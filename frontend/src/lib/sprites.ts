import { CatalogManager } from "./db";

export const spriteURL = (manager: CatalogManager) =>
  manager.sprite
    ? `https://idle-miners.com/static/sprites/${manager.rarity.toLowerCase().replace(/^./, (c) => c.toUpperCase())}/${encodeURIComponent(manager.sprite)}.webp`
    : undefined;
