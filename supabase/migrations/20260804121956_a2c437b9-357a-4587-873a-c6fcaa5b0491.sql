-- Helper: standardized employee display name
CREATE OR REPLACE FUNCTION public.format_employee_name(_first text, _middle text, _last text, _suffix text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT btrim(regexp_replace(
    concat_ws(' ',
      initcap(coalesce(btrim(_first), '')),
      CASE WHEN coalesce(btrim(_middle), '') = '' THEN NULL
           ELSE upper(left(btrim(_middle), 1)) || '.' END,
      initcap(coalesce(btrim(_last), '')),
      CASE WHEN coalesce(btrim(_suffix), '') = '' THEN NULL
           WHEN btrim(_suffix) ~* '^[ivxlcdm]+\.?$' THEN upper(btrim(_suffix))
           ELSE initcap(btrim(_suffix)) END
    ), '\s+', ' ', 'g'))
$$;

-- Attendance notifications now use the 4-punch columns
CREATE OR REPLACE FUNCTION public.notify_employee_on_attendance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  emp_user_id UUID;
  notification_message TEXT;
  new_first TIMESTAMPTZ;
  old_first TIMESTAMPTZ;
  new_last TIMESTAMPTZ;
  old_last TIMESTAMPTZ;
BEGIN
  SELECT user_id INTO emp_user_id FROM employees WHERE id = NEW.employee_id;
  IF emp_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  new_first := COALESCE(NEW.morning_in, NEW.afternoon_in);
  new_last  := COALESCE(NEW.afternoon_out, NEW.morning_out);
  IF TG_OP = 'UPDATE' THEN
    old_first := COALESCE(OLD.morning_in, OLD.afternoon_in);
    old_last  := COALESCE(OLD.afternoon_out, OLD.morning_out);
  END IF;

  IF TG_OP = 'INSERT' AND new_first IS NOT NULL THEN
    notification_message := 'You clocked in at ' || to_char(new_first AT TIME ZONE 'Asia/Manila', 'HH12:MI AM');
    IF NEW.late_minutes > 0 THEN
      notification_message := notification_message || ' (' || NEW.late_minutes || ' minutes late)';
    END IF;
    INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (emp_user_id, 'attendance', 'Clock In Recorded', notification_message, NEW.id, 'attendance');

  ELSIF TG_OP = 'UPDATE' AND old_first IS NULL AND new_first IS NOT NULL THEN
    notification_message := 'You clocked in at ' || to_char(new_first AT TIME ZONE 'Asia/Manila', 'HH12:MI AM');
    IF NEW.late_minutes > 0 THEN
      notification_message := notification_message || ' (' || NEW.late_minutes || ' minutes late)';
    END IF;
    INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (emp_user_id, 'attendance', 'Clock In Recorded', notification_message, NEW.id, 'attendance');

  ELSIF TG_OP = 'UPDATE' AND old_last IS DISTINCT FROM new_last AND new_last IS NOT NULL THEN
    notification_message := 'You clocked out at ' || to_char(new_last AT TIME ZONE 'Asia/Manila', 'HH12:MI AM');
    IF NEW.hours_worked IS NOT NULL THEN
      notification_message := notification_message || '. Hours worked: ' || round(NEW.hours_worked::numeric, 2);
    END IF;
    INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (emp_user_id, 'attendance', 'Clock Out Recorded', notification_message, NEW.id, 'attendance');
  END IF;

  RETURN NEW;
END;
$function$;

-- HR leave request notification with standardized name
CREATE OR REPLACE FUNCTION public.notify_hr_on_leave_request()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
DECLARE
  hr_user RECORD;
  emp_name TEXT;
BEGIN
  SELECT public.format_employee_name(first_name, middle_name, last_name, suffix_name)
    INTO emp_name
  FROM employees WHERE id = NEW.employee_id;

  FOR hr_user IN SELECT user_id FROM user_roles WHERE role::text IN ('hr_admin', 'super_admin')
  LOOP
    INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (
      hr_user.user_id,
      'leave_request',
      'New Leave Request',
      emp_name || ' has submitted a ' || NEW.leave_type || ' leave request',
      NEW.id,
      'leave_request'
    );
  END LOOP;

  RETURN NEW;
END;
$function$;

-- Drop legacy attendance columns
ALTER TABLE public.attendance DROP COLUMN IF EXISTS time_in;
ALTER TABLE public.attendance DROP COLUMN IF EXISTS time_out;

-- Drop unused employee columns
ALTER TABLE public.employees DROP COLUMN IF EXISTS department;
ALTER TABLE public.employees DROP COLUMN IF EXISTS tin_number;
ALTER TABLE public.employees DROP COLUMN IF EXISTS bank_name;
ALTER TABLE public.employees DROP COLUMN IF EXISTS bank_account_number;

-- Drop unused loans table
DROP TABLE IF EXISTS public.loans;