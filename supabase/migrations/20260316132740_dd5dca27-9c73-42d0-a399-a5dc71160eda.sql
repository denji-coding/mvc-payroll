
-- Fix 1: Replace overly permissive ALL policy for branch managers on leave_requests
-- with explicit SELECT and UPDATE policies
DROP POLICY IF EXISTS "Branch managers can view/update branch leave requests" ON public.leave_requests;

CREATE POLICY "Branch managers can view branch leave requests"
ON public.leave_requests
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'branch_manager'::app_role)
  AND employee_id IN (
    SELECT id FROM employees WHERE branch_id = get_user_branch_id(auth.uid())
  )
);

CREATE POLICY "Branch managers can update branch leave requests"
ON public.leave_requests
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'branch_manager'::app_role)
  AND employee_id IN (
    SELECT id FROM employees WHERE branch_id = get_user_branch_id(auth.uid())
  )
);

-- Fix 2: Restrict settings SELECT from public to authenticated only
DROP POLICY IF EXISTS "Everyone can view settings" ON public.settings;

CREATE POLICY "Authenticated can view settings"
ON public.settings
FOR SELECT
TO authenticated
USING (true);
