import { useEffect, useId, useState, type ReactNode } from "react";
import { db, type SyncMetadata, type AppSettings, type PlayerManager, saveSettings } from "../lib/db";
import { type KolibriCredentials, type KolibriDiagnostics } from "../lib/kolibri";
import { signIn, signOut, getBaseUrl, type AuthStatus } from "../lib/pocketbase";
import { type CaptureStatus } from "../lib/capture";
import { catalogClient, type CatalogClientState } from "../lib/catalog-client";
import type { CachedCatalogPackage } from "../lib/catalog-cache";
import { listImportRecords } from "../lib/import-history";
import type { ImportRecord } from "../lib/kolibri-fixtures";
import { describeCache, describeCatalogStatus, redactDiagnostic } from "../lib/operational-status";

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

type StatusTone = "success" | "warning" | "neutral" | "error";

function StatusPill({ tone, children }: { tone: StatusTone; children: ReactNode }) {
  return <span className={`settings-status-pill ${tone}`}>{children}</span>;
}

function StatusSummary({
  label,
  value,
  detail,
  tone,
}: {
  label: string;
  value: string;
  detail: string;
  tone: StatusTone;
}) {
  return (
    <article className="settings-status-card">
      <div className="settings-status-card-heading">
        <span>{label}</span>
        <span className={`settings-status-dot ${tone}`} aria-hidden="true" />
      </div>
      <strong>{value}</strong>
      <p>{detail}</p>
    </article>
  );
}

