/**
 * Idle Miner Tycoon cash suffixes.
 *
 * The game prints large cash values with suffixes that step x1000:
 * K (1e3) -> M (1e6) -> B (1e9) -> T (1e12) -> aa (1e15) -> ab (1e18)
 * -> ac (1e21) ... Each alpha step is another x1000. The Mine Overview
 * rates Yancy enters (for example "6.84 aj/s") are converted here, in one
 * place, so the rest of the app compares real base-unit values instead of
 * pretending 6.84 aj and 122 ak are close because the digits look close.
 */

const SINGLE_SUFFIXES = ["", "K", "M", "B", "T"] as const;

export function suffixStep(suffix: string): number | null {
  const clean = suffix.trim().toLowerCase();
  if (!clean) return 0;
  const single = SINGLE_SUFFIXES.findIndex((s) => s.toLowerCase() === clean);
  if (single >= 0) return single;
  if (/^[a-z]{2}$/.test(clean)) {
    const first = clean.charCodeAt(0) - 97;
    const second = clean.charCodeAt(1) - 97;
    return 5 + first * 26 + second;
  }
  return null;
}

export function suffixForStep(step: number): string {
  if (step < SINGLE_SUFFIXES.length) return SINGLE_SUFFIXES[step];
  const alphaIndex = step - 5;
  const first = Math.floor(alphaIndex / 26);
  const second = alphaIndex % 26;
  return `${String.fromCharCode(97 + first)}${String.fromCharCode(97 + second)}`;
}

/** Parse a player-entered cash amount such as "6.84 aj", "122", or "1.5K". Returns base units. */
export function parseCashValue(raw: string): number | null {
  const match = raw.trim().replace(/,/g, "").match(/^(-?\d+(?:\.\d+)?)\s*([a-zA-Z]{0,2})$/);
  if (!match) return null;
  const amount = Number(match[1]);
  const step = suffixStep(match[2] ?? "");
  if (!Number.isFinite(amount) || step == null) return null;
  return amount * 10 ** (step * 3);
}

/** Format a base-unit cash value the way the game prints it, e.g. 6.84 aj. */
export function formatCashValue(value: number | null): string {
  if (value == null || !Number.isFinite(value) || value === 0) return "—";
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  const step = Math.max(0, Math.floor(Math.log10(abs) / 3));
  const scaled = abs / 10 ** (step * 3);
  const text = scaled >= 100 ? scaled.toFixed(0) : scaled >= 10 ? scaled.toFixed(1) : scaled.toFixed(2);
  const suffix = suffixForStep(step);
  return `${sign}${text}${suffix ? ` ${suffix}` : ""}`;
}
