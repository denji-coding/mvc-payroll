
CREATE OR REPLACE FUNCTION public.sync_employee_to_profile()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE public.profiles
    SET first_name = COALESCE(NEW.first_name, ''),
        last_name  = COALESCE(NEW.last_name, ''),
        email      = COALESCE(NEW.email, email),
        phone      = NEW.phone
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_employee_to_profile ON public.employees;
CREATE TRIGGER trg_sync_employee_to_profile
AFTER INSERT OR UPDATE OF first_name, last_name, email, phone, user_id ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.sync_employee_to_profile();

-- Backfill existing mismatches
UPDATE public.profiles p
SET first_name = COALESCE(e.first_name, ''),
    last_name  = COALESCE(e.last_name, ''),
    email      = COALESCE(e.email, p.email),
    phone      = e.phone
FROM public.employees e
WHERE e.user_id = p.id;
