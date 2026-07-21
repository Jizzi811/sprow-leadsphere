/**
 * Cloudflare Pages Functions – API Middleware
 *
 * Setzt CORS-Header für alle /api/*-Antworten und liest die
 * Backend-URL aus der Environment-Variable LEADSPHERE_API_URL.
 * Fallback auf den Render-Service.
 */
const BACKEND_URL =
  (typeof process !== "undefined" && process.env?.LEADSPHERE_API_URL) ||
  (typeof BACKEND_URL_ENV !== "undefined" ? BACKEND_URL_ENV : null) ||
  "http://localhost:8000";

export async function onRequest({ request, next, env }) {
  const url = new URL(request.url);

  // Backend-URL aus verschiedenen Quellen lesen
  const backendBase =
    env?.LEADSPHERE_API_URL ||
    BACKEND_URL;

  const response = await next(request);

  // CORS-Header setzen (erlaubt Frontend-Zugriff vom selben Origin)
  const origin = request.headers.get("Origin") || "*";
  const headers = new Headers(response.headers);

  headers.set("Access-Control-Allow-Origin", origin);
  headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("X-Backend-URL", backendBase);
  headers.set("X-Frame-Options", "DENY");
  headers.set("X-Content-Type-Options", "nosniff");

  // Preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers,
    });
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}
