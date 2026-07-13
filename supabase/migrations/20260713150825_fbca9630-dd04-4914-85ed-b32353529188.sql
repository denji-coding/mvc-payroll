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
        phone      = NEW.phone,
        avatar_url = NEW.avatar_url
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Backfill existing employees' avatars into their profiles
UPDATE public.profiles p
SET avatar_url = e.avatar_url
FROM public.employees e
WHERE e.user_id = p.id
  AND e.avatar_url IS DISTINCT FROM p.avatar_url;