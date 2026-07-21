import { useEffect, useRef, useState } from 'react'
import { ArrowRight, CaretDown, DownloadSimple, Export, ListBullets, MagnifyingGlass, MapPin, Question, SolarPanel, Sparkle, SquaresFour, Users, X } from '@phosphor-icons/react'

const initialRuns = [
  { query: 'Hausverwaltungen in NRW', region: 'Nordrhein-Westfalen', target: 'Hausverwaltungen', count: 1248, date: '21.07.2026, 09:15' },
  { query: 'Projektentwickler für Solarparks in Bayern', region: 'Bayern', target: 'Projektentwickler', count: 342, date: '20.07.2026, 16:42' },
  { query: 'Industriebetriebe mit 500+ Mitarbeitenden', region: 'Baden-Württemberg', target: 'Industrie', count: 876, date: '20.07.2026, 10:03' },
  { query: 'Kommunen mit öffentlichen Liegenschaften', region: 'Hessen', target: 'Kommunen', count: 421, date: '19.07.2026, 14:21' },
  { query: 'Wohnungsbaugesellschaften in Hamburg', region: 'Hamburg', target: 'Wohnungsunternehmen', count: 198, date: '18.07.2026, 11:37' },
]
const leadPool = [
  { company: 'RheinRuhr Hausverwaltung GmbH', city: 'Essen', website: 'rheinruhr-hv.de', email: 'kontakt@rheinruhr-hv.de', score: 96 },
  { company: 'Bergische Wohnwerte GmbH', city: 'Wuppertal', website: 'bergische-wohnwerte.de', email: 'info@bergische-wohnwerte.de', score: 92 },
  { company: 'Haus & Grund Objektservice', city: 'Düsseldorf', website: 'hg-objektservice.de', email: 'service@hg-objektservice.de', score: 89 },
  { company: 'WestImmo Verwaltung KG', city: 'Duisburg', website: 'westimmo-verwaltung.de', email: 'office@westimmo-verwaltung.de', score: 87 },
  { company: 'Domus Rheinland GmbH', city: 'Köln', website: 'domus-rheinland.de', email: 'kontakt@domus-rheinland.de', score: 84 },
]

function ParticleOrb({ searching }) {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current, ctx = canvas.getContext('2d')
    let frame, t = 0
    const particles = Array.from({ length: 1180 }, (_, i) => ({ phi: Math.acos(1 - 2 * (i + .5) / 1180), theta: Math.PI * (1 + Math.sqrt(5)) * i, size: .45 + Math.random() * 1.45, drift: Math.random() * 6.28 }))
    const resize = () => { const dpr = Math.min(devicePixelRatio || 1, 2), r = canvas.getBoundingClientRect(); canvas.width = r.width * dpr; canvas.height = r.height * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0) }
    const draw = () => {
      const w = canvas.clientWidth, h = canvas.clientHeight, cx = w / 2, cy = h / 2, radius = Math.min(w, h) * .31
      ctx.clearRect(0, 0, w, h); t += searching ? .018 : .006
      const pulse = 1 + Math.sin(t * 2.1) * .025
      particles.forEach(p => {
        const th = p.theta + t, wave = Math.sin(p.phi * 4 + t * 2 + p.drift) * (searching ? 9 : 3), r = (radius + wave) * pulse
        const x3 = Math.sin(p.phi) * Math.cos(th), y3 = Math.cos(p.phi), z3 = Math.sin(p.phi) * Math.sin(th), perspective = .78 + (z3 + 1) * .13
        ctx.beginPath(); ctx.fillStyle = `rgba(${searching ? '114,255,153' : '80,239,126'},${.18 + (z3 + 1) * .31})`; ctx.shadowColor = '#42e878'; ctx.shadowBlur = p.size > 1.5 ? 7 : 0; ctx.arc(cx + x3 * r * perspective, cy + y3 * r, p.size * perspective, 0, Math.PI * 2); ctx.fill()
      })
      ctx.shadowBlur = 0; frame = requestAnimationFrame(draw)
    }
    resize(); draw(); const ro = new ResizeObserver(resize); ro.observe(canvas)
    return () => { cancelAnimationFrame(frame); ro.disconnect() }
  }, [searching])
  return <canvas ref={canvasRef} className={`orb ${searching ? 'searching' : ''}`} aria-label="Animierter LeadSphere Agent" />
}

