UPDATE public.notifications n
SET message = public.format_employee_name(e.first_name, e.middle_name, e.last_name, e.suffix_name)
              || substring(n.message from position(' has submitted' in n.message))
FROM public.leave_requests lr
JOIN public.employees e ON e.id = lr.employee_id
WHERE n.reference_type = 'leave_request'
  AND n.reference_id = lr.id
  AND position(' has submitted' in n.message) > 0
  AND n.message <> public.format_employee_name(e.first_name, e.middle_name, e.last_name, e.suffix_name)
                   || substring(n.message from position(' has submitted' in n.message));