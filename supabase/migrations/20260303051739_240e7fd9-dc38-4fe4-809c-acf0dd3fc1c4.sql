-- Change leave_credits.leave_type from enum to text to support custom leave types
ALTER TABLE public.leave_credits 
  ALTER COLUMN leave_type TYPE text USING leave_type::text;

-- Update existing leave_credits to use leave type names instead of enum values
-- Map existing enum values back to their display names
UPDATE public.leave_credits SET leave_type = 'Sick Leave' WHERE leave_type = 'sick';
UPDATE public.leave_credits SET leave_type = 'Vacation Leave' WHERE leave_type = 'vacation';
UPDATE public.leave_credits SET leave_type = 'Emergency Leave' WHERE leave_type = 'emergency';
UPDATE public.leave_credits SET leave_type = 'Maternity/Paternity Leave' WHERE leave_type = 'maternity';
UPDATE public.leave_credits SET leave_type = 'Bereavement Leave' WHERE leave_type = 'bereavement';
UPDATE public.leave_credits SET leave_type = 'Unpaid Leave' WHERE leave_type = 'unpaid';
UPDATE public.leave_credits SET leave_type = 'Paternity Leave' WHERE leave_type = 'paternity';