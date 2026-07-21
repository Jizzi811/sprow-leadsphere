/**
 * Cloudflare Pages Function – API Proxy
 *
 * Fängt alle Requests unter /api/* ab und leitet sie an das
 * Python-Backend (Render) weiter. Wird deployed als Pages Function
 * und läuft direkt auf Cloudflare Workers Infrastruktur.
 *
 * Environment (in Cloudflare Dashboard setzen):
 *   LEADSPHERE_API_URL = https://dein-service.onrender.com
 */

const FALLBACK_BACKEND = "http://localhost:8000";

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // Backend-URL ermitteln
  const backendBase = env?.LEADSPHERE_API_URL || FALLBACK_BACKEND;

  // Pfad ohne /api/-Prefix an den Backend-Service weiterleiten
  const targetPath = url.pathname; // bleibt /api/searches, /api/extract, etc.
  const targetUrl = `${backendBase.replace(/\/+$/, "")}${targetPath}${url.search}`;

  // Request zum Backend weiterleiten
  const headers = new Headers(request.headers);
  headers.set("Host", new URL(backendBase).hostname);
  headers.set("X-Forwarded-Host", url.hostname);
  headers.set("X-Forwarded-Proto", url.protocol.replace(":", ""));

  const backendRequest = new Request(targetUrl, {
    method: request.method,
    headers,
    body: request.method !== "GET" && request.method !== "HEAD" ? request.body : undefined,
    redirect: "follow",
  });

  try {
    const backendResponse = await fetch(backendRequest, {
      signal: AbortSignal.timeout(30000), // 30s timeout für Scrapling
    });

    // Response an den Client zurückgeben
    const responseHeaders = new Headers(backendResponse.headers);
    responseHeaders.set("Access-Control-Allow-Origin", "*");
    responseHeaders.set("X-Proxy", "cloudflare-worker");

    return new Response(backendResponse.body, {
      status: backendResponse.status,
      statusText: backendResponse.statusText,
      headers: responseHeaders,
    });
  } catch (err) {
    // Fallback: falls Backend nicht erreichbar
    return new Response(
      JSON.stringify({
        error: "Backend nicht erreichbar",
        detail: err.message,
        hint: "Prüfe die LEADSPHERE_API_URL Umgebungsvariable im Cloudflare Dashboard.",
      }),
      {
        status: 502,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": "*",
        },
      }
    );
  }
}
