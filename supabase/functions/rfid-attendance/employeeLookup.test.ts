import { normalizeEmployeeId, employeeEligibilityError } from './employeeLookup.ts';

function assertEqual<T>(actual: T, expected: T): void {
  if (actual !== expected) {
    throw new Error(`Expected ${String(expected)}, received ${String(actual)}`);
  }
}

Deno.test('attendance employee lookup: normalizes EMP-666075 for exact lookup', () => {
  assertEqual(normalizeEmployeeId(' emp-666075 '), 'EMP-666075');
});

Deno.test('attendance employee lookup: recognizes terminated employees without allowing attendance', () => {
  assertEqual(
    employeeEligibilityError({ employment_status: 'terminated' }),
    'Employee employment status is terminated. Only active employees can log attendance. Please contact HR.',
  );
});

Deno.test('attendance employee lookup: allows active employees', () => {
  assertEqual(employeeEligibilityError({ employment_status: 'active' }), null);
});

Deno.test('attendance employee lookup: distinguishes missing employees', () => {
  assertEqual(employeeEligibilityError(null), 'Employee not found');
});