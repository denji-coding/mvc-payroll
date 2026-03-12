import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AccountCreatedEmail {
  type: 'account_created';
  to: string;
  name: string;
  email: string;
  password: string;
  role: string;
  portalUrl: string;
}

interface LeaveApprovedEmail {
  type: 'leave_approved';
  to: string;
  name: string;
  leaveType: string;
  startDate: string;
  endDate: string;
  status: 'approved' | 'rejected';
}

interface PayslipReadyEmail {
  type: 'payslip_ready';
  to: string;
  name: string;
  periodStart: string;
  periodEnd: string;
  netPay: string;
}

type EmailRequest = AccountCreatedEmail | LeaveApprovedEmail | PayslipReadyEmail;

function getAccountCreatedHtml(data: AccountCreatedEmail): string {
  const roleLabel = data.role === 'hr_admin' ? 'HR Administrator' : 
                    data.role === 'branch_manager' ? 'Branch Manager' : 'Employee';
  
  return [
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>',
    '<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f4;"><tr><td align="center" style="padding:30px 0;">',
    '<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">',
    '<tr><td style="background-color:#1a6b3c;padding:30px 40px;text-align:center;">',
    '<img src="https://mvc-rose.vercel.app/favicon.png" alt="MVC Logo" width="60" height="60" style="display:block;margin:0 auto 15px auto;border-radius:8px;" />',
    '<h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;letter-spacing:0.5px;">Welcome to Migrants Venture Corporation</h1>',
    '</td></tr>',
    '<tr><td style="padding:35px 40px;">',
    `<p style="color:#333333;font-size:16px;line-height:1.6;margin:0 0 20px;">Dear <strong>${data.name}</strong>,</p>`,
    '<p style="color:#333333;font-size:15px;line-height:1.6;margin:0 0 25px;">Your account has been created successfully. You can now access the HR &amp; Payroll Portal using the credentials below:</p>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0faf3;border:1px solid #d4edda;border-radius:10px;margin:0 0 25px;">',
    '<tr><td style="padding:20px 25px;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">',
    `<tr><td style="color:#666;font-size:14px;padding:6px 0;">Role:</td><td style="color:#333;font-size:14px;font-weight:600;padding:6px 0;text-align:right;">${roleLabel}</td></tr>`,
    `<tr><td style="color:#666;font-size:14px;padding:6px 0;">Email:</td><td style="color:#333;font-size:14px;font-weight:600;padding:6px 0;text-align:right;">${data.email}</td></tr>`,
    `<tr><td style="color:#666;font-size:14px;padding:6px 0;">Password:</td><td style="color:#333;font-size:14px;font-weight:600;padding:6px 0;text-align:right;">${data.password}</td></tr>`,
    '</table></td></tr></table>',
    '<p style="color:#d9534f;font-size:14px;line-height:1.6;margin:0 0 25px;font-weight:600;">Important: Please change your password after your first login for security purposes.</p>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">',
    `<tr><td align="center" style="padding:10px 0 25px;"><a href="https://mvc-rose.vercel.app/" style="display:inline-block;background-color:#1a6b3c;color:#ffffff;text-decoration:none;padding:14px 35px;border-radius:8px;font-size:15px;font-weight:600;">Access ${roleLabel} Portal</a></td></tr>`,
    '</table>',
    '<p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 10px;">If you have any questions, please contact the HR department.</p>',
    '<p style="color:#333;font-size:14px;line-height:1.6;margin:20px 0 0;">Best regards,<br /><strong>Migrants Venture Corporation HR Team</strong></p>',
    '</td></tr>',
    '<tr><td style="background-color:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #eeeeee;">',
    '<p style="color:#999;font-size:12px;margin:0 0 5px;">This is an automated message. Please do not reply to this email.</p>',
    `<p style="color:#999;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Migrants Venture Corporation. All rights reserved.</p>`,
    '</td></tr></table></td></tr></table></body></html>',
  ].join('');
}

function getLeaveApprovedHtml(data: LeaveApprovedEmail): string {
  const isApproved = data.status === 'approved';
  const statusColor = isApproved ? '#1a6b3c' : '#d9534f';
  const statusBg = isApproved ? '#f0faf3' : '#fdf0f0';
  const statusText = isApproved ? 'Approved' : 'Rejected';
  const statusMsg = isApproved
    ? '<p style="color:#333;font-size:14px;line-height:1.6;margin:0 0 15px;">Your leave has been approved. Please ensure all your pending tasks are properly handed over before your leave starts.</p>'
    : '<p style="color:#333;font-size:14px;line-height:1.6;margin:0 0 15px;">Unfortunately, your leave request has been rejected. Please contact your manager or HR for more details.</p>';

  return [
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>',
    '<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f4;"><tr><td align="center" style="padding:30px 0;">',
    '<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">',
    '<tr><td style="background-color:#1a6b3c;padding:30px 40px;text-align:center;">',
    '<img src="https://migrant-path-hr.lovable.app/favicon.png" alt="MVC Logo" width="60" height="60" style="display:block;margin:0 auto 15px auto;border-radius:8px;" />',
    '<h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Leave Request Update</h1>',
    '</td></tr>',
    '<tr><td style="padding:35px 40px;">',
    `<p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 20px;">Dear <strong>${data.name}</strong>,</p>`,
    '<p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 25px;">Your leave request has been reviewed. Here is the status:</p>',
    `<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:10px 0 20px;"><span style="display:inline-block;background-color:${statusBg};color:${statusColor};padding:10px 30px;border-radius:25px;font-weight:700;font-size:16px;border:1px solid ${statusColor}30;">${statusText}</span></td></tr></table>`,
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9f9f9;border-radius:10px;margin:0 0 25px;"><tr><td style="padding:20px 25px;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">',
    `<tr><td style="color:#666;font-size:14px;padding:6px 0;">Leave Type:</td><td style="color:#333;font-size:14px;font-weight:600;padding:6px 0;text-align:right;">${data.leaveType}</td></tr>`,
    `<tr><td style="color:#666;font-size:14px;padding:6px 0;">Start Date:</td><td style="color:#333;font-size:14px;font-weight:600;padding:6px 0;text-align:right;">${data.startDate}</td></tr>`,
    `<tr><td style="color:#666;font-size:14px;padding:6px 0;">End Date:</td><td style="color:#333;font-size:14px;font-weight:600;padding:6px 0;text-align:right;">${data.endDate}</td></tr>`,
    '</table></td></tr></table>',
    statusMsg,
    '<p style="color:#333;font-size:14px;line-height:1.6;margin:20px 0 0;">Best regards,<br /><strong>Migrants Venture Corporation HR Team</strong></p>',
    '</td></tr>',
    '<tr><td style="background-color:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #eeeeee;">',
    '<p style="color:#999;font-size:12px;margin:0 0 5px;">This is an automated message. Please do not reply to this email.</p>',
    `<p style="color:#999;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Migrants Venture Corporation. All rights reserved.</p>`,
    '</td></tr></table></td></tr></table></body></html>',
  ].join('');
}

