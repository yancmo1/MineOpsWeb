import type { PlayerManager } from "./db";

export type SyncFeedback = {
  syncedAt: string;
  managersReceived: number;
  managersChanged: number;
  levelsIncreased: number;
  starsIncreased: number;
  promotionsIncreased: number;
  fragmentsIncreased: number;
  equipmentChanged: number;
  passiveValuesFound: number;
};

/** Compare normalized player rows without retaining or exposing the raw save. */
export function buildSyncFeedback(before: PlayerManager[], after: PlayerManager[], syncedAt: string): SyncFeedback {
  const previous = new Map(before.map((manager) => [manager.managerId, manager]));
  let managersChanged = 0;
  let levelsIncreased = 0;
  let starsIncreased = 0;
  let promotionsIncreased = 0;
  let fragmentsIncreased = 0;
  let equipmentChanged = 0;

  for (const manager of after) {
    const old = previous.get(manager.managerId);
    if (!old) continue;
    const changed = manager.level !== old.level
      || manager.rank !== old.rank
      || manager.promoted !== old.promoted
      || manager.fragments !== old.fragments
      || JSON.stringify(manager.equipmentIds ?? []) !== JSON.stringify(old.equipmentIds ?? []);
    if (changed) managersChanged += 1;
    if (manager.level > old.level) levelsIncreased += 1;
    if (manager.rank > old.rank) starsIncreased += 1;
    if (manager.promoted > old.promoted) promotionsIncreased += 1;
    if (manager.fragments > old.fragments) fragmentsIncreased += 1;
    if (JSON.stringify(manager.equipmentIds ?? []) !== JSON.stringify(old.equipmentIds ?? [])) equipmentChanged += 1;
  }

  return {
    syncedAt,
    managersReceived: after.filter((manager) => manager.unlocked).length,
    managersChanged,
    levelsIncreased,
    starsIncreased,
    promotionsIncreased,
    fragmentsIncreased,
    equipmentChanged,
    passiveValuesFound: after.filter((manager) => manager.passiveValueSource === "kolibri").length,
  };
}
