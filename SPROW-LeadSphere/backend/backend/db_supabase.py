"""Supabase-backed implementation of the LeadSphere data layer.

Talks to Supabase's auto-generated REST API (PostgREST) directly via httpx —
no extra SDK dependency needed. Activated automatically by db_router.py when
SUPABASE_URL and SUPABASE_KEY are both set.

Required table schema: see supabase_schema.sql in the project root. Run that
file once in the Supabase SQL editor before switching this on.

Use the *service_role* key (Project Settings -> API), not the public anon
key, since this backend does its own access control and needs to bypass
Row Level Security for inserts coming from the server.
"""
import os
from datetime import datetime, timezone
from typing import Optional

import httpx
from fastapi import HTTPException

SUPABASE_URL = os.getenv("SUPABASE_URL", "").rstrip("/")
SUPABASE_KEY = os.getenv("SUPABASE_KEY", "") or os.getenv("SUPABASE_SERVICE_KEY", "")
_REST = f"{SUPABASE_URL}/rest/v1"
_HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


def _iso_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


async def _client() -> httpx.AsyncClient:
    return httpx.AsyncClient(base_url=_REST, headers=_HEADERS, timeout=15)


def _raise_for_status(resp: httpx.Response, action: str) -> None:
    if resp.status_code >= 400:
        raise HTTPException(
            502, f"Supabase-Fehler bei {action}: {resp.status_code} {resp.text[:300]}"
        )


# ---------------------------------------------------------------------------
# Searches
# ---------------------------------------------------------------------------

async def create_search(query: str, region: str = "", target: str = "", source_url: str = "") -> dict:
    import uuid
    sid = uuid.uuid4().hex[:12]
    now = _iso_now()
    row = {
        "id": sid, "query": query, "region": region, "target": target,
        "source_url": source_url, "status": "running", "result_count": 0,
        "created_at": now,
    }
    async with await _client() as client:
        resp = await client.post(
            "/searches", json=row, headers={**_HEADERS, "Prefer": "return=representation"}
        )
    _raise_for_status(resp, "create_search")
    data = resp.json()
    return data[0] if isinstance(data, list) else row


async def finish_search(search_id: str, result_count: int, status: str = "completed"):
    async with await _client() as client:
        resp = await client.patch(
            f"/searches?id=eq.{search_id}",
            json={"status": status, "result_count": result_count},
        )
    _raise_for_status(resp, "finish_search")


async def list_searches(limit: int = 20, offset: int = 0) -> list[dict]:
    async with await _client() as client:
        resp = await client.get(
            "/searches",
            params={"order": "created_at.desc", "limit": limit, "offset": offset},
        )
    _raise_for_status(resp, "list_searches")
    return resp.json()


async def get_search(search_id: str) -> Optional[dict]:
    async with await _client() as client:
        resp = await client.get("/searches", params={"id": f"eq.{search_id}"})
    _raise_for_status(resp, "get_search")
    rows = resp.json()
    return rows[0] if rows else None


async def delete_search(search_id: str) -> bool:
    async with await _client() as client:
        await client.delete(f"/leads?search_id=eq.{search_id}")
        await client.delete(f"/feedback?search_id=eq.{search_id}")
        resp = await client.delete(
            f"/searches?id=eq.{search_id}",
            headers={**_HEADERS, "Prefer": "return=representation"},
        )
    _raise_for_status(resp, "delete_search")
    return bool(resp.json())


async def get_stats() -> dict:
    async with await _client() as client:
        s_resp = await client.head(
            "/searches", headers={**_HEADERS, "Prefer": "count=exact"}
        )
        today = _iso_now()[:10]
        t_resp = await client.head(
            "/searches",
            params={"created_at": f"gte.{today}"},
            headers={**_HEADERS, "Prefer": "count=exact"},
        )
        leads_resp = await client.get("/searches", params={"select": "result_count"})
    _raise_for_status(leads_resp, "get_stats")

    def _count_from_range(resp: httpx.Response) -> int:
        rng = resp.headers.get("content-range", "")
        if "/" in rng:
            total = rng.split("/")[-1]
            return int(total) if total.isdigit() else 0
        return 0

    total = _count_from_range(s_resp)
    today_count = _count_from_range(t_resp)
    total_leads = sum(r.get("result_count", 0) or 0 for r in leads_resp.json())
    return {"total_searches": total, "total_leads": total_leads, "today_searches": today_count}


# ---------------------------------------------------------------------------
# Leads
# ---------------------------------------------------------------------------

async def insert_leads(search_id: str, leads: list[dict]) -> int:
    if not leads:
        return 0
    import uuid
    now = _iso_now()
    rows = [
        {
            "id": uuid.uuid4().hex[:12],
            "search_id": search_id,
            "company": lead.get("company", ""),
            "city": lead.get("city", ""),
            "website": lead.get("website", ""),
            "email": lead.get("email", ""),
            "phone": lead.get("phone", ""),
            "score": min(99, max(0, lead.get("score", 0))),
            "description": lead.get("description", ""),
            "created_at": now,
        }
        for lead in leads
    ]
    async with await _client() as client:
        resp = await client.post("/leads", json=rows)
    _raise_for_status(resp, "insert_leads")
    return len(rows)


async def known_websites() -> set[str]:
    """Alle bereits gefundenen Lead-Websites (für Dubletten-Filter)."""
    async with await _client() as client:
        resp = await client.get("/leads", params={"select": "website", "website": "neq."})
    _raise_for_status(resp, "known_websites")
    return {row["website"] for row in resp.json() if row.get("website")}


async def list_leads(search_id: Optional[str] = None, limit: int = 50, offset: int = 0) -> list[dict]:
    params = {"order": "score.desc", "limit": limit, "offset": offset}
    if search_id:
        params["search_id"] = f"eq.{search_id}"
    else:
        params["order"] = "created_at.desc"
    async with await _client() as client:
        resp = await client.get("/leads", params=params)
    _raise_for_status(resp, "list_leads")
    return resp.json()


# ---------------------------------------------------------------------------
# Feedback
# ---------------------------------------------------------------------------

async def save_feedback(search_id: str, rating: int, comment: str = "") -> dict:
    import uuid
    fid = uuid.uuid4().hex[:12]
    now = _iso_now()
    row = {"id": fid, "search_id": search_id, "rating": rating, "comment": comment, "created_at": now}
    async with await _client() as client:
        resp = await client.post(
            "/feedback", json=row, headers={**_HEADERS, "Prefer": "return=representation"}
        )
    _raise_for_status(resp, "save_feedback")
    data = resp.json()
    return data[0] if isinstance(data, list) else row
