import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Philippine SSS 2024 Contribution Table
function computeSSS(monthlySalary: number): { employee: number; employer: number } {
  const brackets = [
    { min: 0, max: 4249.99, msc: 4000, ee: 180, er: 380 },
    { min: 4250, max: 4749.99, msc: 4500, ee: 202.50, er: 427.50 },
    { min: 4750, max: 5249.99, msc: 5000, ee: 225, er: 475 },
    { min: 5250, max: 5749.99, msc: 5500, ee: 247.50, er: 522.50 },
    { min: 5750, max: 6249.99, msc: 6000, ee: 270, er: 570 },
    { min: 6250, max: 6749.99, msc: 6500, ee: 292.50, er: 617.50 },
    { min: 6750, max: 7249.99, msc: 7000, ee: 315, er: 665 },
    { min: 7250, max: 7749.99, msc: 7500, ee: 337.50, er: 712.50 },
    { min: 7750, max: 8249.99, msc: 8000, ee: 360, er: 760 },
    { min: 8250, max: 8749.99, msc: 8500, ee: 382.50, er: 807.50 },
    { min: 8750, max: 9249.99, msc: 9000, ee: 405, er: 855 },
    { min: 9250, max: 9749.99, msc: 9500, ee: 427.50, er: 902.50 },
    { min: 9750, max: 10249.99, msc: 10000, ee: 450, er: 950 },
    { min: 10250, max: 10749.99, msc: 10500, ee: 472.50, er: 997.50 },
    { min: 10750, max: 11249.99, msc: 11000, ee: 495, er: 1045 },
    { min: 11250, max: 11749.99, msc: 11500, ee: 517.50, er: 1092.50 },
    { min: 11750, max: 12249.99, msc: 12000, ee: 540, er: 1140 },
    { min: 12250, max: 12749.99, msc: 12500, ee: 562.50, er: 1187.50 },
    { min: 12750, max: 13249.99, msc: 13000, ee: 585, er: 1235 },
    { min: 13250, max: 13749.99, msc: 13500, ee: 607.50, er: 1282.50 },
    { min: 13750, max: 14249.99, msc: 14000, ee: 630, er: 1330 },
    { min: 14250, max: 14749.99, msc: 14500, ee: 652.50, er: 1377.50 },
    { min: 14750, max: 15249.99, msc: 15000, ee: 675, er: 1425 },
    { min: 15250, max: 15749.99, msc: 15500, ee: 697.50, er: 1472.50 },
    { min: 15750, max: 16249.99, msc: 16000, ee: 720, er: 1520 },
    { min: 16250, max: 16749.99, msc: 16500, ee: 742.50, er: 1567.50 },
    { min: 16750, max: 17249.99, msc: 17000, ee: 765, er: 1615 },
    { min: 17250, max: 17749.99, msc: 17500, ee: 787.50, er: 1662.50 },
    { min: 17750, max: 18249.99, msc: 18000, ee: 810, er: 1710 },
    { min: 18250, max: 18749.99, msc: 18500, ee: 832.50, er: 1757.50 },
    { min: 18750, max: 19249.99, msc: 19000, ee: 855, er: 1805 },
    { min: 19250, max: 19749.99, msc: 19500, ee: 877.50, er: 1852.50 },
    { min: 19750, max: 20249.99, msc: 20000, ee: 900, er: 1900 },
    { min: 20250, max: 20749.99, msc: 20500, ee: 922.50, er: 1947.50 },
    { min: 20750, max: 21249.99, msc: 21000, ee: 945, er: 1995 },
    { min: 21250, max: 21749.99, msc: 21500, ee: 967.50, er: 2042.50 },
    { min: 21750, max: 22249.99, msc: 22000, ee: 990, er: 2090 },
    { min: 22250, max: 22749.99, msc: 22500, ee: 1012.50, er: 2137.50 },
    { min: 22750, max: 23249.99, msc: 23000, ee: 1035, er: 2185 },
    { min: 23250, max: 23749.99, msc: 23500, ee: 1057.50, er: 2232.50 },
    { min: 23750, max: 24249.99, msc: 24000, ee: 1080, er: 2280 },
    { min: 24250, max: 24749.99, msc: 24500, ee: 1102.50, er: 2327.50 },
    { min: 24750, max: 25249.99, msc: 25000, ee: 1125, er: 2375 },
    { min: 25250, max: 25749.99, msc: 25500, ee: 1147.50, er: 2422.50 },
    { min: 25750, max: 26249.99, msc: 26000, ee: 1170, er: 2470 },
    { min: 26250, max: 26749.99, msc: 26500, ee: 1192.50, er: 2517.50 },
    { min: 26750, max: 27249.99, msc: 27000, ee: 1215, er: 2565 },
    { min: 27250, max: 27749.99, msc: 27500, ee: 1237.50, er: 2612.50 },
    { min: 27750, max: 28249.99, msc: 28000, ee: 1260, er: 2660 },
    { min: 28250, max: 28749.99, msc: 28500, ee: 1282.50, er: 2707.50 },
    { min: 28750, max: 29249.99, msc: 29000, ee: 1305, er: 2755 },
    { min: 29250, max: 29749.99, msc: 29500, ee: 1327.50, er: 2802.50 },
    { min: 29750, max: Infinity, msc: 30000, ee: 1350, er: 2850 },
  ];

  const bracket = brackets.find(b => monthlySalary >= b.min && monthlySalary <= b.max) || brackets[brackets.length - 1];
  return { employee: bracket.ee, employer: bracket.er };
}

