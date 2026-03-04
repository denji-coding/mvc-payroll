
-- Add new configuration columns to leave_types
ALTER TABLE public.leave_types
  ADD COLUMN IF NOT EXISTS credits_per_application numeric NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS max_days_per_application numeric NULL,
  ADD COLUMN IF NOT EXISTS calendar_config text NOT NULL DEFAULT 'disable_past',
  ADD COLUMN IF NOT EXISTS required_fields text[] NOT NULL DEFAULT '{"reason"}',
  ADD COLUMN IF NOT EXISTS upload_condition_days numeric NULL;
