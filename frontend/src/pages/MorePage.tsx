import { type SyncMetadata, type AppSettings, saveSettings } from "../lib/db";
import { type KolibriCredentials, type KolibriDiagnostics } from "../lib/kolibri";
import {
  getAuthStatus,
  signIn,
  signOut,
  getBaseUrl,
  type AuthStatus,
} from "../lib/pocketbase";
import { type CaptureStatus } from "../lib/capture";
import { catalogClient, type CatalogClientState } from "../lib/catalog-client";
import type { CachedCatalogPackage } from "../lib/catalog-cache";
import { listImportRecords } from "../lib/import-history";
import type { ImportRecord } from "../lib/kolibri-fixtures";
import { describeCache, describeCatalogStatus, redactDiagnostic } from "../lib/operational-status";
import { useEffect, useState, type ReactNode } from "react";

interface MorePageProps {
  credentials: KolibriCredentials;
  onCredentialsChange: (credentials: KolibriCredentials) => void;
  syncing: boolean;
  onSyncNow: () => void;
  diagnostics: KolibriDiagnostics | null;
  metadata: SyncMetadata;
  catalogCount: number;
  settings: AppSettings;
  onSettingsChange: (s: AppSettings) => void;
  authStatus: AuthStatus;
  onAuthChange: () => void;
  onOpenSnapshotHistory: () => void;
  captureStatus: CaptureStatus;
  onRefreshCaptureStatus: () => void;
}

function CollapsibleSection({
  title,
  defaultOpen = false,
  ariaLive,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  ariaLive?: "polite" | "assertive" | "off";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="card-container" {...(ariaLive ? { "aria-live": ariaLive } : {})}>
      <h2
        className="card-title"
        onClick={() => setOpen(!open)}
        style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center" }}
      >
        <span>{title}</span>
        <span
          style={{
            fontSize: "0.75rem",
            color: "var(--text-secondary)",
            transition: "transform 0.2s",
            transform: open ? "rotate(180deg)" : "rotate(0deg)",
          }}
        >
          ▼
        </span>
      </h2>
      {open && <div className="collapsible-content">{children}</div>}
    </section>
  );
}

