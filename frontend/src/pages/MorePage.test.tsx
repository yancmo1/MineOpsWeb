// @vitest-environment node
import "fake-indexeddb/auto";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MorePage } from "./MorePage";

function renderMorePage() {
  return renderToStaticMarkup(
    React.createElement(MorePage, {
      credentials: { kolibriId: "", authToken: "", saveGameKey: "0" },
      onCredentialsChange: () => undefined,
      syncing: false,
      onSyncNow: () => undefined,
      diagnostics: null,
      metadata: { status: "never" },
      catalogCount: 118,
      settings: { autoSync: true },
      onSettingsChange: () => undefined,
      authStatus: { authenticated: false },
      onAuthChange: () => undefined,
      onOpenSnapshotHistory: () => undefined,
      captureStatus: { healthy: false },
      onRefreshCaptureStatus: () => undefined,
    }),
  );
}

describe("More page information architecture", () => {
  it("leads with health summaries and the three primary recovery actions", () => {
    const html = renderMorePage();
    for (const label of ["Player data", "Strategy catalog", "Cloud account", "Capture bridge"]) {
      expect(html).toContain(label);
    }
    expect(html).toContain("Sync player data");
    expect(html).toContain("Refresh catalog");
    expect(html).toContain("View history");
  });

  it("uses keyboard-operable disclosure buttons with explicit expanded state", () => {
    const html = renderMorePage();
    expect(html).toMatch(/<button[^>]+class="settings-section-toggle"[^>]+aria-expanded="true"[^>]+aria-controls=/);
    expect(html).toMatch(/<button[^>]+class="settings-section-toggle"[^>]+aria-expanded="false"[^>]+aria-controls=/);
    expect(html).not.toMatch(/<h2[^>]+onClick=/i);
  });

  it("keeps every operational workflow in a clear section", () => {
    const html = renderMorePage();
    for (const title of [
      "Player sync",
      "Catalog &amp; strategy data",
      "History &amp; recovery",
      "Cloud account",
      "Preferences",
      "Capture bridge",
      "Diagnostics &amp; about",
    ]) {
      expect(html).toContain(title);
    }
    expect(html).toContain('name="authToken"');
    expect(html).toContain('name="saveGameKey"');
    expect(html).toContain('type="password"');
  });
});
