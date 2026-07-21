import { useEffect, useState } from "react";
import {
  ChartBar,
  MagnifyingGlass,
  Users,
  Star,
  ArrowRight,
} from "@phosphor-icons/react";

export function Dashboard({ getStats, listSearches, listLeads, onNavigate }) {
  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [topLeads, setTopLeads] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [s, searches, leads] = await Promise.all([
          getStats(),
          listSearches(5, 0),
          listLeads(null, 10, 0),
        ]);
        if (cancelled) return;
        setStats(s);
        setRecent(searches);
        setTopLeads(leads);
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [getStats, listSearches, listLeads]);

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
    {
      icon: MagnifyingGlass,
      label: "Recherchen heute",
      value: stats?.today_searches ?? 0,
      color: "#4de581",
    },
    {
      icon: ChartBar,
      label: "Recherchen gesamt",
      value: stats?.total_searches ?? 0,
      color: "#e0ad3e",
    },
    {
      icon: Users,
      label: "Gefundene Leads",
      value: stats?.total_leads ?? 0,
      color: "#42c875",
    },
    {
      icon: Star,
      label: "Durchschnittsqualität",
      value: "—",
      color: "#8e9792",
    },
  ];

  return (
    <section className="dashboard">
      <div className="section-title">
        <div>
          <ChartBar />
          <h2>Dashboard</h2>
        </div>
      </div>

      <div className="stats-grid">
        {cards.map((card, i) => (
          <div className="stat-card" key={i}>
            <card.icon size={28} color={card.color} weight="duotone" />
            <div>
              <span className="stat-value">{card.value}</span>
              <span className="stat-label">{card.label}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="dashboard-panels">
        <div className="dash-panel">
          <h3>
            <MagnifyingGlass size={16} />
            Letzte Recherchen
          </h3>
          <div className="dash-list">
            {recent.slice(0, 5).map((s, i) => (
              <button
                className="dash-item"
                key={s.id || i}
                onClick={() => onNavigate("Neue Recherche", s)}
              >
                <span className="dash-item-query">{s.query}</span>
                <span className="dash-item-count">{s.result_count}</span>
                <ArrowRight size={14} />
              </button>
            ))}
            {recent.length === 0 && (
              <p className="dash-empty">Noch keine Recherchen</p>
            )}
          </div>
        </div>

        <div className="dash-panel">
          <h3>
            <Users size={16} />
            Top-Leads
          </h3>
          <div className="dash-list">
            {topLeads.slice(0, 5).map((l, i) => (
              <div className="dash-item" key={l.id || i}>
                <span className="dash-item-query">{l.company}</span>
                <span className="dash-item-score">{l.score}%</span>
              </div>
            ))}
            {topLeads.length === 0 && (
              <p className="dash-empty">Noch keine Leads gefunden</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
