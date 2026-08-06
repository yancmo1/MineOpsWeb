import { type CatalogManager, type PlayerManager } from "./db";
import { minPromoForLevel } from "./crystal-planner";

export const FOCUS_LEVELS = [10, 20, 30, 40, 50] as const;

export function clampFocusLevel(value: number, currentLevel = 1): number {
  const safeCurrent = Math.max(1, Math.min(50, Math.floor(currentLevel)));
  const safeTarget = Math.max(safeCurrent, Math.min(50, Math.floor(value)));
  return FOCUS_LEVELS.find((level) => level >= safeTarget) ?? 50;
}

export function focusProgress(currentLevel: number, targetLevel: number): number {
  if (targetLevel <= currentLevel) return 100;
  return Math.max(0, Math.min(100, Math.round((currentLevel / targetLevel) * 100)));
}

export function buildUpgradeFocus(manager: CatalogManager, progress: PlayerManager, targetLevel: number) {
  const target = clampFocusLevel(targetLevel, progress.level);
  const targetMilestone = manager.progression?.find((row) => row.level === target);
  const targetPromotion = targetMilestone?.promotion ?? minPromoForLevel(target);
  const targetPassives = (manager.passives ?? []).filter((passive) => passive.unlockLevel === target);
  const nextPassive = (manager.passives ?? [])
    .filter((passive) => passive.unlockLevel != null && passive.unlockLevel > progress.level)
    .sort((a, b) => (a.unlockLevel ?? 999) - (b.unlockLevel ?? 999))[0];

  return {
    target,
    targetPromotion,
    currentLevel: progress.level,
    levelsRemaining: Math.max(0, target - progress.level),
    progressPct: focusProgress(progress.level, target),
    targetMilestoneCost: targetMilestone?.cost,
    targetPassives,
    nextPassive,
    reached: progress.level >= target,
  };
}
