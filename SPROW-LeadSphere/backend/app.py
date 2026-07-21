"""SPROW LeadSphere API — Full production-ready backend.

- /api/extract   – Scrapling-based public URL extraction
- /api/searches  – Search history CRUD (SQLite)
- /api/leads     – Lead results per search
- /api/stats     – Dashboard statistics
- /api/feedback  – User feedback on search quality
"""
import os
import re
from ipaddress import ip_address
from socket import getaddrinfo
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, HttpUrl, Field

import sys; sys.path.insert(0, os.path.dirname(__file__))
import database as db

app = FastAPI(title="SPROW LeadSphere API", version="1.0.0")

# ---- CORS ----
# In production, set ALLOWED_ORIGINS to your Cloudflare Pages domain, e.g.:
#   ALLOWED_ORIGINS=https://sprow-leadsphere.pages.dev
_DEFAULT_ORIGINS = "http://localhost:4173,http://localhost:5173,https://*.onrender.com,https://*.pages.dev"
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.getenv("ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",")
    if o.strip()
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- Pydantic models ----
class ExtractRequest(BaseModel):
    url: HttpUrl


class SearchRequest(BaseModel):
    query: str = Field(min_length=1, max_length=500)
    region: str = ""
    target: str = ""


class FeedbackCreate(BaseModel):
    search_id: str = Field(min_length=1)
    rating: int = Field(ge=1, le=5)
    comment: str = ""


class LeadsBatch(BaseModel):
    search_id: str = Field(min_length=1)
    leads: list[dict] = Field(default_factory=list, max_length=50)


class SearchUpdate(BaseModel):
    status: str | None = None
    result_count: int | None = None


# ---- Security ----
def assert_public_url(raw_url: str) -> None:
    parsed = urlparse(raw_url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname:
        raise HTTPException(400, "Nur öffentliche HTTP(S)-Adressen sind erlaubt.")
    try:
        addresses = {item[4][0] for item in getaddrinfo(parsed.hostname, None)}
    except OSError as exc:
        raise HTTPException(400, "Domain konnte nicht aufgelöst werden.") from exc
    for address in addresses:
        ip = ip_address(address)
        if not ip.is_global:
            raise HTTPException(400, "Lokale oder private Netzwerkziele sind gesperrt.")


def extract_emails(text: str) -> list[str]:
    return sorted(set(
        m.group(0).lower()
        for m in re.finditer(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", text, re.I)
        if not m.group(0).lower().endswith((".png", ".jpg", ".gif", ".css", ".js"))
    ))[:20]


def extract_phones(text: str) -> list[str]:
    return sorted(set(
        m.group(0).strip()
        for m in re.finditer(r"(?:\+49|0)[\d\s()/.-]{7,}", text)
    ))[:20]


# ---- Health ----
@app.get("/health")
async def health():
    return {"status": "ok", "engine": "scrapling", "version": "1.0.0",
            "db": _DB_PATH if (_DB_PATH := os.getenv("DATABASE_PATH", "leadsphere.db")) else ":memory:",
            "origins": ALLOWED_ORIGINS}


# ---- Extract ----
@app.post("/api/extract")
async def extract(payload: ExtractRequest):
    url = str(payload.url)
    assert_public_url(url)
    try:
        from scrapling.fetchers import AsyncFetcher
    except Exception as exc:
        raise HTTPException(503, "Scrapling ist auf dem Server nicht verfügbar.") from exc

    try:
        page = await AsyncFetcher.get(url, timeout=25)
    except Exception as exc:
        raise HTTPException(502, f"Zielseite konnte nicht geladen werden: {exc}") from exc

    title = page.css("title::text").get(default="")
    desc = page.css('meta[name="description"]::attr(content)').get(default="")
    body_text = " ".join(page.css("body ::text").getall())[:8000]
    emails = extract_emails(body_text)
    phones = extract_phones(body_text)

    # Extract company from title or domain
    domain = urlparse(url).hostname or ""
    company = title or domain.replace("www.", "").split(".")[0].capitalize()

    result = {
        "url": url,
        "title": title,
        "description": desc,
        "company": company,
        "emails": emails,
        "phones": phones,
        "text_preview": body_text[:500],
    }
    return result


# ---- Searches ----
@app.post("/api/searches")
async def create_search(payload: SearchRequest):
    search = await db.create_search(
        query=payload.query,
        region=payload.region,
        target=payload.target,
    )
    return search


@app.get("/api/searches")
async def list_searches(limit: int = Query(20, ge=1, le=100), offset: int = Query(0, ge=0)):
    searches = await db.list_searches(limit=limit, offset=offset)
    return searches


@app.get("/api/searches/{search_id}")
async def get_search(search_id: str):
    s = await db.get_search(search_id)
    if not s:
        raise HTTPException(404, "Recherche nicht gefunden.")
    return s


@app.delete("/api/searches/{search_id}")
async def delete_search(search_id: str):
    ok = await db.delete_search(search_id)
    if not ok:
        raise HTTPException(404, "Recherche nicht gefunden.")
    return {"deleted": True}


# ---- Search update ----
@app.patch("/api/searches/{search_id}")
async def update_search(search_id: str, payload: SearchUpdate):
    s = await db.get_search(search_id)
    if not s:
        raise HTTPException(404, "Recherche nicht gefunden.")
    if payload.status is not None:
        s["status"] = payload.status
    if payload.result_count is not None:
        s["result_count"] = payload.result_count
    await db.finish_search(search_id, s["result_count"], s["status"])
    return await db.get_search(search_id)


# ---- Leads ----
@app.post("/api/leads")
async def save_leads(payload: LeadsBatch):
    count = await db.insert_leads(payload.search_id, payload.leads)
    return {"inserted": count}


@app.get("/api/leads")
async def list_leads(
    search_id: str = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
):
    leads = await db.list_leads(search_id=search_id, limit=limit, offset=offset)
    return leads


# ---- Stats ----
@app.get("/api/stats")
async def stats():
    return await db.get_stats()


# ---- Feedback ----
@app.post("/api/feedback")
async def create_feedback(payload: FeedbackCreate):
    fb = await db.save_feedback(
        search_id=payload.search_id,
        rating=payload.rating,
        comment=payload.comment,
    )
    return fb


# ---- Static frontend (production) ----
_frontend_dist = os.path.join(os.path.dirname(__file__), "..", "dist")
if os.path.isdir(_frontend_dist):
    app.mount("/", StaticFiles(directory=_frontend_dist, html=True), name="frontend")
