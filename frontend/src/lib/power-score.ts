/**
 * Power-score evidence and heuristic comparison.
 *
 * The APK publishes a single `SuperManagerPowerScoreSettings` MonoBehaviour
 * whose custom fields are NOT decoded by UnityPy (no embedded type tree).
 * This module performs the structural decode that IS certain — the standard
 * Unity header plus a Q16.16 fixed-point integer array — and exposes the
 * current MineOps heuristic breakdown for comparison. Field NAMES are not
 * asserted: without the game class definition, naming the Q16 fields would
 * be fabrication. Phase-4's validation diff against the cross-check reference
 * names them before any game-parity number influences scoring.
 */

import type { CatalogManager, PlayerManager } from "./db";

/** Q16.16 fixed-point scaling factor (values are stored × 2^16). */
export const Q16_SCALE = 65536;

export interface PowerScoreSettingsEvidence {
  /** Standard Unity MonoBehaviour header fields, verified structurally. */
  mEnabled: number;
  name: string;
  /** Raw int32 custom fields (after the header). */
  int32Payload: number[];
  /** Custom fields normalized by 2^16 (Q16.16 fixed-point interpretation). */
  q16Values: number[];
  /** Trailing bytes after the last full int32 (padding/alignment). */
  trailingBytes: number;
  /** Always true until the Phase-4 cross-check names the fields. */
  fieldNamesUnverified: boolean;
  /** True when every custom int32 is a clean multiple of 2^16. */
  q16Consistent: boolean;
}

/** Decode the SuperManagerPowerScoreSettings raw payload structurally. */
export function decodePowerScoreSettings(rawBytesBase64: string): PowerScoreSettingsEvidence | null {
  try {
    const bytes = Uint8Array.from(atob(rawBytesBase64), (c) => c.charCodeAt(0));
    if (bytes.length < 62) return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const readI32 = (offset: number) => view.getInt32(offset, true);

    // Unity MonoBehaviour header: m_GameObject PPtr (i32 + i64), m_Enabled i32,
    // m_Script PPtr (i32 + i64), m_Name string (i32 length + bytes).
    let offset = 12; // skip m_GameObject (4 + 8)
    const mEnabled = readI32(offset);
    offset += 4;
    offset += 12; // skip m_Script PPtr (4 + 8)
    const nameLength = readI32(offset);
    offset += 4;
    if (nameLength < 0 || offset + nameLength > bytes.length) return null;
    const name = new TextDecoder().decode(bytes.subarray(offset, offset + nameLength));
    offset += nameLength;

    const full = bytes.length - offset;
    const intCount = Math.floor(full / 4);
    const int32Payload: number[] = [];
    for (let i = 0; i < intCount; i += 1) int32Payload.push(readI32(offset + i * 4));
    const q16Values = int32Payload.map((value) => value / Q16_SCALE);
    const trailingBytes = full - intCount * 4;
    const q16Consistent = int32Payload.every((value) => value % Q16_SCALE === 0);

    return {
      mEnabled,
      name,
      int32Payload,
      q16Values,
      trailingBytes,
      fieldNamesUnverified: true,
      q16Consistent,
    };
  } catch {
    return null;
  }
}

export interface HeuristicBreakdown {
  /** log10(activeValue) × 100 (the dominant term). */
  activeTerm: number;
  levelTerm: number;
  rankTerm: number;
  promotionTerm: number;
  rarityTerm: number;
  total: number;
}

/** Transparent breakdown of the current MineOps strengthScore heuristic. */
export function strengthScoreBreakdown(manager: CatalogManager, progress: PlayerManager): HeuristicBreakdown {
  const activeValue = Math.max(1, progress.level >= 1 && manager.activeLevels && manager.activeLevels.length > 0
    ? (() => {
        const row = manager.activeLevels.find((row) => row.level === progress.level);
        return typeof row?.value === "number" ? row.value : manager.active?.multiplier ?? 1;
      })()
    : manager.active?.multiplier ?? 1);
  const activeTerm = Math.log10(activeValue) * 100;
  const levelTerm = progress.level * 1.5;
  const rankTerm = progress.rank * 20;
  const promotionTerm = progress.promoted * 10;
  const rarityTerm = rarityWeightValue(manager.rarity);
  return {
    activeTerm,
    levelTerm,
    rankTerm,
    promotionTerm,
    rarityTerm,
    total: activeTerm + levelTerm + rankTerm + promotionTerm + rarityTerm,
  };
}

/** Mirrors rarityWeight in db.ts so the breakdown is self-contained. */
function rarityWeightValue(rarity: string): number {
  switch (rarity.toLowerCase()) {
    case "legendary": return 25;
    case "epic": return 18;
    case "rare": return 12;
    case "common": return 6;
    default: return 0;
  }
}

export interface PowerScoreParityRow {
  managerId: string;
  name: string;
  rarity: string;
  level: number;
  rank: number;
  promotion: number;
  heuristicScore: number;
  /** Game settings evidence marker; null until Phase-4 names the fields. */
  gamePowerScore: null;
  gamePowerScoreNote: string;
}

/**
 * Build the parity fixture matrix (rarity × level × rank × promotion) that
 * Phase 4 fills with named game-power-score values after the cross-check.
 */
export function buildPowerScoreParityRows(
  managers: CatalogManager[],
  progressByManager: Map<string, PlayerManager>,
  settingsRawBytes?: string,
): { rows: PowerScoreParityRow[]; settings: PowerScoreSettingsEvidence | null } {
  const settings = settingsRawBytes ? decodePowerScoreSettings(settingsRawBytes) : null;
  const rows: PowerScoreParityRow[] = [];
  for (const manager of managers) {
    const player = progressByManager.get(manager.id);
    if (!player || !player.unlocked) continue;
    const breakdown = strengthScoreBreakdown(manager, player);
    rows.push({
      managerId: manager.id,
      name: manager.name ?? manager.id,
      rarity: manager.rarity,
      level: player.level,
      rank: player.rank,
      promotion: player.promoted,
      heuristicScore: Math.round(breakdown.total * 100) / 100,
      gamePowerScore: null,
      gamePowerScoreNote: settings?.fieldNamesUnverified
        ? "Settings payload decoded structurally (Q16); field names unverified — filled after Phase-4 cross-check."
        : "No power-score settings evidence.",
    });
  }
  return { rows, settings };
}
