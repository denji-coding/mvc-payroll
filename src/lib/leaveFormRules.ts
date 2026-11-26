export function isCertificateImage(file: { type: string }): boolean {
  return file.type.startsWith('image/');
}

export function newestLeaveTypesFirst<T extends { created_at: string }>(types: T[]): T[] {
  return [...types].sort((a, b) => Date.parse(b.created_at) - Date.parse(a.created_at));
}