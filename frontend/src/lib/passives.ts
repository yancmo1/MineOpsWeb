import type { CatalogPassive, PlayerManager } from "./db";

const PASSIVE_LABELS: Record<string, string> = {
  MSB: "Mining Speed Boost",
  CR: "Crate Resources",
  MSUCR: "Mineshaft Upgrade Cost Reduction",
  CIF: "Cash Income Factor",
  WMSB: "Walking & Mining Speed Boost",
  BUCR: "Building Upgrade Cost Reduction",
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

const PLACEHOLDER_TYPE = /^passive[_ -]?\d+$/i;

export function isPlaceholderPassiveType(value?: string): boolean {
  return Boolean(value?.trim() && PLACEHOLDER_TYPE.test(value.trim()));
}

export function passiveLabel(passive: CatalogPassive): string {
  const code = passive.type?.trim();
  if (code && PASSIVE_LABELS[code]) return PASSIVE_LABELS[code];
  if (passive.description?.trim()) return passive.description.trim();
  if (code && !isPlaceholderPassiveType(code)) return code;
  return passive.passiveId == null ? "Passive ability" : `Passive ability #${passive.passiveId}`;
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