function getPayslipReadyHtml(data: PayslipReadyEmail): string {
  return [
    '<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>',
    '<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background-color:#f4f4f4;">',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f4;"><tr><td align="center" style="padding:30px 0;">',
    '<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.1);">',
    '<tr><td style="background-color:#1a6b3c;padding:30px 40px;text-align:center;">',
    '<img src="https://migrant-path-hr.lovable.app/favicon.png" alt="MVC Logo" width="60" height="60" style="display:block;margin:0 auto 15px auto;border-radius:8px;" />',
    '<h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">Your Payslip is Ready</h1>',
    '</td></tr>',
    '<tr><td style="padding:35px 40px;">',
    `<p style="color:#333;font-size:16px;line-height:1.6;margin:0 0 20px;">Dear <strong>${data.name}</strong>,</p>`,
    '<p style="color:#333;font-size:15px;line-height:1.6;margin:0 0 25px;">Your payslip for the following period is now available:</p>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f0faf3;border:1px solid #d4edda;border-radius:10px;margin:0 0 25px;">',
    `<tr><td style="padding:25px;text-align:center;"><p style="color:#666;font-size:14px;margin:0 0 8px;">${data.periodStart} - ${data.periodEnd}</p>`,
    `<p style="color:#666;font-size:13px;margin:0 0 5px;">Net Pay</p><p style="color:#1a6b3c;font-size:32px;font-weight:700;margin:0;">${data.netPay}</p></td></tr></table>`,
    '<p style="color:#333;font-size:14px;line-height:1.6;margin:0 0 25px;">You can view and download your detailed payslip by logging into the HR portal.</p>',
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">',
    '<tr><td align="center" style="padding:10px 0 25px;"><a href="https://migrant-path-hr.lovable.app/my-payslips" style="display:inline-block;background-color:#1a6b3c;color:#ffffff;text-decoration:none;padding:14px 35px;border-radius:8px;font-size:15px;font-weight:600;">View Payslip</a></td></tr></table>',
    '<p style="color:#666;font-size:14px;line-height:1.6;margin:0 0 10px;">If you have any questions about your payslip, please contact the HR department.</p>',
    '<p style="color:#333;font-size:14px;line-height:1.6;margin:20px 0 0;">Best regards,<br /><strong>Migrants Venture Corporation HR Team</strong></p>',
    '</td></tr>',
    '<tr><td style="background-color:#f8f8f8;padding:20px 40px;text-align:center;border-top:1px solid #eeeeee;">',
    '<p style="color:#999;font-size:12px;margin:0 0 5px;">This is an automated message. Please do not reply to this email.</p>',
    `<p style="color:#999;font-size:12px;margin:0;">&copy; ${new Date().getFullYear()} Migrants Venture Corporation. All rights reserved.</p>`,
    '</td></tr></table></td></tr></table></body></html>',
  ].join('');
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const gmailUser = Deno.env.get("GMAIL_USER");
    const gmailPassword = Deno.env.get("GMAIL_APP_PASSWORD");

    if (!gmailUser || !gmailPassword) {
      console.error("Gmail credentials not configured");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailData: EmailRequest = await req.json();
    console.log("Sending email:", emailData.type, "to:", emailData.to);

    let subject = "";
    let html = "";

    switch (emailData.type) {
      case 'account_created':
        subject = "Welcome to Migrants Venture Corporation - Your Account Credentials";
        html = getAccountCreatedHtml(emailData);
        break;
      case 'leave_approved':
        subject = `Leave Request ${emailData.status === 'approved' ? 'Approved' : 'Rejected'} - Migrants Venture Corporation`;
        html = getLeaveApprovedHtml(emailData);
        break;
      case 'payslip_ready':
        subject = `Your Payslip is Ready - ${emailData.periodStart} to ${emailData.periodEnd}`;
        html = getPayslipReadyHtml(emailData);
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid email type" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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

    await client.send({
      from: `Migrants Venture Corporation <${gmailUser}>`,
      to: emailData.to,
      subject: subject,
      content: "Please view this email in an HTML-capable email client.",
      html: html,
    });

    await client.close();

    console.log("Email sent successfully to:", emailData.to);

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error sending email:", error);
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
