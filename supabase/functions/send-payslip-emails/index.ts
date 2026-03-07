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
      console.error("Gmail credentials not configured");
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

    // Only HR admins can send payslip emails
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

    // Get payroll period details
    const { data: period, error: periodError } = await supabase
      .from("payroll_periods")
      .select("*")
      .eq("id", payroll_period_id)
      .single();

    if (periodError || !period) {
      console.error("Error fetching payroll period:", periodError);
      return new Response(
        JSON.stringify({ error: "Payroll period not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get all payroll records with employee details
    const { data: records, error: recordsError } = await supabase
      .from("payroll_records")
      .select(`
        *,
        employees(id, first_name, last_name, email, user_id)
      `)
      .eq("payroll_period_id", payroll_period_id);

    if (recordsError) {
      console.error("Error fetching payroll records:", recordsError);
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
        auth: {
          username: gmailUser,
          password: gmailPassword,
        },
      },
    });

    let emailsSent = 0;
    const errors: string[] = [];

    for (const record of records) {
      const employee = record.employees;
      if (!employee || !employee.email) {
        console.log(`Skipping employee without email: ${record.employee_id}`);
        continue;
      }

      const periodStart = format(new Date(period.period_start), "MMM dd, yyyy");
      const periodEnd = format(new Date(period.period_end), "MMM dd, yyyy");
      const netPay = new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
      }).format(record.net_pay || 0);
      const basicPay = new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
      }).format(record.basic_pay || 0);
      const grossPay = new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
      }).format(record.gross_pay || 0);
      const totalDeductions = new Intl.NumberFormat("en-PH", {
        style: "currency",
        currency: "PHP",
      }).format(record.total_deductions || 0);

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f4;">
    <tr>
      <td align="center" style="padding:30px 0;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="background-color:#1a6b3c;padding:30px 40px;text-align:center;">
              <img src="https://migrant-path-hr.lovable.app/favicon.png" alt="MVC Logo" width="60" height="60" style="display:block;margin:0 auto 15px auto;border-radius:8px;" />
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Your Payslip is Ready</h1>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:35px 40px;">
              <p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 20px;">Dear <strong>${employee.first_name} ${employee.last_name}</strong>,</p>
              <p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 25px;">Your payslip for the period <strong>${periodStart} - ${periodEnd}</strong> is now available. Here is a summary:</p>
              
              <!-- Pay Summary -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0faf3;border:1px solid #d4edda;border-radius:10px;margin:0 0 20px;">
                <tr><td style="padding:25px;text-align:center;">
                  <p style="color:#666;font-size:13px;margin:0 0 5px;text-transform:uppercase;letter-spacing:1px;">Net Pay</p>
                  <p style="color:#1a6b3c;font-size:34px;font-weight:700;margin:0;">${netPay}</p>
                </td></tr>
              </table>

              <!-- Breakdown -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9f9f9;border-radius:10px;margin:0 0 25px;">
                <tr><td style="padding:20px 25px;">
                  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                    <tr>
                      <td style="color:#666;font-size:14px;padding:8px 0;border-bottom:1px solid #eee;">Basic Pay</td>
                      <td style="color:#333;font-size:14px;font-weight:600;padding:8px 0;text-align:right;border-bottom:1px solid #eee;">${basicPay}</td>
                    </tr>
                    <tr>
                      <td style="color:#666;font-size:14px;padding:8px 0;border-bottom:1px solid #eee;">Gross Pay</td>
                      <td style="color:#333;font-size:14px;font-weight:600;padding:8px 0;text-align:right;border-bottom:1px solid #eee;">${grossPay}</td>
                    </tr>
                    <tr>
                      <td style="color:#d9534f;font-size:14px;padding:8px 0;">Total Deductions</td>
                      <td style="color:#d9534f;font-size:14px;font-weight:600;padding:8px 0;text-align:right;">-${totalDeductions}</td>
                    </tr>
                  </table>
                </td></tr>
              </table>
              
              <p style="color:#333;font-size:14px;line-height:1.6;margin:0 0 25px;">For a detailed breakdown of your payslip, please log in to the HR portal.</p>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr><td align="center" style="padding:10px 0 25px;">
                  <a href="https://migrant-path-hr.lovable.app/my-payslips" style="display:inline-block;background-color:#1a6b3c;color:#ffffff;text-decoration:none;padding:14px 35px;border-radius:8px;font-size:15px;font-weight:600;">View Full Payslip</a>
                </td></tr>
              </table>

              <p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 10px;">If you have any questions about your payslip, please contact the HR department.</p>
              <p style="color:#333;font-size:14px;line-height:1.6;margin:20px 0 0;">Best regards,<br /><strong>Migrants Venture Corporation HR Team</strong></p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #eeeeee;">
              <p style="color:#999;font-size:12px;margin:0 0 5px;">This is an automated message. Please do not reply to this email.</p>
              <p style="color:#999;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Migrants Venture Corporation. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

      try {
        await client.send({
          from: `Migrants Venture Corporation <${gmailUser}>`,
          to: employee.email,
          subject: `Your Payslip is Ready - ${periodStart} to ${periodEnd}`,
          content: "Please view this email in an HTML-capable email client.",
          html: html,
        });
        emailsSent++;
        console.log(`Email sent successfully to: ${employee.email}`);
      } catch (emailError) {
        console.error(`Failed to send email to ${employee.email}:`, emailError);
        errors.push(`Failed to send to ${employee.email}`);
      }
    }

    await client.close();

    console.log(`Payslip emails sent: ${emailsSent}/${records.length}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Sent ${emailsSent} payslip emails`, 
        emailsSent,
        errors: errors.length > 0 ? errors : undefined 
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error sending payslip emails:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
