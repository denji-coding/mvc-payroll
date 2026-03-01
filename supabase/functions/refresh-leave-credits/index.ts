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

    const currentYear = new Date().getFullYear();

    // Get all leave credits for current year where used_credits > 0
    const { data: credits, error } = await supabaseAdmin
      .from('leave_credits')
      .select('id, used_credits')
      .eq('year', currentYear)
      .gt('used_credits', 0);

    if (error) throw error;

    if (!credits || credits.length === 0) {
      return new Response(JSON.stringify({ message: 'No credits to refresh', count: 0 }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Reset used_credits to 0 for consumed credits
    const ids = credits.map(c => c.id);
    const { error: updateError } = await supabaseAdmin
      .from('leave_credits')
      .update({ used_credits: 0 })
      .in('id', ids);

    if (updateError) throw updateError;

    return new Response(JSON.stringify({ message: `Refreshed ${ids.length} leave credit records`, count: ids.length }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
