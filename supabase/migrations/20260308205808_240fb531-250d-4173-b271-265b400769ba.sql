INSERT INTO role_permissions (role, permission_key, enabled)
VALUES 
  ('hr_admin', 'page_my_schedule', true),
  ('branch_manager', 'page_my_schedule', true),
  ('employee', 'page_my_schedule', true)
ON CONFLICT DO NOTHING;