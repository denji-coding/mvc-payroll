CREATE OR REPLACE FUNCTION public.get_leave_approver_name(_leave_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.format_employee_name(p.first_name, p.middle_name, p.last_name, NULL)
  FROM public.leave_requests lr
  JOIN public.profiles p ON p.id = lr.hr_id
  WHERE lr.id = _leave_id
    AND (
      public.is_admin(auth.uid())
      OR lr.employee_id = public.get_employee_by_user(auth.uid())
    )
  LIMIT 1
$$;

GRANT EXECUTE ON FUNCTION public.get_leave_approver_name(uuid) TO authenticated;