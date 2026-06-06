
CREATE OR REPLACE FUNCTION public.prevent_overlapping_approved_leaves()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status IN ('pending', 'manager_approved', 'hr_approved') THEN
    IF EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.employee_id = NEW.employee_id
        AND lr.id <> NEW.id
        AND lr.status IN ('manager_approved', 'hr_approved')
        AND lr.start_date <= NEW.end_date
        AND lr.end_date >= NEW.start_date
    ) THEN
      RAISE EXCEPTION 'The selected date range overlaps with an existing approved leave request.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_overlapping_approved_leaves ON public.leave_requests;
CREATE TRIGGER trg_prevent_overlapping_approved_leaves
BEFORE INSERT OR UPDATE ON public.leave_requests
FOR EACH ROW EXECUTE FUNCTION public.prevent_overlapping_approved_leaves();
