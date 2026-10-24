import type { AuthStatus } from "../lib/pocketbase";
import type { CaptureStatus } from "../lib/capture";
import type { AppSettings, CatalogManager, PlayerInventoryEntry, PlayerManager, SyncMetadata } from "../lib/db";
import type { KolibriCredentials, KolibriDiagnostics } from "../lib/kolibri";
import type { MineState } from "../lib/mine-state";
import type { ToolboxView } from "../lib/navigation";
import type { SyncFeedback } from "../lib/sync-feedback";
import { CrewRoster } from "../components/CrewRoster";
import { LeadersPanel } from "../components/LeadersPanel";
import { MissionBoardPanel } from "../components/MissionBoardPanel";
import { SaveMinesPanel } from "../components/SaveMinesPanel";
import { MorePage } from "./MorePage";
import { StrategyPage } from "./StrategyPage";

export interface ToolboxPageProps {
  view: ToolboxView;
  onViewChange: (view: ToolboxView) => void;
  catalog: CatalogManager[];
  progress: PlayerManager[];
  inventory: PlayerInventoryEntry[];
  mineState: MineState | null;
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
  onSelectManager: (manager: CatalogManager) => void;
  // Settings & data (MorePage) wiring, passed through untouched.
  credentials: KolibriCredentials;
  onCredentialsChange: (credentials: KolibriCredentials) => void;
  syncing: boolean;
  onSyncNow: () => void | Promise<void>;
  diagnostics: KolibriDiagnostics | null;
  syncFeedback: SyncFeedback | null;
  metadata: SyncMetadata;
  authStatus: AuthStatus;
  onAuthChange: () => void;
  onOpenSnapshotHistory: () => void;
  captureStatus: CaptureStatus;
  onRefreshCaptureStatus: () => void | Promise<void>;
}

const ENTRIES: Array<{ view: Exclude<ToolboxView, "menu">; title: string; detail: string }> = [
  { view: "plays", title: "Plays & strategy tools", detail: "Manager lineup, compare, Ahead, Everdeep, Essence, progress tracker, and the Frontier playbook." },
  { view: "crew", title: "Crew roster", detail: "Every manager — search, filter by area and rarity, levels, ranks, and the lineup export." },
  { view: "mines", title: "Your mines in detail", detail: "Save facts per mine, rates from the game's tables, and the manual rate check." },
  { view: "leaders", title: "Leaders & upgrade focus", detail: "Strongest manager in each area, plus the one upgrade milestone you track." },
  { view: "data", title: "Settings & data", detail: "Sync, credentials, save inspector, snapshot history, cloud account, and releases." },
];

/**
 * Toolbox: everything that used to be stacked on Today/Plays/Data, behind
 * one door. A flat entry list; each entry hosts the existing page/panel
 * by composition — internals are not rewritten. (2026-10-23 refactor.)
 */
export function ToolboxPage(props: ToolboxPageProps) {
  const { view, onViewChange } = props;

  if (view === "menu") {
    return (
      <div className="toolbox-page">
        <section className="card-container">
          <p className="eyebrow">Everything else, one door</p>
          <h2 className="card-title">Toolbox</h2>
          <p className="muted">Home and My Plan cover the daily loop. Open a tool here only when you need it.</p>
          <div className="toolbox-list">
            {ENTRIES.map((entry) => (
              <button key={entry.view} type="button" className="toolbox-entry" onClick={() => onViewChange(entry.view)}>
                <span className="toolbox-entry-main"><strong>{entry.title}</strong><small>{entry.detail}</small></span>
                <span className="toolbox-entry-arrow" aria-hidden="true">→</span>
              </button>
            ))}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="toolbox-page">
      <p className="toolbox-back-row">
        <button type="button" className="secondary" onClick={() => onViewChange("menu")}>← Toolbox</button>
      </p>
      {view === "plays" && <StrategyPage progress={props.progress} inventory={props.inventory} />}
      {view === "crew" && (
        <CrewRoster
          catalog={props.catalog}
          progress={props.progress}
          onSelectManager={props.onSelectManager}
          onImportData={() => onViewChange("data")}
        />
      )}
      {view === "mines" && (
        <>
          <MissionBoardPanel
            catalog={props.catalog}
            progress={props.progress}
            mineState={props.mineState}
            onImport={() => onViewChange("data")}
          />
          <SaveMinesPanel mineState={props.mineState} catalog={props.catalog} />
        </>
      )}
      {view === "leaders" && (
        <LeadersPanel
          catalog={props.catalog}
          progress={props.progress}
          settings={props.settings}
          onSettingsChange={props.onSettingsChange}
        />
      )}
      {view === "data" && (
        <MorePage
          credentials={props.credentials}
          onCredentialsChange={props.onCredentialsChange}
          syncing={props.syncing}
          onSyncNow={props.onSyncNow}
          diagnostics={props.diagnostics}
          syncFeedback={props.syncFeedback}
          metadata={props.metadata}
          catalogCount={props.catalog.length}
          settings={props.settings}
          onSettingsChange={props.onSettingsChange}
          authStatus={props.authStatus}
          onAuthChange={props.onAuthChange}
          onOpenSnapshotHistory={props.onOpenSnapshotHistory}
          captureStatus={props.captureStatus}
          onRefreshCaptureStatus={props.onRefreshCaptureStatus}
        />
      )}
    </div>
  );
}
