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
 * Format a full name from first/last name (and optional suffix), capitalizing each word.
 */
export function formatFullName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
  suffix?: string | null,
): string {
  const base = `${capitalizeWords(firstName)} ${capitalizeWords(lastName)}`.trim();
  const suf = formatSuffix(suffix);
  return suf ? `${base} ${suf}`.trim() : base;
}
