import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmployeeData {
  employee_id: string;
  first_name: string;
  last_name: string;
  middle_name?: string;
  suffix_name?: string;
  email: string;
  phone?: string;
  date_of_birth?: string;
  gender?: string;
  civil_status?: string;
  address?: string;
  position: string;
  
  date_hired: string;
  basic_salary: number;
  branch_id?: string;
  sss_number?: string;
  philhealth_number?: string;
  pagibig_number?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  rfid_card_number?: string;
  role: 'employee' | 'branch_manager' | 'hr_admin';
  password: string;
}

function cleanData(data: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    cleaned[key] = (value === '' || value === undefined) ? null : value;
  }
  return cleaned;
}

async function validatePhoneAndGovIds(data: EmployeeData): Promise<string | null> {
  const phoneRegex = /^09[0-9]{9}$/;
  if (data.phone && data.phone.trim() !== '' && !phoneRegex.test(data.phone.replace(/\D/g, ''))) {
    return 'Phone number must start with 09 and be exactly 11 digits';
  }
  if (data.emergency_contact_phone && data.emergency_contact_phone.trim() !== '' && !phoneRegex.test(data.emergency_contact_phone.replace(/\D/g, ''))) {
    return 'Emergency contact phone must start with 09 and be exactly 11 digits';
  }
  const sssDigits = (data.sss_number || '').replace(/[-\s]/g, '');
  if (sssDigits.length === 0) return 'SSS Number is required';
  if (sssDigits.length !== 10) return 'SSS Number must be exactly 10 digits';
  const philDigits = (data.philhealth_number || '').replace(/[-\s]/g, '');
  if (philDigits.length === 0) return 'PhilHealth Number is required';
  if (philDigits.length !== 12) return 'PhilHealth Number must be exactly 12 digits';
  const pagibigDigits = (data.pagibig_number || '').replace(/[-\s]/g, '');
  if (pagibigDigits.length === 0) return 'Pag-IBIG Number is required';
  if (pagibigDigits.length !== 12) return 'Pag-IBIG Number must be exactly 12 digits';
  return null;
}

async function checkDuplicates(supabaseAdmin: any, data: EmployeeData) {
  const checks: { field: string; value: string | undefined; label: string }[] = [
    { field: 'email', value: data.email, label: 'email' },
    { field: 'phone', value: data.phone, label: 'phone number' },
    { field: 'rfid_card_number', value: data.rfid_card_number, label: 'RFID card number' },
    { field: 'sss_number', value: data.sss_number, label: 'SSS number' },
    { field: 'philhealth_number', value: data.philhealth_number, label: 'PhilHealth number' },
    { field: 'pagibig_number', value: data.pagibig_number, label: 'Pag-IBIG number' },
  ];

  for (const check of checks) {
    if (!check.value || check.value.trim() === '') continue;
    const { data: existing } = await supabaseAdmin
      .from('employees')
      .select('id')
      .eq(check.field, check.value)
      .limit(1);
    if (existing && existing.length > 0) {
      return `An employee with this ${check.label} already exists`;
    }
  }
  return null;
}

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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Missing authorization' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use anon client to validate the token via getClaims
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId_caller = claimsData.claims.sub as string;

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from('user_roles').select('role').eq('user_id', userId_caller).single();
    if (roleError || roleData?.role !== 'hr_admin') {
      return new Response(JSON.stringify({ error: 'Only HR admins can create employees' }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const employeeData: EmployeeData = await req.json();

    // Validate phone numbers and government IDs
    const validationError = await validatePhoneAndGovIds(employeeData);
    if (validationError) {
      return new Response(JSON.stringify({ error: validationError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Check for duplicates before creating
    const duplicateError = await checkDuplicates(supabaseAdmin, employeeData);
    if (duplicateError) {
      return new Response(JSON.stringify({ error: duplicateError }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Create user account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: employeeData.email,
      password: employeeData.password,
      email_confirm: true,
      user_metadata: { first_name: employeeData.first_name, last_name: employeeData.last_name }
    });

    if (authError) {
      const msg = authError.message.toLowerCase().includes('already been registered')
        ? 'An employee with this email already exists'
        : authError.message;
      return new Response(JSON.stringify({ error: msg }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const userId = authData.user.id;

    // Set role if not employee
    if (employeeData.role !== 'employee') {
      await supabaseAdmin.from('user_roles').update({ role: employeeData.role }).eq('user_id', userId);
    }

    // Branch manager assignment
    if (employeeData.role === 'branch_manager' && employeeData.branch_id) {
      await supabaseAdmin.from('branch_managers').insert({ user_id: userId, branch_id: employeeData.branch_id });
    }

    // Create employee record
    const { password, role, ...employeeFields } = employeeData;
    const cleanedFields = cleanData(employeeFields);
    const insertData: Record<string, unknown> = { ...cleanedFields, user_id: userId, basic_salary: employeeData.basic_salary || 0 };

    const { data: employee, error: employeeError } = await supabaseAdmin
      .from('employees').insert(insertData).select().single();

    if (employeeError) {
      await supabaseAdmin.auth.admin.deleteUser(userId);
      return new Response(JSON.stringify({ error: employeeError.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Send welcome email (non-blocking)
    try {
      await supabaseAdmin.functions.invoke('send-notification-email', {
        body: {
          type: 'account_created', to: employeeData.email,
          name: `${employeeData.first_name} ${employeeData.last_name}`,
          email: employeeData.email, password: employeeData.password,
          role: employeeData.role, portalUrl: 'https://mvc-rose.vercel.app/'
        }
      });
    } catch (emailError) {
      console.error("Failed to send welcome email:", emailError);
    }

    return new Response(JSON.stringify({ success: true, employee, userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
    return new Response(JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
