import { MagnifyingGlass, DownloadSimple, Star, EnvelopeSimple, Globe } from "@phosphor-icons/react";

function exportCsv(leads) {
  const data = leads.length ? leads : [];
  const rows = [
    ["Unternehmen", "Ort", "Website", "E-Mail", "Telefon", "Qualität"],
    ...data.map((l) => [
      l.company,
      l.city,
      l.website,
      l.email,
      l.phone || "",
      `${l.score}%`,
    ]),
  ];
  const csv = rows
    .map((r) => r.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(";"))
    .join("\n");
  const url = URL.createObjectURL(
    new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" })
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = "sprow-leads.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function LeadsTable({ leads, loading }) {
  if (loading) {
    return (
      <section className="results-section">
        <div className="loading-state">
          <div className="spinner" />
          <span>Lade Leads …</span>
        </div>
      </section>
    );
  }

  if (!leads.length) {
    return (
      <section className="results-section">
        <div className="empty-state">
          <span className="eyebrow">LEADSPHERE · POWERED BY NADJ.AI</span>
          <h2>Noch keine Leads</h2>
          <p>Starte eine Recherche, um Geschäftskontakte zu finden.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="results-section">
      <div className="section-title">
        <div>
          <MagnifyingGlass />
          <h2>Gefundene Leads</h2>
          <span className="badge">{leads.length} geprüft</span>
        </div>
        <button className="csv-btn" onClick={() => exportCsv(leads)}>
          <DownloadSimple /> CSV exportieren
        </button>
      </div>
      <div className="leads-table">
        <div className="lead-head">
          <span>Unternehmen</span>
          <span>Ort</span>
          <span>Kontakt</span>
          <span>Qualität</span>
        </div>
        {leads.map((l, i) => (
          <div className="lead-row" key={l.id || i}>
            <strong>
              {l.company}
              <small>
                <Globe size={11} /> {l.website}
              </small>
            </strong>
            <span>
              {l.city && (
                <>
                  {l.city}
                </>
              )}
            </span>
            <div className="contact-links">
              {l.email && l.email !== "—" ? (
                <a href={`mailto:${l.email}`}>
                  <EnvelopeSimple size={11} /> {l.email}
                </a>
              ) : (
                <span className="muted">—</span>
              )}
              {l.phone && l.phone !== "—" && (
                <small className="phone">{l.phone}</small>
              )}
            </div>
            <span className="score">
              <i style={{ width: `${l.score / 2}%` }} />
              {l.score}%
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

export function MiniLeads({ leads }) {
  if (!leads.length) return null;
  return (
    <div className="mini-leads">
      {leads.map((l, i) => (
        <div className="mini-lead" key={l.id || i}>
          <span className="mini-lead-name">{l.company}</span>
          <span className="mini-lead-score">{l.score}%</span>
        </div>
      ))}
    </div>
  );
}
