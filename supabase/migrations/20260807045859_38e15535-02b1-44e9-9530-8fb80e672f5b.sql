DROP POLICY IF EXISTS "Employees can manage own leave requests" ON public.leave_requests;

CREATE POLICY "Employees can view own leave requests"
ON public.leave_requests FOR SELECT TO authenticated
USING (employee_id = public.get_employee_by_user(auth.uid()));

CREATE POLICY "Employees can create own pending leave requests"
ON public.leave_requests FOR INSERT TO authenticated
WITH CHECK (
  employee_id = public.get_employee_by_user(auth.uid())
  AND status = 'pending'::leave_status
  AND manager_id IS NULL
  AND hr_id IS NULL
  AND manager_action_at IS NULL
  AND hr_action_at IS NULL
  AND manager_remarks IS NULL
  AND hr_remarks IS NULL
);

CREATE POLICY "Employees can cancel own pending leave requests"
ON public.leave_requests FOR UPDATE TO authenticated
USING (
  employee_id = public.get_employee_by_user(auth.uid())
  AND status = 'pending'::leave_status
)
WITH CHECK (
  employee_id = public.get_employee_by_user(auth.uid())
  AND status = 'cancelled'::leave_status
  AND manager_id IS NULL
  AND hr_id IS NULL
  AND manager_remarks IS NULL
  AND hr_remarks IS NULL
);