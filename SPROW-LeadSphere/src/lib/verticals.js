/**
 * Branchen-Presets für LeadSphere.
 * Jedes Preset liefert Zielgruppen-Vorschläge, Beispiel-Stichwörter und einen
 * Query-Baustein. `directories: true` schaltet die Verzeichnis-Suche im
 * Backend frei (für Firmen ohne eigene Webseite).
 */
export const VERTICALS = [
  {
    id: "solar",
    name: "Solar & Energie",
    icon: "SolarPanel",
    accent: "#4de581",
    tagline: "Hausverwaltungen, Wohnungswirtschaft, Solarpartner",
    targets: ["Hausverwaltungen", "Wohnungsunternehmen", "Kommunen", "Solar-Fachpartner", "Industriebetriebe", "Gewerbebetriebe"],
    keywords: ["Photovoltaik", "Balkonkraftwerk", "Energieberatung"],
    example: "Finde Hausverwaltungen in NRW",
  },
  {
    id: "crypto",
    name: "Krypto & Finance",
    icon: "CurrencyBtc",
    accent: "#f2b544",
    tagline: "Broker, Vermögensverwalter, FinTechs",
    targets: ["Krypto-Broker", "Vermögensverwalter", "Finanzberater", "Family Offices", "FinTech-Startups", "Steuerberater mit Krypto-Fokus"],
    keywords: ["Bitcoin", "Blockchain", "Digital Assets"],
    example: "Finde Vermögensverwalter mit Krypto-Fokus in Deutschland",
  },
  {
    id: "diamonds",
    name: "Diamanten & Sachwerte",
    icon: "Diamond",
    accent: "#9ad7ff",
    tagline: "Juweliere, Edelstein-Händler, Sachwert-Berater",
    targets: ["Juweliere", "Edelstein-Händler", "Auktionshäuser", "Sachwert-Berater", "Goldhändler", "Pfandhäuser"],
    keywords: ["Anlagediamanten", "Edelmetalle", "Wertanlage"],
    example: "Finde Juweliere mit Anlagediamanten in München",
  },
  {
    id: "banking",
    name: "Banking & Konten",
    icon: "Bank",
    accent: "#b89aff",
    tagline: "Gründer & Firmen, die neue Konten brauchen",
    targets: ["Existenzgründer", "Neu gegründete GmbHs", "Vereine", "Expat-Services", "Gründungsberater", "Coworking Spaces"],
    keywords: ["Geschäftskonto", "Neugründung", "Kontowechsel"],
    example: "Finde Gründungsberater in Berlin",
  },
  {
    id: "lifestyle",
    name: "Lifestyle",
    icon: "Sparkle",
    accent: "#ff9ac2",
    tagline: "Fitness, Beauty, Hotels, Events, Gastro",
    targets: ["Fitnessstudios", "Beauty & Spa", "Hotels & Resorts", "Event-Agenturen", "Restaurants", "Yoga-Studios"],
    keywords: ["Premium", "Wellness", "Mitgliedschaft"],
    example: "Finde Fitnessstudios in Hamburg",
  },
  {
    id: "nowebsite",
    name: "Ohne Webseite",
    icon: "GlobeX",
    accent: "#ff9a62",
    tagline: "Betriebe, die noch keinen Webauftritt haben",
    targets: ["Handwerksbetriebe", "Gastronomie", "Einzelhandel", "Friseure", "Autowerkstätten", "Kleinunternehmen"],
    keywords: ["Telefonnummer", "Branchenbuch"],
    example: "Finde Malerbetriebe in Köln ohne Webseite",
    directories: true,
    note: "Durchsucht Branchenverzeichnisse — Betriebe ohne eigene Website sind sonst unsichtbar.",
  },
  {
    id: "ai",
    name: "KI-Bedarf",
    icon: "Robot",
    accent: "#62e6e6",
    tagline: "Unternehmen, die von KI profitieren würden",
    targets: ["Mittelstand ohne Digitalisierung", "Agenturen", "Kanzleien", "Arztpraxen", "Logistikunternehmen", "Immobilienmakler"],
    keywords: ["Digitalisierung", "Automatisierung", "Prozesse"],
    example: "Finde Kanzleien in Frankfurt mit Digitalisierungsbedarf",
  },
  {
    id: "custom",
    name: "Eigene Suche",
    icon: "Faders",
    accent: "#e8e8e4",
    tagline: "Setze deine eigenen Parameter",
    targets: [],
    keywords: [],
    example: "Beschreibe frei, wen du suchst …",
    custom: true,
  },
];

export const REGION_SUGGESTIONS = [
  "Deutschlandweit", "Nordrhein-Westfalen", "Bayern", "Baden-Württemberg",
  "Hessen", "Niedersachsen", "Berlin", "Hamburg", "Sachsen", "Köln",
  "München", "Frankfurt", "Stuttgart", "Düsseldorf", "Österreich", "Schweiz",
];

/** Komponiert die finale Suchbeschreibung aus Preset + Parametern. */
export function composeQuery({ freeText, target, keywords }) {
  const parts = [];
  if (freeText?.trim()) parts.push(freeText.trim());
  else if (target) parts.push(`Finde ${target}`);
  if (keywords?.length) parts.push(keywords.join(" "));
  return parts.join(" · ");
}
