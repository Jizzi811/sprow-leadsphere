import { useEffect, useRef, useState, useCallback } from "react";
import { SquaresFour, X, Users, Clock, DownloadSimple } from "@phosphor-icons/react";
import { Sidebar } from "./components/Sidebar.jsx";
import { SearchPanel } from "./components/SearchPanel.jsx";
import { LeadsTable } from "./components/LeadsTable.jsx";
import { HistoryTable } from "./components/HistoryTable.jsx";
import { Dashboard } from "./components/Dashboard.jsx";
import { ParticleOrb } from "./components/ParticleOrb.jsx";
import { VERTICALS } from "./lib/verticals.js";
import * as api from "./lib/api.js";

function useToast() {
  const [toast, setToast] = useState({ message: "", type: "success", visible: false });
  const show = useCallback((msg, type = "success") => {
    setToast({ message: msg, type, visible: true });
  }, []);
  const close = useCallback(() => {
    setToast((s) => ({ ...s, visible: false }));
  }, []);
  return { toast, show, close };
}

function Toast({ toast, onClose }) {
  useEffect(() => {
    if (!toast.visible) return;
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [toast.visible, onClose]);
  if (!toast.visible) return null;
  return (
    <div className={`toast toast-${toast.type}`}>
      <span>{toast.message}</span>
      <button onClick={onClose}><X size={14} /></button>
    </div>
  );
}

const DEMO_RUNS = [
  { query: "Hausverwaltungen in NRW", region: "Nordrhein-Westfalen", target: "Hausverwaltungen", result_count: 1248, created_at: "21.07.2026, 09:15" },
  { query: "Projektentwickler für Solarparks in Bayern", region: "Bayern", target: "Projektentwickler", result_count: 342, created_at: "20.07.2026, 16:42" },
  { query: "Industriebetriebe mit 500+ Mitarbeitenden", region: "Baden-Württemberg", target: "Industrie", result_count: 876, created_at: "20.07.2026, 10:03" },
  { query: "Kommunen mit öffentlichen Liegenschaften", region: "Hessen", target: "Kommunen", result_count: 421, created_at: "19.07.2026, 14:21" },
  { query: "Wohnungsbaugesellschaften in Hamburg", region: "Hamburg", target: "Wohnungsunternehmen", result_count: 198, created_at: "18.07.2026, 11:37" },
];

export function App() {
  const [active, setActive] = useState("Neue Recherche");
  const [vertical, setVertical] = useState(VERTICALS[0]);
  const [keywords, setKeywords] = useState(VERTICALS[0].keywords);
  const [query, setQuery] = useState("");
  const [region, setRegion] = useState("Nordrhein-Westfalen");
  const [target, setTarget] = useState(VERTICALS[0].targets[0]);
  const [searching, setSearching] = useState(false);
  const [live, setLive] = useState(false);
  const [progress, setProgress] = useState(0);
  const [leads, setLeads] = useState([]);
  const [searches, setSearches] = useState(DEMO_RUNS);
  const [allLeads, setAllLeads] = useState([]);
  const [notice, setNotice] = useState("");
  const [hasBackend, setHasBackend] = useState(false);
  const [backendLoading, setBackendLoading] = useState(true);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const { toast, show: showToast, close: closeToast } = useToast();

  // ---- Backend detection ----
  useEffect(() => {
    (async () => {
      try {
        const h = await api.checkHealth();
        if (h && h.status === "ok") {
          setHasBackend(true);
          const [s, l] = await Promise.all([api.listSearches(50, 0), api.listLeads(null, 200, 0)]);
          setSearches(s);
          setAllLeads(l);
        }
      } catch {
        // offline mode is fine
      } finally {
        setBackendLoading(false);
      }
    })();
  }, []);

  // ---- Progress simulation ----
  const progressRef = useRef(null);
  useEffect(() => {
    if (!searching) return;
    progressRef.current = setInterval(() => {
      setProgress((p) => Math.min(p + 7, 100));
    }, 140);
    return () => clearInterval(progressRef.current);
  }, [searching]);

  // ---- Search completion (demo mode) ----
  useEffect(() => {
    if (progress !== 100 || !searching) return;
    setSearching(false);
    if (!hasBackend) {
      setLeads(api.DEMO_LEADS);
      const entry = {
        query: query.replace(/^Finde\s+/i, ""),
        region,
        target,
        result_count: 5,
        created_at: new Date().toLocaleString("de-DE"),
      };
      setSearches((s) => [entry, ...s].slice(0, 20));
      setNotice("5 passende Geschäftskontakte gefunden und geprüft.");
    }
  }, [progress, searching, hasBackend, query, region, target]);

  // ---- Live extraction ----
  const runLiveExtraction = useCallback(async (url) => {
    const targetUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;
    let host = url;
    try { host = new URL(targetUrl).hostname.replace(/^www\./, ""); } catch { /* noop */ }

    setLive(true);
    setLeads([]);
    setProgress(0);
    setNotice(`Live-Extraktion läuft: ${host} …`);

    try {
      // Create search record
      const search = await api.createSearch(host, region, target);
      const data = await api.extractUrl(targetUrl);

      const extracted = [{
        company: data.company || data.title || host,
        city: data.phones?.[0] || "—",
        website: host,
        email: data.emails?.[0] || "—",
        phone: data.phones?.[0] || "—",
        score: Math.min(99, 45 + (data.emails?.length || 0) * 15 + (data.phones?.length || 0) * 10),
      }];
      setLeads(extracted);
      await api.finishSearch(search.id, extracted.length);

      const [s, l] = await Promise.all([api.listSearches(50, 0), api.listLeads(null, 200, 0)]);
      setSearches(s);
      setAllLeads(l);

      setNotice(
        extracted.length
          ? `Echte Kontaktdaten von ${host} extrahiert.`
          : `${host} geprüft – keine öffentlichen Kontaktdaten gefunden.`
      );
    } catch (err) {
      setNotice(`Live-Extraktion fehlgeschlagen: ${err.message}`);
    } finally {
      setLive(false);
    }
  }, [region, target]);

  // ---- Discover companies from a description (web search -> extraction) ----
  const runDiscovery = useCallback(async () => {
    setLive(true);
    setLeads([]);
    setProgress(0);
    setNotice("Durchsuche das Web nach passenden Firmen … (kann bis zu einer Minute dauern)");
    try {
      const data = await api.discover({
        query, region, target, keywords,
        includeDirectories: !!vertical?.directories,
      });
      const found = data.leads || [];
      setLeads(found);
      const [s, l] = await Promise.all([api.listSearches(50, 0), api.listLeads(null, 200, 0)]);
      setSearches(s);
      setAllLeads(l);
      setNotice(
        found.length
          ? `${found.length} neue Firmen gefunden und geprüft.`
          : data.exhausted
          ? "Keine neuen Firmen – alle Treffer wurden schon gefunden. Ändere die Parameter für mehr."
          : "Keine passenden Firmen gefunden – formuliere die Suche etwas anders."
      );
    } catch (err) {
      setNotice(`Web-Recherche fehlgeschlagen: ${err.message}`);
    } finally {
      setLive(false);
    }
  }, [query, region, target, keywords, vertical]);

  // ---- Submit search ----
  const startSearch = useCallback((e) => {
    e?.preventDefault();
    setActive("Neue Recherche");
    const free = query.trim();
    if (!free && !target) {
      setNotice("Bitte wähle eine Branche oder beschreibe, wen LeadSphere finden soll.");
      return;
    }
    // A pure domain/URL -> extract that one site; otherwise discover via web search.
    const urlMatch = free.match(/^((?:https?:\/\/)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[^\s]*)?)$/i);
    if (hasBackend) {
      if (urlMatch) runLiveExtraction(urlMatch[0]);
      else runDiscovery();
      return;
    }
    // Offline demo mode (no backend detected).
    setNotice("");
    setLeads([]);
    setProgress(0);
    setSearching(true);
  }, [query, target, hasBackend, runLiveExtraction, runDiscovery]);

  // ---- Delete search ----
  const handleDelete = useCallback(async (searchId) => {
    try {
      if (hasBackend) {
        await api.deleteSearch(searchId);
        const [s, l] = await Promise.all([api.listSearches(50, 0), api.listLeads(null, 200, 0)]);
        setSearches(s);
        setAllLeads(l);
      } else {
        setSearches((s) => s.filter((_, i) => i !== 0));
      }
      showToast("Recherche gelöscht.", "success");
    } catch (err) {
      showToast(`Fehler beim Löschen: ${err.message}`, "error");
    }
  }, [hasBackend, showToast]);

  // ---- Select from history ----
  const handleSelectSearch = useCallback((s) => {
    setQuery(`Finde ${s.query}`);
    setRegion(s.region || "");
    setTarget(s.target || "");
    setActive("Neue Recherche");
  }, []);

  // ---- Dashboard navigation ----
  const handleDashboardNav = useCallback((view, search) => {
    if (search) {
      setQuery(`Finde ${search.query}`);
      setRegion(search.region || "");
      setTarget(search.target || "");
    }
    setActive(view);
  }, []);

  // ---- CSV Export ----
  const exportCsv = useCallback(() => {
    const data = leads.length ? leads : api.DEMO_LEADS;
    const rows = [
      ["Unternehmen", "Ort", "Website", "E-Mail", "Telefon", "Qualität"],
      ...data.map((l) => [l.company, l.city, l.website, l.email, l.phone || "", `${l.score}%`]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = "sprow-leads.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("CSV-Export wurde erstellt.", "success");
  }, [leads, showToast]);

  // ---- Render view ----
  const renderView = () => {
    switch (active) {
      case "Neue Recherche":
        return (
          <>
            <SearchPanel
              query={query} setQuery={setQuery}
              region={region} setRegion={setRegion}
              target={target} setTarget={setTarget}
              vertical={vertical} setVertical={setVertical}
              keywords={keywords} setKeywords={setKeywords}
              searching={searching} live={live}
              progress={progress}
              notice={notice} setNotice={setNotice}
              onSubmit={startSearch}
            />
            {leads.length > 0 ? (
              <LeadsTable leads={leads} loading={false} />
            ) : (
              <HistoryTable
                searches={searches}
                onSelect={handleSelectSearch}
                onDelete={handleDelete}
                loading={historyLoading}
              />
            )}
          </>
        );

      case "Leads": {
        const displayLeads = allLeads.length > 0 ? allLeads : api.DEMO_LEADS;
        return (
          <section className="full-view">
            <div className="view-header">
              <div>
                <Users size={22} weight="duotone" />
                <h1>Leads</h1>
                <span className="badge">{displayLeads.length} Einträge</span>
              </div>
              <button className="csv-btn" onClick={exportCsv}>
                <DownloadSimple /> CSV exportieren
              </button>
            </div>
            <LeadsTable leads={displayLeads} loading={leadsLoading} />
          </section>
        );
      }

      case "Dashboard":
        return (
          <section className="full-view">
            <Dashboard
              getStats={api.getStats}
              listSearches={api.listSearches}
              listLeads={api.listLeads}
              onNavigate={handleDashboardNav}
            />
          </section>
        );

      case "Listen":
        return (
          <section className="full-view">
            <div className="view-header">
              <div>
                <Clock size={22} weight="duotone" />
                <h1>Listen</h1>
              </div>
            </div>
            <HistoryTable
              searches={searches}
              onSelect={handleSelectSearch}
              onDelete={handleDelete}
              loading={historyLoading}
            />
          </section>
        );

      default:
        return (
          <section className="placeholder-view">
            <div className="mini-orb"><ParticleOrb searching={false} /></div>
            <span className="eyebrow">LEADSPHERE · POWERED BY NADJ.AI</span>
            <h1>{active}</h1>
            <p>Hier erscheinen alle gefundenen und geprüften Geschäftskontakte.</p>
            <button onClick={() => setActive("Neue Recherche")}>
              Neue Recherche starten
            </button>
          </section>
        );
    }
  };

  return (
    <div className="app-shell">
      <Sidebar active={active} setActive={setActive} stats={null} />
      <main className="workspace">
        <header>
          <button
            className="mobile-brand"
            onClick={() => document.body.classList.toggle("nav-open")}
          >
            <SquaresFour /> LeadSphere
          </button>
          <div>
            <span>{new Date().toLocaleDateString("de-DE", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</span>
          </div>
        </header>
        {backendLoading ? (
          <div className="loading-state" style={{ minHeight: "60vh" }}>
            <div className="spinner" />
            <span>Verbindungsaufbau …</span>
          </div>
        ) : (
          renderView()
        )}
        <footer><b>LeadSphere</b> · powered by nadj.ai · Öffentliche Quellen · Datenschutzfreundliche Recherche</footer>
      </main>
      <Toast toast={toast} onClose={closeToast} />
    </div>
  );
}
