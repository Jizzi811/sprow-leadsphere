# Deployment — SPROW LeadSphere (single Render service)

SPROW LeadSphere deploys as **one monolithic Render web service** that serves
both the built React/Vite frontend and the FastAPI + Scrapling API on the same
origin. No Cloudflare, no CORS, no `VITE_API_URL` — the frontend calls the API
with relative paths, which the same service answers.

```
Browser ──HTTPS──▶  Render web service (Docker)
                      ├─ /            → built SPA (StaticFiles)
                      ├─ /assets/*    → JS/CSS
                      ├─ /health      → health check
                      └─ /api/*       → FastAPI + Scrapling + SQLite
```

The multi-stage `SPROW-LeadSphere/Dockerfile` builds the frontend (Node stage)
and copies it into the Python image, where `app.py` mounts it at `/`.

## Deploy (fresh, via Blueprint)

1. In Render: **New + → Blueprint → connect `Jizzi811/sprow-leadsphere` → Apply.**
   The root `render.yaml` defines the service (`sprow-leadsphere-api`, Docker,
   root directory `SPROW-LeadSphere`, health check `/health`, free plan).
2. Wait for the build (Node build + `scrapling[all]` install take a few minutes).
3. Open the service URL — the SPROW LeadSphere app loads and live research works
   immediately (the frontend auto-detects the same-origin backend via `/health`).

## Fixing an EXISTING service that shows 404 at `/`

If a `sprow-leadsphere-api` service already exists but only `/health` works
(the frontend was not in the image), update its build settings so it uses the
monolithic Dockerfile:

**Render → sprow-leadsphere-api → Settings → Build & Deploy:**

| Setting         | Value                |
| --------------- | -------------------- |
| Root Directory  | `SPROW-LeadSphere`   |
| Dockerfile Path | `./Dockerfile`       |

Save, then **Manual Deploy → Deploy latest commit**. (The old service pointed at
`backend/Dockerfile`, which built the API only — that file has been removed in
favour of the single monolithic Dockerfile.)

## Data persistence

SQLite lives inside the container and is **ephemeral on the free plan** — saved
searches/leads reset when the instance restarts or wakes from sleep, and the
free instance spins down after inactivity (first request can take ~50 s).

For durable storage, either:
- switch to a paid plan and attach a disk (uncomment the `disk` + `DATABASE_PATH`
  block in `render.yaml`), or
- move the DB layer in `backend/database.py` to an external DB (e.g. Supabase/
  Postgres) — it is isolated behind a small async interface for this reason.

## Local development

```bash
# Backend (terminal 1)
cd SPROW-LeadSphere/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000

# Frontend (terminal 2) — talks to the backend via VITE_API_URL
cd SPROW-LeadSphere
npm install
echo "VITE_API_URL=http://localhost:8000" > .env
npm run dev
```

In production the frontend is served by the backend, so `VITE_API_URL` stays
empty and all calls are same-origin.

## Legal / safety note

The `/api/extract` endpoint only accepts public http(s) URLs and blocks
private/local network targets. Collect only public business information and
respect applicable law, site terms and robots rules.
