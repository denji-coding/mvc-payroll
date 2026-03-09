import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import companyLogo from '@/assets/company-logo.png';

interface TableColumn {
  name: string;
  type: string;
  nullable: string;
  default: string;
  description: string;
}

interface TableSchema {
  name: string;
  description: string;
  columns: TableColumn[];
}

interface Relationship {
  parent: string;
  child: string;
  fkColumn: string;
  parentColumn: string;
}

const relationships: Relationship[] = [
  // Branch relationships
  { parent: 'branches', child: 'employees', fkColumn: 'branch_id', parentColumn: 'id' },
  { parent: 'branches', child: 'branch_managers', fkColumn: 'branch_id', parentColumn: 'id' },
  { parent: 'branches', child: 'announcements', fkColumn: 'branch_id', parentColumn: 'id' },
  // Employee relationships
  { parent: 'employees', child: 'attendance', fkColumn: 'employee_id', parentColumn: 'id' },
  { parent: 'employees', child: 'employee_schedules', fkColumn: 'employee_id', parentColumn: 'id' },
  { parent: 'employees', child: 'employee_salary_adjustments', fkColumn: 'employee_id', parentColumn: 'id' },
  { parent: 'employees', child: 'leave_credits', fkColumn: 'employee_id', parentColumn: 'id' },
  { parent: 'employees', child: 'leave_requests', fkColumn: 'employee_id', parentColumn: 'id' },
  { parent: 'employees', child: 'payroll_records', fkColumn: 'employee_id', parentColumn: 'id' },
  { parent: 'employees', child: 'loans', fkColumn: 'employee_id', parentColumn: 'id' },
  // Salary & Payroll
  { parent: 'salary_components', child: 'employee_salary_adjustments', fkColumn: 'component_id', parentColumn: 'id' },
  { parent: 'payroll_periods', child: 'payroll_records', fkColumn: 'payroll_period_id', parentColumn: 'id' },
  // Auth / User relationships
  { parent: 'profiles', child: 'user_roles', fkColumn: 'user_id', parentColumn: 'id' },
  { parent: 'profiles', child: 'employees', fkColumn: 'user_id', parentColumn: 'id' },
  { parent: 'profiles', child: 'branch_managers', fkColumn: 'user_id', parentColumn: 'id' },
  { parent: 'profiles', child: 'notifications', fkColumn: 'user_id', parentColumn: 'id' },
  { parent: 'profiles', child: 'password_reset_tokens', fkColumn: 'user_id', parentColumn: 'id' },
  { parent: 'profiles', child: 'announcements', fkColumn: 'created_by', parentColumn: 'id' },
  { parent: 'profiles', child: 'payroll_periods', fkColumn: 'created_by', parentColumn: 'id' },
  { parent: 'profiles', child: 'leave_requests', fkColumn: 'manager_id', parentColumn: 'id' },
  { parent: 'profiles', child: 'leave_requests', fkColumn: 'hr_id', parentColumn: 'id' },
  // Leave type references
  { parent: 'leave_types', child: 'leave_credits', fkColumn: 'leave_type', parentColumn: 'name' },
  { parent: 'leave_types', child: 'leave_requests', fkColumn: 'leave_type', parentColumn: 'name' },
  // Role permissions
  { parent: 'user_roles', child: 'role_permissions', fkColumn: 'role', parentColumn: 'role' },
  // Positions referenced by employees
  { parent: 'positions', child: 'employees', fkColumn: 'position', parentColumn: 'name' },
  // Holidays used in payroll computation
  { parent: 'holidays', child: 'payroll_records', fkColumn: 'holiday_pay (computed)', parentColumn: 'date' },
  // Settings used by attendance terminal
  { parent: 'settings', child: 'attendance', fkColumn: 'terminal config (logical)', parentColumn: 'key' },
];

