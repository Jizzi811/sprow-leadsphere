# Monolithic image for SPROW LeadSphere: ONE Render service serving BOTH the
# built React/Vite frontend AND the FastAPI + Scrapling API on the same origin.
#
# Build context is the repository ROOT (Render: dockerfilePath ./Dockerfile,
# NO rootDir) so every path is unambiguous and cannot double up.

# ---- Stage 1: build the React/Vite frontend ----
FROM node:22-slim AS frontend
WORKDIR /build
COPY SPROW-LeadSphere/package.json SPROW-LeadSphere/package-lock.json ./
# wrangler (the only devDependency) is not needed to build the SPA.
RUN npm ci --omit=dev
COPY SPROW-LeadSphere/index.html SPROW-LeadSphere/vite.config.mjs ./
COPY SPROW-LeadSphere/src ./src
# VITE_API_URL is intentionally unset -> the frontend calls the API same-origin
# (relative paths), which is exactly what this monolith serves.
RUN npm run build

# ---- Stage 2: Python backend that also serves the built frontend ----
FROM python:3.12-slim
ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PORT=8000

RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /srv/backend

COPY SPROW-LeadSphere/backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY SPROW-LeadSphere/backend/ ./

# The built SPA lands at /srv/dist; app.py mounts ../dist at "/".
COPY --from=frontend /build/dist /srv/dist

EXPOSE 8000

# Render (and most PaaS) inject $PORT; fall back to 8000 for local `docker run`.
CMD ["sh", "-c", "uvicorn app:app --host 0.0.0.0 --port ${PORT:-8000}"]
