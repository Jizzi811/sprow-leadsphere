# SPROW LeadSphere

Responsive React prototype for Gabi Sprow with an animated particle agent,
research filters, interactive demo flow, lead results and CSV export.

## Frontend

```bash
npm install
npm run dev
```

The frontend deliberately starts in demo mode. The sample companies are
fictional and are not real scraped leads.

## Optional Scrapling API

Scrapling needs a Python server or container and cannot run inside a static
Cloudflare Pages frontend.

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
scrapling install
uvicorn app:app --reload --port 8000
```

The extraction endpoint blocks private/local network targets. Before public
deployment, configure the exact frontend origin in `backend/app.py`, add rate
limits, authentication and a reviewed allow/deny policy. Only collect public
business information and respect applicable law, site terms and robots rules.

## Production architecture

- Static React frontend: Cloudflare Pages
- Scrapling Python API: Railway, Render, Fly.io or a VPS/container
- Database (later): Supabase/Postgres for saved searches and deduplication
