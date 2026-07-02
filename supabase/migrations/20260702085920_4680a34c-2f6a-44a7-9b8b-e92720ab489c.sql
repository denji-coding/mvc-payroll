-- Task 3: add optional suffix name to employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS suffix_name text;

-- Task 1: allow public first-time setup check
CREATE OR REPLACE FUNCTION public.has_any_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE role::text IN ('hr_admin', 'super_admin')
  )
$$;

GRANT EXECUTE ON FUNCTION public.has_any_admin() TO anon, authenticated;

-- Task 1: remove pre-seeded default super admin so first-time setup takes over.
-- Only removes it when it still has the initial default-password flag AND
-- no other admin (hr or super) exists — protects real production data.
DO $$
DECLARE
  v_user_id uuid;
  v_admin_count int;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'superadmin@migrantsventure.com';
  IF v_user_id IS NULL THEN RETURN; END IF;

  SELECT count(*) INTO v_admin_count
  FROM public.user_roles
  WHERE role::text IN ('hr_admin', 'super_admin')
    AND user_id <> v_user_id;

  IF v_admin_count > 0 THEN RETURN; END IF;

  -- Drop protection triggers temporarily to allow clean removal
  ALTER TABLE public.user_roles DISABLE TRIGGER USER;
  ALTER TABLE public.profiles DISABLE TRIGGER USER;

  DELETE FROM public.user_roles WHERE user_id = v_user_id;
  DELETE FROM public.profiles WHERE id = v_user_id;
  DELETE FROM auth.users WHERE id = v_user_id;

  ALTER TABLE public.user_roles ENABLE TRIGGER USER;
  ALTER TABLE public.profiles ENABLE TRIGGER USER;
END $$;