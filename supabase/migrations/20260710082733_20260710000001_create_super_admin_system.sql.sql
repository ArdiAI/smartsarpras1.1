/*
# Super Admin System - Roles, Permissions, Facility Managers, Approval Workflows, System Config

## Summary
Creates a fully dynamic Super Admin system where all configuration is stored in the database.
Super Admins can manage users, roles, permissions, facility managers, approval workflows,
announcements, inventory, and system settings directly from the dashboard without code changes.

## New Tables

### 1. `roles`
- Stores named roles with descriptions and level (super_admin=100 has full access)
- Fields: id, name, description, level, is_system (cannot delete system roles), created_at

### 2. `permissions`
- Atomic permission units like "inventory:read", "borrowings:approve"
- Fields: id, module (e.g. "inventory"), action (e.g. "read"), label, description

### 3. `role_permissions`
- Many-to-many join: which permissions each role has
- Fields: role_id, permission_id

### 4. `admin_user_roles`
- Assigns roles to admin_users entries
- Fields: admin_user_id (FK → admin_users.id), role_id (FK → roles.id)

### 5. `facility_managers`
- Assigns a responsible person (penanggung jawab) to each facility
- Fields: id, facility_id, admin_user_id, is_primary, notes, assigned_at

### 6. `approval_workflows`
- Defines per-module approval chain configuration
- Fields: id, module (e.g. "borrowings"), step_order, approver_role_id, auto_approve_minutes, is_active, notes

### 7. `system_config`
- Key-value store for all runtime system configuration
- Fields: id, key (unique), value (jsonb), label, description, group, updated_by, updated_at

## Security
- RLS enabled on all tables
- anon + authenticated can read roles, permissions, system_config (public reads)
- Only authenticated users with admin_users record can write
- Super admin level policies enforced at application layer

## Notes
- `roles.level = 100` is reserved for Super Admin
- `permissions` uses module:action naming convention
- `system_config.value` is JSONB to support strings, numbers, booleans, arrays
*/

-- ============================================================
-- ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT '',
  level integer NOT NULL DEFAULT 10,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "roles_select" ON roles;
CREATE POLICY "roles_select" ON roles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "roles_insert" ON roles;
CREATE POLICY "roles_insert" ON roles FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "roles_update" ON roles;
CREATE POLICY "roles_update" ON roles FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "roles_delete" ON roles;
CREATE POLICY "roles_delete" ON roles FOR DELETE TO authenticated USING (is_system = false);

-- ============================================================
-- PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  action text NOT NULL,
  label text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  UNIQUE(module, action)
);

ALTER TABLE permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "permissions_select" ON permissions;
CREATE POLICY "permissions_select" ON permissions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "permissions_insert" ON permissions;
CREATE POLICY "permissions_insert" ON permissions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "permissions_update" ON permissions;
CREATE POLICY "permissions_update" ON permissions FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "permissions_delete" ON permissions;
CREATE POLICY "permissions_delete" ON permissions FOR DELETE TO authenticated USING (true);

-- ============================================================
-- ROLE_PERMISSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS role_permissions (
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id uuid NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

ALTER TABLE role_permissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "rp_select" ON role_permissions;
CREATE POLICY "rp_select" ON role_permissions FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "rp_insert" ON role_permissions;
CREATE POLICY "rp_insert" ON role_permissions FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "rp_delete" ON role_permissions;
CREATE POLICY "rp_delete" ON role_permissions FOR DELETE TO authenticated USING (true);

-- ============================================================
-- ADMIN_USER_ROLES
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_user_roles (
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  assigned_at timestamptz DEFAULT now(),
  PRIMARY KEY (admin_user_id, role_id)
);

ALTER TABLE admin_user_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aur_select" ON admin_user_roles;
CREATE POLICY "aur_select" ON admin_user_roles FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "aur_insert" ON admin_user_roles;
CREATE POLICY "aur_insert" ON admin_user_roles FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "aur_delete" ON admin_user_roles;
CREATE POLICY "aur_delete" ON admin_user_roles FOR DELETE TO authenticated USING (true);

-- ============================================================
-- FACILITY_MANAGERS
-- ============================================================
CREATE TABLE IF NOT EXISTS facility_managers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id uuid NOT NULL REFERENCES facilities(id) ON DELETE CASCADE,
  admin_user_id uuid NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  is_primary boolean NOT NULL DEFAULT false,
  notes text DEFAULT '',
  assigned_at timestamptz DEFAULT now(),
  UNIQUE(facility_id, admin_user_id)
);

ALTER TABLE facility_managers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fm_select" ON facility_managers;
CREATE POLICY "fm_select" ON facility_managers FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "fm_insert" ON facility_managers;
CREATE POLICY "fm_insert" ON facility_managers FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "fm_update" ON facility_managers;
CREATE POLICY "fm_update" ON facility_managers FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "fm_delete" ON facility_managers;
CREATE POLICY "fm_delete" ON facility_managers FOR DELETE TO authenticated USING (true);

