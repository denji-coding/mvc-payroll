-- =============================================================================
-- HRM & Payroll System — Consolidated Initial Schema (Reference Export)
-- =============================================================================
-- Generated from the live project on 2026-06-09.
--
-- PURPOSE
--   Single, self-contained PostgreSQL/Supabase migration that reproduces the
--   current HRM & Payroll schema. Intended to bootstrap a BRAND-NEW Supabase
--   project. Do NOT run against the existing project's database — the live
--   schema already exists and re-running here would be a no-op at best.
--
-- IDEMPOTENCY
--   * CREATE TABLE IF NOT EXISTS for every public table.
--   * Enums wrapped in DO blocks that ignore duplicate_object.
--   * CREATE OR REPLACE for every function.
--   * DROP TRIGGER IF EXISTS / DROP POLICY IF EXISTS before re-create.
--   * Seed inserts use ON CONFLICT DO NOTHING.
--
-- CONVENTIONS
--   * All timestamps use TIMESTAMPTZ.
--   * created_at / updated_at on every mutable table, maintained via trigger.
--   * Foreign keys reference auth.users (managed by Supabase) where appropriate.
--   * RLS is enabled on every public table; policies grant access by role
--     (super_admin, hr_admin, branch_manager, employee).
--
-- NOT INCLUDED (manual / out-of-band)
--   * Super Admin auth.users seed — requires Supabase Admin API
--     (auth.admin.createUser). See the application's seeding migration.
--   * Edge Functions — live as Deno files under supabase/functions/ and
--     deploy independently.
--   * pg_cron schedules — created from the Supabase dashboard / CLI; the
--     functions they invoke are defined below.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Extensions
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;


