-- Private cron token for scheduled server jobs
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;
CREATE TABLE IF NOT EXISTS private.cron_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex')
);
INSERT INTO private.cron_config (id) VALUES (1) ON CONFLICT DO NOTHING;
REVOKE ALL ON private.cron_config FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.verify_cron_token(_token text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, private
AS $$ SELECT EXISTS (SELECT 1 FROM private.cron_config WHERE token = _token) $$;
REVOKE ALL ON FUNCTION public.verify_cron_token(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.verify_cron_token(text) TO service_role;

-- Branch lookup only for yourself or admins
CREATE OR REPLACE FUNCTION public.get_user_branch_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT branch_id FROM public.branch_managers
  WHERE user_id = _user_id
    AND (_user_id = auth.uid() OR public.is_admin(auth.uid()) OR auth.role() = 'service_role')
  LIMIT 1
$$;
REVOKE EXECUTE ON FUNCTION public.get_user_branch_id(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_branch_id(uuid) TO authenticated, service_role;

-- Prevent admins from editing their own attendance or salary adjustments
CREATE OR REPLACE FUNCTION public.prevent_self_pay_edit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE _own uuid;
BEGIN
  IF auth.uid() IS NULL OR current_setting('role', true) = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  _own := public.get_employee_by_user(auth.uid());
  IF _own IS NOT NULL AND (
       (TG_OP <> 'INSERT' AND OLD.employee_id = _own)
    OR (TG_OP <> 'DELETE' AND NEW.employee_id = _own)
  ) THEN
    RAISE EXCEPTION 'You cannot change your own % records', TG_TABLE_NAME
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_attendance_edit ON public.attendance;
CREATE TRIGGER trg_prevent_self_attendance_edit
  BEFORE INSERT OR UPDATE OR DELETE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_pay_edit();

DROP TRIGGER IF EXISTS trg_prevent_self_salary_adjustment_edit ON public.employee_salary_adjustments;
CREATE TRIGGER trg_prevent_self_salary_adjustment_edit
  BEFORE INSERT OR UPDATE OR DELETE ON public.employee_salary_adjustments
  FOR EACH ROW EXECUTE FUNCTION public.prevent_self_pay_edit();

-- Prevent admins from relinking their own account to another employee record
CREATE OR REPLACE FUNCTION public.prevent_employee_relink()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR current_setting('role', true) = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'The linked account of an employee cannot be changed' USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_prevent_employee_relink ON public.employees;
CREATE TRIGGER trg_prevent_employee_relink
  BEFORE UPDATE ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.prevent_employee_relink();

-- Password reset: temp password only becomes active after it is used at sign-in
CREATE OR REPLACE FUNCTION public.redeem_password_reset(_email text, _code text)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE _uid uuid; _tok uuid;
BEGIN
  SELECT t.id, t.user_id INTO _tok, _uid
  FROM public.password_reset_tokens t
  JOIN public.profiles p ON p.id = t.user_id
  WHERE lower(p.email) = lower(_email)
    AND t.is_used = false AND t.expires_at > now()
    AND t.temp_password_hash = extensions.crypt(_code, t.temp_password_hash)
  ORDER BY t.created_at DESC LIMIT 1;
  IF _tok IS NULL THEN RETURN NULL; END IF;
  UPDATE public.password_reset_tokens SET is_used = true WHERE user_id = _uid AND is_used = false;
  RETURN _uid;
END;
$$;
REVOKE ALL ON FUNCTION public.redeem_password_reset(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_password_reset(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.hash_reset_code(_code text)
RETURNS text LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, extensions
AS $$ SELECT extensions.crypt(_code, extensions.gen_salt('bf')) $$;
REVOKE ALL ON FUNCTION public.hash_reset_code(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.hash_reset_code(text) TO service_role;

-- Scheduled leave-credit refresh authenticates with the private cron token
SELECT cron.unschedule('refresh-leave-credits-monthly');
SELECT cron.schedule(
  'refresh-leave-credits-monthly',
  '0 0 1 * *',
  $cron$
  SELECT net.http_post(
    url := 'https://nqzzjpbotaawiatwyedb.supabase.co/functions/v1/refresh-leave-credits',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5xenpqcGJvdGFhd2lhdHd5ZWRiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY5Nzc2ODYsImV4cCI6MjA4MjU1MzY4Nn0.z83dCtz3fHen5SN0CXkRY36IZ3AxUADy9RNVY6Vbfo4',
      'x-cron-token', (SELECT token FROM private.cron_config WHERE id = 1)
    ),
    body := '{}'::jsonb
  );
  $cron$
);