"""Picks the active data layer at import time.

- If SUPABASE_URL and SUPABASE_KEY (or SUPABASE_SERVICE_KEY) are set ->
  use Supabase (Postgres via REST), which persists across restarts/deploys.
- Otherwise -> fall back to the local SQLite file (backend/database.py),
  which is fine for local dev but does NOT reliably persist on Render's
  free tier (ephemeral disk unless a paid persistent disk is attached).

app.py just does `import db_router as db` and calls the same functions
either way — the two modules expose an identical async interface.
"""
import os

USING_SUPABASE = bool(os.getenv("SUPABASE_URL")) and bool(
    os.getenv("SUPABASE_KEY") or os.getenv("SUPABASE_SERVICE_KEY")
)

if USING_SUPABASE:
    from db_supabase import (  # noqa: F401
        create_search,
        finish_search,
        list_searches,
        get_search,
        delete_search,
        get_stats,
        insert_leads,
        known_websites,
        list_leads,
        save_feedback,
    )
    BACKEND_NAME = "supabase"
else:
    from database import (  # noqa: F401
        create_search,
        finish_search,
        list_searches,
        get_search,
        delete_search,
        get_stats,
        insert_leads,
        known_websites,
        list_leads,
        save_feedback,
    )
    BACKEND_NAME = "sqlite"
