import { SolarPanel, MagnifyingGlass, Users, ListBullets, ChartBar, CaretDown, Question } from "@phosphor-icons/react";

const NAV_ITEMS = [
  { key: "Neue Recherche", icon: MagnifyingGlass },
  { key: "Leads", icon: Users },
  { key: "Dashboard", icon: ChartBar },
  { key: "Listen", icon: ListBullets },
];

export function Sidebar({ active, setActive, stats }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <SolarPanel weight="duotone" />
        <span>EnergyTeam <b>Sprow</b></span>
      </div>
      <nav>
        {NAV_ITEMS.map(({ key, icon: Icon }) => (
          <button
            key={key}
            className={active === key ? "active" : ""}
            onClick={() => setActive(key)}
          >
            <Icon size={21} />
            <span>{key}</span>
            {key === "Dashboard" && stats && (
              <span className="nav-badge">{stats.today_searches}</span>
            )}
          </button>
        ))}
      </nav>
      <div className="sidebar-bottom">
        <div className="profile">
          <span>GS</span>
          <div>
            <strong>Gabi Sprow</strong>
            <small>EnergyTeam Sprow</small>
          </div>
          <CaretDown />
        </div>
        <button className="help">
          <Question size={20} />
          <span>Hilfe & Support</span>
        </button>
      </div>
    </aside>
  );
}
