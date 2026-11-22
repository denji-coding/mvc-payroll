DROP POLICY IF EXISTS "Users can read permissions" ON public.role_permissions;
CREATE POLICY "Users can read own role permissions" ON public.role_permissions
FOR SELECT TO authenticated
USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = role_permissions.role));