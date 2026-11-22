DROP POLICY IF EXISTS "Authenticated can view settings" ON public.settings;
CREATE POLICY "Authenticated can view settings" ON public.settings
  FOR SELECT TO authenticated
  USING (
    key IN ('company_info', 'lwp_config')
    OR public.is_admin(auth.uid())
  );