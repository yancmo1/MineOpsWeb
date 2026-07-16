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
import { useState } from "react";

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
  return (
    <div className="more-page">
      {/* PocketBase Account Section */}
      <section className="card-container">
        <h2 className="card-title">PocketBase Account</h2>
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
          <div>
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
                value={pbEmail}
                onChange={(e) => setPbEmail(e.target.value)}
                placeholder="admin@mineops.yancmo.xyz"
              />
            </label>
            <label style={{ display: "grid", gap: "0.25rem", marginBottom: "0.75rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>Password</span>
              <input
                type="password"
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
              onClick={handlePbSignIn}
              disabled={pbBusy || !pbEmail || !pbPassword}
              style={{ width: "100%" }}
            >
              {pbBusy ? "Signing in…" : "Sign In"}
            </button>
          </div>
        )}
      </section>

      {/* Sync Settings Section */}
      <section className="card-container">
        <h2 className="card-title">Sync Settings</h2>
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
      </section>

      {/* Kolibri Sync Section */}
      <section className="card-container">
        <h2 className="card-title">Kolibri Sync</h2>

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
              <strong>Error:</strong> {metadata.error}
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
            value={credentials.saveGameKey}
            onChange={(e) =>
              onCredentialsChange({ ...credentials, saveGameKey: e.target.value })
            }
            placeholder="0"
          />
        </label>

        {/* Sync Button */}
        <button onClick={() => onSyncNow()} disabled={syncing} style={{ width: "100%" }}>
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
      </section>

      {/* Snapshot History */}
      <section className="card-container">
        <h2 className="card-title">Snapshot History</h2>
        <p className="muted" style={{ marginTop: "-0.5rem", marginBottom: "0.75rem", fontSize: "0.8rem" }}>
          Review changes between Kolibri syncs and restore previous game states.
        </p>
        <button onClick={onOpenSnapshotHistory} style={{ width: "100%" }}>
          View Snapshots
        </button>
      </section>

      {/* Capture Status */}
      <section className="card-container">
        <h2 className="card-title">Capture Status</h2>
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
                  <strong>Source:</strong> {captureStatus.lastSource}
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
                      <div key={`${release.releaseId}-${release.ingestedAt}`} style={{ 
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
                  {captureStatus.error}
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
      </section>

      {/* About Section */}
      <section className="card-container">
        <h2 className="card-title">About this build</h2>
        <p style={{ marginBottom: 0, fontSize: "0.875rem" }}>
          MineOpsWeb uses the verified Idle Miner Tycoon manager catalog ({catalogCount || "…"}{" "}
          records) and keeps catalog definitions separate from player state.
        </p>
      </section>
    </div>
  );
}
