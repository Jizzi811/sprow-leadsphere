import { useState } from "react";
import {
  Sparkle, MapPin, Users, X, ArrowRight, Plus,
  SolarPanel, CurrencyBtc, Diamond, Bank, Robot, Faders, GlobeX,
} from "@phosphor-icons/react";
import { ParticleOrb } from "./ParticleOrb.jsx";
import { VERTICALS, REGION_SUGGESTIONS } from "../lib/verticals.js";

const ICONS = {
  SolarPanel, CurrencyBtc, Diamond, Bank, Sparkle, Robot, Faders, GlobeX,
};

function VerticalCard({ vertical, active, onSelect, index }) {
  const Icon = ICONS[vertical.icon] || Sparkle;
  return (
    <button
      type="button"
      className={`vertical-card ${active ? "active" : ""}`}
      style={{ "--accent": vertical.accent, "--delay": `${index * 55}ms` }}
      onClick={() => onSelect(vertical)}
    >
      <span className="vc-icon"><Icon size={22} weight="duotone" /></span>
      <strong>{vertical.name}</strong>
      <small>{vertical.tagline}</small>
    </button>
  );
}

export function SearchPanel({
  query, setQuery,
  region, setRegion,
  target, setTarget,
  vertical, setVertical,
  keywords, setKeywords,
  searching, live,
  progress, notice, setNotice,
  onSubmit,
}) {
  const [keywordDraft, setKeywordDraft] = useState("");
  const busy = searching || live;

  const selectVertical = (v) => {
    setVertical(v);
    setTarget(v.targets[0] || "");
    setKeywords(v.keywords || []);
    setQuery("");
  };

  const addKeyword = () => {
    const k = keywordDraft.trim().replace(/,+$/, "");
    if (k && !keywords.includes(k)) setKeywords([...keywords, k]);
    setKeywordDraft("");
  };

  const onKeywordKey = (e) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addKeyword(); }
    if (e.key === "Backspace" && !keywordDraft && keywords.length) {
      setKeywords(keywords.slice(0, -1));
    }
  };

  return (
    <>
      <section className="hero">
        <div className="intro">
          <span className="eyebrow"><Sparkle weight="fill" /> LeadSphere · powered by nadj.ai</span>
          <h1>Leads für<br /><em className="shimmer">jede Branche.</em></h1>
          <p>
            Dein Recherche-Agent findet öffentlich erreichbare
            Geschäftskontakte — von Solar bis Krypto, live aus dem Web.
          </p>
        </div>
        <ParticleOrb searching={busy} accent={vertical?.accent} />
      </section>

      <section className="verticals" aria-label="Branche wählen">
        {VERTICALS.map((v, i) => (
          <VerticalCard
            key={v.id}
            vertical={v}
            index={i}
            active={vertical?.id === v.id}
            onSelect={selectVertical}
          />
        ))}
      </section>

      <form
        className="search-panel"
        style={{ "--accent": vertical?.accent || "#4de581" }}
        onSubmit={onSubmit}
      >
        <div className="command">
          <Sparkle weight="fill" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={vertical?.example || "Beschreibe, wen LeadSphere finden soll …"}
            aria-label="Rechercheauftrag"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Eingabe leeren">
              <X />
            </button>
          )}
        </div>

        <div className="filter-row">
          {vertical && !vertical.custom && vertical.targets.length > 0 && (
            <label>
              <Users />
              <select
                aria-label="Zielgruppe"
                value={target}
                onChange={(e) => setTarget(e.target.value)}
              >
                {vertical.targets.map((t) => <option key={t}>{t}</option>)}
              </select>
            </label>
          )}
          <label>
            <MapPin />
            <input
              className="region-input"
              list="region-suggestions"
              value={region}
              placeholder="Region, z. B. NRW"
              onChange={(e) => setRegion(e.target.value)}
              aria-label="Region"
            />
            <datalist id="region-suggestions">
              {REGION_SUGGESTIONS.map((r) => <option key={r} value={r} />)}
            </datalist>
          </label>
          <button className="start" disabled={busy}>
            {searching
              ? `Recherche ${progress}%`
              : live
              ? "Recherche läuft …"
              : "Suche starten"}
            <ArrowRight />
          </button>
        </div>

        <div className="keyword-row">
          <span className="keyword-label">Parameter</span>
          {keywords.map((k) => (
            <span className="chip" key={k}>
              {k}
              <button
                type="button"
                aria-label={`${k} entfernen`}
                onClick={() => setKeywords(keywords.filter((x) => x !== k))}
              >
                <X size={11} />
              </button>
            </span>
          ))}
          <span className="chip-input">
            <Plus size={12} />
            <input
              value={keywordDraft}
              onChange={(e) => setKeywordDraft(e.target.value)}
              onKeyDown={onKeywordKey}
              onBlur={addKeyword}
              placeholder="Eigenen Parameter hinzufügen"
              aria-label="Eigenen Parameter hinzufügen"
            />
          </span>
        </div>

        {vertical?.note && <p className="vertical-note">{vertical.note}</p>}

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
