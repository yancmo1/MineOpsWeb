import type { CatalogManager, PlayerInventoryEntry } from "./db";

export type EssenceKey = "nature" | "frost" | "flame" | "light" | "dark" | "wind" | "sand" | "water" | "epic" | "legendary" | "chaos" | "order";
export const ESSENCE_TYPES: Array<{ key: EssenceKey; label: string; id: number }> = [
  { key: "nature", label: "Nature", id: 4100000 }, { key: "frost", label: "Frost", id: 4100002 }, { key: "flame", label: "Flame", id: 4100003 },
  { key: "light", label: "Light", id: 4100004 }, { key: "dark", label: "Dark", id: 4100001 }, { key: "wind", label: "Wind", id: 4100007 },
  { key: "sand", label: "Sand", id: 4100005 }, { key: "water", label: "Water", id: 4100006 }, { key: "epic", label: "Epic", id: 4100008 },
  { key: "legendary", label: "Legendary", id: 4100009 }, { key: "chaos", label: "Chaos", id: 4100010 }, { key: "order", label: "Order", id: 4100011 },
];
export type EssenceInventory = Record<EssenceKey, number>;
export type EssenceRecipe = { rank: number; ingredients: Array<{ id: number; amount: number }> };
export const emptyEssenceInventory = (): EssenceInventory => Object.fromEntries(ESSENCE_TYPES.map(({ key }) => [key, 0])) as EssenceInventory;
export function essenceKeyForId(id: number | undefined): EssenceKey | undefined { return ESSENCE_TYPES.find((type) => type.id === id)?.key; }
function essenceKeyForText(value: string): EssenceKey | undefined { const text = value.toLowerCase(); return ESSENCE_TYPES.find(({ key, label }) => text.includes(key) || text.includes(label.toLowerCase()))?.key; }
export function essenceInventoryFromEntries(entries: PlayerInventoryEntry[]): { inventory: EssenceInventory; matchedRows: number; totalRows: number } {
  const inventory = emptyEssenceInventory(); let matchedRows = 0;
  for (const entry of entries.filter((row) => row.kind === "essence")) { const key = essenceKeyForId(entry.itemId) ?? essenceKeyForText(`${entry.key} ${entry.sourceKey} ${entry.sourcePath}`); if (!key) continue; inventory[key] += Math.max(0, entry.quantity); matchedRows += 1; }
  return { inventory, matchedRows, totalRows: entries.filter((row) => row.kind === "essence").length };
}
export function essenceRecipesForManager(manager: CatalogManager): EssenceRecipe[] { return (manager.elementalRecipe ?? []).filter((recipe) => recipe.ingredients.length > 0); }
export type EssencePlanRow = { key: EssenceKey; label: string; needed: number; owned: number; delta: number };
export function planEssenceUpgrade(manager: CatalogManager, currentRank: number, targetRank: number, inventory: EssenceInventory): { rows: EssencePlanRow[]; recipeCount: number; available: boolean } {
  const recipes = essenceRecipesForManager(manager).filter((recipe) => recipe.rank >= currentRank && recipe.rank < targetRank); const needed = emptyEssenceInventory();
  for (const recipe of recipes) for (const ingredient of recipe.ingredients) { const key = essenceKeyForId(ingredient.id); if (key) needed[key] += ingredient.amount; }
  return { rows: ESSENCE_TYPES.map(({ key, label }) => ({ key, label, needed: needed[key], owned: inventory[key], delta: inventory[key] - needed[key] })), recipeCount: recipes.length, available: recipes.length === Math.max(0, targetRank - currentRank) };
}
