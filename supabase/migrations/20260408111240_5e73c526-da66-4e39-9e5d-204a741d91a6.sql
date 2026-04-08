-- Fix 1: Replace ALL policy on user_roles with explicit per-operation policies
DROP POLICY IF EXISTS "HR can manage roles" ON public.user_roles;

CREATE POLICY "HR can select all roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'hr_admin'::app_role));

CREATE POLICY "HR can insert roles"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK (has_role(auth.uid(), 'hr_admin'::app_role));

CREATE POLICY "HR can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (has_role(auth.uid(), 'hr_admin'::app_role));

CREATE POLICY "HR can delete roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (has_role(auth.uid(), 'hr_admin'::app_role));

-- Fix 2: Remove sensitive tables from Realtime publication (keep only notifications)
ALTER PUBLICATION supabase_realtime DROP TABLE public.attendance;
ALTER PUBLICATION supabase_realtime DROP TABLE public.leave_requests;
ALTER PUBLICATION supabase_realtime DROP TABLE public.payroll_records;