function computePhilHealth(fixedAmount: number): { employee: number; employer: number } {
  const share = fixedAmount / 2;
  return { employee: share, employer: share };
}

function computePagIBIG(fixedAmount: number): { employee: number; employer: number } {
  return { employee: fixedAmount, employer: fixedAmount };
}

function computeWithholdingTax(taxableIncome: number): number {
  const brackets = [
    { min: 0, max: 20833, rate: 0, base: 0 },
    { min: 20833, max: 33333, rate: 0.15, base: 0 },
    { min: 33333, max: 66667, rate: 0.20, base: 1875 },
    { min: 66667, max: 166667, rate: 0.25, base: 8541.67 },
    { min: 166667, max: 666667, rate: 0.30, base: 33541.67 },
    { min: 666667, max: Infinity, rate: 0.35, base: 183541.67 },
  ];

  const bracket = brackets.find(b => taxableIncome > b.min && taxableIncome <= b.max) || brackets[0];
  
  if (taxableIncome <= 20833) return 0;
  
  const excess = taxableIncome - bracket.min;
  return bracket.base + (excess * bracket.rate);
}

// Helper: parse "HH:MM" time string to minutes since midnight
function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m || 0);
}

// Calculate session hours from actual timestamps, capped to scheduled duration
function computeSessionHours(
  sessionIn: string | null,
  sessionOut: string | null,
  scheduledDurationHours: number
): number {
  if (!sessionIn || !sessionOut) return 0;
  const inTime = new Date(sessionIn).getTime();
  const outTime = new Date(sessionOut).getTime();
  const rawHours = (outTime - inTime) / (1000 * 60 * 60);
  return Math.min(Math.max(rawHours, 0), scheduledDurationHours);
}

