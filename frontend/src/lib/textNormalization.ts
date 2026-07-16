/**
 * Clean catalog text by removing numeric placeholder patterns like {0}, {1}, etc.
 * @param value - The text to clean
 * @returns The cleaned text, or undefined if empty
 */
export function cleanDescription(value?: string): string | undefined {
  if (!value) return undefined;
  return value.replace(/^\{\d+\}\s*/, "").trim() || undefined;
}

/**
 * Defensive cleanup applied at render time as fallback
 */
export function displayText(value?: string): string {
  return cleanDescription(value) ?? "";
}

/**
 * Format time in seconds to a human-readable format (e.g., "30m", "1m 30s", "45s")
 * Matches iOS implementation
 */
export function formatTime(seconds?: number | string): string {
  if (!seconds) return "—";
  const sec = typeof seconds === "string" ? parseInt(seconds.replace(/[^\d]/g, ""), 10) : seconds;
  if (isNaN(sec)) return "—";
  
  const minutes = Math.floor(sec / 60);
  const remainingSeconds = sec % 60;
  
  if (minutes > 0) {
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  } else {
    return `${sec}s`;
  }
}

/**
 * Interpolate ability description placeholders with actual values
 * Matches iOS interpolatedDescription implementation
 * {0} = multiplier value
 * {1} = cooldown
 * {2} = duration
 * {3} = bonus indicator
 */
export function interpolateAbilityDescription(
  description?: string,
  multiplier?: number,
  cooldown?: number | string,
  duration?: number | string,
  effectType?: number
): string {
  if (!description) return "No description available";
  
  let result = description;
  
  // Format multiplier based on effect type
  const valueStr = effectType === 3
    ? `-${((multiplier || 0) * 100).toFixed(2)}%`  // Type 3 = cost reduction percentage
    : `${(multiplier || 0).toFixed(2)}x`;          // Default = multiplier
  
  const cooldownStr = formatTime(cooldown);
  const durationStr = formatTime(duration);
  
  result = result.replace(/\{0\}/g, valueStr);
  result = result.replace(/\{1\}/g, cooldownStr);
  result = result.replace(/\{2\}/g, durationStr);
  result = result.replace(/\{3\}/g, "(bonus)");
  
  return result;
}
