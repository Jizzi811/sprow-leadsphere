import { MagnifyingGlass, Trash, ArrowRight, Clock } from "@phosphor-icons/react";

export function HistoryTable({ searches, onSelect, onDelete, loading }) {
  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <span>Lade Verlauf …</span>
      </div>
    );
  }

  if (!searches.length) {
    return (
      <div className="empty-state" style={{ padding: "40px 0" }}>
        <span className="eyebrow">SPROW LEADSPHERE</span>
        <h2>Noch keine Recherchen</h2>
        <p>Deine letzten Suchen erscheinen hier.</p>
      </div>
    );
  }

  return (
    <div className="history-section">
      <div className="section-title">
        <div>
          <Clock />
          <h2>Letzte Recherchen</h2>
          <span className="badge">{searches.length} Einträge</span>
        </div>
      </div>
      <div className="runs-table">
        <div className="run-head">
          <span>Anfrage</span>
          <span>Region</span>
          <span>Zielgruppe</span>
          <span>Ergebnisse</span>
          <span>Zuletzt</span>
          <span></span>
        </div>
        {searches.map((s, i) => (
          <div className="run-row" key={s.id || i}>
            <button
              className="run-row-main"
              onClick={() => onSelect(s)}
            >
              <span>
                <MagnifyingGlass />
                {s.query}
              </span>
            </button>
            <span>{s.region || "—"}</span>
            <span>{s.target || "—"}</span>
            <b>{s.result_count}</b>
            <span className="date-cell">{s.created_at?.slice(0, 16).replace("T", " ")}</span>
            <div className="run-actions">
              <button
                className="icon-btn"
                onClick={() => onSelect(s)}
                title="Erneut durchführen"
              >
                <ArrowRight />
              </button>
              <button
                className="icon-btn danger"
                onClick={() => onDelete(s.id)}
                title="Löschen"
              >
                <Trash />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
