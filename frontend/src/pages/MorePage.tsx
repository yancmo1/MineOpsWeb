import { SyncMetadata } from "../lib/db";
import { KolibriCredentials, KolibriDiagnostics } from "../lib/kolibri";
import { cleanDescription } from "../lib/textNormalization";

interface MorePageProps {
  credentials: KolibriCredentials;
  onCredentialsChange: (credentials: KolibriCredentials) => void;
  syncing: boolean;
  onSyncNow: () => void;
  diagnostics: KolibriDiagnostics | null;
  metadata: SyncMetadata;
  catalogCount: number;
}

export function MorePage({
  credentials,
  onCredentialsChange,
  syncing,
  onSyncNow,
  diagnostics,
  metadata,
  catalogCount,
}: MorePageProps) {
  return (
    <div className="more-page">
      {/* Kolibri Sync Section */}
      <section className="card-container">
        <h2 className="card-title">Kolibri Sync</h2>
        
        {/* Sync Status */}
        <div style={{ marginBottom: "1rem", padding: "0.75rem", backgroundColor: "var(--bg-secondary)", borderRadius: "0.5rem" }}>
          <p className="muted" style={{ margin: 0, fontSize: "0.875rem" }}>
            <strong>Last sync:</strong>{" "}
            {metadata.lastSuccessfulSyncAt
              ? new Date(metadata.lastSuccessfulSyncAt).toLocaleString()
              : "Never"}
          </p>
          {metadata.lastAttemptAt && metadata.lastAttemptAt !== metadata.lastSuccessfulSyncAt && (
            <p className="muted" style={{ margin: "0.25rem 0 0", fontSize: "0.875rem" }}>
              <strong>Last attempt:</strong>{" "}
              {new Date(metadata.lastAttemptAt).toLocaleString()}
            </p>
          )}
          {metadata.error && (
            <p style={{ margin: "0.25rem 0 0", fontSize: "0.875rem", color: "var(--accent-orange)" }}>
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
          <p className="muted" style={{ marginTop: "1rem", marginBottom: 0, fontSize: "0.875rem" }}>
            {diagnostics.managerCount} managers received · {diagnostics.payloadFormat} ·{" "}
            {diagnostics.unknownManagerCount} unmatched catalog IDs
          </p>
        )}
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
