import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    // Authenticate caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Only HR admins can purge employees
    const { data: roleData } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', user.id).single();
    if (!['hr_admin', 'super_admin'].includes(roleData?.role ?? '')) {
      return new Response(JSON.stringify({ error: 'Only HR admins can purge employees' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Find terminated employees older than 6 months
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const { data: expiredEmployees } = await supabaseAdmin
      .from('employees')
      .select('id, user_id')
      .eq('employment_status', 'terminated')
      .lt('updated_at', sixMonthsAgo.toISOString());

    if (!expiredEmployees || expiredEmployees.length === 0) {
      return new Response(JSON.stringify({ message: 'No expired employees to purge', count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    let purgedCount = 0;
    for (const emp of expiredEmployees) {
      try {
        await supabaseAdmin.from('attendance').delete().eq('employee_id', emp.id);
        await supabaseAdmin.from('leave_requests').delete().eq('employee_id', emp.id);
        await supabaseAdmin.from('leave_credits').delete().eq('employee_id', emp.id);
        await supabaseAdmin.from('payroll_records').delete().eq('employee_id', emp.id);
        await supabaseAdmin.from('employee_salary_adjustments').delete().eq('employee_id', emp.id);
        await supabaseAdmin.from('employee_schedules').delete().eq('employee_id', emp.id);
        
        await supabaseAdmin.from('employees').delete().eq('id', emp.id);

        if (emp.user_id) {
          await supabaseAdmin.from('branch_managers').delete().eq('user_id', emp.user_id);
          await supabaseAdmin.from('notifications').delete().eq('user_id', emp.user_id);
          await supabaseAdmin.from('user_roles').delete().eq('user_id', emp.user_id);
          await supabaseAdmin.from('profiles').delete().eq('id', emp.user_id);
          await supabaseAdmin.auth.admin.deleteUser(emp.user_id);
        }
        purgedCount++;
      } catch (err) {
        console.error(`Failed to purge employee ${emp.id}:`, err);
      }
    }

    return new Response(JSON.stringify({ message: `Purged ${purgedCount} expired employees`, count: purgedCount }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