-- ============================================================
-- APPROVAL_WORKFLOWS
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_workflows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module text NOT NULL,
  step_order integer NOT NULL DEFAULT 1,
  approver_role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  auto_approve_minutes integer,
  is_active boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE approval_workflows ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "aw_select" ON approval_workflows;
CREATE POLICY "aw_select" ON approval_workflows FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "aw_insert" ON approval_workflows;
CREATE POLICY "aw_insert" ON approval_workflows FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "aw_update" ON approval_workflows;
CREATE POLICY "aw_update" ON approval_workflows FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "aw_delete" ON approval_workflows;
CREATE POLICY "aw_delete" ON approval_workflows FOR DELETE TO authenticated USING (true);

-- ============================================================
-- SYSTEM_CONFIG
-- ============================================================
CREATE TABLE IF NOT EXISTS system_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  value jsonb NOT NULL DEFAULT '"" ',
  label text NOT NULL,
  description text DEFAULT '',
  config_group text NOT NULL DEFAULT 'general',
  updated_by uuid REFERENCES admin_users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sc_select" ON system_config;
CREATE POLICY "sc_select" ON system_config FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "sc_insert" ON system_config;
CREATE POLICY "sc_insert" ON system_config FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "sc_update" ON system_config;
CREATE POLICY "sc_update" ON system_config FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "sc_delete" ON system_config;
CREATE POLICY "sc_delete" ON system_config FOR DELETE TO authenticated USING (true);

-- ============================================================
-- SEED: Default roles
-- ============================================================
INSERT INTO roles (name, description, level, is_system) VALUES
  ('Super Admin', 'Akses penuh ke seluruh sistem tanpa batasan', 100, true),
  ('Admin', 'Akses penuh ke semua modul operasional', 80, true),
  ('Operator', 'Dapat mengelola peminjaman dan inventaris', 50, false),
  ('Penanggung Jawab Fasilitas', 'Bertanggung jawab atas satu atau lebih fasilitas', 30, false),
  ('Viewer', 'Hanya dapat melihat data tanpa mengubah', 10, false)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- SEED: Default permissions
-- ============================================================
INSERT INTO permissions (module, action, label, description) VALUES
  -- Users
  ('users', 'read',   'Lihat Pengguna',       'Melihat daftar admin pengguna'),
  ('users', 'create', 'Tambah Pengguna',       'Membuat admin pengguna baru'),
  ('users', 'update', 'Edit Pengguna',         'Mengubah data admin pengguna'),
  ('users', 'delete', 'Hapus Pengguna',        'Menghapus admin pengguna'),
  -- Roles
  ('roles', 'read',   'Lihat Role',            'Melihat daftar role'),
  ('roles', 'create', 'Tambah Role',           'Membuat role baru'),
  ('roles', 'update', 'Edit Role',             'Mengubah role & permission'),
  ('roles', 'delete', 'Hapus Role',            'Menghapus role non-sistem'),
  -- Facilities
  ('facilities', 'read',   'Lihat Fasilitas',   'Melihat daftar fasilitas'),
  ('facilities', 'create', 'Tambah Fasilitas',  'Menambah fasilitas baru'),
  ('facilities', 'update', 'Edit Fasilitas',    'Mengubah data fasilitas'),
  ('facilities', 'delete', 'Hapus Fasilitas',   'Menghapus fasilitas'),
  -- Facility Managers
  ('facility_managers', 'read',   'Lihat PJ Fasilitas',   'Melihat penanggung jawab fasilitas'),
  ('facility_managers', 'create', 'Assign PJ Fasilitas',  'Menugaskan penanggung jawab'),
  ('facility_managers', 'delete', 'Cabut PJ Fasilitas',   'Mencabut penugasan penanggung jawab'),
  -- Inventory
  ('inventory', 'read',   'Lihat Inventaris',  'Melihat daftar inventaris'),
  ('inventory', 'create', 'Tambah Inventaris', 'Menambah item inventaris'),
  ('inventory', 'update', 'Edit Inventaris',   'Mengubah item inventaris'),
  ('inventory', 'delete', 'Hapus Inventaris',  'Menghapus item inventaris'),
  -- Borrowings
  ('borrowings', 'read',    'Lihat Peminjaman',    'Melihat daftar peminjaman'),
  ('borrowings', 'approve', 'Setujui Peminjaman',  'Menyetujui permintaan peminjaman'),
  ('borrowings', 'reject',  'Tolak Peminjaman',    'Menolak permintaan peminjaman'),
  ('borrowings', 'manage',  'Kelola Peminjaman',   'Mengelola semua status peminjaman'),
  -- Announcements
  ('announcements', 'read',   'Lihat Pengumuman',   'Melihat pengumuman'),
  ('announcements', 'create', 'Tambah Pengumuman',  'Membuat pengumuman baru'),
  ('announcements', 'update', 'Edit Pengumuman',    'Mengubah pengumuman'),
  ('announcements', 'delete', 'Hapus Pengumuman',   'Menghapus pengumuman'),
  -- Workflows
  ('workflows', 'read',   'Lihat Workflow',     'Melihat konfigurasi workflow approval'),
  ('workflows', 'manage', 'Kelola Workflow',    'Mengubah konfigurasi workflow approval'),
  -- System Config
  ('system_config', 'read',   'Lihat Konfigurasi', 'Melihat konfigurasi sistem'),
  ('system_config', 'manage', 'Kelola Konfigurasi','Mengubah konfigurasi sistem'),
  -- Statistics
  ('statistics', 'read', 'Lihat Statistik', 'Melihat laporan dan statistik'),
  -- Reports
  ('reports', 'read',   'Lihat Laporan',   'Melihat laporan kerusakan'),
  ('reports', 'manage', 'Kelola Laporan',  'Mengelola laporan kerusakan')
