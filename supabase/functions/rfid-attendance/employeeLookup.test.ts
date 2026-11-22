import { describe, expect, test } from 'bun:test';
import { normalizeEmployeeId, employeeEligibilityError } from './employeeLookup';

describe('attendance employee lookup', () => {
  test('normalizes EMP-666075 for exact lookup', () => {
    expect(normalizeEmployeeId(' emp-666075 ')).toBe('EMP-666075');
  });
  test('recognizes terminated employees without allowing attendance', () => {
    expect(employeeEligibilityError({ employment_status: 'terminated' })).toBe(
      'Employee employment status is terminated. Only active employees can log attendance. Please contact HR.',
    );
  });
  test('allows active employees', () => {
    expect(employeeEligibilityError({ employment_status: 'active' })).toBeNull();
  });
  test('distinguishes missing employees', () => {
    expect(employeeEligibilityError(null)).toBe('Employee not found');
  });
});