import { describe, expect, it } from "vitest";
import { mergeProgress } from "./sync-merge";
import type { PlayerManager } from "./db";

function row(overrides: Partial<PlayerManager> & { managerId: string }): PlayerManager {
  return {
    level: 1,
    rank: 0,
    promoted: 0,
    fragments: 0,
    unlocked: false,
    updatedAt: "",
    ...overrides,
  };
}

describe("mergeProgress", () => {
  it("marks a preserved row stale when the fresh sync did not resolve it", () => {
    // The reported bug: a manager promoted in-game still suggested its old
    // rank because the merge silently kept the pre-promotion row.
    const existing = [row({ managerId: "chef-bearnard", unlocked: true, level: 20, rank: 2, fragments: 48 })];
    const fresh = [row({ managerId: "chef-bearnard", unlocked: false })];
    const merged = mergeProgress(existing, fresh);
    expect(merged).toHaveLength(1);
    expect(merged[0].rank).toBe(2);
    expect(merged[0].stale).toBe(true);
  });

  it("keeps fresh values (not stale) when the sync resolves the manager", () => {
    const existing = [row({ managerId: "chef-bearnard", unlocked: true, level: 20, rank: 2, fragments: 48 })];
    const fresh = [row({ managerId: "chef-bearnard", unlocked: true, level: 20, rank: 3, fragments: 4, fragmentSource: "kolibri" })];
    const merged = mergeProgress(existing, fresh);
    expect(merged[0].rank).toBe(3);
    expect(merged[0].fragments).toBe(4);
    expect(merged[0].stale).toBeFalsy();
  });

  it("preserves known fragments without marking a resolved row stale", () => {
    const existing = [row({ managerId: "chef-bearnard", unlocked: true, rank: 3, fragments: 48, fragmentSource: "kolibri" })];
    const fresh = [row({ managerId: "chef-bearnard", unlocked: true, rank: 3, fragments: 0, fragmentSource: "unavailable" })];
    const merged = mergeProgress(existing, fresh);
    expect(merged[0].fragments).toBe(48);
    expect(merged[0].stale).toBeFalsy();
  });

  it("does not resurrect a previously locked manager from a stale row", () => {
    const existing = [row({ managerId: "chef-bearnard", unlocked: false })];
    const fresh = [row({ managerId: "chef-bearnard", unlocked: false })];
    const merged = mergeProgress(existing, fresh);
    expect(merged[0].unlocked).toBe(false);
    expect(merged[0].stale).toBeFalsy();
  });
});
