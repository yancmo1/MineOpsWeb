import type { CatalogManager, PlayerManager } from "./db";

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

/** Build the strict flat JSON shape accepted by Idle Master's Hub. */
export function buildTrackerBackup(catalog: CatalogManager[], progress: PlayerManager[]): TrackerBackup {
  const progressById = new Map(progress.map((manager) => [manager.managerId, manager]));

  return Object.fromEntries(catalog.map((manager) => {
    const player = progressById.get(manager.id);
    return [trackerKeyForName(manager.name), {
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
