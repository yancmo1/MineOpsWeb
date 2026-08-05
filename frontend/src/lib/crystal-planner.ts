/**
 * Crystal planner — budget calculator for spending crystals on a Super Manager.
 *
 * Ports idle-miners.com's crystal planner STRUCTURE (the rank/promo/level gate
 * rules are game mechanics) while keeping the crystal cost schedule as an
 * explicit MANUAL INPUT: crystal prices are event-shop data the APK does not
 * publish, so the player enters the schedule they see in-game. The planner then
 * validates the gates, sums the level/promo steps, applies the discount, and
 * checks affordability against blue/red budgets.
 */

export const MAX_LEVEL = 50;
export const MAX_PROMO = 5;

/** L1-10→P0, L11-20→P10, L21-30→P20, L31-40→P30, L41-50→P40. */
export function minPromoForLevel(level: number): number {
  return Math.max(0, Math.min(MAX_PROMO, Math.ceil(level / 10) - 1));
}

/** R2→2, R3→3, R4→4, R5→5; R1 maxes at P1. */
export function maxPromoForRank(rank: number): number {
  if (rank <= 1) return 1;
  return rank;
}

/** L1-20→R0, L21-30→R2, L31-40→R3, L41-50→R4. */
export function minRankForLevel(level: number): number {
  if (level <= 20) return 0;
  if (level <= 30) return 2;
  if (level <= 40) return 3;
  return 4;
}

/** P20→R2, P30→R3, ... P0/P10 need R0. */
export function minRankForPromo(promo: number): number {
  if (promo <= 1) return 0;
  return promo;
}

export interface CrystalCostTable {
  /** Cost in crystals to level INTO each target level (index targetLevel-1). */
  bluePerLevel: number[];
  /** Cost in crystals to promote INTO each target promo (index targetPromo). */
  redPerPromo: number[];
}

export interface CrystalPlannerInput {
  fromLevel: number;
  toLevel: number;
  fromPromo: number;
  toPromo: number;
  costTable: CrystalCostTable;
  blueBudget: number;
  /** null = unlimited (red cap toggle off). */
  redBudget: number | null;
  /** 0..100 percent discount applied to the total. */
  discountPct: number;
}

export interface CrystalStep {
  kind: "level" | "promo";
  from: number;
  to: number;
  cost: number;
}

export interface CrystalPlanResult {
  blueLevels: number;
  redPromos: number;
  blueCost: number; // after discount
  redCost: number; // after discount
  blueBudgetOk: boolean;
  redBudgetOk: boolean;
  gates: Array<{ field: string; message: string; ok: boolean }>;
  steps: CrystalStep[];
}

export function crystalCostAfterDiscount(cost: number, discountPct: number): number {
  return Math.max(0, Math.round(cost * (1 - Math.max(0, Math.min(100, discountPct)) / 100)));
}

export function planCrystalSpend(input: CrystalPlannerInput): CrystalPlanResult {
  const { fromLevel, toLevel, fromPromo, toPromo } = input;
  const clampLevel = (level: number): number => Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  const clampPromo = (promo: number): number => Math.max(0, Math.min(MAX_PROMO, Math.floor(promo)));
  const fromL = clampLevel(fromLevel);
  const toL = clampLevel(toLevel);
  const fromP = clampPromo(fromPromo);
  const toP = clampPromo(toPromo);

  const gates: Array<{ field: string; message: string; ok: boolean }> = [];
  gates.push({
    field: "level/promo",
    message: `Target level ${toL} requires promo P${minPromoForLevel(toL)} or higher.`,
    ok: toP >= minPromoForLevel(toL),
  });
  gates.push({
    field: "level/promo",
    message: `Current level ${fromL} requires promo P${minPromoForLevel(fromL)} or higher.`,
    ok: fromP >= minPromoForLevel(fromL),
  });

  const steps: CrystalStep[] = [];
  let blueRaw = 0;
  let redRaw = 0;
  for (let level = fromL + 1; level <= toL; level++) {
    const cost = input.costTable.bluePerLevel[level - 1] ?? 0;
    blueRaw += cost;
    steps.push({ kind: "level", from: level - 1, to: level, cost });
  }
  for (let promo = fromP + 1; promo <= toP; promo++) {
    const cost = input.costTable.redPerPromo[promo] ?? 0;
    redRaw += cost;
    steps.push({ kind: "promo", from: promo - 1, to: promo, cost });
  }

  const blueCost = crystalCostAfterDiscount(blueRaw, input.discountPct);
  const redCost = crystalCostAfterDiscount(redRaw, input.discountPct);
  const blueBudget = Math.max(0, input.blueBudget);
  const redBudget = input.redBudget == null ? Infinity : Math.max(0, input.redBudget);

  return {
    blueLevels: Math.max(0, toL - fromL),
    redPromos: Math.max(0, toP - fromP),
    blueCost,
    redCost,
    blueBudgetOk: blueCost <= blueBudget,
    redBudgetOk: redCost <= redBudget,
    gates,
    steps,
  };
}
