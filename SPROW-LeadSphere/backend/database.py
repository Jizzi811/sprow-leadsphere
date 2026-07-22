"""Async SQLite database layer for SPROW LeadSphere.

Uses aiosqlite with a single reusable connection to avoid thread-restart issues.
Easily swappable to PostgreSQL/Supabase by replacing this module.
"""
import os
import uuid
from datetime import datetime, timezone
from typing import Optional

import aiosqlite

_DB_PATH = os.getenv("DATABASE_PATH", os.path.join(os.path.dirname(__file__), "leadsphere.db"))

# Global connection (lazily initialised, reused across requests)
_conn: Optional[aiosqlite.Connection] = None


# ---------------------------------------------------------------------------
# Schema
# ---------------------------------------------------------------------------

_SCHEMA = """
CREATE TABLE IF NOT EXISTS searches (
    id          TEXT PRIMARY KEY,
    query       TEXT NOT NULL,
    region      TEXT DEFAULT '',
    target      TEXT DEFAULT '',
    source_url  TEXT DEFAULT '',
    status      TEXT DEFAULT 'completed',
    result_count INTEGER DEFAULT 0,
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS leads (
    id          TEXT PRIMARY KEY,
    search_id   TEXT NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
    company     TEXT NOT NULL DEFAULT '',
    city        TEXT DEFAULT '',
    website     TEXT DEFAULT '',
    email       TEXT DEFAULT '',
    phone       TEXT DEFAULT '',
    score       INTEGER DEFAULT 0,
    description TEXT DEFAULT '',
    created_at  TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
    id          TEXT PRIMARY KEY,
    search_id   TEXT NOT NULL REFERENCES searches(id) ON DELETE CASCADE,
    rating      INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
    comment     TEXT DEFAULT '',
    created_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_leads_search ON leads(search_id);
CREATE INDEX IF NOT EXISTS idx_searches_created ON searches(created_at DESC);
"""


# ---------------------------------------------------------------------------
# Connection management – single shared connection
# ---------------------------------------------------------------------------

async def get_db() -> aiosqlite.Connection:
    """Return a shared connection, creating it on first call."""
    global _conn
    if _conn is None:
        _conn = await aiosqlite.connect(_DB_PATH)
        _conn.row_factory = aiosqlite.Row
        await _conn.executescript(_SCHEMA)
        await _conn.commit()
    return _conn


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


async def _execute(sql: str, params=()):
    """Helper: acquire the shared connection and execute."""
    db = await get_db()
    c = await db.execute(sql, params)
    await db.commit()
    return c


# ---------------------------------------------------------------------------
# Searches CRUD
# ---------------------------------------------------------------------------

async def create_search(
    query: str,
    region: str = "",
    target: str = "",
    source_url: str = "",
) -> dict:
    sid = uuid.uuid4().hex[:12]
    now = _iso_now()
    db = await get_db()
    await db.execute(
        "INSERT INTO searches (id, query, region, target, source_url, result_count, created_at) "
        "VALUES (?, ?, ?, ?, ?, 0, ?)",
        (sid, query, region, target, source_url, now),
    )
    await db.commit()
    return {"id": sid, "query": query, "region": region, "target": target,
            "source_url": source_url, "status": "running", "result_count": 0, "created_at": now}


async def finish_search(search_id: str, result_count: int, status: str = "completed"):
    db = await get_db()
    await db.execute(
        "UPDATE searches SET status=?, result_count=? WHERE id=?",
        (status, result_count, search_id),
    )
    await db.commit()


async def list_searches(limit: int = 20, offset: int = 0) -> list[dict]:
    db = await get_db()
    rows = await db.execute_fetchall(
        "SELECT * FROM searches ORDER BY created_at DESC LIMIT ? OFFSET ?",
        (limit, offset),
    )
    return [dict(r) for r in rows]


async def get_search(search_id: str) -> Optional[dict]:
    db = await get_db()
    row = await db.execute_fetchall("SELECT * FROM searches WHERE id=?", (search_id,))
    return dict(row[0]) if row else None


async def delete_search(search_id: str) -> bool:
    db = await get_db()
    await db.execute("DELETE FROM leads WHERE search_id=?", (search_id,))
    await db.execute("DELETE FROM feedback WHERE search_id=?", (search_id,))
    c = await db.execute("DELETE FROM searches WHERE id=?", (search_id,))
    await db.commit()
    return c.rowcount > 0


async def get_stats() -> dict:
    db = await get_db()
    total = (await db.execute_fetchall("SELECT COUNT(*) FROM searches"))[0][0]
    total_leads = (await db.execute_fetchall("SELECT COALESCE(SUM(result_count),0) FROM searches"))[0][0]
    today = _iso_now()[:10]
    today_count = (await db.execute_fetchall(
        "SELECT COUNT(*) FROM searches WHERE created_at >= ?", (today,)
    ))[0][0]
    return {"total_searches": total, "total_leads": total_leads, "today_searches": today_count}


# ---------------------------------------------------------------------------
# Leads CRUD
# ---------------------------------------------------------------------------

async def insert_leads(search_id: str, leads: list[dict]) -> int:
    if not leads:
        return 0
    now = _iso_now()
    rows = []
    for lead in leads:
        rows.append((
            uuid.uuid4().hex[:12],
            search_id,
            lead.get("company", ""),
            lead.get("city", ""),
            lead.get("website", ""),
            lead.get("email", ""),
            lead.get("phone", ""),
            min(99, max(0, lead.get("score", 0))),
            lead.get("description", ""),
            now,
        ))
    db = await get_db()
    await db.executemany(
        "INSERT INTO leads (id, search_id, company, city, website, email, phone, score, description, created_at) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        rows,
    )
    await db.commit()
    return len(rows)


async def known_websites() -> set[str]:
    """Alle bereits gefundenen Lead-Websites (für Dubletten-Filter)."""
    db = await get_db()
    rows = await db.execute_fetchall("SELECT DISTINCT website FROM leads WHERE website != ''")
    return {r[0] for r in rows if r[0]}


async def list_leads(search_id: Optional[str] = None, limit: int = 50, offset: int = 0) -> list[dict]:
    db = await get_db()
    if search_id:
        rows = await db.execute_fetchall(
            "SELECT * FROM leads WHERE search_id=? ORDER BY score DESC LIMIT ? OFFSET ?",
            (search_id, limit, offset),
        )
    else:
        rows = await db.execute_fetchall(
            "SELECT * FROM leads ORDER BY created_at DESC LIMIT ? OFFSET ?",
            (limit, offset),
        )
    return [dict(r) for r in rows]


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

async def save_feedback(search_id: str, rating: int, comment: str = "") -> dict:
    fid = uuid.uuid4().hex[:12]
    now = _iso_now()
    db = await get_db()
    await db.execute(
        "INSERT INTO feedback (id, search_id, rating, comment, created_at) VALUES (?, ?, ?, ?, ?)",
        (fid, search_id, rating, comment, now),
    )
    await db.commit()
    return {"id": fid, "search_id": search_id, "rating": rating, "comment": comment, "created_at": now}
