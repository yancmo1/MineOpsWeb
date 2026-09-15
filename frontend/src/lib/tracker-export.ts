import type { CatalogManager, PlayerManager } from "./db";
import { isVariantId } from "./manager-variants";

export type TrackerManagerEntry = {
  unlocked: boolean;
  rank: number;
  level: number;
  promoted: number;
  fragments: number;
  chronoExcluded: boolean;
  tierlistExcluded: boolean;
};

export type TrackerBackup = Record<string, TrackerManagerEntry>;

const TARGET_KEY_OVERRIDES: Readonly<Record<string, string>> = Object.freeze({
  "sm-10018": "santa-2020",
  "sm-10024": "wolfgang-clawson",
  "sm-10033": "professor-maple",
  "sm-10042": "ut-ux",
  "sm-10067": "lavender-wick",
  "sm-10077": "om-nix",
  "sm-10078": "abeo-meremikwu",
  "sm-10089": "h4v0c",
  "sm-10028": "rabbit-blingsley",
});

export function trackerKeyForName(name: string): string {
  return name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, " and ")
    .replace(/[’']/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

export function trackerKeyForManager(manager: CatalogManager): string {
  return TARGET_KEY_OVERRIDES[manager.id] ?? trackerKeyForName(manager.name);
}

/** Build the strict flat JSON shape accepted by Idle Master's Hub. */
export function buildTrackerBackup(catalog: CatalogManager[], progress: PlayerManager[]): TrackerBackup {
  const progressById = new Map(progress.map((manager) => [manager.managerId, manager]));

  return Object.fromEntries(catalog.filter((manager) => !isVariantId(manager.id)).map((manager) => {
    const player = progressById.get(manager.id);
    return [trackerKeyForManager(manager), {
      unlocked: player?.unlocked ?? false,
      rank: player?.rank ?? 0,
      level: player?.level ?? 1,
      promoted: player?.promoted ?? 0,
      fragments: player?.fragments ?? 0,
      chronoExcluded: false,
      tierlistExcluded: false,
    } satisfies TrackerManagerEntry];
  }));
}

export function serializeTrackerBackup(backup: TrackerBackup): string {
  return `${JSON.stringify(backup, null, 2)}\n`;
}

export function downloadTrackerBackup(backup: TrackerBackup, filename = "sm-tracker-backup.json"): void {
  const blob = new Blob([serializeTrackerBackup(backup)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
