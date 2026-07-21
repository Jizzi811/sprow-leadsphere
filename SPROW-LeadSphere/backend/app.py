"""Optional Scrapling backend for SPROW LeadSphere.

Run this service separately from the static frontend. It only accepts public
http(s) URLs and deliberately rejects local/private network targets.
"""
import os
from ipaddress import ip_address
from socket import getaddrinfo
from urllib.parse import urlparse

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, HttpUrl

app = FastAPI(title="SPROW LeadSphere API", version="0.1.0")

# Comma-separated list of allowed frontend origins. In production set
# ALLOWED_ORIGINS to your deployed frontend URL, e.g.
#   ALLOWED_ORIGINS=https://sprow-leadsphere.<subdomain>.workers.dev
_DEFAULT_ORIGINS = "http://localhost:4173,http://localhost:5173"
ALLOWED_ORIGINS = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", _DEFAULT_ORIGINS).split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


class ExtractRequest(BaseModel):
    url: HttpUrl


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


@app.get("/health")
async def health():
    return {"status": "ok", "engine": "scrapling", "origins": ALLOWED_ORIGINS}


@app.post("/api/extract")
async def extract(payload: ExtractRequest):
    url = str(payload.url)
    assert_public_url(url)
    # Import lazily so the service (and /health) starts even if Scrapling's
    # optional browser extras are not fully provisioned in the runtime.
    try:
        from scrapling.fetchers import AsyncFetcher
    except Exception as exc:  # pragma: no cover - defensive import guard
        raise HTTPException(503, "Scrapling ist auf dem Server nicht verfügbar.") from exc
    try:
        page = await AsyncFetcher.get(url, timeout=25)
    except Exception as exc:
        raise HTTPException(502, f"Zielseite konnte nicht geladen werden: {exc}") from exc
    return {
        "url": url,
        "title": page.css("title::text").get(default=""),
        "description": page.css('meta[name="description"]::attr(content)').get(default=""),
        "emails": sorted(set(page.re(r"[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}", flags=2)))[:20],
        "phones": sorted(set(page.re(r"(?:\+49|0)[\d\s()/.-]{7,}", flags=2)))[:20],
        "text": " ".join(page.css("body ::text").getall())[:8000],
    }
