-- Add missing module permissions for team, aspirasi, and approver_emails
-- These modules exist in the admin UI but had no permission rows, so RBAC could not gate them.

INSERT INTO permissions (module, action, label, description) VALUES
  ('team', 'create', 'Tambah Tim', 'Menambah anggota tim'),
  ('team', 'read',   'Lihat Tim',  'Melihat daftar tim'),
  ('team', 'update', 'Edit Tim',   'Mengubah anggota tim'),
  ('team', 'delete', 'Hapus Tim',  'Menghapus anggota tim'),
  ('aspirasi', 'read',   'Lihat Aspirasi',  'Melihat aspirasi'),
  ('aspirasi', 'update', 'Tanggapi Aspirasi','Menanggapi aspirasi'),
  ('approver_emails', 'create', 'Tambah Email Approver', 'Menambah email approver'),
  ('approver_emails', 'read',   'Lihat Email Approver',  'Melihat email approver'),
  ('approver_emails', 'update', 'Edit Email Approver',  'Mengubah email approver'),
  ('approver_emails', 'delete', 'Hapus Email Approver', 'Menghapus email approver')
ON CONFLICT DO NOTHING;

-- Grant team + aspirasi permissions to Admin and Super Admin (they already manage most modules)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name IN ('Admin', 'Super Admin')
  AND p.module IN ('team', 'aspirasi', 'approver_emails')
ON CONFLICT DO NOTHING;

-- Grant read on team + aspirasi to Viewer (read-only role)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'Viewer'
  AND p.module IN ('team', 'aspirasi')
  AND p.action = 'read'
ON CONFLICT DO NOTHING;

-- Grant approver_emails management to Super Admin only (already covered above, but ensure)
-- (No extra insert needed; Super Admin already covered by the cross join above.)
