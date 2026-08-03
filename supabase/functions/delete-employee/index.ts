import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use anon key client with user's auth header for JWT validation
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = claimsData.claims.sub as string;

    // Use service role client for admin operations
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const { data: roleData } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', userId).single();
    if (roleData?.role !== 'hr_admin') {
      return new Response(JSON.stringify({ error: 'Only HR admins can permanently delete employees' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { employee_id } = await req.json();
    if (!employee_id) {
      return new Response(JSON.stringify({ error: 'Employee ID is required' }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get employee to find user_id
    const { data: employee } = await supabaseAdmin
      .from('employees').select('user_id').eq('id', employee_id).single();

    if (!employee) {
      return new Response(JSON.stringify({ error: 'Employee not found' }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Delete related records
    await supabaseAdmin.from('attendance').delete().eq('employee_id', employee_id);
    await supabaseAdmin.from('leave_requests').delete().eq('employee_id', employee_id);
    await supabaseAdmin.from('leave_credits').delete().eq('employee_id', employee_id);
    await supabaseAdmin.from('payroll_records').delete().eq('employee_id', employee_id);
    await supabaseAdmin.from('employee_salary_adjustments').delete().eq('employee_id', employee_id);
    await supabaseAdmin.from('employee_schedules').delete().eq('employee_id', employee_id);
    

    // Delete employee record
    await supabaseAdmin.from('employees').delete().eq('id', employee_id);

    // Delete auth user and related records
    if (employee.user_id) {
      await supabaseAdmin.from('branch_managers').delete().eq('user_id', employee.user_id);
      await supabaseAdmin.from('notifications').delete().eq('user_id', employee.user_id);
      await supabaseAdmin.from('user_roles').delete().eq('user_id', employee.user_id);
      await supabaseAdmin.from('profiles').delete().eq('id', employee.user_id);
      await supabaseAdmin.auth.admin.deleteUser(employee.user_id);
    }

    return new Response(JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
