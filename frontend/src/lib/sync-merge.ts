/**
 * Merge a fresh Kolibri sync into existing progress.
 *
 * Extracted verbatim from App.tsx's syncNow merge (2026-10-24) with one
 * addition: a row preserved only because the fresh sync did not resolve
 * that manager is marked `stale: true`.
 *
 * Why: the old merge silently kept the previous row when the new sync left
 * a manager unresolved (unlocked=false), while the sync timestamp still
 * advanced. A manager promoted in-game could therefore keep showing its
 * pre-promotion rank — and keep generating a "Rank N→N+1" suggestion —
 * after every later sync. A stale row may still be displayed as last-known
 * data, but it must never drive an upgrade suggestion (see upgrade-roi.ts).
 */

import type { PlayerManager } from "./db";

export function mergeProgress(existingProgress: PlayerManager[], freshProgress: PlayerManager[]): PlayerManager[] {
  const existingById = new Map(existingProgress.map((p) => [p.managerId, p]));
  return freshProgress.map((p) => {
    const existing = existingById.get(p.managerId);
    // If the new progress has unlocked=false and the manager had existing
    // progress with unlocked=true, keep the existing data (sync didn't touch
    // it) — but flag it stale so suggestions never trust its rank/level.
    if (existing && !p.unlocked && existing.unlocked) return { ...existing, stale: true };
    // The current save shape omits fragment counts. Never erase a known
    // local/manual fragment count just because this sync could not read it.
    // This row WAS resolved, so it is fresh, not stale.
    if (existing && p.fragmentSource === "unavailable" && existing.fragments > 0) {
      return { ...p, fragments: existing.fragments, fragmentSource: existing.fragmentSource ?? "manual" };
    }
    return p;
  });
}
