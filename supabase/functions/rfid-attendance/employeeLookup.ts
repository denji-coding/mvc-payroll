/** Normalize manual IDs without changing employee records. */
export function normalizeEmployeeId(value: string): string {
  return value.trim().toUpperCase();
}

export function employeeEligibilityError(employee: { employment_status: string } | null): string | null {
  if (!employee) return 'Employee not found';
  if (employee.employment_status !== 'active') {
    return `Employee employment status is ${employee.employment_status}. Only active employees can log attendance. Please contact HR.`;
  }
  return null;
}