const tables: TableSchema[] = [
  {
    name: 'employees',
    description: 'Core employee records with personal info, employment details, and government IDs.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'employee_id', type: 'text', nullable: 'No', default: '-', description: 'Unique employee ID code' },
      { name: 'user_id', type: 'uuid', nullable: 'Yes', default: '-', description: 'Auth user reference' },
      { name: 'first_name', type: 'text', nullable: 'No', default: '-', description: 'First name' },
      { name: 'last_name', type: 'text', nullable: 'No', default: '-', description: 'Last name' },
      { name: 'middle_name', type: 'text', nullable: 'Yes', default: '-', description: 'Middle name' },
      { name: 'email', type: 'text', nullable: 'No', default: '-', description: 'Email address' },
      { name: 'phone', type: 'text', nullable: 'Yes', default: '-', description: 'Phone number' },
      { name: 'gender', type: 'text', nullable: 'Yes', default: '-', description: 'Gender' },
      { name: 'civil_status', type: 'text', nullable: 'Yes', default: '-', description: 'Civil status' },
      { name: 'date_of_birth', type: 'date', nullable: 'Yes', default: '-', description: 'Date of birth' },
      { name: 'address', type: 'text', nullable: 'Yes', default: '-', description: 'Home address' },
      { name: 'position', type: 'text', nullable: 'No', default: '-', description: 'Job position title' },
      { name: 'department', type: 'text', nullable: 'Yes', default: '-', description: 'Department' },
      { name: 'branch_id', type: 'uuid', nullable: 'Yes', default: '-', description: 'FK → branches.id' },
      { name: 'date_hired', type: 'date', nullable: 'No', default: '-', description: 'Hire date' },
      { name: 'employment_status', type: 'enum', nullable: 'Yes', default: 'active', description: 'active|resigned|terminated|on_leave|inactive' },
      { name: 'basic_salary', type: 'numeric', nullable: 'No', default: '0', description: 'Monthly basic salary' },
      { name: 'rfid_card_number', type: 'text', nullable: 'Yes', default: '-', description: 'RFID card for attendance' },
      { name: 'sss_number', type: 'text', nullable: 'Yes', default: '-', description: 'SSS number' },
      { name: 'philhealth_number', type: 'text', nullable: 'Yes', default: '-', description: 'PhilHealth number' },
      { name: 'pagibig_number', type: 'text', nullable: 'Yes', default: '-', description: 'Pag-IBIG number' },
      { name: 'tin_number', type: 'text', nullable: 'Yes', default: '-', description: 'TIN number' },
      { name: 'bank_name', type: 'text', nullable: 'Yes', default: '-', description: 'Bank name' },
      { name: 'bank_account_number', type: 'text', nullable: 'Yes', default: '-', description: 'Bank account number' },
      { name: 'emergency_contact_name', type: 'text', nullable: 'Yes', default: '-', description: 'Emergency contact name' },
      { name: 'emergency_contact_phone', type: 'text', nullable: 'Yes', default: '-', description: 'Emergency contact phone' },
      { name: 'avatar_url', type: 'text', nullable: 'Yes', default: '-', description: 'Profile photo URL' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Record creation time' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Last update time' },
    ],
  },
  {
    name: 'profiles',
    description: 'Auth user profile data (mirrors auth.users for public access).',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: '-', description: 'PK, matches auth.users.id' },
      { name: 'email', type: 'text', nullable: 'No', default: '-', description: 'Email address' },
      { name: 'first_name', type: 'text', nullable: 'No', default: '-', description: 'First name' },
      { name: 'last_name', type: 'text', nullable: 'No', default: '-', description: 'Last name' },
      { name: 'middle_name', type: 'text', nullable: 'Yes', default: '-', description: 'Middle name' },
      { name: 'phone', type: 'text', nullable: 'Yes', default: '-', description: 'Phone number' },
      { name: 'avatar_url', type: 'text', nullable: 'Yes', default: '-', description: 'Profile photo URL' },
      { name: 'must_change_password', type: 'boolean', nullable: 'Yes', default: 'false', description: 'Force password change flag' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'user_roles',
    description: 'Maps auth users to application roles (hr_admin, branch_manager, employee).',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'user_id', type: 'uuid', nullable: 'No', default: '-', description: 'Auth user ID' },
      { name: 'role', type: 'app_role', nullable: 'No', default: '-', description: 'hr_admin|branch_manager|employee' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
    ],
  },
  {
    name: 'branches',
    description: 'Company branch/office locations.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'name', type: 'text', nullable: 'No', default: '-', description: 'Branch name' },
      { name: 'code', type: 'text', nullable: 'No', default: '-', description: 'Unique branch code' },
      { name: 'address', type: 'text', nullable: 'Yes', default: '-', description: 'Branch address' },
      { name: 'contact_number', type: 'text', nullable: 'Yes', default: '-', description: 'Contact phone' },
      { name: 'is_active', type: 'boolean', nullable: 'Yes', default: 'true', description: 'Active status' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'branch_managers',
    description: 'Maps branch manager users to their assigned branches.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'branch_id', type: 'uuid', nullable: 'No', default: '-', description: 'FK → branches.id' },
      { name: 'user_id', type: 'uuid', nullable: 'No', default: '-', description: 'Auth user ID of manager' },
      { name: 'assigned_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Assignment date' },
    ],
  },
  {
    name: 'positions',
    description: 'Job positions/titles with department grouping.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'name', type: 'text', nullable: 'No', default: '-', description: 'Position title' },
      { name: 'department', type: 'text', nullable: 'Yes', default: '-', description: 'Department name' },
      { name: 'description', type: 'text', nullable: 'Yes', default: '-', description: 'Position description' },
      { name: 'is_active', type: 'boolean', nullable: 'Yes', default: 'true', description: 'Active status' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'attendance',
    description: 'Daily attendance records with time-in/out, split sessions, and computed metrics.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'employee_id', type: 'uuid', nullable: 'No', default: '-', description: 'FK → employees.id' },
      { name: 'date', type: 'date', nullable: 'No', default: '-', description: 'Attendance date' },
      { name: 'time_in', type: 'timestamptz', nullable: 'Yes', default: '-', description: 'Clock-in timestamp' },
      { name: 'time_out', type: 'timestamptz', nullable: 'Yes', default: '-', description: 'Clock-out timestamp' },
      { name: 'morning_in', type: 'timestamptz', nullable: 'Yes', default: '-', description: 'AM session in' },
      { name: 'morning_out', type: 'timestamptz', nullable: 'Yes', default: '-', description: 'AM session out' },
      { name: 'afternoon_in', type: 'timestamptz', nullable: 'Yes', default: '-', description: 'PM session in' },
      { name: 'afternoon_out', type: 'timestamptz', nullable: 'Yes', default: '-', description: 'PM session out' },
      { name: 'rfid_time_in', type: 'text', nullable: 'Yes', default: '-', description: 'RFID clock-in raw' },
      { name: 'rfid_time_out', type: 'text', nullable: 'Yes', default: '-', description: 'RFID clock-out raw' },
      { name: 'hours_worked', type: 'numeric', nullable: 'Yes', default: '-', description: 'Total hours worked' },
      { name: 'overtime_hours', type: 'numeric', nullable: 'Yes', default: '0', description: 'Overtime hours' },
      { name: 'late_minutes', type: 'integer', nullable: 'Yes', default: '0', description: 'Minutes late' },
      { name: 'undertime_minutes', type: 'integer', nullable: 'Yes', default: '0', description: 'Undertime minutes' },
      { name: 'status', type: 'text', nullable: 'Yes', default: 'present', description: 'present|absent|late|half_day' },
      { name: 'remarks', type: 'text', nullable: 'Yes', default: '-', description: 'Additional remarks' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'employee_schedules',
    description: 'Weekly work schedules per employee with AM/PM split sessions.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'employee_id', type: 'uuid', nullable: 'No', default: '-', description: 'FK → employees.id' },
      { name: 'day_of_week', type: 'integer', nullable: 'No', default: '-', description: '0=Sun, 1=Mon, ..., 6=Sat' },
      { name: 'is_duty_day', type: 'boolean', nullable: 'Yes', default: 'true', description: 'Working day flag' },
      { name: 'start_time', type: 'time', nullable: 'Yes', default: '08:00', description: 'Overall start time' },
      { name: 'end_time', type: 'time', nullable: 'Yes', default: '17:00', description: 'Overall end time' },
      { name: 'morning_start', type: 'time', nullable: 'Yes', default: '08:00', description: 'AM session start' },
      { name: 'morning_end', type: 'time', nullable: 'Yes', default: '12:00', description: 'AM session end' },
      { name: 'afternoon_start', type: 'time', nullable: 'Yes', default: '13:00', description: 'PM session start' },
      { name: 'afternoon_end', type: 'time', nullable: 'Yes', default: '17:00', description: 'PM session end' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'leave_types',
    description: 'Configurable leave type definitions with credit and validation rules.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'name', type: 'text', nullable: 'No', default: '-', description: 'Leave type name' },
      { name: 'description', type: 'text', nullable: 'Yes', default: '-', description: 'Description' },
      { name: 'default_credits', type: 'numeric', nullable: 'No', default: '0', description: 'Default annual credits' },
      { name: 'credits_per_application', type: 'numeric', nullable: 'No', default: '1', description: 'Credits deducted per use' },
      { name: 'max_days_per_application', type: 'numeric', nullable: 'Yes', default: '-', description: 'Max days per request' },
      { name: 'upload_condition_days', type: 'numeric', nullable: 'Yes', default: '-', description: 'Days threshold for doc upload' },
      { name: 'required_fields', type: 'text[]', nullable: 'No', default: '{reason}', description: 'Required form fields' },
      { name: 'calendar_config', type: 'text', nullable: 'No', default: 'disable_past', description: 'Calendar date restriction' },
      { name: 'is_active', type: 'boolean', nullable: 'No', default: 'true', description: 'Active status' },
      { name: 'created_at', type: 'timestamptz', nullable: 'No', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'No', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'leave_requests',
    description: 'Employee leave applications with two-tier approval workflow.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'employee_id', type: 'uuid', nullable: 'No', default: '-', description: 'FK → employees.id' },
      { name: 'leave_type', type: 'text', nullable: 'No', default: '-', description: 'Type of leave' },
      { name: 'start_date', type: 'date', nullable: 'No', default: '-', description: 'Leave start date' },
      { name: 'end_date', type: 'date', nullable: 'No', default: '-', description: 'Leave end date' },
      { name: 'total_days', type: 'numeric', nullable: 'No', default: '-', description: 'Total leave days' },
      { name: 'reason', type: 'text', nullable: 'Yes', default: '-', description: 'Leave reason' },
      { name: 'pay_type', type: 'text', nullable: 'No', default: 'with_pay', description: 'with_pay|without_pay' },
      { name: 'status', type: 'leave_status', nullable: 'Yes', default: 'pending', description: 'pending|manager_approved|hr_approved|rejected|cancelled' },
      { name: 'manager_id', type: 'uuid', nullable: 'Yes', default: '-', description: 'Approving manager user ID' },
      { name: 'manager_remarks', type: 'text', nullable: 'Yes', default: '-', description: 'Manager remarks' },
      { name: 'manager_action_at', type: 'timestamptz', nullable: 'Yes', default: '-', description: 'Manager action time' },
      { name: 'hr_id', type: 'uuid', nullable: 'Yes', default: '-', description: 'Approving HR user ID' },
      { name: 'hr_remarks', type: 'text', nullable: 'Yes', default: '-', description: 'HR remarks' },
      { name: 'hr_action_at', type: 'timestamptz', nullable: 'Yes', default: '-', description: 'HR action time' },
      { name: 'medical_certificate_url', type: 'text', nullable: 'Yes', default: '-', description: 'Medical cert file URL' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'leave_credits',
    description: 'Annual leave credit balances per employee per leave type.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'employee_id', type: 'uuid', nullable: 'No', default: '-', description: 'FK → employees.id' },
      { name: 'leave_type', type: 'text', nullable: 'No', default: '-', description: 'Leave type name' },
      { name: 'year', type: 'integer', nullable: 'No', default: '-', description: 'Credit year' },
      { name: 'total_credits', type: 'numeric', nullable: 'Yes', default: '0', description: 'Total allocated credits' },
      { name: 'used_credits', type: 'numeric', nullable: 'Yes', default: '0', description: 'Credits consumed' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'payroll_periods',
    description: 'Payroll processing periods with approval workflow.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'period_start', type: 'date', nullable: 'No', default: '-', description: 'Period start date' },
      { name: 'period_end', type: 'date', nullable: 'No', default: '-', description: 'Period end date' },
      { name: 'pay_date', type: 'date', nullable: 'No', default: '-', description: 'Scheduled pay date' },
      { name: 'status', type: 'payroll_status', nullable: 'Yes', default: 'draft', description: 'draft|processing|approved|paid' },
      { name: 'created_by', type: 'uuid', nullable: 'Yes', default: '-', description: 'Creator user ID' },
      { name: 'approved_by', type: 'uuid', nullable: 'Yes', default: '-', description: 'Approver user ID' },
      { name: 'approved_at', type: 'timestamptz', nullable: 'Yes', default: '-', description: 'Approval timestamp' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'payroll_records',
    description: 'Individual payroll computation records per employee per period.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'payroll_period_id', type: 'uuid', nullable: 'No', default: '-', description: 'FK → payroll_periods.id' },
      { name: 'employee_id', type: 'uuid', nullable: 'No', default: '-', description: 'FK → employees.id' },
      { name: 'basic_pay', type: 'numeric', nullable: 'No', default: '0', description: 'Basic pay for period' },
      { name: 'days_worked', type: 'numeric', nullable: 'Yes', default: '0', description: 'Days worked' },
      { name: 'overtime_pay', type: 'numeric', nullable: 'Yes', default: '0', description: 'Overtime pay' },
      { name: 'night_differential', type: 'numeric', nullable: 'Yes', default: '0', description: 'Night diff pay' },
      { name: 'holiday_pay', type: 'numeric', nullable: 'Yes', default: '0', description: 'Holiday pay' },
      { name: 'total_allowances', type: 'numeric', nullable: 'Yes', default: '0', description: 'Total allowances' },
      { name: 'allowances_breakdown', type: 'jsonb', nullable: 'Yes', default: '{}', description: 'Allowance details JSON' },
      { name: 'gross_pay', type: 'numeric', nullable: 'Yes', default: '0', description: 'Gross pay' },
      { name: 'sss_contribution', type: 'numeric', nullable: 'Yes', default: '0', description: 'SSS deduction' },
      { name: 'philhealth_contribution', type: 'numeric', nullable: 'Yes', default: '0', description: 'PhilHealth deduction' },
      { name: 'pagibig_contribution', type: 'numeric', nullable: 'Yes', default: '0', description: 'Pag-IBIG deduction' },
      { name: 'withholding_tax', type: 'numeric', nullable: 'Yes', default: '0', description: 'Withholding tax' },
      { name: 'other_deductions', type: 'numeric', nullable: 'Yes', default: '0', description: 'Other deductions total' },
      { name: 'deductions_breakdown', type: 'jsonb', nullable: 'Yes', default: '{}', description: 'Deduction details JSON' },
      { name: 'total_deductions', type: 'numeric', nullable: 'Yes', default: '0', description: 'Total deductions' },
      { name: 'net_pay', type: 'numeric', nullable: 'Yes', default: '0', description: 'Net pay after deductions' },
      { name: 'is_manual', type: 'boolean', nullable: 'Yes', default: 'false', description: 'Manually entered flag' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'salary_components',
    description: 'Reusable salary components (allowances, deductions) for payroll.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'name', type: 'text', nullable: 'No', default: '-', description: 'Component name' },
      { name: 'type', type: 'text', nullable: 'No', default: '-', description: 'allowance|deduction' },
      { name: 'description', type: 'text', nullable: 'Yes', default: '-', description: 'Description' },
      { name: 'is_taxable', type: 'boolean', nullable: 'Yes', default: 'true', description: 'Subject to tax' },
      { name: 'is_mandatory', type: 'boolean', nullable: 'Yes', default: 'false', description: 'Mandatory flag' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
    ],
  },
  {
    name: 'employee_salary_adjustments',
    description: 'Per-employee salary adjustments linked to salary components.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'employee_id', type: 'uuid', nullable: 'No', default: '-', description: 'FK → employees.id' },
      { name: 'component_id', type: 'uuid', nullable: 'No', default: '-', description: 'FK → salary_components.id' },
      { name: 'amount', type: 'numeric', nullable: 'No', default: '-', description: 'Adjustment amount' },
      { name: 'is_recurring', type: 'boolean', nullable: 'Yes', default: 'true', description: 'Recurring every period' },
      { name: 'effective_from', type: 'date', nullable: 'Yes', default: '-', description: 'Start date' },
      { name: 'effective_to', type: 'date', nullable: 'Yes', default: '-', description: 'End date' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
    ],
  },
  {
    name: 'loans',
    description: 'Employee loan records with amortization tracking.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'employee_id', type: 'uuid', nullable: 'No', default: '-', description: 'FK → employees.id' },
      { name: 'loan_type', type: 'text', nullable: 'No', default: '-', description: 'SSS|Pag-IBIG|Company|etc.' },
      { name: 'principal_amount', type: 'numeric', nullable: 'No', default: '-', description: 'Original loan amount' },
      { name: 'monthly_amortization', type: 'numeric', nullable: 'No', default: '-', description: 'Monthly payment' },
      { name: 'total_paid', type: 'numeric', nullable: 'Yes', default: '0', description: 'Total paid so far' },
      { name: 'remaining_balance', type: 'numeric', nullable: 'No', default: '-', description: 'Remaining balance' },
      { name: 'start_date', type: 'date', nullable: 'No', default: '-', description: 'Loan start date' },
      { name: 'status', type: 'text', nullable: 'Yes', default: 'active', description: 'active|paid|cancelled' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'holidays',
    description: 'Company and national holiday calendar for payroll computation.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'name', type: 'text', nullable: 'No', default: '-', description: 'Holiday name' },
      { name: 'date', type: 'date', nullable: 'No', default: '-', description: 'Holiday date' },
      { name: 'type', type: 'text', nullable: 'No', default: '-', description: 'regular|special' },
      { name: 'year', type: 'integer', nullable: 'No', default: '-', description: 'Year' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
    ],
  },
  {
    name: 'notifications',
    description: 'In-app notification messages for users.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'user_id', type: 'uuid', nullable: 'No', default: '-', description: 'Recipient user ID' },
      { name: 'type', type: 'notification_type', nullable: 'No', default: '-', description: 'leave_request|payroll_ready|announcement|etc.' },
      { name: 'title', type: 'text', nullable: 'No', default: '-', description: 'Notification title' },
      { name: 'message', type: 'text', nullable: 'No', default: '-', description: 'Notification body' },
      { name: 'is_read', type: 'boolean', nullable: 'Yes', default: 'false', description: 'Read status' },
      { name: 'reference_id', type: 'uuid', nullable: 'Yes', default: '-', description: 'Related record ID' },
      { name: 'reference_type', type: 'text', nullable: 'Yes', default: '-', description: 'Related record type' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
    ],
  },
  {
    name: 'announcements',
    description: 'Company-wide or branch-specific announcements.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'title', type: 'text', nullable: 'No', default: '-', description: 'Announcement title' },
      { name: 'content', type: 'text', nullable: 'No', default: '-', description: 'Announcement body' },
      { name: 'is_published', type: 'boolean', nullable: 'Yes', default: 'false', description: 'Published status' },
      { name: 'branch_id', type: 'uuid', nullable: 'Yes', default: '-', description: 'FK → branches.id (null=all)' },
      { name: 'created_by', type: 'uuid', nullable: 'Yes', default: '-', description: 'Creator user ID' },
      { name: 'published_at', type: 'timestamptz', nullable: 'Yes', default: '-', description: 'Publish timestamp' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'settings',
    description: 'Key-value application settings store.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'key', type: 'text', nullable: 'No', default: '-', description: 'Setting key' },
      { name: 'value', type: 'jsonb', nullable: 'No', default: '{}', description: 'Setting value (JSON)' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'role_permissions',
    description: 'Granular permission flags per role.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'role', type: 'app_role', nullable: 'No', default: '-', description: 'hr_admin|branch_manager|employee' },
      { name: 'permission_key', type: 'text', nullable: 'No', default: '-', description: 'Permission identifier' },
      { name: 'enabled', type: 'boolean', nullable: 'Yes', default: 'true', description: 'Permission enabled' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
      { name: 'updated_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Updated timestamp' },
    ],
  },
  {
    name: 'password_reset_tokens',
    description: 'Temporary password reset tokens for forgot-password flow.',
    columns: [
      { name: 'id', type: 'uuid', nullable: 'No', default: 'gen_random_uuid()', description: 'Primary key' },
      { name: 'user_id', type: 'uuid', nullable: 'No', default: '-', description: 'Target user ID' },
      { name: 'temp_password_hash', type: 'text', nullable: 'No', default: '-', description: 'Hashed temp password' },
      { name: 'expires_at', type: 'timestamptz', nullable: 'No', default: '-', description: 'Token expiry time' },
      { name: 'is_used', type: 'boolean', nullable: 'Yes', default: 'false', description: 'Token used flag' },
      { name: 'created_at', type: 'timestamptz', nullable: 'Yes', default: 'now()', description: 'Created timestamp' },
    ],
  },
];

const enums = [
  { name: 'app_role', values: 'hr_admin | branch_manager | employee' },
  { name: 'employment_status', values: 'active | resigned | terminated | on_leave | inactive' },
  { name: 'leave_status', values: 'pending | manager_approved | hr_approved | rejected | cancelled' },
  { name: 'notification_type', values: 'leave_request | leave_approved | leave_rejected | payroll_ready | announcement | system | attendance' },
  { name: 'payroll_status', values: 'draft | processing | approved | paid' },
];

const dbFunctions = [
  { name: 'has_role(_user_id uuid, _role app_role)', returns: 'boolean', description: 'Check if user has a specific role (SECURITY DEFINER)' },
  { name: 'get_employee_by_user(_user_id uuid)', returns: 'uuid', description: 'Get employee ID from auth user ID' },
  { name: 'get_user_branch_id(_user_id uuid)', returns: 'uuid', description: 'Get branch ID for a branch manager user' },
];

export function generateDataDictionaryPdf(): void {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;

  // ─── TITLE PAGE ───
  try {
    doc.addImage(companyLogo, 'PNG', pageWidth / 2 - 15, 30, 30, 30);
  } catch (e) {
    console.warn('Logo failed:', e);
  }

  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('Database Data Dictionary', pageWidth / 2, 80, { align: 'center' });

  doc.setFontSize(14);
  doc.setFont('helvetica', 'normal');
  doc.text('Migrants Venture Corporation', pageWidth / 2, 92, { align: 'center' });

  doc.setFontSize(10);
  doc.text('HR & Payroll Management System', pageWidth / 2, 100, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(100);
  doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy hh:mm a')}`, pageWidth / 2, 115, { align: 'center' });
  doc.text(`Total Tables: ${tables.length}  |  Relationships: ${relationships.length}`, pageWidth / 2, 122, { align: 'center' });
  doc.setTextColor(0);

  // ─── TABLE OF CONTENTS ───
  doc.addPage();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Table of Contents', margin, 20);
  
  let tocY = 30;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  tables.forEach((t, i) => {
    doc.text(`${i + 1}. ${t.name}`, margin + 5, tocY);
    doc.setTextColor(100);
    doc.text(t.description.substring(0, 70) + (t.description.length > 70 ? '...' : ''), margin + 55, tocY);
    doc.setTextColor(0);
    tocY += 5;
    if (tocY > 270) {
      doc.addPage();
      tocY = 20;
    }
  });

  // ─── DATA DICTIONARY ───
  tables.forEach((table) => {
    doc.addPage();
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.text(`Table: ${table.name}`, margin, 18);

    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    doc.text(table.description, margin, 24);
    doc.setTextColor(0);

    autoTable(doc, {
      startY: 28,
      head: [['Column', 'Type', 'Nullable', 'Default', 'Description']],
      body: table.columns.map((c) => [c.name, c.type, c.nullable, c.default, c.description]),
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [41, 98, 255], textColor: [255, 255, 255], fontSize: 7 },
      columnStyles: {
        0: { cellWidth: 35, fontStyle: 'bold' },
        1: { cellWidth: 22 },
        2: { cellWidth: 15, halign: 'center' },
        3: { cellWidth: 30 },
        4: { cellWidth: 'auto' },
      },
      margin: { left: margin, right: margin },
      theme: 'grid',
    });
  });

  // ─── ENUMS ───
  doc.addPage();
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Enumerations', margin, 18);

  autoTable(doc, {
    startY: 24,
    head: [['Enum Name', 'Values']],
    body: enums.map((e) => [e.name, e.values]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [139, 92, 246], textColor: [255, 255, 255] },
    columnStyles: {
      0: { cellWidth: 40, fontStyle: 'bold' },
      1: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
    theme: 'grid',
  });

  // ─── FUNCTIONS ───
  let fnY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Database Functions', margin, fnY);

  autoTable(doc, {
    startY: fnY + 6,
    head: [['Function', 'Returns', 'Description']],
    body: dbFunctions.map((f) => [f.name, f.returns, f.description]),
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [16, 185, 129], textColor: [255, 255, 255] },
    margin: { left: margin, right: margin },
    theme: 'grid',
  });

  // ─── VISUAL ERD ───
  doc.addPage('landscape');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text('Entity Relationship Diagram (ERD)', margin, 15);

  doc.setFontSize(7);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text('All database tables and their connections are shown below. Lines indicate foreign key or logical relationships.', margin, 21);
  doc.setTextColor(0);

  const lPageW = doc.internal.pageSize.getWidth();
  const lPageH = doc.internal.pageSize.getHeight();

  // ERD node positions (landscape A4: ~297 x 210)
  interface ErdNode { x: number; y: number; w: number; h: number; label: string; color: [number, number, number] }
  const nodes: ErdNode[] = [
    // Row 1 - Core auth
    { x: 20,  y: 30, w: 32, h: 14, label: 'profiles',           color: [59, 130, 246] },
    { x: 60,  y: 30, w: 32, h: 14, label: 'user_roles',         color: [59, 130, 246] },
    { x: 100, y: 30, w: 38, h: 14, label: 'role_permissions',    color: [59, 130, 246] },
    { x: 150, y: 30, w: 42, h: 14, label: 'password_reset_tokens', color: [59, 130, 246] },
    // Row 2 - Organization
    { x: 20,  y: 55, w: 32, h: 14, label: 'branches',           color: [16, 185, 129] },
    { x: 60,  y: 55, w: 40, h: 14, label: 'branch_managers',    color: [16, 185, 129] },
    { x: 110, y: 55, w: 32, h: 14, label: 'positions',          color: [16, 185, 129] },
    { x: 150, y: 55, w: 36, h: 14, label: 'announcements',      color: [16, 185, 129] },
    // Row 3 - Central entity
    { x: 85,  y: 82, w: 40, h: 16, label: 'employees',          color: [234, 88, 12] },
    // Row 4 - Employee children (left)
    { x: 10,  y: 110, w: 32, h: 14, label: 'attendance',        color: [139, 92, 246] },
    { x: 48,  y: 110, w: 42, h: 14, label: 'employee_schedules', color: [139, 92, 246] },
    { x: 96,  y: 110, w: 34, h: 14, label: 'leave_requests',    color: [139, 92, 246] },
    { x: 136, y: 110, w: 32, h: 14, label: 'leave_credits',     color: [139, 92, 246] },
    // Row 5 - More children
    { x: 10,  y: 138, w: 32, h: 14, label: 'loans',             color: [236, 72, 153] },
    { x: 48,  y: 138, w: 50, h: 14, label: 'employee_salary_adj', color: [236, 72, 153] },
    { x: 105, y: 138, w: 38, h: 14, label: 'payroll_records',   color: [236, 72, 153] },
    // Row 6 - Reference tables
    { x: 48,  y: 166, w: 40, h: 14, label: 'salary_components', color: [245, 158, 11] },
    { x: 105, y: 166, w: 38, h: 14, label: 'payroll_periods',   color: [245, 158, 11] },
    { x: 155, y: 110, w: 32, h: 14, label: 'leave_types',       color: [245, 158, 11] },
    // Standalone-ish
    { x: 200, y: 55, w: 36, h: 14, label: 'notifications',      color: [107, 114, 128] },
    { x: 200, y: 82, w: 28, h: 14, label: 'settings',           color: [107, 114, 128] },
    { x: 200, y: 110, w: 28, h: 14, label: 'holidays',          color: [107, 114, 128] },
  ];

  // Draw nodes
  nodes.forEach((n) => {
    doc.setFillColor(n.color[0], n.color[1], n.color[2]);
    doc.roundedRect(n.x, n.y, n.w, n.h, 2, 2, 'F');
    doc.setFontSize(6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 255, 255);
    doc.text(n.label, n.x + n.w / 2, n.y + n.h / 2 + 1.5, { align: 'center' });
  });

  // Draw connections
  doc.setDrawColor(150);
  doc.setLineWidth(0.3);
  doc.setTextColor(0);

  const findNode = (label: string) => {
    const mapped: Record<string, string> = {
      'employee_salary_adjustments': 'employee_salary_adj',
    };
    return nodes.find(n => n.label === (mapped[label] || label));
  };

  const drawnLines = new Set<string>();
  relationships.forEach((r) => {
    const pn = findNode(r.parent);
    const cn = findNode(r.child);
    if (!pn || !cn) return;
    
    const key = `${pn.label}-${cn.label}`;
    if (drawnLines.has(key)) return;
    drawnLines.add(key);

    const px = pn.x + pn.w / 2;
    const py = pn.y + pn.h;
    const cx = cn.x + cn.w / 2;
    const cy = cn.y;

    // Draw line from bottom of parent to top of child
    const fromY = py < cy ? py : pn.y;
    const toY = py < cy ? cy : cn.y + cn.h;
    
    doc.setDrawColor(150);
    doc.line(px, fromY, cx, toY);
  });

  // Legend
  const legendX = lPageW - 80;
  const legendY = 148;
  doc.setFontSize(7);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Legend', legendX, legendY);
  
  const legendItems: { color: [number, number, number]; label: string }[] = [
    { color: [59, 130, 246], label: 'Authentication & Roles' },
    { color: [16, 185, 129], label: 'Organization' },
    { color: [234, 88, 12], label: 'Core Entity' },
    { color: [139, 92, 246], label: 'Employee Activity' },
    { color: [236, 72, 153], label: 'Compensation' },
    { color: [245, 158, 11], label: 'Reference Tables' },
    { color: [107, 114, 128], label: 'System' },
  ];
  
  legendItems.forEach((item, i) => {
    const ly = legendY + 5 + i * 6;
    doc.setFillColor(item.color[0], item.color[1], item.color[2]);
    doc.roundedRect(legendX, ly - 3, 8, 4, 1, 1, 'F');
    doc.setFontSize(6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60);
    doc.text(item.label, legendX + 10, ly);
  });

  // ─── RELATIONSHIPS TABLE ───
  doc.addPage('portrait');
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0);
  doc.text('Relationships Reference', margin, 18);

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  doc.text('All foreign key and logical relationships between tables.', margin, 24);
  doc.setTextColor(0);

  autoTable(doc, {
    startY: 28,
    head: [['Parent Table', 'Parent Column', '→', 'Child Table', 'FK Column']],
    body: relationships.map((r) => [r.parent, r.parentColumn, '→', r.child, r.fkColumn]),
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [234, 88, 12], textColor: [255, 255, 255] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 32 },
      1: { cellWidth: 22 },
      2: { cellWidth: 8, halign: 'center' },
      3: { fontStyle: 'bold', cellWidth: 38 },
      4: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
    theme: 'grid',
  });

  // Cardinality summary
  let cardY = (doc as jsPDF & { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 12;
  if (cardY > 240) {
    doc.addPage();
    cardY = 20;
  }
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Cardinality Summary', margin, cardY);
  
  cardY += 6;
  const cardinalityData = [
    ['profiles', '1 : N', 'user_roles, employees, branch_managers, notifications, password_reset_tokens, announcements, payroll_periods, leave_requests'],
    ['branches', '1 : N', 'employees, branch_managers, announcements'],
    ['employees', '1 : N', 'attendance, schedules, leave_credits, leave_requests, payroll_records, loans, salary_adjustments'],
    ['salary_components', '1 : N', 'employee_salary_adjustments'],
    ['payroll_periods', '1 : N', 'payroll_records'],
    ['leave_types', '1 : N', 'leave_credits, leave_requests'],
    ['user_roles', '1 : N', 'role_permissions (via role enum)'],
    ['positions', '1 : N', 'employees (via position name)'],
    ['holidays', '1 : N', 'payroll_records (computed holiday_pay)'],
    ['settings', '1 : N', 'attendance (terminal config)'],
  ];

  autoTable(doc, {
    startY: cardY,
    head: [['Entity', 'Cardinality', 'Related Entities']],
    body: cardinalityData,
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [99, 102, 241], textColor: [255, 255, 255] },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 32 },
      1: { cellWidth: 18, halign: 'center' },
      2: { cellWidth: 'auto' },
    },
    margin: { left: margin, right: margin },
    theme: 'grid',
  });

  // ─── FOOTER on all pages ───
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    const pw = doc.internal.pageSize.getWidth();
    doc.setFontSize(7);
    doc.setTextColor(150);
    doc.text(
      `Migrants Venture Corporation — Data Dictionary  |  Page ${i} of ${totalPages}`,
      pw / 2,
      doc.internal.pageSize.getHeight() - 8,
      { align: 'center' }
    );
  }

  doc.save(`Data_Dictionary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
}
