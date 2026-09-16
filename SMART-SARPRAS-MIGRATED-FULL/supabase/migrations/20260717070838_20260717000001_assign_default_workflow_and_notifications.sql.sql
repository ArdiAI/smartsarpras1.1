-- Assign default "Workflow Sarpras" to all facilities that don't have a workflow
UPDATE facilities 
SET workflow_template_id = (SELECT id FROM workflow_templates WHERE name = 'Workflow Sarpras' LIMIT 1)
WHERE workflow_template_id IS NULL;

-- Add notification system config keys (value column is jsonb, label is NOT NULL)
INSERT INTO system_config (key, value, label, config_group, description)
VALUES 
  ('email_enabled', 'true'::jsonb, 'Email Enabled', 'notifications', 'Aktifkan notifikasi email'),
  ('notify_on_new_request', 'true'::jsonb, 'Notify On New Request', 'notifications', 'Notifikasi approver pertama saat pengajuan baru'),
  ('notify_on_step_advance', 'true'::jsonb, 'Notify On Step Advance', 'notifications', 'Notifikasi approver berikutnya saat step diterima'),
  ('notify_borrower_on_step', 'true'::jsonb, 'Notify Borrower On Step', 'notifications', 'Notifikasi peminjam di setiap tahap persetujuan'),
  ('notify_borrower_on_final', 'true'::jsonb, 'Notify Borrower On Final', 'notifications', 'Notifikasi peminjam saat disetujui/ditolak'),
  ('default_workflow_template', '"Workflow Sarpras"'::jsonb, 'Default Workflow Template', 'borrowing', 'Template workflow default untuk peminjaman')
ON CONFLICT (key) DO NOTHING;
