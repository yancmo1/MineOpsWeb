import type { CatalogPassive, PlayerManager } from "./db";

const PASSIVE_LABELS: Record<string, string> = {
  MSB: "Mining Speed Boost",
  CR: "Crate Resources",
  MSUCR: "Mineshaft Upgrade Cost Reduction",
  WUCR: "Warehouse Upgrade Cost Reduction",
  CIF: "Cash Income Factor",
  WMSB: "Walking & Mining Speed Boost",
  BUCR: "Building Upgrade Cost Reduction",
  EUCR: "Elevator Upgrade Cost Reduction",
  MLSB: "Mineshaft Loading Speed Boost",
  IC: "Instant Cash",
  MIF: "Mine Income Factor",
  WWLSB: "Worker Loading Speed Boost",
  EBEAM: "Elevator Beam",
  MSBEAM: "Mineshaft Beam",
  EMSB: "Elevator Movement Speed Boost",
  GWSB: "General Walking Speed Boost",
  WWLB: "Worker Loading Boost",
  WSB: "Walking Speed Boost",
  MBEAM: "Mine Beam",
  MLBSB: "Movement & Loading Speed Boost",
  ICB: "Idle Cash Boost",
  BULCR: "Barrier Unlock Cost Reduction",
  MSULCR: "Mineshaft Unlock Cost Reduction",
};

// Stable APK passive IDs take precedence over legacy row-position enrichment.
// These values come from the SuperManagerPassiveType enum in the 5.63 IL2CPP
// dump. Do not infer them from the order of the passive rows in a manager.
const PASSIVE_TYPES_BY_ID: Record<number, string> = {
  1: "EMSB",
  2: "GWSB",
  3: "MSB",
  4: "WWLSB",
  5: "WMSB",
  6: "MLBSB",
  7: "MSUCR",
  8: "EUCR",
  9: "WUCR",
  1001: "ICB",
  1005: "BULCR",
  1006: "MSULCR",
  1007: "MIF",
  1008: "MSBEAM",
  1009: "EBEAM",
  1010: "CIF",
};

const PLACEHOLDER_TYPE = /^passive[_ -]?\d+$/i;

export function isPlaceholderPassiveType(value?: string): boolean {
  return Boolean(value?.trim() && PLACEHOLDER_TYPE.test(value.trim()));
}

export function passiveLabel(passive: CatalogPassive): string {
  const code = (passive.passiveId != null ? PASSIVE_TYPES_BY_ID[passive.passiveId] : undefined) ?? passive.type?.trim();
  if (code && PASSIVE_LABELS[code]) return PASSIVE_LABELS[code];
  if (passive.description?.trim()) return passive.description.trim();
  if (code && !isPlaceholderPassiveType(code)) return code;
  return passive.passiveId == null ? "Passive ability" : `Passive ability #${passive.passiveId}`;
}

export function passiveTypeForId(passiveId?: number): string | undefined {
  return passiveId == null ? undefined : PASSIVE_TYPES_BY_ID[passiveId];
}

export function isPassiveUnlocked(passive: CatalogPassive, progress?: PlayerManager): boolean {
  if (!progress?.unlocked) return false;
  const hasPromotionRequirement = passive.promoReq != null;
  const hasLevelRequirement = passive.unlockLevel != null;
  if (!hasPromotionRequirement && !hasLevelRequirement) return false;
  if (hasPromotionRequirement && progress.promoted < passive.promoReq!) return false;
  if (hasLevelRequirement && progress.level < passive.unlockLevel!) return false;
  return true;
}

export function passiveRequirement(passive: CatalogPassive): string | undefined {
  if (passive.unlockLevel != null && passive.promoReq != null) {
    return `Lv ${passive.unlockLevel} · P${passive.promoReq}`;
  }
  if (passive.promoReq != null) return `Lv ${passive.promoReq * 10} · P${passive.promoReq}`;
  if (passive.unlockLevel != null) return `Lv ${passive.unlockLevel}`;
  return undefined;
}

export function activePassives(passives: CatalogPassive[] | undefined, progress?: PlayerManager): CatalogPassive[] {
  return (passives ?? []).filter((passive) => isPassiveUnlocked(passive, progress));
}
