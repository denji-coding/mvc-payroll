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
 * Format a full name from first and last name parts, capitalizing each word.
 */
export function formatFullName(firstName: string | null | undefined, lastName: string | null | undefined): string {
  return `${capitalizeWords(firstName)} ${capitalizeWords(lastName)}`.trim();
}
