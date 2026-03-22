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
  let earningsRows = `<tr><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;">No. of Days</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;text-align:center;">${daysWorked} days</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;text-align:right;">${fmtPHP(basicPay)}</td></tr>`;
  for (const [name, amount] of Object.entries(allowances)) {
    if (Number(amount) > 0) {
      earningsRows += `<tr><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;">${name}</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;text-align:center;"></td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;text-align:right;">${fmtPHP(Number(amount))}</td></tr>`;
    }
  }

  // Build deductions rows
  let deductionRows = '';
  if (sss > 0) deductionRows += `<tr><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;">SSS Contribution</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;text-align:right;">${fmtPHP(sss)}</td></tr>`;
  if (philhealth > 0) deductionRows += `<tr><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;">PhilHealth Contribution</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;text-align:right;">${fmtPHP(philhealth)}</td></tr>`;
  if (pagibig > 0) deductionRows += `<tr><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;">Pag-IBIG Contribution</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;text-align:right;">${fmtPHP(pagibig)}</td></tr>`;
  if (tax > 0) deductionRows += `<tr><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;">Withholding Tax</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;text-align:right;">${fmtPHP(tax)}</td></tr>`;
  for (const [name, amount] of Object.entries(deductionsBreakdown)) {
    if (Number(amount) > 0) {
      deductionRows += `<tr><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;">${name}</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;text-align:right;">${fmtPHP(Number(amount))}</td></tr>`;
    }
  }

  return [
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>',
    '<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f4;"><tr><td align="center" style="padding:30px 0;">',
    '<table role="presentation" width="620" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">',

    // Header
    '<tr><td style="padding:25px 30px;text-align:center;border-bottom:2px solid #eee;">',
    '<img src="https://mvc-rose.vercel.app/favicon.png" alt="MVC Logo" width="50" height="50" style="display:block;margin:0 auto 10px auto;border-radius:8px;" />',
    '<h1 style="color:#1a6b3c;margin:0;font-size:20px;font-weight:700;">PAYSLIP</h1>',
    '<p style="color:#333;font-size:13px;margin:5px 0 0;font-weight:600;">Migrants Venture Corporation</p>',
    '<p style="color:#666;font-size:11px;margin:3px 0 0;">Lapu-Lapu St. Tagum City, Davao del Norte</p>',
    `<p style="color:#666;font-size:11px;margin:3px 0 0;">Pay Period: ${periodStart} - ${periodEnd}</p>`,
    '</td></tr>',

    // Body
    '<tr><td style="padding:25px 30px;">',

    // Greeting
    '<p style="color:#333;font-size:14px;margin:0 0 10px;">Good day!</p>',
    `<p style="color:#333;font-size:14px;margin:0 0 20px;">Furnishing you with the details of your <strong style="color:#1a6b3c;text-decoration:underline;">Payslips</strong> for the Period: <strong>${periodText}.</strong></p>`,

    // Employee Info Table
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 15px;">',
    `<tr><td style="padding:5px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;width:25%;">Employee Name</td><td style="padding:5px 10px;border:1px solid #ccc;font-size:13px;width:35%;">${employee.last_name}, ${employee.first_name}</td><td style="padding:5px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;width:20%;">Employee ID</td><td style="padding:5px 10px;border:1px solid #ccc;font-size:13px;width:20%;">${employee.employee_id || ''}</td></tr>`,
    `<tr><td style="padding:5px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;">Position</td><td style="padding:5px 10px;border:1px solid #ccc;font-size:13px;">${employee.position || ''}</td><td style="padding:5px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;">Pay Date</td><td style="padding:5px 10px;border:1px solid #ccc;font-size:13px;">${payDate}</td></tr>`,
    `<tr><td style="padding:5px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;">Daily Rate</td><td style="padding:5px 10px;border:1px solid #ccc;font-size:13px;">${fmtPHP(dailyRate)}</td><td style="padding:5px 10px;border:1px solid #ccc;font-size:13px;"></td><td style="padding:5px 10px;border:1px solid #ccc;font-size:13px;"></td></tr>`,
    '</table>',

    // Earnings Table
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 5px;">',
    '<tr><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;width:15%;"></td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;">Descriptions</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;text-align:center;">Details</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;text-align:right;">Amount</td></tr>',
    `<tr><td rowspan="99" style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;vertical-align:middle;">Earnings</td></tr>`,
    earningsRows,
    '</table>',

    // Total Earnings
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 15px;">',
    `<tr><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;">Total Earnings</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;text-align:right;">${fmtPHP(grossPay)}</td></tr>`,
    '</table>',

    // Deductions Table
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 5px;">',
    '<tr><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;width:15%;"></td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;">Descriptions</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;text-align:right;">Amount</td></tr>',
    `<tr><td rowspan="99" style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;vertical-align:middle;">Deductions</td></tr>`,
    deductionRows || '<tr><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;">No deductions</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;text-align:right;">0.00</td></tr>',
    '</table>',

    // Total Deductions
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 5px;">',
    `<tr><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;">Total Deductions</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;text-align:right;">${fmtPHP(totalDeductions)}</td></tr>`,
    '</table>',

    // Net Monthly Earnings
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;margin:0 0 20px;">',
    `<tr><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;">Net Monthly Earnings</td><td style="padding:6px 10px;border:1px solid #ccc;font-size:13px;font-weight:bold;text-align:right;">${fmtPHP(netPay)}</td></tr>`,
    '</table>',

    '<p style="color:#666;font-size:12px;margin:15px 0 0;">For the full detailed payslip, please log in to the HR portal.</p>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:15px 0;"><a href="https://mvc-rose.vercel.app/my-payslips" style="display:inline-block;background-color:#1a6b3c;color:#ffffff;text-decoration:none;padding:12px 30px;border-radius:8px;font-size:14px;font-weight:600;">View Full Payslip</a></td></tr></table>',

    '</td></tr>',

    // Footer
    '<tr><td style="background-color:#f8f8f8;padding:15px 30px;text-align:center;border-top:1px solid #eee;">',
    '<p style="color:#999;font-size:11px;margin:0 0 3px;">This is an automated message. Please do not reply to this email.</p>',
    `<p style="color:#999;font-size:11px;margin:0;">&copy; ${new Date().getFullYear()} Migrants Venture Corporation. All rights reserved.</p>`,
    '</td></tr>',

    '</table></td></tr></table></body></html>',
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
