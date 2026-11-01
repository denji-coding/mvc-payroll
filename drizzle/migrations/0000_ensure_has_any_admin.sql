CREATE OR REPLACE FUNCTION public.has_any_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE role::text IN ('hr_admin','super_admin'))
$$;
GRANT EXECUTE ON FUNCTION public.has_any_admin() TO anon, authenticated, service_role;