export function App() {
  const [active, setActive] = useState('Neue Recherche'), [query, setQuery] = useState('Finde Hausverwaltungen in NRW')
  const [region, setRegion] = useState('Nordrhein-Westfalen'), [target, setTarget] = useState('Hausverwaltungen')
  const [searching, setSearching] = useState(false), [progress, setProgress] = useState(0), [leads, setLeads] = useState([])
  const [runs, setRuns] = useState(initialRuns), [notice, setNotice] = useState('')
  useEffect(() => { if (!searching) return; const timer = setInterval(() => setProgress(p => Math.min(p + 7, 100)), 140); return () => clearInterval(timer) }, [searching])
  useEffect(() => { if (progress !== 100 || !searching) return; setSearching(false); setLeads(leadPool); setRuns(r => [{ query: query.replace(/^Finde\s+/i, ''), region, target, count: 5, date: 'gerade eben' }, ...r].slice(0, 6)); setNotice('5 passende Geschäftskontakte gefunden und geprüft.') }, [progress, searching, query, region, target])
  const startSearch = e => { e?.preventDefault(); if (!query.trim()) { setNotice('Bitte beschreibe zuerst, wen LeadSphere finden soll.'); return } setNotice(''); setLeads([]); setProgress(0); setSearching(true); setActive('Neue Recherche') }
  const exportCsv = () => { const data = leads.length ? leads : leadPool, rows = [['Unternehmen','Ort','Website','E-Mail','Qualität'], ...data.map(l => [l.company,l.city,l.website,l.email,`${l.score}%`])], csv = rows.map(r => r.map(v => `"${String(v).replaceAll('"','""')}"`).join(';')).join('\n'), url = URL.createObjectURL(new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' })); const a = document.createElement('a'); a.href = url; a.download = 'sprow-leads.csv'; a.click(); URL.revokeObjectURL(url); setNotice('CSV-Export wurde erstellt.') }
  const nav = [['Neue Recherche', MagnifyingGlass], ['Leads', Users], ['Listen', ListBullets], ['Exporte', Export]]
  return <div className="app-shell">
    <aside className="sidebar"><div className="brand"><SolarPanel weight="duotone"/><span>EnergyTeam <b>Sprow</b></span></div><nav>{nav.map(([label, Icon]) => <button key={label} className={active === label ? 'active' : ''} onClick={() => setActive(label)}><Icon size={21}/><span>{label}</span></button>)}</nav><div className="sidebar-bottom"><div className="profile"><span>GS</span><div><strong>Gabi Sprow</strong><small>EnergyTeam Sprow</small></div><CaretDown/></div><button className="help"><Question size={20}/><span>Hilfe & Support</span></button></div></aside>
    <main className="workspace"><header><button className="mobile-brand" onClick={() => document.body.classList.toggle('nav-open')}><SquaresFour/> LeadSphere</button><div><strong>Guten Morgen, Gabi Sprow</strong><span>21. Juli 2026</span></div></header>
    {active === 'Neue Recherche' && <><section className="hero"><div className="intro"><span className="eyebrow">SPROW LEADSPHERE</span><h1>Wen sollen wir<br/>heute finden?</h1><p>Dein Recherche-Agent für öffentlich erreichbare<br/>Geschäftskontakte im Energiemarkt.</p></div><ParticleOrb searching={searching}/></section>
    <form className="search-panel" onSubmit={startSearch}><div className="command"><Sparkle weight="fill"/><input value={query} onChange={e => setQuery(e.target.value)} aria-label="Rechercheauftrag"/><button type="button" onClick={() => setQuery('')} aria-label="Eingabe leeren"><X/></button></div><div className="filter-row"><label><MapPin/><select aria-label="Region" value={region} onChange={e => setRegion(e.target.value)}><option>Nordrhein-Westfalen</option><option>Deutschlandweit</option><option>Bayern</option><option>Hessen</option><option>Hamburg</option></select></label><label><Users/><select aria-label="Zielgruppe" value={target} onChange={e => setTarget(e.target.value)}><option>Hausverwaltungen</option><option>Wohnungsunternehmen</option><option>Kommunen</option><option>Gewerbebetriebe</option><option>Solar-Fachpartner</option></select></label><button className="start" disabled={searching}>{searching ? `Recherche ${progress}%` : 'Suche starten'}<ArrowRight/></button></div>{searching && <div className="progress"><span style={{width:`${progress}%`}}/></div>}</form>
    {notice && <div className="notice"><Sparkle weight="fill"/>{notice}<button onClick={() => setNotice('')}><X/></button></div>}
    {leads.length > 0 ? <section className="results-section"><div className="section-title"><div><MagnifyingGlass/><h2>Gefundene Leads</h2><span>{leads.length} geprüft</span></div><button onClick={exportCsv}><DownloadSimple/> CSV exportieren</button></div><div className="leads-table"><div className="lead-head"><span>Unternehmen</span><span>Ort</span><span>Kontakt</span><span>Qualität</span></div>{leads.map(l => <div className="lead-row" key={l.company}><strong>{l.company}<small>{l.website}</small></strong><span>{l.city}</span><a href={`mailto:${l.email}`}>{l.email}</a><span className="score"><i style={{width:`${l.score/2}%`}}/>{l.score}%</span></div>)}</div></section> : <section className="recent-section"><div className="section-title"><div><ListBullets/><h2>Letzte Recherchen</h2></div><button onClick={() => setActive('Leads')}>Alle anzeigen <ArrowRight/></button></div><div className="runs-table"><div className="run-head"><span>Anfrage</span><span>Region</span><span>Zielgruppe</span><span>Ergebnisse</span><span>Zuletzt</span></div>{runs.map((r,i) => <button className="run-row" key={`${r.query}-${i}`} onClick={() => {setQuery(`Finde ${r.query}`);setRegion(r.region);setTarget(r.target)}}><span><MagnifyingGlass/>{r.query}</span><span>{r.region}</span><span>{r.target}</span><b>{r.count.toLocaleString('de-DE')}</b><span>{r.date}</span><ArrowRight/></button>)}</div></section>}<footer>Öffentliche Quellen · Datenschutzfreundliche Recherche · Quellen werden dokumentiert</footer></>}
    {active !== 'Neue Recherche' && <section className="placeholder-view"><div className="mini-orb"><ParticleOrb searching={false}/></div><span className="eyebrow">SPROW LEADSPHERE</span><h1>{active}</h1><p>{active === 'Leads' ? 'Hier erscheinen alle gefundenen und geprüften Geschäftskontakte.' : active === 'Listen' ? 'Erstelle Zielgruppenlisten für deine nächste Vertriebskampagne.' : 'Exportiere freigegebene Leads als CSV für deine weitere Bearbeitung.'}</p><button onClick={active === 'Exporte' ? exportCsv : () => setActive('Neue Recherche')}>{active === 'Exporte' ? <><DownloadSimple/> Beispieldaten exportieren</> : 'Neue Recherche starten'}</button></section>}</main>
  </div>
}
