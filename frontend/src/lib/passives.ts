import type { CatalogPassive, PlayerManager } from "./db";

const PASSIVE_LABELS: Record<string, string> = {
  MSB: "Mining Speed Boost",
  CR: "Crate Resources",
  MSUCR: "Mineshaft Upgrade Cost Reduction",
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
};

// Stable APK passive IDs take precedence over legacy row-position enrichment.
// ID 8 is elevator upgrade-cost reduction; it is not crate resources.
const PASSIVE_TYPES_BY_ID: Record<number, string> = {
  7: "MSUCR",
  8: "EUCR",
  9: "BUCR",
  1007: "MIF",
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
