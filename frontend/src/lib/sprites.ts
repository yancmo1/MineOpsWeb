import { CatalogManager } from "./db";
import { getBaseUrl } from "./pocketbase";

/**
 * Get sprite image URL for a manager.
 *
 * Uses catalog spriteRefs (APK-extracted sprites served via the catalog
 * artifact endpoint). Falls back to the legacy idle-miners.com URL pattern
 * when no spriteRefs are available. The master-data enrichment provides the
 * upstream sprite slug (for example AlTitude); canonical IDs are not valid
 * upstream sprite filenames.
 *
 * The catalog sprites are served from the active release's storageBaseUrl
 * with ?file=sprites/<filename> query parameter.
 */
export function spriteURL(manager: CatalogManager): string | undefined {
  // Prefer catalog spriteRefs
  const fullBody = manager.spriteRefs?.find((s) => s.type === "fullbody" || s.type === "face");
  if (fullBody?.filename) {
    return `${getBaseUrl().replace(/\/$/, "")}/api/catalog/artifacts?file=sprites/${encodeURIComponent(fullBody.filename)}`;
  }

  // Legacy fallback: use manager.id as sprite name on idle-miners.com
  const spriteId = manager.sprite;
  if (!spriteId) return undefined;
  const rarity = manager.rarity.toLowerCase().replace(/^./, (c) => c.toUpperCase());
  return `https://idle-miners.com/static/sprites/${rarity}/${encodeURIComponent(spriteId)}.webp`;
}
