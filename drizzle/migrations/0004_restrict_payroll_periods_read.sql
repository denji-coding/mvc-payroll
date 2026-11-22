DROP POLICY IF EXISTS "Authenticated can view payroll periods" ON public.payroll_periods;
CREATE POLICY "Authenticated can view payroll periods" ON public.payroll_periods
  FOR SELECT TO authenticated
  USING (
    public.is_admin(auth.uid())
    OR EXISTS (
      SELECT 1 FROM public.payroll_records pr
      WHERE pr.payroll_period_id = payroll_periods.id
        AND pr.employee_id = public.get_employee_by_user(auth.uid())
    )
  );