CREATE OR REPLACE FUNCTION public.get_leave_approver_name(_leave_id uuid)
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.format_employee_name(
    coalesce(e.first_name, p.first_name),
    coalesce(nullif(btrim(e.middle_name), ''), p.middle_name),
    coalesce(e.last_name, p.last_name),
    e.suffix_name
  )
  FROM public.leave_requests lr
  JOIN public.profiles p ON p.id = lr.hr_id
  LEFT JOIN public.employees e ON e.user_id = lr.hr_id
  WHERE lr.id = _leave_id
    AND (
      public.is_admin(auth.uid())
      OR lr.employee_id = public.get_employee_by_user(auth.uid())
    )
  LIMIT 1
$function$;