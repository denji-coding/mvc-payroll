type OutAction = 'morning_out' | 'afternoon_out';

interface PunchRecord {
  id: string;
  morning_in?: string | null;
  morning_out?: string | null;
  afternoon_in?: string | null;
  afternoon_out?: string | null;
}

export function nextOutAction(record: PunchRecord | null): OutAction | null {
  if (!record) return null;
  if (record.morning_in && !record.morning_out && !record.afternoon_in) return 'morning_out';
  if (record.afternoon_in && !record.afternoon_out) return 'afternoon_out';
  return null;
}

export function sessionUndertimeMinutes(date: string, end: string, out: string): number {
  const scheduledEnd = new Date(`${date}T${end}+08:00`).getTime();
  return Math.max(0, Math.floor((scheduledEnd - new Date(out).getTime()) / 60000));
}

export function requiresEarlyOutConfirmation(date: string, end: string, out: string): boolean {
  return new Date(out).getTime() < new Date(`${date}T${end}+08:00`).getTime();
}

export function matchesOutConfirmation(
  confirmation: { record_id: string; action: OutAction; date: string },
  record: PunchRecord | null,
  date: string,
): boolean {
  return confirmation.record_id === record?.id && confirmation.date === date &&
    confirmation.action === nextOutAction(record);
}