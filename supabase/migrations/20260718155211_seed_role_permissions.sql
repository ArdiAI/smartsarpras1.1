/*
# Seed Default Role Permissions

## Purpose
Populate the `role_permissions` junction table so every built-in role has a
working set of permissions immediately after migration. This removes the need
for any manual SQL editing — all default roles become usable on first login.

## Changes
- Inserts role_permissions rows for every built-in role using
  `ON CONFLICT DO NOTHING` (idempotent, safe to re-run).
- Existing role_permissions rows are preserved; only missing ones are added.

## Role → Permission mapping
- Super Admin (level 100) → ALL 44 permissions
- Admin (level 80)        → all except system_config:manage, roles:delete, users:delete
- Operator (level 50)     → inventory (CRUD), facilities (CRUD), announcements (CRUD), reports (read+manage), statistics:read, borrowings:read
- Pembina (level 60)      → borrowings:read, borrowings:approve, borrowings:reject
- Wakasek Kesiswaan (85)  → borrowings:read, borrowings:approve
- Wakasek Sarpras (90)    → borrowings:read, borrowings:approve, borrowings:manage, statistics:read
- PJ Fasilitas (30)       → borrowings:read, borrowings:approve, facilities:read
- PJ Barang (30)          → borrowings:read, borrowings:approve, inventory:read
- Viewer (10)             → all :read permissions
- Guru (40)               → borrowings:read, inventory:read, facilities:read, statistics:read
- Siswa (20)              → borrowings:read, facilities:read, inventory:read
- Kepala Bengkel (55)     → inventory:read, borrowings:read, borrowings:approve, reports:read

## Notes
- Re-running this migration is safe — ON CONFLICT DO NOTHING skips duplicates.
- Super Admin can still adjust any role's permissions from the dashboard.
*/

-- Helper: insert a role's permissions by module:action list.
-- Uses a DO block to avoid repeating INSERT statements per role.
DO $$
DECLARE
  r_super_admin uuid;
  r_admin uuid;
  r_operator uuid;
  r_pembina uuid;
  r_wakasiswaan uuid;
  r_wakasarpras uuid;
  r_pj_fasilitas uuid;
  r_pj_barang uuid;
  r_viewer uuid;
  r_guru uuid;
  r_siswa uuid;
  r_kepala_bengkel uuid;
BEGIN
  SELECT id INTO r_super_admin    FROM roles WHERE name = 'Super Admin';
  SELECT id INTO r_admin          FROM roles WHERE name = 'Admin';
  SELECT id INTO r_operator       FROM roles WHERE name = 'Operator';
  SELECT id INTO r_pembina        FROM roles WHERE name = 'Pembina';
  SELECT id INTO r_wakasiswaan    FROM roles WHERE name = 'Wakasek Kesiswaan';
  SELECT id INTO r_wakasarpras   FROM roles WHERE name = 'Wakasek Sarpras';
  SELECT id INTO r_pj_fasilitas   FROM roles WHERE name = 'Penanggung Jawab Fasilitas';
  SELECT id INTO r_pj_barang      FROM roles WHERE name = 'PJ Barang';
  SELECT id INTO r_viewer         FROM roles WHERE name = 'Viewer';
  SELECT id INTO r_guru           FROM roles WHERE name = 'Guru';
  SELECT id INTO r_siswa          FROM roles WHERE name = 'Siswa';
  SELECT id INTO r_kepala_bengkel FROM roles WHERE name = 'Kepala Bengkel';

  -- Super Admin → ALL permissions
  IF r_super_admin IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_super_admin, p.id FROM permissions p
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Admin → all EXCEPT system_config:manage, roles:delete, users:delete
  IF r_admin IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_admin, p.id FROM permissions p
    WHERE NOT (p.module = 'system_config' AND p.action = 'manage')
      AND NOT (p.module = 'roles' AND p.action = 'delete')
      AND NOT (p.module = 'users' AND p.action = 'delete')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Operator → inventory(CRUD), facilities(CRUD), announcements(CRUD), reports(read+manage), statistics:read, borrowings:read
  IF r_operator IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_operator, p.id FROM permissions p
    WHERE (p.module = 'inventory')
       OR (p.module = 'facilities')
       OR (p.module = 'announcements')
       OR (p.module = 'reports' AND p.action IN ('read','manage'))
       OR (p.module = 'statistics' AND p.action = 'read')
       OR (p.module = 'borrowings' AND p.action = 'read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Pembina → borrowings:read, borrowings:approve, borrowings:reject
  IF r_pembina IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_pembina, p.id FROM permissions p
    WHERE p.module = 'borrowings' AND p.action IN ('read','approve','reject')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Wakasek Kesiswaan → borrowings:read, borrowings:approve
  IF r_wakasiswaan IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_wakasiswaan, p.id FROM permissions p
    WHERE p.module = 'borrowings' AND p.action IN ('read','approve')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Wakasek Sarpras → borrowings:read, borrowings:approve, borrowings:manage, statistics:read
  IF r_wakasarpras IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_wakasarpras, p.id FROM permissions p
    WHERE (p.module = 'borrowings' AND p.action IN ('read','approve','manage'))
       OR (p.module = 'statistics' AND p.action = 'read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- PJ Fasilitas → borrowings:read, borrowings:approve, facilities:read
  IF r_pj_fasilitas IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_pj_fasilitas, p.id FROM permissions p
    WHERE (p.module = 'borrowings' AND p.action IN ('read','approve'))
       OR (p.module = 'facilities' AND p.action = 'read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- PJ Barang → borrowings:read, borrowings:approve, inventory:read
  IF r_pj_barang IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_pj_barang, p.id FROM permissions p
    WHERE (p.module = 'borrowings' AND p.action IN ('read','approve'))
       OR (p.module = 'inventory' AND p.action = 'read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Viewer → all :read permissions
  IF r_viewer IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_viewer, p.id FROM permissions p
    WHERE p.action = 'read'
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Guru → borrowings:read, inventory:read, facilities:read, statistics:read
  IF r_guru IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_guru, p.id FROM permissions p
    WHERE (p.module = 'borrowings' AND p.action = 'read')
       OR (p.module = 'inventory' AND p.action = 'read')
       OR (p.module = 'facilities' AND p.action = 'read')
       OR (p.module = 'statistics' AND p.action = 'read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Siswa → borrowings:read, facilities:read, inventory:read
  IF r_siswa IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_siswa, p.id FROM permissions p
    WHERE (p.module = 'borrowings' AND p.action = 'read')
       OR (p.module = 'facilities' AND p.action = 'read')
       OR (p.module = 'inventory' AND p.action = 'read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;

  -- Kepala Bengkel → inventory:read, borrowings:read, borrowings:approve, reports:read
  IF r_kepala_bengkel IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r_kepala_bengkel, p.id FROM permissions p
    WHERE (p.module = 'inventory' AND p.action = 'read')
       OR (p.module = 'borrowings' AND p.action IN ('read','approve'))
       OR (p.module = 'reports' AND p.action = 'read')
    ON CONFLICT (role_id, permission_id) DO NOTHING;
  END IF;
END $$;
