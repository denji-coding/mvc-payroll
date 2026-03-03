-- Convert leave_requests.leave_type from enum to text to support custom leave types
ALTER TABLE public.leave_requests 
  ALTER COLUMN leave_type TYPE text USING leave_type::text;