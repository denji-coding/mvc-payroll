CREATE OR REPLACE FUNCTION public.restrict_employee_self_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Privileged callers bypass the restriction
  IF current_setting('role', true) = 'service_role'
     OR auth.uid() IS NULL
     OR public.is_admin(auth.uid())
     OR public.has_role(auth.uid(), 'branch_manager'::app_role) THEN
    RETURN NEW;
  END IF;

  -- Self-service update: force sensitive columns back to their stored values
  IF OLD.user_id IS NOT NULL AND OLD.user_id = auth.uid() THEN
    NEW.user_id            := OLD.user_id;
    NEW.employee_id        := OLD.employee_id;
    NEW.rfid_card_number   := OLD.rfid_card_number;
    NEW.branch_id          := OLD.branch_id;
    NEW.position           := OLD.position;
    NEW.date_hired         := OLD.date_hired;
    NEW.employment_status  := OLD.employment_status;
    NEW.basic_salary       := OLD.basic_salary;
    NEW.sss_number         := OLD.sss_number;
    NEW.philhealth_number  := OLD.philhealth_number;
    NEW.pagibig_number     := OLD.pagibig_number;
    NEW.email              := OLD.email;
    NEW.first_name         := OLD.first_name;
    NEW.middle_name        := OLD.middle_name;
    NEW.last_name          := OLD.last_name;
    NEW.suffix_name        := OLD.suffix_name;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_restrict_employee_self_update ON public.employees;
CREATE TRIGGER trg_restrict_employee_self_update
BEFORE UPDATE ON public.employees
FOR EACH ROW EXECUTE FUNCTION public.restrict_employee_self_update();

DROP POLICY IF EXISTS "Employees can update own record" ON public.employees;
CREATE POLICY "Employees can update own record"
ON public.employees FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());