function CollapsibleSection({
  title,
  description,
  status,
  defaultOpen = false,
  ariaLive,
  children,
}: {
  title: string;
  description: string;
  status?: ReactNode;
  defaultOpen?: boolean;
  ariaLive?: "polite" | "assertive" | "off";
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const contentId = `settings-section-${useId().replace(/:/g, "")}`;

  return (
    <section className={`settings-section${open ? " open" : ""}`}>
      <button
        type="button"
        className="settings-section-toggle"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="settings-section-heading">
          <span className="settings-section-title-row">
            <span className="settings-section-title">{title}</span>
            {status}
          </span>
          <span className="settings-section-description">{description}</span>
        </span>
        <span className="settings-section-chevron" aria-hidden="true">⌄</span>
      </button>
      <div
        id={contentId}
        className="settings-section-content"
        hidden={!open}
        {...(ariaLive ? { "aria-live": ariaLive } : {})}
      >
        {children}
      </div>
    </section>
  );
}

function formatDate(value?: string): string {
  return value ? new Date(value).toLocaleString() : "Never";
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
  const [progress, setProgress] = useState<PlayerManager[]>([]);
  const [bridgeCommandCopied, setBridgeCommandCopied] = useState(false);

  useEffect(() => {
    const refresh = async () => {
      setCatalogState({ ...catalogClient });
      setPackages(await catalogClient.getCachedPackages());
      setImports(await listImportRecords());
      setProgress(await db.progress.toArray());
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

  function handlePbSignOut() {
    signOut();
    onAuthChange();
  }

  async function handleAutoSyncToggle() {
    const newSettings = { ...settings, autoSync: !settings.autoSync };
    onSettingsChange(newSettings);
    await saveSettings(newSettings);
  }

  async function copyBridgeUpdateCommand() {
    try {
      await navigator.clipboard.writeText("ssh ubuntumac '~/mineops-data/bin/check-and-upload.sh'");
      setBridgeCommandCopied(true);
    } catch {
      setBridgeCommandCopied(false);
    }
  }

  const catalogStatus = describeCatalogStatus(catalogState.loadState);
  const cacheDetail = describeCache(catalogState.cacheStatus, packages);
  const activePackage = packages.find((pkg) => pkg.isActive);
  const coreContent = activePackage?.artifacts["catalog-core.json"]?.content as {
    releaseId?: string;
    managers?: Array<{ canonicalId?: string; id?: string }>;
  } | undefined;
  const catalogManagerIds = new Set(
    (coreContent?.managers ?? []).map((manager) => manager.canonicalId ?? manager.id ?? "").filter(Boolean),
  );
  const progressManagerIds = progress.map((manager) => manager.managerId);
  const orphanedProgressIds = progressManagerIds.filter((id) => id && !catalogManagerIds.has(id));
  const catalogSource = activePackage
    ? catalogState.loadState.phase === "bootstrap_fallback"
      ? "Bootstrap fallback"
      : catalogState.loadState.phase === "offline_cached"
        ? "Cached offline"
        : catalogState.loadState.phase === "active_stale"
          ? "Published, stale"
          : activePackage.source === "published"
            ? "Published"
            : activePackage.source
    : "Unavailable";
  const releaseIdentityMismatch = Boolean(
    activePackage && coreContent?.releaseId && activePackage.releaseId !== coreContent.releaseId,
  );
  const hasExactManagerLevels = Boolean(activePackage?.artifacts["manager-domain.json"]);
  const artifactCount = activePackage ? Object.keys(activePackage.artifacts).length : 0;

  const syncLabel = syncing
    ? "Syncing"
    : metadata.status === "current"
      ? "Current"
      : metadata.status === "stale"
        ? "Needs sync"
        : metadata.status === "offline"
          ? "Offline"
          : "Not synced";
  const syncTone: StatusTone = syncing
    ? "neutral"
    : metadata.status === "current"
      ? "success"
      : metadata.status === "stale"
        ? "warning"
        : metadata.status === "offline"
          ? "error"
          : "neutral";
  const catalogTone: StatusTone = activePackage && !releaseIdentityMismatch
    ? catalogState.loadState.phase === "active_stale" || catalogState.loadState.phase === "bootstrap_fallback"
      ? "warning"
      : "success"
    : "error";
  const accountTone: StatusTone = authStatus.authenticated ? "success" : "neutral";
  const bridgeTone: StatusTone = captureStatus.healthy ? "success" : "warning";

  return (
    <div className="more-page">
      <section className="more-hero" aria-labelledby="settings-data-heading">
        <div>
          <p className="eyebrow">Settings &amp; data</p>
          <h2 id="settings-data-heading">Keep MineOps current</h2>
          <p>
            Sync player progress, verify the active game catalog, and recover safely without mixing player data with catalog updates.
          </p>
        </div>
        <div className="more-quick-actions" aria-label="Quick actions">
          <button type="button" onClick={onSyncNow} disabled={syncing}>
            {syncing ? "Syncing…" : "Sync player data"}
          </button>
          <button type="button" className="secondary" onClick={() => void catalogClient.reloadCatalog()}>
            Refresh catalog
          </button>
          <button type="button" className="settings-quiet-button" onClick={onOpenSnapshotHistory}>
            View history
          </button>
        </div>
      </section>

      <section className="settings-status-grid" aria-label="MineOps data health">
        <StatusSummary
          label="Player data"
          value={syncLabel}
          detail={metadata.lastSuccessfulSyncAt ? `Last synced ${formatDate(metadata.lastSuccessfulSyncAt)}` : "No successful Kolibri sync yet"}
          tone={syncTone}
        />
        <StatusSummary
          label="Strategy catalog"
          value={activePackage ? `${catalogManagerIds.size || catalogCount || "—"} managers` : catalogStatus.label}
          detail={activePackage ? `${hasExactManagerLevels ? "Exact level tables" : "Compatibility data"} · ${artifactCount} verified artifacts` : catalogStatus.detail}
          tone={catalogTone}
        />
        <StatusSummary
          label="Cloud account"
          value={authStatus.authenticated ? "Connected" : "Local only"}
          detail={authStatus.authenticated ? authStatus.email ?? "PocketBase session active" : "Sign in for cross-device snapshots"}
          tone={accountTone}
        />
        <StatusSummary
          label="Capture bridge"
          value={captureStatus.healthy ? "Online" : "Unavailable"}
          detail={captureStatus.lastReleaseId ? `Latest ${captureStatus.lastReleaseId}` : "APK catalog capture status"}
          tone={bridgeTone}
        />
      </section>

      <div className="settings-layout">
        <div className="settings-primary-column">
          <CollapsibleSection
            title="Player sync"
            description="Kolibri credentials, freshness, and the next player-data sync."
            status={<StatusPill tone={syncTone}>{syncLabel}</StatusPill>}
            defaultOpen
          >
            <div className={`settings-callout ${metadata.error ? "error" : "neutral"}`} aria-live="polite">
              <div className="settings-facts">
                <div><span>Status</span><strong>{syncLabel}</strong></div>
                <div><span>Last successful</span><strong>{formatDate(metadata.lastSuccessfulSyncAt)}</strong></div>
                {metadata.lastAttemptAt && metadata.lastAttemptAt !== metadata.lastSuccessfulSyncAt && (
                  <div><span>Last attempt</span><strong>{formatDate(metadata.lastAttemptAt)}</strong></div>
                )}
              </div>
              {metadata.error && <p className="settings-error-text">{redactDiagnostic(metadata.error)}</p>}
            </div>

            <form className="settings-form" onSubmit={(event) => { event.preventDefault(); if (!syncing) onSyncNow(); }}>
              <div className="settings-field-grid">
                <label className="settings-field settings-field-wide">
                  <span>Kolibri ID or full debug string</span>
                  <input
                    value={credentials.kolibriId}
                    onChange={(event) => onCredentialsChange({ ...credentials, kolibriId: event.target.value })}
                    placeholder="Paste UUID or full debug ID"
                    spellCheck={false}
                  />
                  <small>The full debug string is accepted; MineOps extracts and validates the player ID.</small>
                </label>
                <label className="settings-field">
                  <span>Auth token</span>
                  <input
                    type="password"
                    name="authToken"
                    autoComplete="current-password"
                    value={credentials.authToken}
                    onChange={(event) => onCredentialsChange({ ...credentials, authToken: event.target.value })}
                    placeholder="Token value"
                  />
                </label>
                <label className="settings-field">
                  <span>Save game key</span>
                  <input
                    type="password"
                    name="saveGameKey"
                    autoComplete="off"
                    value={credentials.saveGameKey}
                    onChange={(event) => onCredentialsChange({ ...credentials, saveGameKey: event.target.value })}
                    placeholder="0"
                  />
                </label>
              </div>
              <button type="submit" className="settings-full-button" disabled={syncing}>
                {syncing ? "Syncing player data…" : "Sync player data"}
              </button>
            </form>

            {diagnostics && (
              <div className="settings-diagnostic-summary">
                <strong>Last response</strong>
                <p>
                  {diagnostics.managerCount} managers received · {diagnostics.payloadFormat} · {diagnostics.unknownManagerCount} unmatched IDs
                </p>
                <p>
                  {diagnostics.fragmentFieldCount ?? 0} fragment counts present · {diagnostics.fragmentMissingCount ?? 0} missing from save
                </p>
                {diagnostics.unresolvedSampleIds && diagnostics.unresolvedSampleIds.length > 0 && (
                  <p className="settings-code-line">Sample IDs: {diagnostics.unresolvedSampleIds.join(", ")}</p>
                )}
              </div>
            )}
          </CollapsibleSection>

          <CollapsibleSection
            title="Catalog & strategy data"
            description="The verified release used for manager facts and strategy scoring."
            status={<StatusPill tone={catalogTone}>{activePackage ? "Verified" : catalogStatus.label}</StatusPill>}
            defaultOpen
            ariaLive="polite"
          >
            <div className="catalog-health-heading">
              <div>
                <strong>{catalogStatus.label}</strong>
                <p>{catalogStatus.detail}</p>
              </div>
              {hasExactManagerLevels && <StatusPill tone="success">Exact levels active</StatusPill>}
            </div>

            <div className="settings-metric-grid">
              <div><strong>{catalogManagerIds.size || "—"}</strong><span>Managers</span></div>
              <div><strong>{artifactCount || "—"}</strong><span>Verified artifacts</span></div>
              <div><strong>{catalogState.cacheStatus.packageCount}</strong><span>Cached packages</span></div>
            </div>

            <dl className="settings-detail-list">
              <div><dt>Active release</dt><dd>{activePackage?.releaseId ?? "None"}</dd></div>
              <div><dt>Source</dt><dd>{catalogSource} · {activePackage?.verificationState ?? "not verified"}</dd></div>
              <div><dt>Cache size</dt><dd>{cacheDetail.size}</dd></div>
              <div><dt>Strategy level data</dt><dd>{hasExactManagerLevels ? "Exact APK level tables" : "Compatibility fallback"}</dd></div>
            </dl>

            {orphanedProgressIds.length > 0 && (
              <div className="settings-warning" role="status">
                {orphanedProgressIds.length} player IDs are not in the active catalog: {orphanedProgressIds.slice(0, 5).join(", ")}{orphanedProgressIds.length > 5 ? "…" : ""}
              </div>
            )}
            {releaseIdentityMismatch && (
              <div className="settings-warning" role="alert">
                Catalog release identity mismatch detected. Refresh the catalog before syncing player data.
              </div>
            )}

            {activePackage && (
              <details className="settings-technical-details">
                <summary>Technical catalog details</summary>
                <p>Manifest: <code>{activePackage.manifestHash}</code></p>
                <p>Schema {activePackage.manifestSchemaVersion} · last-known-good {cacheDetail.lastKnownGood}</p>
                <div className="settings-artifact-list">
                  {Object.values(activePackage.artifacts).map((artifact) => (
                    <span key={artifact.filename}>✓ {artifact.filename} · {artifact.schemaVersion} · {artifact.bytes.toLocaleString()} bytes</span>
                  ))}
                </div>
                {activePackage.warnings.map((warning) => <p className="settings-error-text" key={warning}>{redactDiagnostic(warning)}</p>)}
              </details>
            )}

            <p className="settings-help-text">{catalogStatus.recovery}</p>
            <button type="button" className="settings-full-button" onClick={() => void catalogClient.reloadCatalog()}>
              Refresh catalog safely
            </button>
          </CollapsibleSection>

          <CollapsibleSection
            title="History & recovery"
            description="Review imports and restore an earlier player snapshot without changing the catalog."
            status={<StatusPill tone="neutral">{imports.length} local imports</StatusPill>}
          >
            <div className="settings-action-row">
              <div>
                <strong>Snapshot history</strong>
                <p>Compare Kolibri syncs and restore a previous player state.</p>
              </div>
              <button type="button" onClick={onOpenSnapshotHistory}>View snapshots</button>
            </div>

            <div className="settings-subsection">
              <h3>Recent player imports</h3>
              {imports.length ? (
                <ol className="settings-history-list">
                  {imports.slice(0, 5).map((record) => (
                    <li key={record.id ?? record.importedAt}>
                      <div>
                        <strong>{record.source}</strong>
                        <time dateTime={record.importedAt}>{formatDate(record.importedAt)}</time>
                      </div>
                      <span>{record.resolvedCount} resolved · {record.unresolvedCount} unresolved</span>
                      <small>{record.catalogVersion ?? "No catalog reference"}</small>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="settings-empty-note">No local player imports recorded yet.</p>
              )}
            </div>
          </CollapsibleSection>
        </div>

        <aside className="settings-secondary-column" aria-label="Connections and preferences">
          <CollapsibleSection
            title="Cloud account"
            description="Optional PocketBase sign-in for cross-device snapshots."
            status={<StatusPill tone={accountTone}>{authStatus.authenticated ? "Connected" : "Local only"}</StatusPill>}
          >
            {authStatus.authenticated ? (
              <div>
                <div className="settings-account-state success">
                  <span className="settings-account-mark" aria-hidden="true">✓</span>
                  <div><strong>{authStatus.email}</strong><span>Signed in to PocketBase</span></div>
                </div>
                <button type="button" className="settings-full-button secondary" onClick={handlePbSignOut}>Sign out</button>
              </div>
            ) : (
              <form className="settings-form" onSubmit={(event) => { event.preventDefault(); void handlePbSignIn(); }}>
                <div className="settings-account-state">
                  <span className="settings-account-mark" aria-hidden="true">○</span>
                  <div><strong>Local data only</strong><span>Your browser remains the primary local store.</span></div>
                </div>
                <label className="settings-field">
                  <span>Email</span>
                  <input type="email" name="email" autoComplete="username" value={pbEmail} onChange={(event) => setPbEmail(event.target.value)} placeholder="you@example.com" />
                </label>
                <label className="settings-field">
                  <span>Password</span>
                  <input type="password" name="password" autoComplete="current-password" value={pbPassword} onChange={(event) => setPbPassword(event.target.value)} placeholder="••••••••" />
                </label>
                {pbError && <p className="settings-error-text" role="alert">{pbError}</p>}
                <button type="submit" className="settings-full-button" disabled={pbBusy || !pbEmail || !pbPassword}>
                  {pbBusy ? "Signing in…" : "Sign in"}
                </button>
              </form>
            )}
            <p className="settings-endpoint">Server <code>{getBaseUrl()}</code></p>
          </CollapsibleSection>

          <CollapsibleSection
            title="Preferences"
            description="Control when this browser refreshes player data."
            status={<StatusPill tone={settings.autoSync ? "success" : "neutral"}>{settings.autoSync ? "Auto-sync on" : "Manual"}</StatusPill>}
            defaultOpen
          >
            <label className="settings-toggle">
              <span>
                <strong>Auto-sync on launch</strong>
                <small>Sync with Kolibri when MineOps opens and saved credentials are available.</small>
              </span>
              <input type="checkbox" checked={settings.autoSync} onChange={() => void handleAutoSyncToggle()} />
            </label>
          </CollapsibleSection>

          <CollapsibleSection
            title="Capture bridge"
            description="UbuntuMac APK capture and Oracle ingest status."
            status={<StatusPill tone={bridgeTone}>{captureStatus.healthy ? "Online" : "Unavailable"}</StatusPill>}
          >
            <div className="bridge-manual-update">
              <strong>Publish a newer game catalog</strong>
              <p>The web app can verify a published release, but it cannot start APK capture on UbuntuMac.</p>
              <button type="button" className="secondary" onClick={() => void copyBridgeUpdateCommand()}>
                {bridgeCommandCopied ? "Command copied" : "Copy UbuntuMac update command"}
              </button>
              <p className="bridge-manual-steps">Run the command on your Mac, then refresh bridge status and the catalog.</p>
            </div>

            {captureStatus.healthy ? (
              <dl className="settings-detail-list">
                <div><dt>Status</dt><dd className="settings-success-text">Online</dd></div>
                {captureStatus.catalogVersionCount !== undefined && <div><dt>Catalog versions</dt><dd>{captureStatus.catalogVersionCount}</dd></div>}
                {captureStatus.lastReleaseId && <div><dt>Latest release</dt><dd>{captureStatus.lastReleaseId}</dd></div>}
                {captureStatus.lastSource && <div><dt>Source</dt><dd>{redactDiagnostic(captureStatus.lastSource)}</dd></div>}
                {captureStatus.lastObjectCount !== undefined && <div><dt>Objects captured</dt><dd>{captureStatus.lastObjectCount.toLocaleString()}</dd></div>}
                {captureStatus.lastIngestedAt && <div><dt>Last ingested</dt><dd>{formatDate(captureStatus.lastIngestedAt)}</dd></div>}
              </dl>
            ) : (
              <div className="settings-warning" role="status">
                {captureStatus.error ? redactDiagnostic(captureStatus.error) : "Capture status is unavailable."} Sign in and confirm the capture endpoint is reachable.
              </div>
            )}

            {captureStatus.recentReleases && captureStatus.recentReleases.length > 0 && (
              <div className="settings-subsection">
                <h3>Recent releases</h3>
                <ol className="settings-release-list">
                  {captureStatus.recentReleases.slice(0, 5).map((release, index) => (
                    <li key={`${release.releaseId}-${release.ingestedAt}-${index}`}>
                      <span>{index === 0 ? "Current ingest" : `Previous ${index}`}</span>
                      <strong>{release.releaseId}</strong>
                      <small>{release.objectCount !== undefined ? `${release.objectCount.toLocaleString()} objects` : "Object count unavailable"}{release.ingestedAt ? ` · ${new Date(release.ingestedAt).toLocaleDateString()}` : ""}</small>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {captureStatus.latestRawImport && (
              <details className="settings-technical-details">
                <summary>Latest raw import metadata</summary>
                {captureStatus.latestRawImport.versionName && <p>Game {captureStatus.latestRawImport.versionName}{captureStatus.latestRawImport.versionCode !== undefined ? ` · code ${captureStatus.latestRawImport.versionCode}` : ""}</p>}
                {captureStatus.latestRawImport.totalAssets !== undefined && <p>{captureStatus.latestRawImport.totalAssets.toLocaleString()} extracted assets</p>}
                {captureStatus.latestRawImport.objectTypes && captureStatus.latestRawImport.objectTypes.length > 0 && <p>Types: {captureStatus.latestRawImport.objectTypes.join(", ")}</p>}
                {captureStatus.latestRawImport.apkCount !== undefined && captureStatus.latestRawImport.apkCount > 0 && <p>{captureStatus.latestRawImport.apkCount} APK files</p>}
              </details>
            )}

            {captureStatus.notes && captureStatus.notes.length > 0 && (
              <ul className="settings-note-list">{captureStatus.notes.map((note) => <li key={note}>{note}</li>)}</ul>
            )}
            <button type="button" className="settings-full-button secondary" onClick={onRefreshCaptureStatus}>Refresh bridge status</button>
          </CollapsibleSection>

          <CollapsibleSection
            title="Diagnostics & about"
            description="Technical identity, cache, and build information."
          >
            <dl className="settings-detail-list">
              <div><dt>Catalog records</dt><dd>{catalogCount || "Loading…"}</dd></div>
              <div><dt>Player rows on device</dt><dd>{progress.length}</dd></div>
              <div><dt>Active release</dt><dd>{activePackage?.releaseId ?? "None"}</dd></div>
              <div><dt>Manifest</dt><dd className="settings-hash">{activePackage?.manifestHash ?? "Unavailable"}</dd></div>
              <div><dt>Connection</dt><dd>{typeof navigator !== "undefined" && navigator.onLine ? "Online" : "Offline"}</dd></div>
            </dl>
            <p className="settings-help-text">
              MineOps keeps verified game definitions separate from player progress. Resetting or refreshing the catalog does not delete player snapshots.
            </p>
          </CollapsibleSection>
        </aside>
      </div>
    </div>
  );
}
