import { describe, expect, test } from 'bun:test';
import { matchesOutConfirmation, nextOutAction, requiresEarlyOutConfirmation, sessionUndertimeMinutes } from './earlyOut';

const morning = { id: 'attendance-1', morning_in: '2026-11-24T00:00:00Z' };
const afternoon = { ...morning, morning_out: '2026-11-24T04:00:00Z', afternoon_in: '2026-11-24T05:00:00Z' };

describe('early-out confirmation', () => {
  test('requires confirmation for Morning Out before its scheduled end', () => {
    expect(nextOutAction(morning)).toBe('morning_out');
    expect(requiresEarlyOutConfirmation('2026-11-24', '12:00:00', '2026-11-24T03:30:00Z')).toBe(true);
    expect(sessionUndertimeMinutes('2026-11-24', '12:00:00', '2026-11-24T03:30:00Z')).toBe(30);
  });
  test('requires confirmation for Afternoon Out before its scheduled end', () => {
    expect(nextOutAction(afternoon)).toBe('afternoon_out');
    expect(requiresEarlyOutConfirmation('2026-11-24', '17:00', '2026-11-24T08:15:00Z')).toBe(true);
    expect(sessionUndertimeMinutes('2026-11-24', '17:00', '2026-11-24T08:15:00Z')).toBe(45);
  });
  test('does not request confirmation for In punches or completed attendance', () => {
    expect(nextOutAction(null)).toBeNull();
    expect(nextOutAction({ ...morning, morning_out: '2026-11-24T04:00:00Z' })).toBeNull();
    expect(nextOutAction({ ...afternoon, afternoon_out: '2026-11-24T09:00:00Z' })).toBeNull();
  });
  test('does not require confirmation at or after scheduled time', () => {
    expect(requiresEarlyOutConfirmation('2026-11-24', '12:00', '2026-11-24T04:00:00Z')).toBe(false);
    expect(requiresEarlyOutConfirmation('2026-11-24', '17:00', '2026-11-24T09:01:00Z')).toBe(false);
    expect(sessionUndertimeMinutes('2026-11-24', '17:00', '2026-11-24T09:01:00Z')).toBe(0);
  });
  test('binds confirmation to the same date, attendance record, and pending Out punch', () => {
    const confirmation = { record_id: morning.id, action: 'morning_out' as const, date: '2026-11-24' };
    expect(matchesOutConfirmation(confirmation, morning, '2026-11-24')).toBe(true);
    expect(matchesOutConfirmation(confirmation, afternoon, '2026-11-24')).toBe(false);
    expect(matchesOutConfirmation(confirmation, morning, '2026-11-25')).toBe(false);
    expect(matchesOutConfirmation(confirmation, { ...morning, id: 'other-record' }, '2026-11-24')).toBe(false);
  });
  test('retains morning undertime when the afternoon session completes', () => {
    const am = sessionUndertimeMinutes('2026-11-24', '12:00', '2026-11-24T03:30:00Z');
    const pm = sessionUndertimeMinutes('2026-11-24', '17:00', '2026-11-24T08:15:00Z');
    expect(am + pm).toBe(75);
  });
});