import { Sparkle, MapPin, Users, X, ArrowRight } from "@phosphor-icons/react";
import { ParticleOrb } from "./ParticleOrb.jsx";

export function SearchPanel({
  query, setQuery,
  region, setRegion,
  target, setTarget,
  searching, live,
  progress, notice, setNotice,
  hasBackend, onSubmit,
}) {
  return (
    <>
      <section className="hero">
        <div className="intro">
          <span className="eyebrow">SPROW LEADSPHERE</span>
          <h1>Wen sollen wir<br />heute finden?</h1>
          <p>
            Dein Recherche-Agent für öffentlich erreichbare<br />
            Geschäftskontakte im Energiemarkt.
          </p>
        </div>
        <ParticleOrb searching={searching || live} />
      </section>

      <form className="search-panel" onSubmit={onSubmit}>
        <div className="command">
          <Sparkle weight="fill" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Finde Hausverwaltungen in NRW …"
            aria-label="Rechercheauftrag"
          />
          <button type="button" onClick={() => setQuery("")} aria-label="Eingabe leeren">
            <X />
          </button>
        </div>
        <div className="filter-row">
          <label>
            <MapPin />
            <select
              aria-label="Region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
            >
              <option>Nordrhein-Westfalen</option>
              <option>Deutschlandweit</option>
              <option>Bayern</option>
              <option>Hessen</option>
              <option>Hamburg</option>
              <option>Baden-Württemberg</option>
              <option>Niedersachsen</option>
              <option>Berlin/Brandenburg</option>
            </select>
          </label>
          <label>
            <Users />
            <select
              aria-label="Zielgruppe"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
            >
              <option>Hausverwaltungen</option>
              <option>Wohnungsunternehmen</option>
              <option>Kommunen</option>
              <option>Gewerbebetriebe</option>
              <option>Solar-Fachpartner</option>
              <option>Industriebetriebe</option>
            </select>
          </label>
          <button className="start" disabled={searching || live}>
            {searching
              ? `Recherche ${progress}%`
              : live
              ? "Extraktion läuft …"
              : "Suche starten"}
            <ArrowRight />
          </button>
        </div>
        {searching && (
          <div className="progress">
            <span style={{ width: `${progress}%` }} />
          </div>
        )}
      </form>

      {notice && (
        <div className={`notice ${notice.includes("fehlgeschlagen") ? "error" : ""}`}>
          <Sparkle weight="fill" />
          {notice}
          <button onClick={() => setNotice("")}>
            <X />
          </button>
        </div>
      )}
    </>
  );
}
