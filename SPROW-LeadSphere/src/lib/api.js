/**
 * SPROW LeadSphere API client.
 * Handles communication with the FastAPI/Scrapling backend.
 */

function baseUrl() {
  const raw = import.meta.env.VITE_API_URL || "";
  return raw.replace(/\/+$/, "");
}

async function request(path, options = {}) {
  const url = `${baseUrl()}${path}`;
  const headers = { "Content-Type": "application/json", ...options.headers };
  const res = await fetch(url, { ...options, headers });
  if (!res.ok) {
    let detail = `Server antwortete mit ${res.status}`;
    try {
      const err = await res.json();
      detail = err.detail || err.error || detail;
    } catch {
      // ignore parse errors
    }
    throw new Error(detail);
  }
  return res.json();
}

// ---- Health ----
export async function checkHealth() {
  try {
    const data = await request("/health");
    return data;
  } catch {
    return null;
  }
}

// ---- Extract (single website) ----
export async function extractUrl(url) {
  return request("/api/extract", {
    method: "POST",
    body: JSON.stringify({ url }),
  });
}

// ---- Discover (description -> web search -> extraction) ----
export async function discover(query, region = "", target = "") {
  return request("/api/discover", {
    method: "POST",
    body: JSON.stringify({ query, region, target }),
  });
}

// ---- Searches ----
export async function createSearch(query, region = "", target = "") {
  return request("/api/searches", {
    method: "POST",
    body: JSON.stringify({ query, region, target }),
  });
}

export async function listSearches(limit = 50, offset = 0) {
  return request(`/api/searches?limit=${limit}&offset=${offset}`);
}

export async function getSearch(searchId) {
  return request(`/api/searches/${searchId}`);
}

export async function deleteSearch(searchId) {
  return request(`/api/searches/${searchId}`, { method: "DELETE" });
}

// ---- Leads ----
export async function listLeads(searchId = null, limit = 100, offset = 0) {
  let path = `/api/leads?limit=${limit}&offset=${offset}`;
  if (searchId) path += `&search_id=${searchId}`;
  return request(path);
}

// ---- Search update ----
export async function finishSearch(searchId, resultCount, status = "completed") {
  return request(`/api/searches/${searchId}`, {
    method: "PATCH",
    body: JSON.stringify({ status, result_count: resultCount }),
  });
}


// ---- Save leads ----
export async function saveLeads(searchId, leads) {
  return request("/api/leads", {
    method: "POST",
    body: JSON.stringify({ search_id: searchId, leads }),
  });
}


// ---- Stats ----
export async function getStats() {
  return request("/api/stats");
}

// ---- Feedback ----
export async function submitFeedback(searchId, rating, comment = "") {
  return request("/api/feedback", {
    method: "POST",
    body: JSON.stringify({ search_id: searchId, rating, comment }),
  });
}

// ---- Demo / offline fallback ----
export const DEMO_LEADS = [
  { company: "RheinRuhr Hausverwaltung GmbH", city: "Essen", website: "rheinruhr-hv.de", email: "kontakt@rheinruhr-hv.de", phone: "", score: 96 },
  { company: "Bergische Wohnwerte GmbH", city: "Wuppertal", website: "bergische-wohnwerte.de", email: "info@bergische-wohnwerte.de", phone: "", score: 92 },
  { company: "Haus & Grund Objektservice", city: "Düsseldorf", website: "hg-objektservice.de", email: "service@hg-objektservice.de", phone: "", score: 89 },
  { company: "WestImmo Verwaltung KG", city: "Duisburg", website: "westimmo-verwaltung.de", email: "office@westimmo-verwaltung.de", phone: "", score: 87 },
  { company: "Domus Rheinland GmbH", city: "Köln", website: "domus-rheinland.de", email: "kontakt@domus-rheinland.de", phone: "", score: 84 },
];
