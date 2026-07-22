"""Database layer for LeadSphere.

Dual backend:
- If DATABASE_URL (postgres…) is set -> PostgreSQL via asyncpg (durable,
  e.g. Supabase). Survives restarts, so the cross-search dedup is permanent.
- Otherwise -> local SQLite via aiosqlite (ephemeral on Render free).

Public async API is identical for both backends.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

_DATABASE_URL = os.getenv("DATABASE_URL", "").strip()
_IS_PG = _DATABASE_URL.startswith(("postgres://", "postgresql://"))
_DB_PATH = os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "leadsphere.db"))

_sqlite_conn = None
_pg_pool = None
_pg_failed = False  # set True if the Postgres connection is misconfigured/unreachable


def _use_pg() -> bool:
    return _IS_PG and not _pg_failed


# ---------------------------------------------------------------------------
# Schema (created_at kept as ISO text in both backends for identical sorting)
# ---------------------------------------------------------------------------

_SCHEMA = """
CREATE TABLE IF NOT EXISTS searches (
    id           TEXT PRIMARY KEY,
    query        TEXT NOT NULL,
    region       TEXT DEFAULT '',
    target       TEXT DEFAULT '',
    source_url   TEXT DEFAULT '',
    status       TEXT DEFAULT 'completed',
    result_count INTEGER DEFAULT 0,
    created_at   TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS leads (
    id          TEXT PRIMARY KEY,
    search_id   TEXT NOT NULL,
    company     TEXT DEFAULT '',
    city        TEXT DEFAULT '',
    website     TEXT DEFAULT '',
    email       TEXT DEFAULT '',
    phone       TEXT DEFAULT '',
    score       INTEGER DEFAULT 0,
    description TEXT DEFAULT '',
    created_at  TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS feedback (
    id         TEXT PRIMARY KEY,
    search_id  TEXT NOT NULL,
    rating     INTEGER NOT NULL,
    comment    TEXT DEFAULT '',
    created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_leads_search ON leads(search_id);
CREATE INDEX IF NOT EXISTS idx_leads_website ON leads(website);
CREATE INDEX IF NOT EXISTS idx_searches_created ON searches(created_at);
"""


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


# ---------------------------------------------------------------------------
# Connection management
# ---------------------------------------------------------------------------

async def _get_sqlite():
    global _sqlite_conn
    if _sqlite_conn is None:
        import aiosqlite
        _sqlite_conn = await aiosqlite.connect(_DB_PATH)
        _sqlite_conn.row_factory = aiosqlite.Row
        await _sqlite_conn.executescript(_SCHEMA)
        await _sqlite_conn.commit()
    return _sqlite_conn


async def _get_pg():
    global _pg_pool
    if _pg_pool is None:
        import asyncpg
        # statement_cache_size=0 keeps us compatible with Supabase's pgbouncer
        # (transaction pooling) connection strings.
        _pg_pool = await asyncpg.create_pool(
            _DATABASE_URL, min_size=1, max_size=5, statement_cache_size=0
        )
        async with _pg_pool.acquire() as con:
            for stmt in filter(str.strip, _SCHEMA.split(";")):
                await con.execute(stmt)
    return _pg_pool


def _to_pg(sql: str) -> str:
    """Translate '?' placeholders into '$1, $2, …' for asyncpg."""
    out, idx = [], 0
    for ch in sql:
        if ch == "?":
            idx += 1
            out.append(f"${idx}")
        else:
            out.append(ch)
    return "".join(out)


def _pg_fallback(exc: Exception):
    """Ein kaputter/erreichbarer DATABASE_URL darf die App nicht lahmlegen —
    einmalig auf SQLite umschalten statt bei jeder Anfrage 500 zu werfen."""
    global _pg_failed
    if not _pg_failed:
        _pg_failed = True
        print(f"[db] Postgres nicht verfügbar -> SQLite-Fallback: {exc}", flush=True)


async def _exec(sql: str, *params):
    if _use_pg():
        try:
            pool = await _get_pg()
            async with pool.acquire() as con:
                await con.execute(_to_pg(sql), *params)
            return
        except Exception as exc:
            _pg_fallback(exc)
    con = await _get_sqlite()
    await con.execute(sql, params)
    await con.commit()


async def _fetch(sql: str, *params) -> list[dict]:
    if _use_pg():
        try:
            pool = await _get_pg()
            async with pool.acquire() as con:
                rows = await con.fetch(_to_pg(sql), *params)
            return [dict(r) for r in rows]
        except Exception as exc:
            _pg_fallback(exc)
    con = await _get_sqlite()
    cur = await con.execute(sql, params)
    rows = await cur.fetchall()
    return [dict(r) for r in rows]


async def ping() -> dict:
    """Trigger a connection and report the effective backend (for /health)."""
    try:
        await _fetch("SELECT 1 AS ok")
    except Exception:
        pass
    return {
        "backend": "postgres" if _use_pg() else "sqlite",
        "pg_configured": _IS_PG,
        "pg_failed": _pg_failed,
    }


# ---------------------------------------------------------------------------
# Searches
# ---------------------------------------------------------------------------

async def create_search(query: str, region: str = "", target: str = "", source_url: str = "") -> dict:
    sid = uuid.uuid4().hex[:12]
    now = _iso_now()
    await _exec(
        "INSERT INTO searches (id, query, region, target, source_url, result_count, created_at) "
        "VALUES (?, ?, ?, ?, ?, 0, ?)",
        sid, query, region, target, source_url, now,
    )
    return {"id": sid, "query": query, "region": region, "target": target,
            "source_url": source_url, "status": "running", "result_count": 0, "created_at": now}


async def finish_search(search_id: str, result_count: int, status: str = "completed"):
    await _exec("UPDATE searches SET status = ?, result_count = ? WHERE id = ?",
                status, result_count, search_id)


async def list_searches(limit: int = 20, offset: int = 0) -> list[dict]:
    return await _fetch(
        "SELECT * FROM searches ORDER BY created_at DESC LIMIT ? OFFSET ?", limit, offset)


async def get_search(search_id: str) -> Optional[dict]:
    rows = await _fetch("SELECT * FROM searches WHERE id = ?", search_id)
    return rows[0] if rows else None


async def delete_search(search_id: str) -> bool:
    await _exec("DELETE FROM leads WHERE search_id = ?", search_id)
    await _exec("DELETE FROM feedback WHERE search_id = ?", search_id)
    if _use_pg():
        rows = await _fetch("DELETE FROM searches WHERE id = ? RETURNING id", search_id)
        return len(rows) > 0
    con = await _get_sqlite()
    cur = await con.execute("DELETE FROM searches WHERE id = ?", (search_id,))
    await con.commit()
    return cur.rowcount > 0


async def get_stats() -> dict:
    total = (await _fetch("SELECT COUNT(*) AS c FROM searches"))[0]["c"]
    total_leads = (await _fetch("SELECT COALESCE(SUM(result_count), 0) AS c FROM searches"))[0]["c"]
    today = _iso_now()[:10]
    today_count = (await _fetch(
        "SELECT COUNT(*) AS c FROM searches WHERE created_at >= ?", today))[0]["c"]
    return {"total_searches": int(total), "total_leads": int(total_leads),
            "today_searches": int(today_count)}


# ---------------------------------------------------------------------------
# Leads
# ---------------------------------------------------------------------------

async def insert_leads(search_id: str, leads: list[dict]) -> int:
    if not leads:
        return 0
    now = _iso_now()
    for lead in leads:
        await _exec(
            "INSERT INTO leads (id, search_id, company, city, website, email, phone, score, description, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            uuid.uuid4().hex[:12], search_id,
            lead.get("company", ""), lead.get("city", ""), lead.get("website", ""),
            lead.get("email", ""), lead.get("phone", ""),
            min(99, max(0, int(lead.get("score", 0)))), lead.get("description", ""), now,
        )
    return len(leads)


async def known_websites() -> set[str]:
    """Alle bereits gefundenen Lead-Websites (für Dubletten-Filter)."""
    rows = await _fetch("SELECT DISTINCT website FROM leads WHERE website != ''")
    return {r["website"] for r in rows if r["website"]}


async def list_leads(search_id: Optional[str] = None, limit: int = 50, offset: int = 0) -> list[dict]:
    if search_id:
        return await _fetch(
            "SELECT * FROM leads WHERE search_id = ? ORDER BY score DESC LIMIT ? OFFSET ?",
            search_id, limit, offset)
    return await _fetch(
        "SELECT * FROM leads ORDER BY created_at DESC LIMIT ? OFFSET ?", limit, offset)


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

async def save_feedback(search_id: str, rating: int, comment: str = "") -> dict:
    fid = uuid.uuid4().hex[:12]
    now = _iso_now()
    await _exec(
        "INSERT INTO feedback (id, search_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?)",
        fid, search_id, rating, comment, now,
    )
    return {"id": fid, "search_id": search_id, "rating": rating, "comment": comment, "created_at": now}
