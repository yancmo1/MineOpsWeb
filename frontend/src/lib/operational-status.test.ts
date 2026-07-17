import { describe, expect, it } from "vitest";
import { describeCatalogStatus, redactDiagnostic } from "./operational-status";

describe("catalog operational status", () => {
  it("distinguishes an offline cache fallback", () => {
    expect(describeCatalogStatus({ phase: "offline_cached", releaseId: "r1", manifestHash: "a", catalogVersion: "1" }).label).toBe("Offline cached package");
  });

  it("shows artifact progress while downloading", () => {
    expect(describeCatalogStatus({ phase: "fetching_artifacts", loaded: 1, total: 2 }).detail).toContain("1 of 2");
  });

  it("redacts credentials and local paths from diagnostics", () => {
    expect(redactDiagnostic("token=abc /Users/me/private.apk")).toBe("token=[redacted] [private path redacted]");
  });
});