interface PayrollRequest {
  payroll_period_id: string;
  employee_ids?: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Custom JWT verification
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: roleData, error: roleError } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (roleError || roleData?.role !== 'hr_admin') {
      return new Response(
        JSON.stringify({ error: 'Only HR admins can run payroll' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { payroll_period_id, employee_ids }: PayrollRequest = await req.json();

    if (!payroll_period_id) {
      return new Response(
        JSON.stringify({ error: 'Payroll period ID is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get payroll period
    const { data: period, error: periodError } = await supabase
      .from('payroll_periods')
      .select('*')
      .eq('id', payroll_period_id)
      .single();

    if (periodError || !period) {
      return new Response(
        JSON.stringify({ error: 'Payroll period not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get benefit rates from settings
    const { data: benefitRatesData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'benefit_rates')
      .single();
    
    const benefitRates = benefitRatesData?.value as { 
      sss_contribution?: number;
      philhealth_rate?: number; 
      pagibig_employee_rate?: number; 
    } || {};
    
    const sssFixed = benefitRates.sss_contribution ?? 1350;
    const philhealthFixed = benefitRates.philhealth_rate ?? 500;
    const pagibigFixed = benefitRates.pagibig_employee_rate ?? 200;

    // Get payroll deduction toggles
    const { data: deductionTogglesData } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'payroll_deductions')
      .single();
    
    const deductionToggles = deductionTogglesData?.value as {
      sss_enabled?: boolean;
      philhealth_enabled?: boolean;
      pagibig_enabled?: boolean;
    } || {};

    const sssEnabled = deductionToggles.sss_enabled !== false;
    const philhealthEnabled = deductionToggles.philhealth_enabled !== false;
    const pagibigEnabled = deductionToggles.pagibig_enabled !== false;

    // Get employees
    let employeesQuery = supabase
      .from('employees')
      .select('*')
      .eq('employment_status', 'active');

    if (employee_ids && employee_ids.length > 0) {
      employeesQuery = employeesQuery.in('id', employee_ids);
    }

    const { data: employees, error: empError } = await employeesQuery;

    if (empError) {
      throw empError;
    }

    const records = [];
    const periodStart = new Date(period.period_start);
    const periodEnd = new Date(period.period_end);

    for (const employee of employees || []) {
      // Get attendance for the period
      const { data: attendance } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employee.id)
        .gte('date', period.period_start)
        .lte('date', period.period_end);

      // Get employee schedules (all days)
      const { data: schedules } = await supabase
        .from('employee_schedules')
        .select('*')
        .eq('employee_id', employee.id);

      // Build schedule map by day_of_week
      const scheduleMap: Record<number, any> = {};
      for (const s of schedules || []) {
        scheduleMap[s.day_of_week] = s;
      }

      // Get approved leaves for the period
      const { data: leaveRequests } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('employee_id', employee.id)
        .eq('status', 'hr_approved')
        .lte('start_date', period.period_end)
        .gte('end_date', period.period_start);

      // Calculate leave days within the period
      let leaveWithPayDays = 0;
      let leaveWithoutPayDays = 0;
      for (const leave of leaveRequests || []) {
        const leaveStart = new Date(Math.max(new Date(leave.start_date).getTime(), periodStart.getTime()));
        const leaveEnd = new Date(Math.min(new Date(leave.end_date).getTime(), periodEnd.getTime()));
        const leaveDays = calculateWorkingDays(leaveStart, leaveEnd);
        if (leave.pay_type === 'without_pay') {
          leaveWithoutPayDays += leaveDays;
        } else {
          leaveWithPayDays += leaveDays;
        }
      }

      // Calculate total hours worked using SESSION-BASED calculation
      let totalCappedHours = 0;
      const totalLateMinutes = attendance?.reduce((sum, a) => sum + (parseInt(String(a.late_minutes)) || 0), 0) || 0;

      for (const a of attendance || []) {
        const attendanceDate = new Date(a.date + 'T12:00:00+08:00');
        const dayOfWeek = attendanceDate.getDay();
        const schedule = scheduleMap[dayOfWeek];

        if (schedule && schedule.is_duty_day) {
          const mStartMin = timeToMinutes(schedule.morning_start || '08:00');
          const mEndMin = timeToMinutes(schedule.morning_end || '12:00');
          const aStartMin = timeToMinutes(schedule.afternoon_start || '13:00');
          const aEndMin = timeToMinutes(schedule.afternoon_end || '17:00');
          const morningScheduledHours = (mEndMin - mStartMin) / 60;
          const afternoonScheduledHours = (aEndMin - aStartMin) / 60;

          // Compute hours from actual session timestamps, capped to schedule
          const morningHours = computeSessionHours(a.morning_in, a.morning_out, morningScheduledHours);
          const afternoonHours = computeSessionHours(a.afternoon_in, a.afternoon_out, afternoonScheduledHours);
          totalCappedHours += morningHours + afternoonHours;
        } else {
          // No schedule for this day, fallback to hours_worked capped at 8
          const rawHours = parseFloat(String(a.hours_worked)) || 0;
          totalCappedHours += Math.min(rawHours, 8);
        }
      }

      const daysWorked = Math.round((totalCappedHours / 8) * 100) / 100;

      // Get employee salary adjustments (allowances/deductions)
      const { data: adjustments } = await supabase
        .from('employee_salary_adjustments')
        .select('*, salary_components(*)')
        .eq('employee_id', employee.id)
        .eq('is_recurring', true);

      // Calculate pay components - basic_salary is the DAILY RATE
      const dailyRate = employee.basic_salary;
      const hourlyRate = dailyRate / 8;
      const minuteRate = hourlyRate / 60;
      const basicPay = dailyRate * daysWorked;
      const lateDeduction = Math.round(minuteRate * totalLateMinutes * 100) / 100;
      const leavePay = dailyRate * leaveWithPayDays;

      // Allowances
      let totalAllowances = 0;
      const allowancesBreakdown: Record<string, number> = {};
      adjustments?.filter(a => a.salary_components?.type === 'earning').forEach(adj => {
        totalAllowances += parseFloat(adj.amount);
        allowancesBreakdown[adj.salary_components.name] = parseFloat(adj.amount);
      });
      if (leaveWithPayDays > 0) {
        allowancesBreakdown[`Leave With Pay (${leaveWithPayDays} days)`] = Math.round(leavePay * 100) / 100;
      }

      // Gross pay — NO overtime
      const grossPay = basicPay + totalAllowances + leavePay;

      // Government contributions (respect toggle settings)
      const sssContribution = sssEnabled ? sssFixed : 0;
      const philhealthContribution = philhealthEnabled ? philhealthFixed : 0;
      const pagibigContribution = pagibigEnabled ? pagibigFixed : 0;

      // Taxable income
      const taxableIncome = grossPay - sssContribution - philhealthContribution - pagibigContribution;
      const withholdingTax = computeWithholdingTax(taxableIncome * 2) / 2;

      // Other deductions
      let otherDeductions = lateDeduction;
      const deductionsBreakdown: Record<string, number> = {};
      if (lateDeduction > 0) {
        deductionsBreakdown[`Late (${totalLateMinutes} mins)`] = lateDeduction;
      }
      adjustments?.filter(a => a.salary_components?.type === 'deduction').forEach(adj => {
        otherDeductions += parseFloat(adj.amount);
        deductionsBreakdown[adj.salary_components.name] = parseFloat(adj.amount);
      });
      if (leaveWithoutPayDays > 0) {
        deductionsBreakdown[`Leave Without Pay (${leaveWithoutPayDays} days)`] = 0;
      }

      const totalDeductions = sssContribution + philhealthContribution + pagibigContribution + withholdingTax + otherDeductions;
      const netPay = grossPay - totalDeductions;

      const payrollRecord = {
        payroll_period_id,
        employee_id: employee.id,
        basic_pay: Math.round(basicPay * 100) / 100,
        days_worked: daysWorked,
        overtime_pay: 0,
        night_differential: 0,
        holiday_pay: 0,
        total_allowances: Math.round(totalAllowances * 100) / 100,
        gross_pay: Math.round(grossPay * 100) / 100,
        sss_contribution: Math.round(sssContribution * 100) / 100,
        philhealth_contribution: Math.round(philhealthContribution * 100) / 100,
        pagibig_contribution: Math.round(pagibigContribution * 100) / 100,
        withholding_tax: Math.round(withholdingTax * 100) / 100,
        other_deductions: Math.round(otherDeductions * 100) / 100,
        total_deductions: Math.round(totalDeductions * 100) / 100,
        net_pay: Math.round(netPay * 100) / 100,
        allowances_breakdown: allowancesBreakdown,
        deductions_breakdown: deductionsBreakdown,
      };

      // Check if record exists
      const { data: existing } = await supabase
        .from('payroll_records')
        .select('id')
        .eq('payroll_period_id', payroll_period_id)
        .eq('employee_id', employee.id)
        .single();

      if (existing) {
        const { error } = await supabase
          .from('payroll_records')
          .update(payrollRecord)
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('payroll_records')
          .insert(payrollRecord);
        if (error) throw error;
      }

      records.push({
        employee_name: `${employee.first_name} ${employee.last_name}`,
        ...payrollRecord,
      });
    }

    // Update payroll period status
    await supabase
      .from('payroll_periods')
      .update({ status: 'processing' })
      .eq('id', payroll_period_id);

    console.log(`Payroll computed for ${records.length} employees`);

    return new Response(
      JSON.stringify({
        success: true,
        period,
        records_count: records.length,
        records,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: unknown) {
    console.error('Payroll Computation Error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function calculateWorkingDays(start: Date, end: Date): number {
  let count = 0;
  const current = new Date(start);
  while (current <= end) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) count++;
    current.setDate(current.getDate() + 1);
  }
  return count;
}
