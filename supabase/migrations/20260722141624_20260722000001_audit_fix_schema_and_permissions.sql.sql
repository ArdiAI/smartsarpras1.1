/*
# Audit Fix: Schema Alignment, RLS Fixes, and New Permissions

## Summary
This migration fixes critical bugs found during a full audit of the Smart Sarpras application:
1. Adds missing columns to `agendas` table (email, end_date, jumlah_peserta, jenis_kegiatan)
2. Fixes RLS INSERT policy on `borrowings` that blocked "Lainnya" (custom) items (inventory_id was required NOT NULL)
3. Fixes RLS INSERT policy on `damage_reports` that required inventory_id NOT NULL
4. Adds missing permissions for agenda, dashboard, timeline, and history modules
5. Grants history:delete permission to Super Admin role only
6. Adds anon INSERT policy on borrowing_items so public (not-logged-in) users can submit borrowings with custom items

## Changes

### 1. agendas table — new columns
- `email` (text, nullable) — email contact for the activity organizer
- `end_date` (date, nullable) — end date for multi-day activities
- `jumlah_peserta` (integer, nullable, default 0) — number of participants
- `jenis_kegiatan` (text, nullable) — activity type (Rapat, Upacara, etc.)

### 2. borrowings RLS fix
- The old INSERT policy required `inventory_id IS NOT NULL`.
  This blocked "Lainnya" (custom) borrowing items where inventory_id is NULL.
- New policy allows inventory_id to be NULL.

### 3. damage_reports RLS fix
- The old INSERT policy required `inventory_id IS NOT NULL`.
- New policy allows inventory_id to be NULL.

### 4. New permissions
- `agenda:read`, `dashboard:read`, `timeline:read`, `history:read`, `history:delete`

### 5. Role permissions
- Grant new read permissions to Super Admin and all admin roles
- Grant history:delete to Super Admin only
*/

-- 1. Add missing columns to agendas
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS email text DEFAULT '';
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS end_date date;
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS jumlah_peserta integer DEFAULT 0;
ALTER TABLE agendas ADD COLUMN IF NOT EXISTS jenis_kegiatan text DEFAULT '';

-- 2. Fix borrowings INSERT RLS policy to allow NULL inventory_id (for "Lainnya" custom items)
DROP POLICY IF EXISTS "Public can create borrowings with validation" ON borrowings;
CREATE POLICY "Public can create borrowings"
ON borrowings FOR INSERT
TO anon, authenticated
WITH CHECK (
  borrower_name IS NOT NULL
  AND borrower_name <> ''
  AND borrow_date IS NOT NULL
  AND return_date IS NOT NULL
);

-- 3. Fix damage_reports INSERT RLS policy to allow NULL inventory_id
DROP POLICY IF EXISTS "Public can create damage reports with validation" ON damage_reports;
CREATE POLICY "Public can create damage reports"
ON damage_reports FOR INSERT
TO anon, authenticated
WITH CHECK (
  reporter_name IS NOT NULL
  AND reporter_name <> ''
  AND description IS NOT NULL
  AND description <> ''
);

-- 4. Add missing permissions (permissions table has a NOT NULL label column)
INSERT INTO permissions (module, action, label, description) VALUES
  ('agenda', 'read', 'Agenda: Read', 'View agenda page'),
  ('dashboard', 'read', 'Dashboard: Read', 'View dashboard page'),
  ('timeline', 'read', 'Timeline: Read', 'View timeline page'),
  ('history', 'read', 'History: Read', 'View history page'),
  ('history', 'delete', 'History: Delete', 'Delete history records')
ON CONFLICT DO NOTHING;

-- 5. Grant new permissions to Super Admin role
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Super Admin'
  AND p.module IN ('agenda', 'dashboard', 'timeline', 'history')
  AND p.action IN ('read', 'delete')
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- 6. Grant read permissions to other admin roles
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('Staff Sarpras', 'Wakasek Kesiswaan', 'Admin', 'Operator', 'Pembina', 'Kepala Bengkel', 'PJ Barang', 'Penanggung Jawab Fasilitas')
  AND p.module IN ('agenda', 'dashboard', 'timeline', 'history')
  AND p.action = 'read'
  AND NOT EXISTS (
    SELECT 1 FROM role_permissions rp
    WHERE rp.role_id = r.id AND rp.permission_id = p.id
  );

-- 7. Add anon INSERT policy on borrowing_items
DROP POLICY IF EXISTS "bi_insert_anon" ON borrowing_items;
CREATE POLICY "bi_insert_anon"
ON borrowing_items FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- 8. Add anon INSERT policy on agendas (public can submit agendas)
DROP POLICY IF EXISTS "insert_agendas_anon" ON agendas;
CREATE POLICY "insert_agendas_anon"
ON agendas FOR INSERT
TO anon, authenticated
WITH CHECK (true);
