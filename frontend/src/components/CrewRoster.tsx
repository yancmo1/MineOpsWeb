import { useEffect, useMemo, useRef, useState } from "react";
import { rankThreshold, strengthScore, type CatalogManager, type PlayerManager } from "../lib/db";
import { compareManagers, defaultOwnership, sortOptions, type ManagersOwnership, type ManagersSortOption } from "../lib/managers-view";
import { buildTrackerBackup, downloadTrackerBackup } from "../lib/tracker-export";
import { ManagerCard } from "./ManagerCard";

type Department = "All" | "Mine Shaft" | "Elevator" | "Warehouse";
type Ownership = ManagersOwnership;
type SortOption = ManagersSortOption;

const departments: Department[] = ["All", "Mine Shaft", "Elevator", "Warehouse"];
const rarities: string[] = ["legendary", "epic", "rare", "common"];

/**
 * The crew roster (search, filters, sort, manager grid), moved out of
 * App.tsx in the 2026-10-23 Home/My Plan/Toolbox refactor. Behavior is
 * unchanged; it now renders inside the Toolbox ("Crew roster"). Filter
 * state lives here instead of in the app shell.
 */
export function CrewRoster({
  catalog,
  progress,
  onSelectManager,
  onImportData,
}: {
  catalog: CatalogManager[];
  progress: PlayerManager[];
  onSelectManager: (manager: CatalogManager) => void;
  onImportData: () => void;
}) {
  const [query, setQuery] = useState("");
  const [department, setDepartment] = useState<Department>("All");
  const [ownership, setOwnership] = useState<Ownership>(defaultOwnership);
  const [sort, setSort] = useState<SortOption>("recommended");
  const [selectedRarities, setSelectedRarities] = useState<Set<string>>(new Set());
  const [showSortMenu, setShowSortMenu] = useState(false);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Close sort menu on click outside
  useEffect(() => {
    if (!showSortMenu) return;
    const handleClick = (e: MouseEvent) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showSortMenu]);

  const byId = useMemo(() => new Map(catalog.map((m) => [m.id, m])), [catalog]);

  const managers = useMemo(() => {
    let items = progress
      .map((p) => ({ ...p, catalog: byId.get(p.managerId) }))
      .filter((p): p is PlayerManager & { catalog: CatalogManager } => Boolean(p.catalog));

    // Ownership filter
    if (ownership === "unlocked") {
      items = items.filter((p) => p.unlocked);
    }

    // Department filter
    if (department !== "All") {
      items = items.filter((p) => p.catalog.type === department);
    }

    // Rarity filter
    if (selectedRarities.size > 0) {
      items = items.filter((p) => selectedRarities.has(p.catalog.rarity.toLowerCase()));
    }

    // Search
    if (query) {
      const q = query.toLowerCase();
      items = items.filter((p) => p.catalog.name.toLowerCase().includes(q));
    }

    // Sort
    items.sort((a, b) => compareManagers(a, b, sort, strengthScore, rankThreshold));

    return items;
  }, [progress, byId, ownership, department, selectedRarities, query, sort]);

  const unlocked = progress.filter((p) => p.unlocked);

  function toggleRarity(rarity: string) {
    setSelectedRarities((prev) => {
      const next = new Set(prev);
      if (next.has(rarity)) {
        next.delete(rarity);
      } else {
        next.add(rarity);
      }
      return next;
    });
  }

  function exportTrackerBackup() {
    downloadTrackerBackup(buildTrackerBackup(catalog, progress));
  }

  return (
    <section className="managers-page">
      <div className="page-intro">
        <div className="page-intro-copy">
          <span className="section-kicker">Crew board</span>
          <h2>Your crew, ready first</h2>
          <p>Find who can work now, who is close to a breakpoint, and who is worth investing in next.</p>
          <div className="manager-board-meta" aria-label="Roster summary">
            <span><i aria-hidden="true" />{unlocked.length} owned</span>
            <span><i aria-hidden="true" />{catalog.length} in catalog</span>
          </div>
        </div>
        <div className="page-intro-stat"><strong>{unlocked.length}</strong><span>owned of {catalog.length}</span></div>
      </div>
      {/* Search */}
      <div className="toolbar">
        <input
          type="search"
          aria-label="Search managers"
          placeholder="Search managers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="manager-count-badge">
          {managers.length}/{catalog.length}
        </div>
        <button className="secondary manager-export-button" type="button" onClick={exportTrackerBackup} aria-label="Export lineup for Idle Master's Hub">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 21h14" />
          </svg>
          <span>Export lineup</span>
        </button>
      </div>

      <div className="filter-panel" aria-label="Roster filters">
        <div className="filter-group">
          <span className="filter-group-label">Area</span>
          <div className="filter-chips">
            {departments.map((dept) => (
              <button
                key={dept}
                type="button"
                className={`filter-chip ${dept !== "All" ? `filter-chip-${dept.toLowerCase().replace(" ", "-")}` : ""} ${department === dept ? "active" : ""}`}
                aria-pressed={department === dept}
                onClick={() => setDepartment(dept)}
              >
                {dept}
              </button>
            ))}
          </div>
        </div>

        <div className="filter-group">
          <span className="filter-group-label">Rarity</span>
          <div className="filter-chips">
            {rarities.map((rarity) => {
              const isSelected = selectedRarities.has(rarity);
              return (
                <button
                  key={rarity}
                  type="button"
                  className={`filter-chip filter-chip-${rarity} ${isSelected ? "active" : ""}`}
                  aria-pressed={isSelected}
                  onClick={() => toggleRarity(rarity)}
                >
                  {rarity.charAt(0).toUpperCase() + rarity.slice(1)}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Ownership + Sort Controls */}
      <div className="manager-controls-row">
        <div className="segmented-control">
          <button
            className={ownership === "unlocked" ? "active" : ""}
            onClick={() => setOwnership("unlocked")}
          >
            Unlocked
          </button>
          <button
            className={ownership === "all" ? "active" : ""}
            onClick={() => setOwnership("all")}
          >
            All Managers
          </button>
        </div>

        {/* Sort Dropdown */}
        <div className="sort-dropdown" ref={sortMenuRef}>
          <button
            className="sort-trigger"
            onClick={() => setShowSortMenu((v) => !v)}
            aria-label="Sort managers"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 6h18M6 12h12M10 18h4"/>
            </svg>
            <span className="sort-trigger-label">{sortOptions.find((o) => o.value === sort)?.label ?? "Sort"}</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 9l6 6 6-6"/>
            </svg>
          </button>

          {showSortMenu && (
            <div className="sort-menu">
              {sortOptions.map((option) => (
                <button
                  key={option.value}
                  className={`sort-option ${sort === option.value ? "active" : ""}`}
                  onClick={() => {
                    setSort(option.value);
                    setShowSortMenu(false);
                  }}
                >
                  {sort === option.value && (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  )}
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Manager Grid */}
      <section className="grid">
        {managers.length === 0 ? (
          <div className="empty-state" style={{ gridColumn: "1 / -1" }}>
            <h3>{unlocked.length === 0 ? "No roster imported yet" : "No managers found"}</h3>
            <p>{unlocked.length === 0 ? "Sync your player data to see your owned crew, fragments, and rank-up readiness." : "Try adjusting your filters or search term."}</p>
            {unlocked.length === 0 && <button type="button" onClick={onImportData}>Import / sync player data</button>}
          </div>
        ) : (
          managers.map((item) => (
            <ManagerCard
              key={item.managerId}
              manager={item}
              onClick={() => onSelectManager(item.catalog)}
            />
          ))
        )}
      </section>
    </section>
  );
}