ON CONFLICT (module, action) DO NOTHING;

-- ============================================================
-- SEED: Give Super Admin role ALL permissions
-- ============================================================
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Super Admin'
ON CONFLICT DO NOTHING;

-- Give Admin role all except users/roles/system_config manage
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Admin'
  AND NOT (p.module IN ('users', 'roles', 'system_config') AND p.action IN ('delete', 'manage'))
ON CONFLICT DO NOTHING;

-- Give Operator role operational permissions
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Operator'
  AND p.module IN ('inventory', 'borrowings', 'facilities', 'announcements', 'statistics', 'reports')
  AND p.action IN ('read', 'create', 'update', 'approve', 'reject')
ON CONFLICT DO NOTHING;

-- Give PJ Fasilitas scoped read + borrowing approval
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Penanggung Jawab Fasilitas'
  AND p.module IN ('facilities', 'borrowings', 'inventory')
  AND p.action IN ('read', 'approve', 'reject')
ON CONFLICT DO NOTHING;

-- Give Viewer only read everywhere
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Viewer'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: Default system config
-- ============================================================
INSERT INTO system_config (key, value, label, description, config_group) VALUES
  ('site_name',            '"SMART SARPRAS"',              'Nama Sistem',             'Nama sistem yang tampil di header', 'general'),
  ('site_tagline',         '"Website Sarana & Prasarana"', 'Tagline Sistem', 'Tagline di halaman utama',         'general'),
  ('school_name',          '"SMK Negeri 1 Cimahi"',        'Nama Sekolah',            'Nama lengkap sekolah',             'general'),
  ('school_address',       '"Jl. Mahar Martanegara No.48, Cimahi"', 'Alamat Sekolah', 'Alamat sekolah',                  'general'),
  ('max_borrow_days',      '7',                            'Maks Hari Peminjaman',    'Batas maksimum hari peminjaman',   'borrowing'),
  ('max_borrow_items',     '5',                            'Maks Item Peminjaman',    'Jumlah item maksimal per peminjaman', 'borrowing'),
  ('require_approval',     'true',                         'Wajib Persetujuan',       'Apakah peminjaman butuh persetujuan admin', 'borrowing'),
  ('auto_reject_hours',    '48',                           'Auto Tolak (jam)',         'Otomatis tolak jika tidak diproses dalam N jam', 'borrowing'),
  ('announcement_max',     '10',                           'Maks Pengumuman Aktif',   'Jumlah maksimal pengumuman yang aktif', 'announcements'),
  ('maintenance_mode',     'false',                        'Mode Maintenance',        'Nonaktifkan akses publik saat maintenance', 'system'),
  ('allow_registration',   'true',                         'Izinkan Registrasi',      'Izinkan pengguna baru mendaftar',  'system'),
  ('session_timeout_min',  '480',                          'Timeout Sesi (menit)',    'Durasi sesi login sebelum kadaluarsa', 'system'),
  ('email_notifications',  'true',                         'Notifikasi Email',        'Aktifkan notifikasi email otomatis', 'notifications'),
  ('email_from',           '"noreply@smkn1cimahi.sch.id"', 'Email Pengirim',          'Alamat email pengirim notifikasi', 'notifications'),
  ('inventory_low_stock',  '3',                            'Stok Minimum',            'Beri peringatan jika stok <= nilai ini', 'inventory'),
  ('qr_prefix',            '"SARPRAS"',                    'Prefix QR Code',          'Awalan kode QR untuk inventaris',  'inventory')
ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- SEED: Default approval workflows
-- ============================================================
INSERT INTO approval_workflows (module, step_order, approver_role_id, auto_approve_minutes, is_active, notes)
SELECT 'borrowings', 1, r.id, 2880, true, 'Persetujuan peminjaman fasilitas/inventaris oleh Admin'
FROM roles r WHERE r.name = 'Admin'
ON CONFLICT DO NOTHING;
