# Deployment — SPROW LeadSphere

Two parts that deploy to **different** hosts:

- **Frontend** (Vite + React SPA in `SPROW-LeadSphere/`) → **Cloudflare Workers**
  (static assets)
- **Backend** (FastAPI + Scrapling in `SPROW-LeadSphere/backend/`) → **Render**
  (Docker) — Cloudflare cannot run Python/Scrapling.

Deploy order matters because of the two-way link (frontend needs the API URL at
build time; backend needs the frontend origin for CORS):

```
1) Backend on Render  ->  2) Frontend on Cloudflare  ->  3) CORS back on Render
```

Until `VITE_API_URL` is set, the frontend stays in **demo mode** (fictional
sample leads) — which is safe to publish on its own.

## 1. Backend on Render

Render → **New + → Blueprint** → pick this repo. The root `render.yaml` defines
a Docker web service (`sprow-leadsphere-api`, health check `/health`) built from
`SPROW-LeadSphere/backend/Dockerfile`.

After the first deploy you get a URL like
`https://sprow-leadsphere-api.onrender.com`. Test it:

```bash
curl https://sprow-leadsphere-api.onrender.com/health   # {"status":"ok",...}
```

> The `free` plan sleeps after inactivity (first request is slow) and gives
> 512 MB RAM. Bump the plan in `render.yaml` if you need it always-on.

## 2. Frontend on Cloudflare

Cloudflare → **Workers & Pages → Create → Import a repository** → this repo.

| Setting                | Value                     |
| ---------------------- | ------------------------- |
| Root directory         | `SPROW-LeadSphere`        |
| Build command          | `npm run build`           |
| Deploy command         | `npx wrangler deploy`     |
| Build variable         | `VITE_API_URL` = your Render URL |

`VITE_API_URL` is inlined by Vite **at build time**, so it must be set as a
build variable *before* the build. Deploy → you get a
`https://sprow-leadsphere.<subdomain>.workers.dev` URL.

`wrangler.jsonc` serves `dist/` with SPA routing (`not_found_handling:
single-page-application`).

## 3. CORS back on Render

On the Render service → **Environment** → set:

```
ALLOWED_ORIGINS = https://sprow-leadsphere.<subdomain>.workers.dev
```

(Comma-separate multiple origins.) Redeploy the backend.

## 4. Verify live research

Open the Cloudflare URL. With `VITE_API_URL` set, a **“Live-Modus aktiv”** hint
appears. Enter a company website (e.g. `example.de`) and start the search —
real title / e-mail / phone are extracted via Scrapling. Without a URL (or
without `VITE_API_URL`), the polished demo flow runs unchanged.

## Local development

```bash
# Frontend
cd SPROW-LeadSphere && npm install && npm run dev

# Backend
cd SPROW-LeadSphere/backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
uvicorn app:app --reload --port 8000
```

Point the frontend at the local API with `SPROW-LeadSphere/.env`:

```
VITE_API_URL=http://localhost:8000
```

## Legal / safety note

The backend only accepts public http(s) URLs and blocks private/local network
targets. Collect only public business information and respect applicable law,
site terms and robots rules.
