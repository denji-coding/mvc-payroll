
-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'super_admin'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('hr_admin', 'super_admin')
  )
$$;

REVOKE EXECUTE ON FUNCTION public.is_super_admin(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_super_admin(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

-- ============ PROTECTION TRIGGER ON user_roles ============
CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  is_caller_super boolean;
  super_count int;
BEGIN
  -- Allow service_role to bypass entirely (used for seeding/admin tasks)
  IF current_setting('role', true) = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  is_caller_super := auth.uid() IS NOT NULL AND public.is_super_admin(auth.uid());

  IF TG_OP = 'DELETE' THEN
    IF OLD.role::text = 'super_admin' THEN
      SELECT count(*) INTO super_count FROM public.user_roles WHERE role::text = 'super_admin';
      IF super_count <= 1 THEN
        RAISE EXCEPTION 'Cannot delete the last Super Admin account';
      END IF;
      IF NOT is_caller_super THEN
        RAISE EXCEPTION 'Only a Super Admin can remove a Super Admin role';
      END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.role::text = 'super_admin' AND NEW.role::text <> 'super_admin' THEN
      RAISE EXCEPTION 'The Super Admin role cannot be demoted';
    END IF;
    IF NEW.role::text = 'super_admin' AND OLD.role::text <> 'super_admin' AND NOT is_caller_super THEN
      RAISE EXCEPTION 'Only a Super Admin can grant the Super Admin role';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role::text = 'super_admin' THEN
      -- Allow the very first super admin (seed) when none exists yet
      SELECT count(*) INTO super_count FROM public.user_roles WHERE role::text = 'super_admin';
      IF super_count > 0 AND NOT is_caller_super THEN
        RAISE EXCEPTION 'Only a Super Admin can grant the Super Admin role';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_role ON public.user_roles;
CREATE TRIGGER trg_protect_super_admin_role
BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();

-- Protect the underlying profile from being deleted while a super_admin role exists
CREATE OR REPLACE FUNCTION public.protect_super_admin_profile()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.id AND role::text = 'super_admin') THEN
    RAISE EXCEPTION 'Cannot delete the profile of a Super Admin account';
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_profile ON public.profiles;
CREATE TRIGGER trg_protect_super_admin_profile
BEFORE DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_profile();

-- ============ WIDEN RLS POLICIES (HR-admin -> admin) ============
-- We add an additional super_admin policy alongside existing hr_admin ones (keeps existing ones intact).
DO $$
DECLARE
  t text;
  pol_name text := 'Super admins have full access';
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'announcements','attendance','branches','branch_managers','employees',
    'employee_salary_adjustments','employee_schedules','holidays','leave_credits',
    'leave_requests','leave_types','loans','payroll_periods','payroll_records',
    'positions','profiles','role_permissions','salary_components','settings','user_roles'
  ] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol_name, t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.is_super_admin(auth.uid())) WITH CHECK (public.is_super_admin(auth.uid()))',
      pol_name, t
    );
  END LOOP;
END $$;

-- ============ SEED DEFAULT SUPER ADMIN ============
DO $$
DECLARE
  v_uid uuid;
  v_email text := 'superadmin@migrantsventure.com';
BEGIN
  SELECT id INTO v_uid FROM auth.users WHERE email = v_email LIMIT 1;

  IF v_uid IS NULL THEN
    v_uid := gen_random_uuid();

    INSERT INTO auth.users (
      instance_id, id, aud, role, email, encrypted_password,
      email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
      created_at, updated_at, confirmation_token, email_change,
      email_change_token_new, recovery_token, is_super_admin
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      v_uid,
      'authenticated',
      'authenticated',
      v_email,
      crypt('Password', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{"first_name":"Super","last_name":"Admin"}'::jsonb,
      now(), now(), '', '', '', '', false
    );

    INSERT INTO auth.identities (
      id, user_id, provider_id, identity_data, provider,
      last_sign_in_at, created_at, updated_at
    ) VALUES (
      gen_random_uuid(),
      v_uid,
      v_uid::text,
      jsonb_build_object('sub', v_uid::text, 'email', v_email, 'email_verified', true),
      'email',
      now(), now(), now()
    );
  END IF;

  -- Upsert profile (handle_new_user trigger may have already created it)
  INSERT INTO public.profiles (id, email, first_name, last_name, must_change_password)
  VALUES (v_uid, v_email, 'Super', 'Admin', true)
  ON CONFLICT (id) DO UPDATE SET
    first_name = EXCLUDED.first_name,
    last_name = EXCLUDED.last_name,
    must_change_password = COALESCE(public.profiles.must_change_password, true);

  -- Ensure super_admin role (replace any default employee role)
  DELETE FROM public.user_roles WHERE user_id = v_uid AND role::text <> 'super_admin';

  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = v_uid AND role::text = 'super_admin') THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (v_uid, 'super_admin'::public.app_role);
  END IF;
END $$;
