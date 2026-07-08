/**
 * Capitalize each word in a name string.
 * e.g. "juan dela cruz" → "Juan Dela Cruz"
 */
export function capitalizeWords(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

/**
 * Format an optional suffix (Jr., Sr., II, III, IV...) preserving common casing.
 * Roman numerals become uppercase; word suffixes are Title Cased.
 */
export function formatSuffix(suffix: string | null | undefined): string {
  if (!suffix) return '';
  const trimmed = suffix.trim();
  if (!trimmed) return '';
  // Detect roman numerals (I, II, III, IV, V, VI, VII, VIII, IX, X)
  if (/^[ivxlcdm]+\.?$/i.test(trimmed)) return trimmed.toUpperCase();
  return capitalizeWords(trimmed);
}

/**
 * Extract the initial of the middle name (first character of the first middle-name word).
 * Returns an empty string when no middle name is provided.
 */
export function middleInitial(middleName: string | null | undefined): string {
  if (!middleName) return '';
  const trimmed = middleName.trim();
  if (!trimmed) return '';
  const firstWord = trimmed.split(/\s+/)[0];
  const letter = firstWord.charAt(0);
  return letter ? `${letter.toUpperCase()}.` : '';
}

/**
 * Format a full name from first/last name (and optional suffix, optional middle name).
 * When a middle name is provided, only its first initial is shown:
 *   "Roy B. Nabesis", "John Mark S. Espanol", "Rey B. Nabesis Jr."
 */
export function formatFullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  suffix?: string | null,
  middleName?: string | null,
): string {
  const first = capitalizeWords(firstName);
  const last = capitalizeWords(lastName);
  const mi = middleInitial(middleName);
  const suf = formatSuffix(suffix);
  const parts = [first, mi, last, suf].filter(Boolean);
  return parts.join(' ').trim();
}
