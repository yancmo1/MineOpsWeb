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
