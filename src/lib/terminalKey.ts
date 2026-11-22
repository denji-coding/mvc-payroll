const KEY = 'attendance-terminal-key';

export const getTerminalKey = (): string => {
  try { return localStorage.getItem(KEY) ?? ''; } catch { return ''; }
};

export const setTerminalKey = (value: string) => {
  try { localStorage.setItem(KEY, value.trim()); } catch { /* ignore */ }
};

/** Headers that authorize this device as the attendance terminal. */
export const terminalHeaders = (): Record<string, string> => {
  const k = getTerminalKey();
  return k ? { 'x-terminal-secret': k } : {};
};