-- -----------------------------------------------------------------------------
-- 2. Enums
-- -----------------------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.app_role AS ENUM ('hr_admin','branch_manager','employee','super_admin');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.employment_status AS ENUM ('active','resigned','terminated','on_leave','inactive');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.leave_status AS ENUM ('pending','manager_approved','hr_approved','rejected','cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.leave_type AS ENUM ('vacation','sick','emergency','maternity','paternity','bereavement','unpaid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.payroll_status AS ENUM ('draft','processing','approved','paid');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.notification_type AS ENUM (
    'leave_request','leave_approved','leave_rejected',
    'payroll_ready','announcement','system','attendance'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- -----------------------------------------------------------------------------
-- 3. Utility function — generic updated_at touch
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


-- =============================================================================
-- 4. Tables (CREATE TABLE -> GRANT -> ENABLE RLS -> POLICIES)
--    Order respects FK dependencies.
-- =============================================================================

-- ---- profiles ---------------------------------------------------------------
-- Mirror of auth.users with editable display fields and the must_change_password
-- flag used by the forgot-password flow.
CREATE TABLE IF NOT EXISTS public.profiles (
  id                    uuid PRIMARY KEY,
  email                 text NOT NULL,
  first_name            text NOT NULL,
  last_name             text NOT NULL,
  middle_name           text,
  phone                 text,
  avatar_url            text,
  must_change_password  boolean DEFAULT false,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- ---- user_roles -------------------------------------------------------------
-- A user may hold multiple roles. Role checks are read via has_role()/is_admin()
-- security-definer functions to avoid recursive RLS.
CREATE TABLE IF NOT EXISTS public.user_roles (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role        public.app_role NOT NULL,
  created_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ---- role_permissions -------------------------------------------------------
-- Per-role feature toggles consumed by the sidebar/permission hook.
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role            public.app_role NOT NULL,
  permission_key  text NOT NULL,
  enabled         boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now(),
  UNIQUE (role, permission_key)
);
GRANT SELECT ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- ---- branches ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branches (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  code            text NOT NULL UNIQUE,
  address         text,
  contact_number  text,
  is_active       boolean DEFAULT true,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);
GRANT SELECT ON public.branches TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.branches TO authenticated;
GRANT ALL ON public.branches TO service_role;
ALTER TABLE public.branches ENABLE ROW LEVEL SECURITY;

-- ---- branch_managers --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.branch_managers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  branch_id    uuid NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  assigned_at  timestamptz DEFAULT now(),
  UNIQUE (branch_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.branch_managers TO authenticated;
GRANT ALL ON public.branch_managers TO service_role;
ALTER TABLE public.branch_managers ENABLE ROW LEVEL SECURITY;

-- ---- positions --------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.positions (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  department  text,
  description text,
  is_active   boolean DEFAULT true,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.positions TO authenticated;
GRANT ALL ON public.positions TO service_role;
ALTER TABLE public.positions ENABLE ROW LEVEL SECURITY;

-- ---- employees --------------------------------------------------------------
-- The primary HR record. user_id links to auth.users (set null on user delete
-- to preserve historic payroll/attendance).
CREATE TABLE IF NOT EXISTS public.employees (
  id                       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  employee_id              text NOT NULL UNIQUE,           -- format EMP-XXXXXX
  first_name               text NOT NULL,
  middle_name              text,
  last_name                text NOT NULL,
  suffix_name              text,                            -- optional (e.g. Jr., Sr., II, III)
  email                    text NOT NULL,
  phone                    text,
  date_of_birth            date,
  gender                   text,
  civil_status             text,
  address                  text,
  emergency_contact_name   text,
  emergency_contact_phone  text,
  position                 text NOT NULL,
  
  date_hired               date NOT NULL,
  employment_status        public.employment_status DEFAULT 'active',
  basic_salary             numeric NOT NULL DEFAULT 0,
  branch_id                uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  sss_number               text,
  philhealth_number        text,
  pagibig_number           text,
  rfid_card_number         text UNIQUE,
  avatar_url               text,
  created_at               timestamptz DEFAULT now(),
  updated_at               timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employees TO authenticated;
GRANT ALL ON public.employees TO service_role;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;

-- ---- employee_schedules -----------------------------------------------------
-- Weekly schedule. Four-punch (AM in/out, PM in/out) is enforced in the app.
CREATE TABLE IF NOT EXISTS public.employee_schedules (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  day_of_week       integer NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  is_duty_day       boolean DEFAULT true,
  start_time        time DEFAULT '08:00',
  end_time          time DEFAULT '17:00',
  morning_start     time DEFAULT '08:00',
  morning_end       time DEFAULT '12:00',
  afternoon_start   time DEFAULT '13:00',
  afternoon_end     time DEFAULT '17:00',
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  UNIQUE (employee_id, day_of_week)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_schedules TO authenticated;
GRANT ALL ON public.employee_schedules TO service_role;
ALTER TABLE public.employee_schedules ENABLE ROW LEVEL SECURITY;

-- ---- salary_components ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.salary_components (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name          text NOT NULL,
  type          text NOT NULL,                 -- earning | deduction
  is_taxable    boolean DEFAULT true,
  is_mandatory  boolean DEFAULT false,
  description   text,
  created_at    timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.salary_components TO authenticated;
GRANT ALL ON public.salary_components TO service_role;
ALTER TABLE public.salary_components ENABLE ROW LEVEL SECURITY;

-- ---- employee_salary_adjustments -------------------------------------------
CREATE TABLE IF NOT EXISTS public.employee_salary_adjustments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id     uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  component_id    uuid NOT NULL REFERENCES public.salary_components(id) ON DELETE CASCADE,
  amount          numeric NOT NULL,
  is_recurring    boolean DEFAULT true,
  effective_from  date,
  effective_to    date,
  created_at      timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.employee_salary_adjustments TO authenticated;
GRANT ALL ON public.employee_salary_adjustments TO service_role;
ALTER TABLE public.employee_salary_adjustments ENABLE ROW LEVEL SECURITY;

-- ---- attendance -------------------------------------------------------------
-- 4-punch sequence (morning_in, morning_out, afternoon_in, afternoon_out).
-- One row per employee per date.
CREATE TABLE IF NOT EXISTS public.attendance (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id         uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  date                date NOT NULL,
  morning_in          timestamptz,
  morning_out         timestamptz,
  afternoon_in        timestamptz,
  afternoon_out       timestamptz,
  rfid_time_in        text,
  rfid_time_out       text,
  hours_worked        numeric,
  late_minutes        integer DEFAULT 0,
  undertime_minutes   integer DEFAULT 0,
  overtime_hours      numeric DEFAULT 0,
  status              text DEFAULT 'present',
  remarks             text,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE (employee_id, date)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendance TO authenticated;
GRANT ALL ON public.attendance TO service_role;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;

-- ---- holidays ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.holidays (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  date        date NOT NULL,
  type        text NOT NULL CHECK (type IN ('regular','special')),
  year        integer NOT NULL,
  created_at  timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.holidays TO authenticated;
GRANT ALL ON public.holidays TO service_role;
ALTER TABLE public.holidays ENABLE ROW LEVEL SECURITY;

-- ---- leave_types ------------------------------------------------------------
-- Catalog of configurable leave types. Names are also referenced as text by
-- leave_credits.leave_type.
CREATE TABLE IF NOT EXISTS public.leave_types (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      text NOT NULL UNIQUE,
  description               text,
  default_credits           numeric NOT NULL DEFAULT 0,
  credits_per_application   numeric NOT NULL DEFAULT 1,
  max_days_per_application  numeric,
  calendar_config           text NOT NULL DEFAULT 'disable_past',  -- disable_past|disable_future|no_disable
  required_fields           text[] NOT NULL DEFAULT '{reason}',
  upload_condition_days     numeric,
  is_active                 boolean NOT NULL DEFAULT true,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_types TO authenticated;
GRANT SELECT ON public.leave_types TO anon;  -- public catalog
GRANT ALL ON public.leave_types TO service_role;
ALTER TABLE public.leave_types ENABLE ROW LEVEL SECURITY;

-- ---- leave_credits ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_credits (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id    uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type     text NOT NULL,
  year           integer NOT NULL,
  total_credits  numeric DEFAULT 0,
  used_credits   numeric DEFAULT 0,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  UNIQUE (employee_id, leave_type, year)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_credits TO authenticated;
GRANT ALL ON public.leave_credits TO service_role;
ALTER TABLE public.leave_credits ENABLE ROW LEVEL SECURITY;

-- ---- leave_requests ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.leave_requests (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id               uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  leave_type                text NOT NULL,
  start_date                date NOT NULL,
  end_date                  date NOT NULL,
  total_days                numeric NOT NULL,
  pay_type                  text NOT NULL DEFAULT 'with_pay',
  reason                    text,
  medical_certificate_url   text,
  status                    public.leave_status DEFAULT 'pending',
  manager_id                uuid REFERENCES auth.users(id),
  manager_action_at         timestamptz,
  manager_remarks           text,
  hr_id                     uuid REFERENCES auth.users(id),
  hr_action_at              timestamptz,
  hr_remarks                text,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.leave_requests TO authenticated;
GRANT ALL ON public.leave_requests TO service_role;
ALTER TABLE public.leave_requests ENABLE ROW LEVEL SECURITY;

-- ---- payroll_periods --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_periods (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start  date NOT NULL,
  period_end    date NOT NULL,
  pay_date      date NOT NULL,
  status        public.payroll_status DEFAULT 'draft',
  created_by    uuid REFERENCES auth.users(id),
  approved_by   uuid REFERENCES auth.users(id),
  approved_at   timestamptz,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_periods TO authenticated;
GRANT ALL ON public.payroll_periods TO service_role;
ALTER TABLE public.payroll_periods ENABLE ROW LEVEL SECURITY;

-- ---- payroll_records --------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.payroll_records (
  id                        uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_period_id         uuid NOT NULL REFERENCES public.payroll_periods(id) ON DELETE CASCADE,
  employee_id               uuid NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
  days_worked               numeric DEFAULT 0,
  basic_pay                 numeric NOT NULL DEFAULT 0,
  overtime_pay              numeric DEFAULT 0,
  holiday_pay               numeric DEFAULT 0,
  night_differential        numeric DEFAULT 0,
  total_allowances          numeric DEFAULT 0,
  gross_pay                 numeric DEFAULT 0,
  sss_contribution          numeric DEFAULT 0,
  philhealth_contribution   numeric DEFAULT 0,
  pagibig_contribution      numeric DEFAULT 0,
  withholding_tax           numeric DEFAULT 0,
  other_deductions          numeric DEFAULT 0,
  total_deductions          numeric DEFAULT 0,
  net_pay                   numeric DEFAULT 0,
  allowances_breakdown      jsonb DEFAULT '{}'::jsonb,
  deductions_breakdown      jsonb DEFAULT '{}'::jsonb,
  is_manual                 boolean DEFAULT false,
  created_at                timestamptz DEFAULT now(),
  updated_at                timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payroll_records TO authenticated;
GRANT ALL ON public.payroll_records TO service_role;
ALTER TABLE public.payroll_records ENABLE ROW LEVEL SECURITY;


-- ---- announcements ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.announcements (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title         text NOT NULL,
  content       text NOT NULL,
  branch_id     uuid REFERENCES public.branches(id) ON DELETE SET NULL,
  is_published  boolean DEFAULT false,
  published_at  timestamptz,
  created_by    uuid REFERENCES auth.users(id),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.announcements TO authenticated;
GRANT ALL ON public.announcements TO service_role;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- ---- notifications ----------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.notifications (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type            public.notification_type NOT NULL,
  title           text NOT NULL,
  message         text NOT NULL,
  reference_id    uuid,
  reference_type  text,
  is_read         boolean DEFAULT false,
  created_at      timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---- settings ---------------------------------------------------------------
-- Free-form JSON configuration keyed by string (company_info, terminal, etc.)
CREATE TABLE IF NOT EXISTS public.settings (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key         text NOT NULL UNIQUE,
  value       jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.settings TO authenticated;
GRANT ALL ON public.settings TO service_role;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;

-- ---- password_reset_tokens --------------------------------------------------
-- Locked-down table; accessed only by the forgot-password edge function via
-- service_role. No client policies on purpose.
CREATE TABLE IF NOT EXISTS public.password_reset_tokens (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  temp_password_hash   text NOT NULL,
  expires_at           timestamptz NOT NULL,
  is_used              boolean DEFAULT false,
  created_at           timestamptz DEFAULT now()
);
GRANT ALL ON public.password_reset_tokens TO service_role;
ALTER TABLE public.password_reset_tokens ENABLE ROW LEVEL SECURITY;


-- =============================================================================
-- 5. Domain functions (SECURITY DEFINER)
-- =============================================================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  -- super_admin inherits every hr_admin check
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id
    AND (role = _role OR (_role = 'hr_admin'::public.app_role AND role = 'super_admin'::public.app_role)))
$$;

CREATE OR REPLACE FUNCTION public.is_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text IN ('hr_admin','super_admin')
  )
$$;

CREATE OR REPLACE FUNCTION public.is_super_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role::text = 'super_admin'
  )
$$;

-- Used by the login page (signed out) to decide whether to show First-Time Setup.
CREATE OR REPLACE FUNCTION public.has_any_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE role::text IN ('hr_admin','super_admin')
  )
$$;
GRANT EXECUTE ON FUNCTION public.has_any_admin() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_employee_by_user(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.employees WHERE user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_branch_id(_user_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT branch_id FROM public.branch_managers WHERE user_id = _user_id LIMIT 1
$$;

-- Auth handler: on auth.users insert, create profile + default 'employee' role.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email, first_name, last_name)
  VALUES (NEW.id, NEW.email,
          COALESCE(NEW.raw_user_meta_data ->> 'first_name', ''),
          COALESCE(NEW.raw_user_meta_data ->> 'last_name', ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'employee');
  RETURN NEW;
END;
$$;

-- Auto-seed leave_credits when a new employee is inserted.
CREATE OR REPLACE FUNCTION public.assign_leave_credits_to_employee()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  lt RECORD; current_yr integer; enum_val text;
BEGIN
  current_yr := EXTRACT(YEAR FROM now());
  FOR lt IN SELECT name, default_credits FROM leave_types WHERE is_active = true LOOP
    enum_val := CASE lt.name
      WHEN 'Sick Leave' THEN 'sick'
      WHEN 'Vacation Leave' THEN 'vacation'
      WHEN 'Emergency Leave' THEN 'emergency'
      WHEN 'Maternity/Paternity Leave' THEN 'maternity'
      WHEN 'Paternity Leave' THEN 'paternity'
      WHEN 'Bereavement Leave' THEN 'bereavement'
      WHEN 'Unpaid Leave' THEN 'unpaid'
      ELSE 'sick'
    END;
    INSERT INTO leave_credits (employee_id, leave_type, year, total_credits, used_credits)
    VALUES (NEW.id, enum_val::leave_type, current_yr, lt.default_credits, 0)
    ON CONFLICT DO NOTHING;
  END LOOP;
  RETURN NEW;
END;
$$;

-- Block overlapping approved/pending leaves for the same employee.
CREATE OR REPLACE FUNCTION public.prevent_overlapping_approved_leaves()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IN ('pending','manager_approved','hr_approved') THEN
    IF EXISTS (
      SELECT 1 FROM public.leave_requests lr
      WHERE lr.employee_id = NEW.employee_id
        AND lr.id <> NEW.id
        AND lr.status IN ('manager_approved','hr_approved')
        AND lr.start_date <= NEW.end_date
        AND lr.end_date   >= NEW.start_date
    ) THEN
      RAISE EXCEPTION 'The selected date range overlaps with an existing approved leave request.'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Super Admin protection — guarantees ≥1 super_admin row and blocks demotion.
CREATE OR REPLACE FUNCTION public.protect_super_admin_role()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  is_caller_super boolean; super_count int;
BEGIN
  IF current_setting('role', true) = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  is_caller_super := auth.uid() IS NOT NULL AND public.is_super_admin(auth.uid());

  IF TG_OP = 'DELETE' THEN
    IF OLD.role::text = 'super_admin' THEN
      SELECT count(*) INTO super_count FROM public.user_roles WHERE role::text = 'super_admin';
      IF super_count <= 1 THEN RAISE EXCEPTION 'Cannot delete the last Super Admin account'; END IF;
      IF NOT is_caller_super THEN RAISE EXCEPTION 'Only a Super Admin can remove a Super Admin role'; END IF;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD.role::text = 'super_admin' AND NEW.role::text <> 'super_admin' THEN
      RAISE EXCEPTION 'The Super Admin role cannot be demoted';
    END IF;
    IF NEW.role::text = 'super_admin' AND OLD.role::text <> 'super_admin' AND NOT is_caller_super THEN
      RAISE EXCEPTION 'Only a Super Admin can grant the Super Admin role';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.role::text = 'super_admin' THEN
      SELECT count(*) INTO super_count FROM public.user_roles WHERE role::text = 'super_admin';
      IF super_count > 0 AND NOT is_caller_super THEN
        RAISE EXCEPTION 'Only a Super Admin can grant the Super Admin role';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.protect_super_admin_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = OLD.id AND role::text = 'super_admin') THEN
    RAISE EXCEPTION 'Cannot delete the profile of a Super Admin account';
  END IF;
  RETURN OLD;
END;
$$;

-- Notification fan-out triggers ----------------------------------------------
CREATE OR REPLACE FUNCTION public.format_employee_name(_first text, _middle text, _last text, _suffix text)
RETURNS text LANGUAGE sql IMMUTABLE SET search_path = public AS $$
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

CREATE OR REPLACE FUNCTION public.notify_hr_on_leave_request()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE hr_user RECORD; emp_name TEXT;
BEGIN
  SELECT public.format_employee_name(first_name, middle_name, last_name, suffix_name)
    INTO emp_name FROM employees WHERE id = NEW.employee_id;
  FOR hr_user IN SELECT user_id FROM user_roles WHERE role::text IN ('hr_admin','super_admin') LOOP
    INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (hr_user.user_id, 'leave_request', 'New Leave Request',
            emp_name || ' has submitted a ' || NEW.leave_type || ' leave request',
            NEW.id, 'leave_request');
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_employee_on_leave_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp_user_id uuid; t notification_type; title TEXT; msg TEXT;
BEGIN
  IF OLD.status = NEW.status THEN RETURN NEW; END IF;
  SELECT user_id INTO emp_user_id FROM employees WHERE id = NEW.employee_id;
  IF emp_user_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'hr_approved' THEN
    t := 'leave_approved'; title := 'Leave Request Approved';
    msg := 'Your ' || NEW.leave_type || ' leave request has been approved';
  ELSIF NEW.status = 'rejected' THEN
    t := 'leave_rejected'; title := 'Leave Request Rejected';
    msg := 'Your ' || NEW.leave_type || ' leave request has been rejected';
  ELSE RETURN NEW;
  END IF;
  INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
  VALUES (emp_user_id, t, title, msg, NEW.id, 'leave_request');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_employee_on_attendance()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  emp_user_id uuid; msg TEXT;
  new_first timestamptz; old_first timestamptz; new_last timestamptz; old_last timestamptz;
BEGIN
  SELECT user_id INTO emp_user_id FROM employees WHERE id = NEW.employee_id;
  IF emp_user_id IS NULL THEN RETURN NEW; END IF;

  new_first := COALESCE(NEW.morning_in, NEW.afternoon_in);
  new_last  := COALESCE(NEW.afternoon_out, NEW.morning_out);
  IF TG_OP = 'UPDATE' THEN
    old_first := COALESCE(OLD.morning_in, OLD.afternoon_in);
    old_last  := COALESCE(OLD.afternoon_out, OLD.morning_out);
  END IF;

  IF (TG_OP = 'INSERT' AND new_first IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND old_first IS NULL AND new_first IS NOT NULL) THEN
    msg := 'You clocked in at ' || to_char(new_first AT TIME ZONE 'Asia/Manila','HH12:MI AM');
    IF NEW.late_minutes > 0 THEN msg := msg || ' (' || NEW.late_minutes || ' minutes late)'; END IF;
    INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (emp_user_id, 'attendance', 'Clock In Recorded', msg, NEW.id, 'attendance');
  ELSIF TG_OP = 'UPDATE' AND old_last IS DISTINCT FROM new_last AND new_last IS NOT NULL THEN
    msg := 'You clocked out at ' || to_char(new_last AT TIME ZONE 'Asia/Manila','HH12:MI AM');
    IF NEW.hours_worked IS NOT NULL THEN msg := msg || '. Hours worked: ' || round(NEW.hours_worked::numeric,2); END IF;
    INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (emp_user_id, 'attendance', 'Clock Out Recorded', msg, NEW.id, 'attendance');
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_employees_on_announcement()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp RECORD;
BEGIN
  IF NEW.is_published = true THEN
    FOR emp IN
      SELECT DISTINCT e.user_id FROM public.employees e
      WHERE e.employment_status = 'active' AND e.user_id IS NOT NULL
        AND (NEW.branch_id IS NULL OR e.branch_id = NEW.branch_id)
    LOOP
      INSERT INTO public.notifications (user_id, type, title, message, reference_id, reference_type)
      VALUES (emp.user_id, 'announcement', 'New Announcement: ' || NEW.title,
              LEFT(NEW.content,100) || CASE WHEN LENGTH(NEW.content) > 100 THEN '...' ELSE '' END,
              NEW.id, 'announcement');
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_employees_on_payroll_approved()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE emp_record RECORD;
BEGIN
  IF OLD.status = NEW.status OR NEW.status <> 'approved' THEN RETURN NEW; END IF;
  FOR emp_record IN
    SELECT e.user_id, pr.net_pay
    FROM payroll_records pr JOIN employees e ON e.id = pr.employee_id
    WHERE pr.payroll_period_id = NEW.id AND e.user_id IS NOT NULL
  LOOP
    INSERT INTO notifications (user_id, type, title, message, reference_id, reference_type)
    VALUES (emp_record.user_id, 'payroll_ready', 'Payslip Ready',
            'Your payslip for ' || to_char(NEW.period_start,'Mon DD') || ' - ' ||
            to_char(NEW.period_end,'Mon DD, YYYY') || ' is ready to view',
            NEW.id, 'payroll_period');
  END LOOP;
  RETURN NEW;
END;
$$;


-- =============================================================================
-- 6. Triggers
-- =============================================================================

-- auth.users -> profiles + default role
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- updated_at maintenance (one per mutable table)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles','role_permissions','branches','positions','employees','employee_schedules',
    'attendance','leave_types','leave_credits','leave_requests',
    'payroll_periods','payroll_records','announcements','settings'
  ] LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON public.%I', t, t);
    EXECUTE format(
      'CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON public.%I
       FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()', t, t);
  END LOOP;
END $$;

-- Super Admin protection
DROP TRIGGER IF EXISTS trg_protect_super_admin_role ON public.user_roles;
CREATE TRIGGER trg_protect_super_admin_role
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_role();

DROP TRIGGER IF EXISTS trg_protect_super_admin_profile ON public.profiles;
CREATE TRIGGER trg_protect_super_admin_profile
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_super_admin_profile();

-- Employee onboarding -> leave credits
DROP TRIGGER IF EXISTS on_employee_created_assign_leave ON public.employees;
CREATE TRIGGER on_employee_created_assign_leave
  AFTER INSERT ON public.employees
  FOR EACH ROW EXECUTE FUNCTION public.assign_leave_credits_to_employee();

-- Leave overlap guard + notification triggers
DROP TRIGGER IF EXISTS trg_prevent_overlapping_approved_leaves ON public.leave_requests;
CREATE TRIGGER trg_prevent_overlapping_approved_leaves
  BEFORE INSERT OR UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.prevent_overlapping_approved_leaves();

DROP TRIGGER IF EXISTS on_leave_request_created ON public.leave_requests;
CREATE TRIGGER on_leave_request_created
  AFTER INSERT ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_hr_on_leave_request();

DROP TRIGGER IF EXISTS on_leave_status_updated ON public.leave_requests;
CREATE TRIGGER on_leave_status_updated
  AFTER UPDATE ON public.leave_requests
  FOR EACH ROW EXECUTE FUNCTION public.notify_employee_on_leave_update();

-- Attendance notifications
DROP TRIGGER IF EXISTS on_attendance_recorded ON public.attendance;
CREATE TRIGGER on_attendance_recorded
  AFTER INSERT OR UPDATE ON public.attendance
  FOR EACH ROW EXECUTE FUNCTION public.notify_employee_on_attendance();

-- Announcement notifications
DROP TRIGGER IF EXISTS on_announcement_published ON public.announcements;
CREATE TRIGGER on_announcement_published
  AFTER INSERT ON public.announcements
  FOR EACH ROW WHEN (NEW.is_published = true)
  EXECUTE FUNCTION public.notify_employees_on_announcement();

DROP TRIGGER IF EXISTS on_announcement_publish_update ON public.announcements;
CREATE TRIGGER on_announcement_publish_update
  AFTER UPDATE OF is_published ON public.announcements
  FOR EACH ROW WHEN (OLD.is_published = false AND NEW.is_published = true)
  EXECUTE FUNCTION public.notify_employees_on_announcement();

-- Payroll approval notifications
DROP TRIGGER IF EXISTS on_payroll_approved ON public.payroll_periods;
CREATE TRIGGER on_payroll_approved
  AFTER UPDATE ON public.payroll_periods
  FOR EACH ROW EXECUTE FUNCTION public.notify_employees_on_payroll_approved();


-- =============================================================================
-- 7. RLS Policies
--   Every public table has a blanket super_admin policy plus role-specific
--   policies that mirror what the live project enforces.
-- =============================================================================

-- profiles --------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "System can insert profiles" ON public.profiles;
CREATE POLICY "System can insert profiles" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "HR can view all profiles" ON public.profiles;
CREATE POLICY "HR can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.profiles;
CREATE POLICY "Super admins have full access" ON public.profiles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- user_roles ------------------------------------------------------------------
DROP POLICY IF EXISTS "Users can view own role" ON public.user_roles;
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "HR can select all roles" ON public.user_roles;
CREATE POLICY "HR can select all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "HR can insert roles" ON public.user_roles;
CREATE POLICY "HR can insert roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "HR can update roles" ON public.user_roles;
CREATE POLICY "HR can update roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "HR can delete roles" ON public.user_roles;
CREATE POLICY "HR can delete roles" ON public.user_roles
  FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.user_roles;
CREATE POLICY "Super admins have full access" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- role_permissions ------------------------------------------------------------
DROP POLICY IF EXISTS "Users can read permissions" ON public.role_permissions;
DROP POLICY IF EXISTS "Users can read own role permissions" ON public.role_permissions;
CREATE POLICY "Users can read own role permissions" ON public.role_permissions
  FOR SELECT TO authenticated USING (public.is_admin(auth.uid()) OR EXISTS (SELECT 1 FROM public.user_roles ur WHERE ur.user_id = auth.uid() AND ur.role = role_permissions.role));

DROP POLICY IF EXISTS "HR can manage permissions" ON public.role_permissions;
CREATE POLICY "HR can manage permissions" ON public.role_permissions
  FOR ALL TO authenticated USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.role_permissions;
CREATE POLICY "Super admins have full access" ON public.role_permissions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- branches --------------------------------------------------------------------
DROP POLICY IF EXISTS "Everyone can view branches" ON public.branches;
CREATE POLICY "Everyone can view branches" ON public.branches
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "HR can manage branches" ON public.branches;
CREATE POLICY "HR can manage branches" ON public.branches
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.branches;
CREATE POLICY "Super admins have full access" ON public.branches
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- branch_managers -------------------------------------------------------------
DROP POLICY IF EXISTS "Branch managers can view own assignment" ON public.branch_managers;
CREATE POLICY "Branch managers can view own assignment" ON public.branch_managers
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "HR can manage branch managers" ON public.branch_managers;
CREATE POLICY "HR can manage branch managers" ON public.branch_managers
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.branch_managers;
CREATE POLICY "Super admins have full access" ON public.branch_managers
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- positions -------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated users can read positions" ON public.positions;
CREATE POLICY "Authenticated users can read positions" ON public.positions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "HR admins can manage positions" ON public.positions;
CREATE POLICY "HR admins can manage positions" ON public.positions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'hr_admin'))
  WITH CHECK (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.positions;
CREATE POLICY "Super admins have full access" ON public.positions
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- employees -------------------------------------------------------------------
DROP POLICY IF EXISTS "Employees can view own record" ON public.employees;
CREATE POLICY "Employees can view own record" ON public.employees
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Employees can update own record" ON public.employees;
CREATE POLICY "Employees can update own record" ON public.employees
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Branch managers can view branch employees" ON public.employees;
CREATE POLICY "Branch managers can view branch employees" ON public.employees
  FOR SELECT USING (
    public.has_role(auth.uid(),'branch_manager')
    AND branch_id = public.get_user_branch_id(auth.uid())
  );

DROP POLICY IF EXISTS "HR can manage all employees" ON public.employees;
CREATE POLICY "HR can manage all employees" ON public.employees
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.employees;
CREATE POLICY "Super admins have full access" ON public.employees
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- employee_schedules ----------------------------------------------------------
DROP POLICY IF EXISTS "Employees can view own schedule" ON public.employee_schedules;
CREATE POLICY "Employees can view own schedule" ON public.employee_schedules
  FOR SELECT USING (employee_id = public.get_employee_by_user(auth.uid()));

DROP POLICY IF EXISTS "Branch managers can view branch schedules" ON public.employee_schedules;
CREATE POLICY "Branch managers can view branch schedules" ON public.employee_schedules
  FOR SELECT USING (
    public.has_role(auth.uid(),'branch_manager')
    AND employee_id IN (SELECT id FROM public.employees WHERE branch_id = public.get_user_branch_id(auth.uid()))
  );

DROP POLICY IF EXISTS "HR can manage schedules" ON public.employee_schedules;
CREATE POLICY "HR can manage schedules" ON public.employee_schedules
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.employee_schedules;
CREATE POLICY "Super admins have full access" ON public.employee_schedules
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- employee_salary_adjustments -------------------------------------------------
DROP POLICY IF EXISTS "Employees can view own adjustments" ON public.employee_salary_adjustments;
CREATE POLICY "Employees can view own adjustments" ON public.employee_salary_adjustments
  FOR SELECT USING (employee_id = public.get_employee_by_user(auth.uid()));

DROP POLICY IF EXISTS "HR can manage salary adjustments" ON public.employee_salary_adjustments;
CREATE POLICY "HR can manage salary adjustments" ON public.employee_salary_adjustments
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.employee_salary_adjustments;
CREATE POLICY "Super admins have full access" ON public.employee_salary_adjustments
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- attendance ------------------------------------------------------------------
DROP POLICY IF EXISTS "Employees can view own attendance" ON public.attendance;
CREATE POLICY "Employees can view own attendance" ON public.attendance
  FOR SELECT USING (employee_id = public.get_employee_by_user(auth.uid()));

DROP POLICY IF EXISTS "Branch managers can view branch attendance" ON public.attendance;
CREATE POLICY "Branch managers can view branch attendance" ON public.attendance
  FOR SELECT USING (
    public.has_role(auth.uid(),'branch_manager')
    AND employee_id IN (SELECT id FROM public.employees WHERE branch_id = public.get_user_branch_id(auth.uid()))
  );

DROP POLICY IF EXISTS "HR can manage all attendance" ON public.attendance;
CREATE POLICY "HR can manage all attendance" ON public.attendance
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.attendance;
CREATE POLICY "Super admins have full access" ON public.attendance
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- holidays --------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can view holidays" ON public.holidays;
CREATE POLICY "Authenticated can view holidays" ON public.holidays
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "HR can manage holidays" ON public.holidays;
CREATE POLICY "HR can manage holidays" ON public.holidays
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.holidays;
CREATE POLICY "Super admins have full access" ON public.holidays
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- leave_types -----------------------------------------------------------------
DROP POLICY IF EXISTS "Anyone can view leave types" ON public.leave_types;
CREATE POLICY "Anyone can view leave types" ON public.leave_types
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "HR admins can insert leave types" ON public.leave_types;
CREATE POLICY "HR admins can insert leave types" ON public.leave_types
  FOR INSERT WITH CHECK (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "HR admins can update leave types" ON public.leave_types;
CREATE POLICY "HR admins can update leave types" ON public.leave_types
  FOR UPDATE USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "HR admins can delete leave types" ON public.leave_types;
CREATE POLICY "HR admins can delete leave types" ON public.leave_types
  FOR DELETE USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.leave_types;
CREATE POLICY "Super admins have full access" ON public.leave_types
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- leave_credits ---------------------------------------------------------------
DROP POLICY IF EXISTS "Employees can view own leave credits" ON public.leave_credits;
CREATE POLICY "Employees can view own leave credits" ON public.leave_credits
  FOR SELECT USING (employee_id = public.get_employee_by_user(auth.uid()));

DROP POLICY IF EXISTS "HR can manage leave credits" ON public.leave_credits;
CREATE POLICY "HR can manage leave credits" ON public.leave_credits
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.leave_credits;
CREATE POLICY "Super admins have full access" ON public.leave_credits
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- leave_requests --------------------------------------------------------------
DROP POLICY IF EXISTS "Employees can manage own leave requests" ON public.leave_requests;
CREATE POLICY "Employees can manage own leave requests" ON public.leave_requests
  FOR ALL USING (employee_id = public.get_employee_by_user(auth.uid()));

DROP POLICY IF EXISTS "Branch managers can view branch leave requests" ON public.leave_requests;
CREATE POLICY "Branch managers can view branch leave requests" ON public.leave_requests
  FOR SELECT TO authenticated USING (
    public.has_role(auth.uid(),'branch_manager')
    AND employee_id IN (SELECT id FROM public.employees WHERE branch_id = public.get_user_branch_id(auth.uid()))
  );

DROP POLICY IF EXISTS "Branch managers can update branch leave requests" ON public.leave_requests;
CREATE POLICY "Branch managers can update branch leave requests" ON public.leave_requests
  FOR UPDATE TO authenticated USING (
    public.has_role(auth.uid(),'branch_manager')
    AND employee_id IN (SELECT id FROM public.employees WHERE branch_id = public.get_user_branch_id(auth.uid()))
  );

DROP POLICY IF EXISTS "HR can manage all leave requests" ON public.leave_requests;
CREATE POLICY "HR can manage all leave requests" ON public.leave_requests
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.leave_requests;
CREATE POLICY "Super admins have full access" ON public.leave_requests
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- salary_components -----------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can view salary components" ON public.salary_components;
CREATE POLICY "Authenticated can view salary components" ON public.salary_components
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "HR can manage salary components" ON public.salary_components;
CREATE POLICY "HR can manage salary components" ON public.salary_components
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.salary_components;
CREATE POLICY "Super admins have full access" ON public.salary_components
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- payroll_periods -------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can view payroll periods" ON public.payroll_periods;
CREATE POLICY "Authenticated can view payroll periods" ON public.payroll_periods
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "HR can manage payroll periods" ON public.payroll_periods;
CREATE POLICY "HR can manage payroll periods" ON public.payroll_periods
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.payroll_periods;
CREATE POLICY "Super admins have full access" ON public.payroll_periods
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- payroll_records -------------------------------------------------------------
DROP POLICY IF EXISTS "Employees can view own payroll" ON public.payroll_records;
CREATE POLICY "Employees can view own payroll" ON public.payroll_records
  FOR SELECT USING (employee_id = public.get_employee_by_user(auth.uid()));

DROP POLICY IF EXISTS "Branch managers can view branch payroll" ON public.payroll_records;
CREATE POLICY "Branch managers can view branch payroll" ON public.payroll_records
  FOR SELECT USING (
    public.has_role(auth.uid(),'branch_manager')
    AND employee_id IN (SELECT id FROM public.employees WHERE branch_id = public.get_user_branch_id(auth.uid()))
  );

DROP POLICY IF EXISTS "HR can manage all payroll records" ON public.payroll_records;
CREATE POLICY "HR can manage all payroll records" ON public.payroll_records
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.payroll_records;
CREATE POLICY "Super admins have full access" ON public.payroll_records
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));


-- announcements ---------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can view published announcements" ON public.announcements;
CREATE POLICY "Authenticated can view published announcements" ON public.announcements
  FOR SELECT TO authenticated USING (is_published = true);

DROP POLICY IF EXISTS "HR can manage announcements" ON public.announcements;
CREATE POLICY "HR can manage announcements" ON public.announcements
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.announcements;
CREATE POLICY "Super admins have full access" ON public.announcements
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- notifications ---------------------------------------------------------------
DROP POLICY IF EXISTS "Users can manage own notifications" ON public.notifications;
CREATE POLICY "Users can manage own notifications" ON public.notifications
  FOR ALL USING (user_id = auth.uid());

-- settings --------------------------------------------------------------------
DROP POLICY IF EXISTS "Authenticated can view settings" ON public.settings;
CREATE POLICY "Authenticated can view settings" ON public.settings
  FOR SELECT TO authenticated
  USING (
    key IN ('company_info', 'lwp_config')
    OR public.is_admin(auth.uid())
  );

DROP POLICY IF EXISTS "HR can manage settings" ON public.settings;
CREATE POLICY "HR can manage settings" ON public.settings
  FOR ALL USING (public.has_role(auth.uid(),'hr_admin'));

DROP POLICY IF EXISTS "Super admins have full access" ON public.settings;
CREATE POLICY "Super admins have full access" ON public.settings
  FOR ALL TO authenticated
  USING (public.is_super_admin(auth.uid()))
  WITH CHECK (public.is_super_admin(auth.uid()));

-- password_reset_tokens: no policies on purpose (service_role only).


-- =============================================================================
-- 8. Storage buckets + object policies
-- =============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('employee-avatars','employee-avatars', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-certificates','medical-certificates', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Anyone can view employee avatars" ON storage.objects;
CREATE POLICY "Anyone can view employee avatars" ON storage.objects
  FOR SELECT USING (bucket_id = 'employee-avatars');

DROP POLICY IF EXISTS "HR can upload employee avatars" ON storage.objects;
CREATE POLICY "HR can upload employee avatars" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'employee-avatars' AND public.has_role(auth.uid(),'hr_admin')
  );

DROP POLICY IF EXISTS "HR can update employee avatars" ON storage.objects;
CREATE POLICY "HR can update employee avatars" ON storage.objects
  FOR UPDATE USING (
    bucket_id = 'employee-avatars' AND public.has_role(auth.uid(),'hr_admin')
  );

DROP POLICY IF EXISTS "HR can delete employee avatars" ON storage.objects;
CREATE POLICY "HR can delete employee avatars" ON storage.objects
  FOR DELETE USING (
    bucket_id = 'employee-avatars' AND public.has_role(auth.uid(),'hr_admin')
  );

DROP POLICY IF EXISTS "Users can upload their own medical certificates" ON storage.objects;
CREATE POLICY "Users can upload their own medical certificates" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'medical-certificates'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "Users can view their own medical certificates" ON storage.objects;
CREATE POLICY "Users can view their own medical certificates" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'medical-certificates'
    AND (auth.uid())::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS "HR can view all medical certificates" ON storage.objects;
CREATE POLICY "HR can view all medical certificates" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'medical-certificates' AND public.has_role(auth.uid(),'hr_admin')
  );


-- =============================================================================
-- 9. Seed data (idempotent)
-- =============================================================================

-- 9.1 Default leave types ----------------------------------------------------
INSERT INTO public.leave_types
  (name, description, default_credits, credits_per_application,
   max_days_per_application, calendar_config, required_fields, upload_condition_days, is_active)
VALUES
  ('Vacation Leave',   'For personal vacation time',           5, 1, 5, 'disable_past',   ARRAY['reason'],          NULL, true),
  ('Sick Leave',       'For illness or medical appointments',  5, 2, 5, 'disable_future', ARRAY['reason','upload'], 3,    true),
  ('Emergency Leave',  'For unexpected emergencies',           5, 2, 5, 'disable_past',   ARRAY['reason'],          NULL, true),
  ('Maternity/Paternity Leave', 'Maternity or paternity leave', 60, 1, 60, 'disable_past', ARRAY['reason','upload'], 0,  true),
  ('Bereavement Leave','For the loss of an immediate family member', 3, 1, 3, 'disable_past', ARRAY['reason'],     NULL, true),
  ('Unpaid Leave',     'Leave without pay',                    0, 1, NULL,'disable_past',   ARRAY['reason'],          NULL, true)
ON CONFLICT (name) DO NOTHING;

-- 9.2 Default role_permissions matrix ----------------------------------------
INSERT INTO public.role_permissions (role, permission_key, enabled) VALUES
  -- hr_admin: full access
  ('hr_admin','page_dashboard',true),
  ('hr_admin','page_employees',true),
  ('hr_admin','page_branches',true),
  ('hr_admin','page_attendance',true),
  ('hr_admin','page_clock_inout',true),
  ('hr_admin','page_leaves',true),
  ('hr_admin','page_payroll',true),
  ('hr_admin','page_my_payslips',true),
  ('hr_admin','page_my_schedule',true),
  ('hr_admin','page_reports',true),
  ('hr_admin','page_settings',true),
  -- branch_manager
  ('branch_manager','page_dashboard',true),
  ('branch_manager','page_employees',true),
  ('branch_manager','page_attendance',true),
  ('branch_manager','page_clock_inout',false),
  ('branch_manager','page_leaves',true),
  ('branch_manager','page_payroll',true),
  ('branch_manager','page_my_payslips',true),
  ('branch_manager','page_my_schedule',true),
  ('branch_manager','page_reports',true),
  -- employee
  ('employee','page_dashboard',true),
  ('employee','page_employees',false),
  ('employee','page_branches',false),
  ('employee','page_attendance',false),
  ('employee','page_clock_inout',true),
  ('employee','page_dtr',true),
  ('employee','page_leaves',true),
  ('employee','page_my_attendance',true),
  ('employee','page_my_payslips',true),
  ('employee','page_my_schedule',true),
  ('employee','page_payroll',false),
  ('employee','page_positions',false),
  ('employee','page_reports',false),
  ('employee','page_settings',false),
  ('employee','page_time_schedule',false)
ON CONFLICT (role, permission_key) DO NOTHING;

-- 9.3 Default salary components ----------------------------------------------
INSERT INTO public.salary_components (name, type, is_taxable, is_mandatory, description) VALUES
  ('SSS Contribution',         'deduction', false, true,  'Social Security System contribution'),
  ('PhilHealth Contribution',  'deduction', false, true,  'Philippine Health Insurance contribution'),
  ('Pag-IBIG Contribution',    'deduction', false, true,  'Home Development Mutual Fund contribution'),
  ('Meal Allowance',           'earning',   false, false, 'Daily meal allowance'),
  ('Rice Allowance',           'earning',   false, false, 'Monthly rice allowance'),
  ('Transportation Allowance', 'earning',   false, false, 'Monthly transportation allowance')
ON CONFLICT DO NOTHING;

-- 9.4 Default settings -------------------------------------------------------
INSERT INTO public.settings (key, value) VALUES
  ('company_info',        '{"company_name":"Migrants Venture Corporation","company_logo_url":null}'::jsonb),
  ('terminal',            '{"terminal_enabled":true,"allow_manual_entry":true,"grace_period_minutes":5,"work_start_time":"06:00","work_end_time":"20:00"}'::jsonb),
  ('benefit_rates',       '{"sss_contribution":250,"philhealth_rate":250,"pagibig_employee_rate":280}'::jsonb),
  ('payroll_deductions',  '{"sss_enabled":true,"philhealth_enabled":true,"pagibig_enabled":true}'::jsonb),
  ('lwp_config',          '{"paid_leave_credits":3,"refresh_months":1}'::jsonb)
ON CONFLICT (key) DO NOTHING;

-- =============================================================================
-- 9.5 Super Admin seed — MANUAL STEP
-- -----------------------------------------------------------------------------
-- Creating an auth.users row portably from SQL is not supported. After running
-- this migration, create the default Super Admin using the Supabase Admin API
-- (service role) — e.g. in an edge function or one-off script:
--
--   await supabase.auth.admin.createUser({
--     email: 'superadmin@migrantsventure.com',
--     password: 'Password',
--     email_confirm: true,
--   });
--   await supabase.from('user_roles').insert({ user_id, role: 'super_admin' });
--   await supabase.from('profiles').update({ must_change_password: true }).eq('id', user_id);
--
-- The profile row is created automatically by handle_new_user(); flip
-- must_change_password to true so the first login forces a password change.
-- =============================================================================

-- End of file
