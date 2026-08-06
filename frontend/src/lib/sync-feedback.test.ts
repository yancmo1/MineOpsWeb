import { describe, expect, it } from "vitest";
import { buildSyncFeedback } from "./sync-feedback";
import type { PlayerManager } from "./db";

const manager = (patch: Partial<PlayerManager> = {}): PlayerManager => ({
  managerId: "sm-10066", level: 10, rank: 1, promoted: 1, fragments: 4,
  equipmentIds: [], unlocked: true, updatedAt: "", ...patch,
});

describe("buildSyncFeedback", () => {
  it("counts meaningful roster changes and evidence coverage", () => {
    const result = buildSyncFeedback(
      [manager()],
      [manager({ level: 30, rank: 3, promoted: 2, fragments: 8, equipmentIds: [11031], passiveValueSource: "kolibri" })],
      "2026-08-05T12:00:00.000Z",
    );
    expect(result).toMatchObject({ managersReceived: 1, managersChanged: 1, levelsIncreased: 1, starsIncreased: 1, promotionsIncreased: 1, fragmentsIncreased: 1, equipmentChanged: 1, passiveValuesFound: 1 });
  });

  it("reports zero changes for a repeat sync", () => {
    const row = manager();
    expect(buildSyncFeedback([row], [row], "now")).toMatchObject({ managersChanged: 0, levelsIncreased: 0, starsIncreased: 0, equipmentChanged: 0 });
  });
});
