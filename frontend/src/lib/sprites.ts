import { CatalogManager } from "./db";

/**
 * Get sprite image URL for a manager.
 *
 * iOS equivalent: SMMasterDataService.spriteURL(for:) uses manager.id as the
 * sprite name when no explicit sprite field exists in the catalog.
 *
 * The idle-miners.com site stores sprites at:
 *   /static/sprites/<Rarity>/<sprite-id>.webp
 * where <Rarity> is the capitalized rarity (e.g. "Legendary", "Epic")
 * and <sprite-id> is the manager's catalog `id` field.
 */
export const spriteURL = (manager: CatalogManager) => {
  const spriteId = manager.sprite ?? manager.id;
  if (!spriteId) return undefined;
  const rarity = manager.rarity.toLowerCase().replace(/^./, (c) => c.toUpperCase());
  return `https://idle-miners.com/static/sprites/${rarity}/${encodeURIComponent(spriteId)}.webp`;
};
