import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Server-side re-check: setup is allowed only when no admin exists.
    const { data: existing, error: existingErr } = await admin
      .from("user_roles")
      .select("user_id")
      .in("role", ["hr_admin", "super_admin"])
      .limit(1);
    if (existingErr) return json({ error: `Could not check existing admins: ${existingErr.message}` }, 500);
    if (existing && existing.length > 0) {
      return json({ error: "Setup already completed. An admin account already exists." }, 403);
    }

    let body: any = {};
    try { body = await req.json(); } catch { /* empty */ }
    const first_name = String(body?.first_name ?? "").trim();
    const last_name = String(body?.last_name ?? "").trim();
    const email = String(body?.email ?? "").trim().toLowerCase();
    const password = String(body?.password ?? "");

    // Only the person who installed the system knows the setup key (stored as a server secret).
    const expectedKey = Deno.env.get("FIRST_ADMIN_SETUP_KEY") ?? "";
    const setupKey = String(body?.setup_key ?? "");
    if (!expectedKey) return json({ error: "Setup is locked. Ask the system owner to configure the setup key." }, 403);
    if (setupKey !== expectedKey) return json({ error: "Invalid setup key." }, 403);

    if (!first_name || !last_name || !email || !password) {
      return json({ error: "First name, last name, email and password are required." }, 400);
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "Please enter a valid email address." }, 400);
    if (password.length < 8) return json({ error: "Password must be at least 8 characters." }, 400);

    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { first_name, last_name },
    });
    if (createErr || !created?.user) {
      const msg = createErr?.message ?? "Failed to create account";
      const friendly = /already|registered|exists/i.test(msg)
        ? "This email is already registered. Please use a different email or sign in."
        : msg;
      return json({ error: friendly }, 400);
    }
    const userId = created.user.id;

    const rollback = async (message: string) => {
      await admin.from("user_roles").delete().eq("user_id", userId);
      await admin.from("profiles").delete().eq("id", userId);
      await admin.auth.admin.deleteUser(userId);
      return json({ error: message }, 500);
    };

    // Ensure profile exists (normally created by the signup trigger).
    const { error: profErr } = await admin.from("profiles").upsert(
      { id: userId, email, first_name, last_name, must_change_password: false },
      { onConflict: "id" },
    );
    if (profErr) return await rollback(`Could not save profile: ${profErr.message}`);

    // Make the first account the protected Super Admin.
    const { data: roleRows, error: roleSelErr } = await admin
      .from("user_roles").select("id").eq("user_id", userId);
    if (roleSelErr) return await rollback(`Could not read role: ${roleSelErr.message}`);

    const roleRes = roleRows && roleRows.length > 0
      ? await admin.from("user_roles").update({ role: "super_admin" }).eq("user_id", userId)
      : await admin.from("user_roles").insert({ user_id: userId, role: "super_admin" });
    if (roleRes.error) return await rollback(`Could not assign admin role: ${roleRes.error.message}`);

    return json({ success: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : "Unknown error" }, 500);
  }
});