export function MorePage({
  credentials,
  onCredentialsChange,
  syncing,
  onSyncNow,
  diagnostics,
  metadata,
  catalogCount,
  settings,
  onSettingsChange,
  authStatus,
  onAuthChange,
  onOpenSnapshotHistory,
  captureStatus,
  onRefreshCaptureStatus,
}: MorePageProps) {
  const [pbEmail, setPbEmail] = useState("");
  const [pbPassword, setPbPassword] = useState("");
  const [pbError, setPbError] = useState<string | null>(null);
  const [pbBusy, setPbBusy] = useState(false);
  const [catalogState, setCatalogState] = useState<CatalogClientState>(() => ({ ...catalogClient }));
  const [packages, setPackages] = useState<CachedCatalogPackage[]>([]);
  const [imports, setImports] = useState<ImportRecord[]>([]);

  useEffect(() => {
    const refresh = async () => {
      setCatalogState({ ...catalogClient });
      setPackages(await catalogClient.getCachedPackages());
      setImports(await listImportRecords());
    };
    void refresh();
    return catalogClient.subscribe(() => { void refresh(); });
  }, []);

  async function handlePbSignIn() {
    setPbBusy(true);
    setPbError(null);
    try {
      await signIn(pbEmail, pbPassword);
      setPbEmail("");
      setPbPassword("");
      onAuthChange();
    } catch (err) {
      setPbError(err instanceof Error ? err.message : "Sign in failed");
    } finally {
      setPbBusy(false);
    }
  }

  async function handlePbSignOut() {
    signOut();
    onAuthChange();
  }

  async function handleAutoSyncToggle() {
    const newSettings = { ...settings, autoSync: !settings.autoSync };
    onSettingsChange(newSettings);
    await saveSettings(newSettings);
  }
  const catalogStatus = describeCatalogStatus(catalogState.loadState);
  const cacheDetail = describeCache(catalogState.cacheStatus, packages);
  const activePackage = packages.find((pkg) => pkg.isActive);
  return (
    <div className="more-page">
      <CollapsibleSection title="PocketBase Account">
        <p className="muted" style={{ marginTop: "-0.5rem", marginBottom: "0.75rem", fontSize: "0.8rem" }}>
          Server: {getBaseUrl()}
        </p>
        {authStatus.authenticated ? (
          <div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                padding: "0.75rem",
                background: "rgba(52, 199, 89, 0.1)",
                borderRadius: "0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              <span style={{ color: "#34c759", fontSize: "1.2rem" }}>✓</span>
              <div>
                <div style={{ fontWeight: 600 }}>{authStatus.email}</div>
                <div style={{ fontSize: "0.8rem", color: "var(--text-secondary)" }}>
                  Signed in
                </div>
              </div>
            </div>
            <button onClick={handlePbSignOut} style={{ width: "100%" }}>
              Sign Out
            </button>
          </div>
        ) : (
          <form onSubmit={(event) => { event.preventDefault(); void handlePbSignIn(); }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
                marginBottom: "0.75rem",
              }}
            >
              <span style={{ color: "var(--text-secondary)", fontSize: "1.2rem" }}>○</span>
              <span style={{ color: "var(--text-secondary)", fontSize: "0.875rem" }}>
                Not signed in — data is stored locally only
              </span>
            </div>
            <label style={{ display: "grid", gap: "0.25rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Email</span>
              <input
                type="email"
                name="email"
                autoComplete="username"
                value={pbEmail}
                onChange={(e) => setPbEmail(e.target.value)}
                placeholder="admin@mineops.yancmo.xyz"
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Password</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={pbPassword}
                onChange={(e) => setPbPassword(e.target.value)}
                placeholder="••••••••"
              />
            </label>
            {pbError && (
              <p
                style={{
                  color: "var(--accent-orange)",
                  fontSize: "0.8rem",
                  marginBottom: "0.5rem",
                }}
              >
                {pbError}
              </p>
            )}
            <button
              type="submit"
              disabled={pbBusy || !pbEmail || !pbPassword}
              style={{ width: "100%" }}
            >
              {pbBusy ? "Signing in…" : "Sign In"}
            </button>
          </form>
        )}
      </CollapsibleSection>

      <CollapsibleSection title="Sync Settings">
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            cursor: "pointer",
            padding: "0.5rem",
          }}
        >
          <input
            type="checkbox"
            checked={settings.autoSync}
            onChange={handleAutoSyncToggle}
            style={{ width: "1.25rem", height: "1.25rem", cursor: "pointer" }}
          />
          <div>
            <div style={{ fontWeight: 600 }}>Auto-sync on launch</div>
            <div
              style={{
                fontSize: "0.875rem",
                color: "var(--text-secondary)",
                marginTop: "0.25rem",
              }}
            >
              Automatically sync with Kolibri when app loads (requires saved credentials)
            </div>
          </div>
        </label>
      </CollapsibleSection>

      <CollapsibleSection title="Kolibri Sync">

        {/* Sync Status */}
        <div
          style={{
            marginBottom: "1rem",
            padding: "0.75rem",
            backgroundColor: "var(--bg-secondary)",
            borderRadius: "0.5rem",
          }}
        >
          <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
            <strong>Last sync:</strong>{" "}
            {metadata.lastSuccessfulSyncAt
              ? new Date(metadata.lastSuccessfulSyncAt).toLocaleString()
              : "Never"}
          </p>
          {metadata.lastAttemptAt &&
            metadata.lastAttemptAt !== metadata.lastSuccessfulSyncAt && (
              <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                <strong>Last attempt:</strong>{" "}
                {new Date(metadata.lastAttemptAt).toLocaleString()}
              </p>
            )}
          {metadata.error && (
            <p
              style={{
                margin: "0.25rem 0 0",
                fontSize: "0.875rem",
                color: "var(--accent-orange)",
              }}
            >
              <strong>Error:</strong> {redactDiagnostic(metadata.error)}
            </p>
          )}
          <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
            <strong>Status:</strong>{" "}
            {metadata.status === "never"
              ? "No sync attempted"
              : metadata.status === "current"
                ? "Up to date"
                : metadata.status === "stale"
                  ? "Needs sync"
                  : "Offline"}
          </p>
        </div>

        <form onSubmit={(event) => { event.preventDefault(); if (!syncing) onSyncNow(); }}>
        {/* Credentials */}
        <label style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>
            Kolibri ID or full debug string
          </span>
          <input
            value={credentials.kolibriId}
            onChange={(e) =>
              onCredentialsChange({ ...credentials, kolibriId: e.target.value })
            }
            placeholder="Paste UUID/debug ID"
          />
        </label>

        <label style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Auth token</span>
          <input
            type="password"
            name="authToken"
            autoComplete="current-password"
            value={credentials.authToken}
            onChange={(e) =>
              onCredentialsChange({ ...credentials, authToken: e.target.value })
            }
            placeholder="Token value"
          />
        </label>

        <label style={{ display: "grid", gap: "0.5rem", marginBottom: "1rem" }}>
          <span style={{ fontSize: "0.875rem", fontWeight: 600 }}>Save game key</span>
          <input
            type="password"
            name="saveGameKey"
            autoComplete="off"
            value={credentials.saveGameKey}
            onChange={(e) =>
              onCredentialsChange({ ...credentials, saveGameKey: e.target.value })
            }
            placeholder="0"
          />
        </label>

        {/* Sync Button */}
        <button type="submit" disabled={syncing} style={{ width: "100%" }}>
          {syncing ? "Syncing…" : "Sync Now"}
        </button>

        {/* Diagnostics */}
        {diagnostics && (
          <p
            className="muted"
            style={{ marginTop: "1rem", marginBottom: 0, fontSize: "0.875rem" }}
          >
            {diagnostics.managerCount} managers received · {diagnostics.payloadFormat} ·{" "}
            {diagnostics.unknownManagerCount} unmatched catalog IDs
          </p>
        )}
        </form>
      </CollapsibleSection>

      <CollapsibleSection title="Catalog package" ariaLive="polite">
        <p style={{ marginTop: "-0.5rem", fontSize: "0.875rem" }}><strong>{catalogStatus.label}</strong></p>
        <p className="muted" style={{ fontSize: "0.8rem" }}>{catalogStatus.detail}</p>
        <div style={{ padding: "0.75rem", background: "var(--bg-secondary)", borderRadius: "0.5rem", fontSize: "0.8rem" }}>
          <p style={{ margin: 0 }}><strong>Active release:</strong> {activePackage?.releaseId ?? "None"}</p>
          <p style={{ margin: "0.35rem 0 0" }}><strong>Manifest:</strong> {activePackage?.manifestHash ?? "Not available"}</p>
          <p style={{ margin: "0.35rem 0 0" }}><strong>Schema:</strong> {activePackage?.manifestSchemaVersion ?? "Not available"}</p>
          <p style={{ margin: "0.35rem 0 0" }}><strong>Cache:</strong> {catalogState.cacheStatus.packageCount} package(s), {cacheDetail.size}</p>
          <p style={{ margin: "0.35rem 0 0" }}><strong>Last-known-good:</strong> {cacheDetail.lastKnownGood}</p>
        </div>
        {activePackage && <div style={{ marginTop: "0.75rem", fontSize: "0.8rem" }}>
          <strong>Artifact verification</strong>
          {Object.values(activePackage.artifacts).map((artifact) => <p className="muted" key={artifact.filename} style={{ margin: "0.3rem 0" }}>✓ {artifact.filename} · {artifact.schemaVersion} · {artifact.bytes.toLocaleString()} bytes</p>)}
          {activePackage.warnings.map((warning) => <p key={warning} style={{ color: "var(--accent-orange)", margin: "0.3rem 0" }}>{redactDiagnostic(warning)}</p>)}
        </div>}
        <p className="muted" style={{ fontSize: "0.8rem", marginTop: "0.75rem" }}>{catalogStatus.recovery}</p>
        <button onClick={() => void catalogClient.reloadCatalog()} style={{ width: "100%" }}>Refresh catalog safely</button>
      </CollapsibleSection>

      <CollapsibleSection title="Snapshot History">
        <p className="muted" style={{ marginTop: "-0.5rem", marginBottom: "0.75rem", fontSize: "0.8rem" }}>
          Review changes between Kolibri syncs and restore previous game states.
        </p>
        <button onClick={onOpenSnapshotHistory} style={{ width: "100%" }}>
          View Snapshots
        </button>
      </CollapsibleSection>

      <CollapsibleSection title="Capture Status">
        <p className="muted" style={{ marginTop: "-0.5rem", marginBottom: "0.75rem", fontSize: "0.8rem" }}>
          APK extraction pipeline from ubuntumac. Refresh to check for new releases.
        </p>
        <div
          style={{
            padding: "0.75rem",
            backgroundColor: "var(--bg-secondary)",
            borderRadius: "0.5rem",
            marginBottom: "0.75rem",
          }}
        >
          {captureStatus.healthy ? (
            <>
              <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
                <strong>Status:</strong>{" "}
                <span style={{ color: "var(--accent-green, #34c759)" }}>Online</span>
              </p>
              {captureStatus.catalogVersionCount !== undefined && (
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                  <strong>Catalog versions:</strong> {captureStatus.catalogVersionCount}
                </p>
              )}
              {captureStatus.lastReleaseId && (
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                  <strong>Latest release:</strong> {captureStatus.lastReleaseId}
                </p>
              )}
              {captureStatus.lastSource && (
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                  <strong>Source:</strong> {redactDiagnostic(captureStatus.lastSource)}
                </p>
              )}
              {captureStatus.lastObjectCount !== undefined && (
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                  <strong>Objects captured:</strong> {captureStatus.lastObjectCount}
                </p>
              )}
              {captureStatus.lastIngestedAt && (
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
                  <strong>Last ingested:</strong>{" "}
                  {new Date(captureStatus.lastIngestedAt).toLocaleString()}
                </p>
              )}

              {captureStatus.recentReleases && captureStatus.recentReleases.length > 0 && (
                <div style={{ marginTop: "0.5rem" }}>
                  <p className="muted" style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600 }}>
                    Import history ({captureStatus.recentReleases.length} release{captureStatus.recentReleases.length !== 1 ? "s" : ""})
                  </p>
                  <div style={{ display: "grid", gap: "0.25rem", marginTop: "0.25rem" }}>
                    {captureStatus.recentReleases.slice(0, 5).map((release, idx) => (
                      <div key={`${release.releaseId}-${release.ingestedAt}-${idx}`} style={{
                        display: "flex", 
                        justifyContent: "space-between",
                        alignItems: "center",
                        gap: "0.5rem",
                        fontSize: "0.8rem",
                        padding: "0.15rem 0",
                      }}>
                        <span style={{ 
                          flex: 1, 
                          overflow: "hidden", 
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          color: idx === 0 ? "var(--accent-cyan)" : "var(--text-secondary)",
                        }}>
                          {idx === 0 ? "● " : ""}{release.releaseId}
                        </span>
                        <span className="muted" style={{ flexShrink: 0 }}>
                          {release.objectCount !== undefined ? `${release.objectCount} obj` : "—"}
                        </span>
                        <span className="muted" style={{ flexShrink: 0, fontSize: "0.75rem" }}>
                          {release.ingestedAt ? new Date(release.ingestedAt).toLocaleDateString() : ""}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {captureStatus.latestRawImport && (
                <div style={{ marginTop: "0.75rem", borderTop: "1px solid var(--border-color, rgba(255,255,255,0.08))", paddingTop: "0.5rem" }}>
                  <p className="muted" style={{ margin: 0, fontSize: "0.8rem", fontWeight: 600 }}>
                    Latest raw import (UbuntuMac payload)
                  </p>
                  {captureStatus.latestRawImport.versionName && (
                    <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
                      <strong>Game version:</strong> {captureStatus.latestRawImport.versionName}
                      {captureStatus.latestRawImport.versionCode !== undefined ? ` (code ${captureStatus.latestRawImport.versionCode})` : ""}
                    </p>
                  )}
                  {captureStatus.latestRawImport.totalAssets !== undefined && (
                    <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
                      <strong>Total assets extracted:</strong> {captureStatus.latestRawImport.totalAssets.toLocaleString()}
                    </p>
                  )}
                  {captureStatus.latestRawImport.objectTypes && captureStatus.latestRawImport.objectTypes.length > 0 && (
                    <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
                      <strong>Asset types:</strong> {captureStatus.latestRawImport.objectTypes.join(", ")}
                    </p>
                  )}
                  {captureStatus.latestRawImport.apkCount !== undefined && captureStatus.latestRawImport.apkCount > 0 && (
                    <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
                      <strong>APK files:</strong> {captureStatus.latestRawImport.apkCount}
                    </p>
                  )}
                </div>
              )}

              {captureStatus.notes && captureStatus.notes.length > 0 && (
                <div style={{ marginTop: "0.5rem" }}>
                  {captureStatus.notes.map((note) => (
                    <p key={note} className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.8rem" }}>
                      • {note}
                    </p>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
                <strong>Status:</strong>{" "}
                <span style={{ color: "var(--accent-orange)" }}>Unavailable</span>
              </p>
              {captureStatus.error && (
                <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--accent-orange)" }}>
                  {redactDiagnostic(captureStatus.error)}
                </p>
              )}
              <p className="muted" style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>
                Sign into PocketBase and ensure the capture-ingest endpoint is reachable.
              </p>
            </>
          )}
        </div>
        <button onClick={onRefreshCaptureStatus} style={{ width: "100%" }}>
          Refresh
        </button>
      </CollapsibleSection>

      <CollapsibleSection title="Player import history">
        {imports.length ? imports.slice(0, 5).map((record) => <p key={record.id ?? record.importedAt} className="muted" style={{ fontSize: "0.8rem" }}>{new Date(record.importedAt).toLocaleString()} · {record.source} · {record.resolvedCount} resolved / {record.unresolvedCount} unresolved · {record.catalogVersion ?? "no catalog reference"}</p>) : <p className="muted" style={{ fontSize: "0.8rem" }}>No local player imports recorded yet.</p>}
      </CollapsibleSection>

      <CollapsibleSection title="About this build">
        <p style={{ marginBottom: 0, fontSize: "0.875rem" }}>
          MineOpsWeb uses the verified Idle Miner Tycoon manager catalog ({catalogCount || "…"}{" "}
          records) and keeps catalog definitions separate from player state.
        </p>
      </CollapsibleSection>
    </div>
  );
}
