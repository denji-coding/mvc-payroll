import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { format } from "https://esm.sh/date-fns@3.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PayslipEmailRequest {
  payroll_period_id: string;
}

const fmtPHP = (amount: number) =>
  new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(amount);

function buildPayslipEmailHtml(employee: any, record: any, period: any): string {
  const periodStart = format(new Date(period.period_start), "MMM dd, yyyy");
  const periodEnd = format(new Date(period.period_end), "MMM dd, yyyy");
  const periodText = `${format(new Date(period.period_start), "MMMM d")}-${format(new Date(period.period_end), "d, yyyy")}`;
  const payDate = format(new Date(period.pay_date), "MMMM d, yyyy");
  const daysWorked = Number(record.days_worked || 0);
  const basicPay = Number(record.basic_pay || 0);
  const dailyRate = daysWorked > 0 ? basicPay / daysWorked : 0;
  const grossPay = Number(record.gross_pay || 0);
  const totalDeductions = Number(record.total_deductions || 0);
  const netPay = Number(record.net_pay || 0);
  const sss = Number(record.sss_contribution || 0);
  const philhealth = Number(record.philhealth_contribution || 0);
  const pagibig = Number(record.pagibig_contribution || 0);
  const tax = Number(record.withholding_tax || 0);

  const allowances = record.allowances_breakdown || {};
  const deductionsBreakdown = record.deductions_breakdown || {};

  // Build earnings rows
  let earningsRows = `<tr><td style="border:1px solid #000;padding:4px;font-size:12px;">No. of Days</td><td style="border:1px solid #000;padding:4px;font-size:12px;">${daysWorked} days</td><td style="border:1px solid #000;padding:4px;font-size:12px;">${fmtPHP(basicPay)}</td></tr>`;
  let earningsCount = 1;
  for (const [name, amount] of Object.entries(allowances)) {
    if (Number(amount) > 0) {
      earningsRows += `<tr><td style="border:1px solid #000;padding:4px;font-size:12px;">${name}</td><td style="border:1px solid #000;padding:4px;font-size:12px;"></td><td style="border:1px solid #000;padding:4px;font-size:12px;">${fmtPHP(Number(amount))}</td></tr>`;
      earningsCount++;
    }
  }

  // Build deductions rows
  let deductionRows = '';
  let deductionsCount = 0;
  if (sss > 0) { deductionRows += `<tr><td style="border:1px solid #000;padding:4px;font-size:12px;">SSS Contribution</td><td colspan="2" style="border:1px solid #000;padding:4px;font-size:12px;">${fmtPHP(sss)}</td></tr>`; deductionsCount++; }
  if (philhealth > 0) { deductionRows += `<tr><td style="border:1px solid #000;padding:4px;font-size:12px;">PhilHealth Contribution</td><td colspan="2" style="border:1px solid #000;padding:4px;font-size:12px;">${fmtPHP(philhealth)}</td></tr>`; deductionsCount++; }
  if (pagibig > 0) { deductionRows += `<tr><td style="border:1px solid #000;padding:4px;font-size:12px;">Pag-IBIG Contribution</td><td colspan="2" style="border:1px solid #000;padding:4px;font-size:12px;">${fmtPHP(pagibig)}</td></tr>`; deductionsCount++; }
  if (tax > 0) { deductionRows += `<tr><td style="border:1px solid #000;padding:4px;font-size:12px;">Withholding Tax</td><td colspan="2" style="border:1px solid #000;padding:4px;font-size:12px;">${fmtPHP(tax)}</td></tr>`; deductionsCount++; }
  for (const [name, amount] of Object.entries(deductionsBreakdown)) {
    if (Number(amount) > 0) {
      deductionRows += `<tr><td style="border:1px solid #000;padding:4px;font-size:12px;">${name}</td><td colspan="2" style="border:1px solid #000;padding:4px;font-size:12px;">${fmtPHP(Number(amount))}</td></tr>`;
      deductionsCount++;
    }
  }
  if (deductionsCount === 0) {
    deductionRows = `<tr><td style="border:1px solid #000;padding:4px;font-size:12px;">No deductions</td><td colspan="2" style="border:1px solid #000;padding:4px;font-size:12px;">0.00</td></tr>`;
    deductionsCount = 1;
  }

  const earningsRowspan = earningsCount + 1;
  const deductionsRowspan = deductionsCount + 1;

  return [
    '<!DOCTYPE html><html><head><meta charset="UTF-8">',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '</head>',
    '<body style="margin:0;padding:20px;font-family:Arial,Helvetica,sans-serif;background:#fff;">',
    '<table width="700" align="center" style="border-collapse:collapse;">',
    '<tr><td colspan="4" style="text-align:center;padding-bottom:10px;">',
    '<img src="https://mvc-rose.vercel.app/favicon.png" width="70" style="margin-bottom:5px;" />',
    '<h2 style="margin:0;font-size:22px;letter-spacing:2px;">PAYSLIP</h2>',
    '<div style="font-weight:bold;font-size:13px;">Migrants Venture Corporation</div>',
    '<div style="font-size:11px;">Lapu-Lapu St. Tagum City, Davao del Norte</div>',
    `<div style="font-size:11px;">Pay Period: ${periodStart} - ${periodEnd}</div>`,
    '</td></tr>',
    '<tr><td colspan="4" style="padding:10px 0;font-size:12px;">Good day!</td></tr>',
    `<tr><td colspan="4" style="padding-bottom:10px;font-size:12px;">Furnishing you with the details of your Payslips for the Period: <b>${periodText}</b>.</td></tr>`,
    '<tr>',
    `<td style="border:1px solid #000;padding:4px;font-size:12px;"><b>Employee Name</b></td>`,
    `<td style="border:1px solid #000;padding:4px;font-size:12px;">${employee.last_name}, ${employee.first_name}</td>`,
    `<td style="border:1px solid #000;padding:4px;font-size:12px;"><b>Employee ID</b></td>`,
    `<td style="border:1px solid #000;padding:4px;font-size:12px;">${employee.employee_id || ''}</td>`,
    '</tr>',
    '<tr>',
    `<td style="border:1px solid #000;padding:4px;font-size:12px;"><b>Position</b></td>`,
    `<td style="border:1px solid #000;padding:4px;font-size:12px;">${employee.position || ''}</td>`,
    `<td style="border:1px solid #000;padding:4px;font-size:12px;"><b>Pay Date</b></td>`,
    `<td style="border:1px solid #000;padding:4px;font-size:12px;">${payDate}</td>`,
    '</tr>',
    '<tr>',
    `<td style="border:1px solid #000;padding:4px;font-size:12px;"><b>Daily Rate</b></td>`,
    `<td style="border:1px solid #000;padding:4px;font-size:12px;">${fmtPHP(dailyRate)}</td>`,
    '<td style="border:1px solid #000;"></td>',
    '<td style="border:1px solid #000;"></td>',
    '</tr>',
    '<tr>',
    `<td rowspan="${earningsRowspan}" style="border:1px solid #000;padding:4px;font-size:12px;text-align:center;"><b>Earnings</b></td>`,
    '<td style="border:1px solid #000;padding:4px;font-size:12px;"><b>Descriptions</b></td>',
    '<td style="border:1px solid #000;padding:4px;font-size:12px;"><b>Details</b></td>',
    '<td style="border:1px solid #000;padding:4px;font-size:12px;"><b>Amount</b></td>',
    '</tr>',
    earningsRows,
    `<tr><td colspan="3" style="border:1px solid #000;padding:4px;font-size:12px;"><b>Total Earnings</b></td><td style="border:1px solid #000;padding:4px;font-size:12px;">${fmtPHP(grossPay)}</td></tr>`,
    '<tr>',
    `<td rowspan="${deductionsRowspan}" style="border:1px solid #000;padding:4px;font-size:12px;text-align:center;"><b>Deductions</b></td>`,
    '<td style="border:1px solid #000;padding:4px;font-size:12px;"><b>Descriptions</b></td>',
    '<td colspan="2" style="border:1px solid #000;padding:4px;font-size:12px;"><b>Amount</b></td>',
    '</tr>',
    deductionRows,
    `<tr><td colspan="3" style="border:1px solid #000;padding:4px;font-size:12px;"><b>Total Deductions</b></td><td style="border:1px solid #000;padding:4px;font-size:12px;">${fmtPHP(totalDeductions)}</td></tr>`,
    `<tr><td colspan="3" style="border:1px solid #000;padding:4px;font-size:12px;"><b>Net Monthly Earnings</b></td><td style="border:1px solid #000;padding:4px;font-size:12px;"><b>${fmtPHP(netPay)}</b></td></tr>`,
    '</table>',
    '</body></html>',
  ].join('');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailUser || !gmailPassword) {
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: roleData } = await supabase
      .from('user_roles').select('role').eq('user_id', user.id).single();
    if (roleData?.role !== 'hr_admin') {
      return new Response(JSON.stringify({ error: 'Only HR admins can send payslip emails' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { payroll_period_id }: PayslipEmailRequest = await req.json();

    if (!payroll_period_id) {
      return new Response(
        JSON.stringify({ error: "payroll_period_id is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: period, error: periodError } = await supabase
      .from("payroll_periods").select("*").eq("id", payroll_period_id).single();

    if (periodError || !period) {
      return new Response(
        JSON.stringify({ error: "Payroll period not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: records, error: recordsError } = await supabase
      .from("payroll_records")
      .select(`*, employees(id, first_name, last_name, email, user_id, employee_id, position, department, basic_salary)`)
      .eq("payroll_period_id", payroll_period_id);

    if (recordsError) {
      return new Response(
        JSON.stringify({ error: "Failed to fetch payroll records" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!records || records.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "No payroll records found", emailsSent: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const client = new SMTPClient({
      connection: {
        hostname: "smtp.gmail.com",
        port: 465,
        tls: true,
        auth: { username: gmailUser, password: gmailPassword },
      },
    });

    let emailsSent = 0;
    const errors: string[] = [];

    for (const record of records) {
      const employee = record.employees;
      if (!employee || !employee.email) continue;

      const periodStart = format(new Date(period.period_start), "MMM dd, yyyy");
      const periodEnd = format(new Date(period.period_end), "MMM dd, yyyy");
      const html = buildPayslipEmailHtml(employee, record, period);

      try {
        await client.send({
          from: `Migrants Venture Corporation <${gmailUser}>`,
          to: employee.email,
          subject: `Your Payslip is Ready - ${periodStart} to ${periodEnd}`,
          content: "Please view this email in an HTML-capable email client.",
          html,
        });
        emailsSent++;
        console.log(`Email sent to: ${employee.email}`);
      } catch (emailError) {
        console.error(`Failed to send to ${employee.email}:`, emailError);
        errors.push(`Failed to send to ${employee.email}`);
      }
    }

    await client.close();

    return new Response(
      JSON.stringify({ success: true, message: `Sent ${emailsSent} payslip emails`, emailsSent, errors: errors.length > 0 ? errors : undefined }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error sending payslip emails:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "An unknown error occurred" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
