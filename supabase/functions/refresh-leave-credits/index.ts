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

    // Allow scheduled job (private cron token) or a signed-in HR admin
    const authHeader = req.headers.get('Authorization');
    const cronToken = req.headers.get('x-cron-token');
    const deny = (msg: string, status: number) => new Response(JSON.stringify({ error: msg }),
      { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    let authorized = false;
    if (cronToken) {
      const { data: ok } = await supabaseAdmin.rpc('verify_cron_token', { _token: cronToken });
      authorized = ok === true;
    }
    if (!authorized && authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (user) {
        const { data: isAdmin } = await supabaseAdmin.rpc('is_admin', { _user_id: user.id });
        if (!isAdmin) return deny('Only HR admins can refresh leave credits', 403);
        authorized = true;
      }
    }
    if (!authorized) return deny('Unauthorized', 401);

    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1; // 1-12

    // Read refresh_months from lwp_config settings
    const { data: lwpSetting } = await supabaseAdmin
      .from('settings')
      .select('value')
      .eq('key', 'lwp_config')
      .single();

    const refreshMonths = (lwpSetting?.value as any)?.refresh_months || 1;

    // Check if this month is a refresh month for regular leave credits
    // e.g. refresh_months=1 → every month, refresh_months=3 → Jan,Apr,Jul,Oct
    const isRefreshMonth = (currentMonth - 1) % refreshMonths === 0;

    // LWP refreshes yearly (only in January)
    const isLwpRefreshMonth = currentMonth === 1;

    if (!isRefreshMonth && !isLwpRefreshMonth) {
      return new Response(JSON.stringify({ 
        message: `Not a refresh month. Regular refresh every ${refreshMonths} month(s), LWP yearly. Current month: ${currentMonth}`, 
        count: 0 
      }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Get all leave credits for current year where used_credits > 0
    const { data: credits, error } = await supabaseAdmin
      .from('leave_credits')
      .select('id, used_credits, leave_type')
      .eq('year', currentYear)
      .gt('used_credits', 0);

    if (error) throw error;

    if (!credits || credits.length === 0) {
      return new Response(JSON.stringify({ message: 'No credits to refresh', count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Reset used_credits to 0 for all consumed credits when it's a refresh month
    const ids = credits.map(c => c.id);
    const { error: updateError } = await supabaseAdmin
      .from('leave_credits')
      .update({ used_credits: 0 })
      .in('id', ids);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ 
      message: `Refreshed ${ids.length} leave credit records`, 
      count: ids.length,
      refresh_months: refreshMonths,
      is_refresh_month: isRefreshMonth,
      is_lwp_refresh: isLwpRefreshMonth
    }), { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
