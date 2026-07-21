# SPROW LeadSphere – Deployment Guide

## Architektur (mit Cloudflare Workers)

```
Browser
   │
   ▼
Cloudflare Pages + Workers (ein Service)
   ├── Statische Assets (React Frontend)
   ├── Pages Functions (API-Proxy)
   │        └── functions/api/[[path]].js
   │                 │
   │                 ▼  (nur /api/*)
   │         Python Backend auf Render
   │         FastAPI + Scrapling + SQLite
   │
   └── Alles auf einer Domain → keine CORS-Probleme!
```

**Vorteil:** Frontend UND API laufen unter derselben Domain.
Kein separates CORS-Setup nötig. Der Worker proxy-t alle `/api/*`-Aufrufe unsichtbar an Render.

---

## 1. Cloudflare Workers API-Keys besorgen

Du brauchst 2 Keys aus deinem Cloudflare Dashboard:

| Key | Beschreibung |
|---|---|
| `CLOUDFLARE_API_TOKEN` | API-Token mit Berechtigung "Workers Scripts: Edit" |
| `CLOUDFLARE_ACCOUNT_ID` | Deine Account ID (im Dashboard rechts unten) |

**So erstellst du den API-Token:**
1. [Cloudflare Dashboard](https://dash.cloudflare.com) → "My Profile" → "API Tokens"
2. "Create Token" → "Edit Cloudflare Workers"
3. Token kopieren → in Freebuff Keys Tab als `CLOUDFLARE_API_TOKEN` einfügen
4. Account ID kopieren → als `CLOUDFLARE_ACCOUNT_ID` einfügen

---

## 2. Backend auf Render deployen

1. [Render.com](https://render.com) Account erstellen (kostenlos)
2. "New +" → "Web Service" → GitHub Repository verbinden
3. **Root Directory:** `backend`
4. **Runtime:** `Docker`
5. **Health Check Path:** `/health`
6. **Disk:** 1 GB unter `/var/data` (für SQLite-Persistenz)
7. **Env-Vars:**
   - `ALLOWED_ORIGINS` = `*` (wird vom Worker gehandhabt)
   - `DATABASE_PATH` = `/var/data/leadsphere.db`
   - `PORT` = `8000`
8. Nach dem Deploy: URL notieren, z.B. `https://sprow-leadsphere-api.onrender.com`

---

## 3. Workers + Frontend deployen

### Cloudflare Pages Projekt mit Functions

1. Cloudflare Dashboard → "Workers & Pages" → "Create" → "Pages" → "Connect to Git"
2. Repository `Jizzi811/sprow-leadsphere` auswählen
3. Build-Einstellungen:

| Feld | Wert |
|---|---|
| **Root directory** | `SPROW-LeadSphere` |
| **Build command** | `npm run build` |
| **Build output directory** | `dist` |

4. **Environment Variables (Production):**

| Variable | Wert | Zweck |
|---|---|---|
| `LEADSPHERE_API_URL` | `https://dein-service.onrender.com` | Backend-URL für den Worker-Proxy |

5. "Save and Deploy" klicken
6. Die Pages Functions (`functions/api/[[path]].js`) werden automatisch deployed!
7. Fertige URL: `https://sprow-leadsphere.pages.dev`

> Der Worker in `functions/api/[[path]].js` leitet alle `/api/*`-Requests
> automatisch an dein Render-Backend weiter. Das Frontend spricht nur noch
> die Pages-Domain an → keine CORS-Fehler mehr!

---

## 4. Lokal entwickeln mit Worker

```bash
cd SPROW-LeadSphere

# Frontend + Worker lokal testen
LEADSPHERE_API_URL=http://localhost:8000 npm run dev:worker

# Oder einzeln:
npm run dev                  # Nur Frontend (Vite)
cd backend && uvicorn app:app --reload --port 8000   # Nur Backend
```

---

## 5. Umgebungsvariablen (Übersicht)

### Keys Tab (Freebuff / Cloudflare Dashboard)

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | ✅ Ja | API-Token für Worker-Deployment |
| `CLOUDFLARE_ACCOUNT_ID` | ✅ Ja | Deine Cloudflare Account ID |

### Cloudflare Pages Environment

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `LEADSPHERE_API_URL` | ✅ Ja | Backend-URL (z.B. `https://api.onrender.com`) |

### Render Backend

| Variable | Pflicht | Beschreibung |
|---|---|---|
| `ALLOWED_ORIGINS` | ✅ Ja | Auf `*` setzen (wird vom Worker gemanagt) |
| `DATABASE_PATH` | ❌ Optional | SQLite-Pfad (empfohlen: `/var/data/leadsphere.db`) |
| `PORT` | ✅ Ja | `8000` |

---

## 6. Kosten

| Service | Kosten | Details |
|---|---|---|
| **Cloudflare Pages** | **€0** | Unbegrenzte Bandbreite, 500 Builds/Monat |
| **Cloudflare Workers** | **€0** | 100.000 Anfragen/Tag im Free Tier |
| **Render** | **€0** | 750 Stunden/Monat, 512 MB RAM |

Alles bleibt im Free Tier – auch wenn deine Freundin mit sucht.
