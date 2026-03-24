import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-terminal-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate caller: accept terminal secret header OR valid Supabase API key
    const terminalSecret = req.headers.get('x-terminal-secret');
    const expectedSecret = Deno.env.get('RFID_TERMINAL_SECRET');
    const authHeader = req.headers.get('Authorization');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    const hasValidTerminalSecret = expectedSecret && terminalSecret === expectedSecret;
    const hasValidApiKey = authHeader && (
      (anonKey && authHeader.includes(anonKey)) ||
      (serviceKey && authHeader.includes(serviceKey))
    );
    
    if (!hasValidTerminalSecret && !hasValidApiKey) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey2 = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey2);

    // Get today's date in Philippine timezone
    const phFormatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const today = phFormatter.format(new Date());

    const { data, error } = await supabase
      .from('attendance')
      .select('*, employees(first_name, last_name, employee_id, position, avatar_url)')
      .eq('date', today)
      .order('updated_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    return new Response(
      JSON.stringify({ records: data || [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Terminal attendance log error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to fetch attendance records' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
