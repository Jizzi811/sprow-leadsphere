import { useEffect, useState, useMemo } from "react";
import {
  ChartBar, MagnifyingGlass, Users, Star, ArrowRight,
  DownloadSimple, EnvelopeSimple, Globe,
} from "@phosphor-icons/react";

function exportLeadsCsv(leads) {
  const rows = [
    ["Unternehmen", "Ort", "Website", "E-Mail", "Telefon", "Qualität", "Gefunden"],
    ...leads.map((l) => [
      l.company, l.city, l.website, l.email, l.phone || "", `${l.score}%`,
      (l.created_at || "").slice(0, 16).replace("T", " "),
    ]),
  ];
  const csv = rows
    .map((r) => r.map((v) => `"${String(v ?? "").replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  const url = URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `leadsphere-leads-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function Dashboard({ getStats, listSearches, listLeads, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [allLeads, setAllLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [s, searches, leads] = await Promise.all([
          getStats(),
          listSearches(6, 0),
          listLeads(null, 500, 0),
        ]);
        if (cancelled) return;
        setStats(s);
        setRecent(searches);
        setAllLeads(leads);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [getStats, listSearches, listLeads]);

  const derived = useMemo(() => {
    const withScore = allLeads.filter((l) => typeof l.score === "number");
    const avg = withScore.length
      ? Math.round(withScore.reduce((a, l) => a + l.score, 0) / withScore.length)
      : 0;
    const withEmail = allLeads.filter((l) => l.email && l.email !== "—").length;
    const top = [...allLeads].sort((a, b) => (b.score || 0) - (a.score || 0)).slice(0, 6);
    return { avg, withEmail, top };
  }, [allLeads]);

  if (loading) {
    return (
      <section className="dashboard">
        <div className="loading-state" style={{ minHeight: 400 }}>
          <div className="spinner" />
          <span>Lade Dashboard …</span>
        </div>
      </section>
    );
  }

  const cards = [
    { icon: MagnifyingGlass, label: "Recherchen heute", value: stats?.today_searches ?? 0, color: "#4de581", go: "Listen" },
    { icon: ChartBar, label: "Recherchen gesamt", value: stats?.total_searches ?? 0, color: "#e0ad3e", go: "Listen" },
    { icon: Users, label: "Gefundene Leads", value: allLeads.length, color: "#42c875", go: "Leads" },
    { icon: Star, label: "Ø Qualität", value: derived.avg ? `${derived.avg}%` : "—", color: "#9ad7ff" },
  ];

  return (
    <section className="dashboard">
      <div className="section-title">
        <div>
          <ChartBar />
          <h2>Dashboard</h2>
          {derived.withEmail > 0 && (
            <span className="badge">{derived.withEmail} mit E-Mail</span>
          )}
        </div>
        {allLeads.length > 0 && (
          <button className="csv-btn" onClick={() => exportLeadsCsv(allLeads)}>
            <DownloadSimple /> Alle Leads exportieren
          </button>
        )}
      </div>

      <div className="stats-grid">
        {cards.map((card, i) => (
          <button
            className="stat-card"
            key={i}
            onClick={() => card.go && onNavigate(card.go)}
            style={{ cursor: card.go ? "pointer" : "default" }}
          >
            <card.icon size={28} color={card.color} weight="duotone" />
            <div>
              <span className="stat-value">{card.value}</span>
              <span className="stat-label">{card.label}</span>
            </div>
          </button>
        ))}
      </div>

      <div className="dashboard-panels">
        <div className="dash-panel">
          <h3><MagnifyingGlass size={16} /> Letzte Recherchen</h3>
          <div className="dash-list">
            {recent.slice(0, 6).map((s, i) => (
              <button className="dash-item" key={s.id || i} onClick={() => onNavigate("Neue Recherche", s)}>
                <span className="dash-item-query">{s.query}</span>
                <span className="dash-item-count">{s.result_count}</span>
                <ArrowRight size={14} />
              </button>
            ))}
            {recent.length === 0 && <p className="dash-empty">Noch keine Recherchen</p>}
          </div>
        </div>

        <div className="dash-panel">
          <h3><Star size={16} /> Top-Leads</h3>
          <div className="dash-list">
            {derived.top.map((l, i) => (
              <a
                className="dash-item"
                key={l.id || i}
                href={l.website ? `https://${l.website}` : undefined}
                target="_blank"
                rel="noreferrer"
              >
                <span className="dash-item-query">
                  {l.company}
                  {l.email && l.email !== "—" && (
                    <small className="dash-item-mail"><EnvelopeSimple size={11} /> {l.email}</small>
                  )}
                </span>
                <span className="dash-item-score">{l.score}%</span>
                <Globe size={13} />
              </a>
            ))}
            {derived.top.length === 0 && <p className="dash-empty">Noch keine Leads gefunden</p>}
          </div>
        </div>
      </div>
    </section>
  );
}
