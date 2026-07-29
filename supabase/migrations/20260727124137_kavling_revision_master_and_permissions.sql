/*
# Kavling revision: master kelas/eskul, status enum, permissions

1. New Tables
- `master_kelas` — daftar kelas yang dikelola Admin/Super Admin.
  - id (uuid PK), nama (text UNIQUE NOT NULL), is_active (bool default true), created_at, updated_at
- `master_ekstrakurikuler` — daftar ekstrakurikuler yang dikelola Admin/Super Admin.
  - id (uuid PK), nama (text UNIQUE NOT NULL), is_active (bool default true), created_at, updated_at

2. Modified Tables
- `kavling` — perubahan status values:
  - Status lama: 'Menunggu' | 'Selesai' | 'Ditolak'
  - Status baru: 'Menunggu Verifikasi' | 'Diverifikasi' | 'Ditolak'
  - Update CHECK constraint dan default ke 'Menunggu Verifikasi'.
  - Update data lama: 'Menunggu' -> 'Menunggu Verifikasi', 'Selesai' -> 'Diverifikasi'.
  - Kolom `nama_kategori` tetap (menyimpan nama kelas/eskul/unit; untuk Kelas & Eskul nilainya sama dengan master, untuk Unit bebas teks).

3. Security
- RLS pada master_kelas & master_ekstrakurikuler:
  - SELECT: TO anon, authenticated USING (true) — publik agar form bisa pilih.
  - INSERT/UPDATE/DELETE: TO authenticated USING (true) — Admin/Super Admin kelola.
- RLS kavling tidak diubah (sudah ada dari migration sebelumnya).

4. New Permissions (module: action)
- kavling:read    — Lihat Data Kavling
- kavling:create  — Input Kavling
- kavling:update  — Edit Data Kavling (termasuk catatan & hasil)
- kavling:verify  — Verifikasi / Tolak / Ubah status
- kavling:delete  — Hapus Data Kavling
- master_data:read   — Lihat Master Kelas & Ekstrakurikuler
- master_data:manage — Kelola Master Kelas & Ekstrakurikuler

5. Role Permission Assignments
- Super Admin: semua permission kavling + master_data (sudah otomatis dapat semua via seed, tapi eksplisit di sini).
- Admin: semua kavling + master_data.
- PJ Sarpras: kavling:read, kavling:update, kavling:verify (verifikasi, tolak, edit, edit catatan, edit hasil).
- Wakasek Kesiswaan: kavling:read (lihat data, statistik, detail — tidak edit/hapus/verifikasi).
- Siswa: kavling:create (hanya input).
- Viewer: kavling:read.

6. Notes
- Tidak mengubah tabel lain (workflow, borrowings, inventory, agenda, timeline, auth, logs, dll).
- Unit tetap menggunakan textbox biasa (tidak ada master unit) — nama unit bebas.
- Master Kelas & Master Ekstrakurikuler dikelola Admin/Super Admin.
*/

-- ============================================================
-- Master Kelas
-- ============================================================
CREATE TABLE IF NOT EXISTS master_kelas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE master_kelas ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "master_kelas_select" ON master_kelas;
CREATE POLICY "master_kelas_select" ON master_kelas FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "master_kelas_insert" ON master_kelas;
CREATE POLICY "master_kelas_insert" ON master_kelas FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "master_kelas_update" ON master_kelas;
CREATE POLICY "master_kelas_update" ON master_kelas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "master_kelas_delete" ON master_kelas;
CREATE POLICY "master_kelas_delete" ON master_kelas FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Master Ekstrakurikuler
-- ============================================================
CREATE TABLE IF NOT EXISTS master_ekstrakurikuler (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text UNIQUE NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
ALTER TABLE master_ekstrakurikuler ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "master_ekstrakurikuler_select" ON master_ekstrakurikuler;
CREATE POLICY "master_ekstrakurikuler_select" ON master_ekstrakurikuler FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "master_ekstrakurikuler_insert" ON master_ekstrakurikuler;
CREATE POLICY "master_ekstrakurikuler_insert" ON master_ekstrakurikuler FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "master_ekstrakurikuler_update" ON master_ekstrakurikuler;
CREATE POLICY "master_ekstrakurikuler_update" ON master_ekstrakurikuler FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "master_ekstrakurikuler_delete" ON master_ekstrakurikuler;
CREATE POLICY "master_ekstrakurikuler_delete" ON master_ekstrakurikuler FOR DELETE TO authenticated USING (true);

-- ============================================================
-- Kavling: update status values
-- ============================================================
-- Migrate existing data to new status values (idempotent)
UPDATE kavling SET status = 'Menunggu Verifikasi' WHERE status = 'Menunggu';
UPDATE kavling SET status = 'Diverifikasi' WHERE status = 'Selesai';

-- Replace the CHECK constraint with the new allowed values
ALTER TABLE kavling DROP CONSTRAINT IF EXISTS kavling_status_check;
DO $$ BEGIN
  ALTER TABLE kavling ADD CONSTRAINT kavling_status_check
    CHECK (status IN ('Menunggu Verifikasi', 'Diverifikasi', 'Ditolak'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Update default
ALTER TABLE kavling ALTER COLUMN status SET DEFAULT 'Menunggu Verifikasi';

-- ============================================================
-- New permissions
-- ============================================================
INSERT INTO permissions (module, action, label, description) VALUES
  ('kavling', 'read',   'Lihat Data Kavling',     'Melihat daftar & detail data kavling'),
  ('kavling', 'create', 'Input Kavling',          'Menginput data kavling baru'),
  ('kavling', 'update', 'Edit Data Kavling',      'Mengedit data, catatan, dan hasil kavling'),
  ('kavling', 'verify', 'Verifikasi Kavling',     'Verifikasi, tolak, dan ubah status kavling'),
  ('kavling', 'delete', 'Hapus Data Kavling',     'Menghapus data kavling'),
  ('master_data', 'read',   'Lihat Master Data',  'Melihat master kelas & ekstrakurikuler'),
  ('master_data', 'manage', 'Kelola Master Data', 'Menambah/mengubah/menghapus master kelas & ekstrakurikuler')
ON CONFLICT (module, action) DO NOTHING;

-- ============================================================
-- Role permission assignments
-- ============================================================
-- Super Admin: all kavling + master_data (explicit, in addition to existing catch-all)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Super Admin'
  AND p.module IN ('kavling', 'master_data')
ON CONFLICT DO NOTHING;

-- Admin: all kavling + master_data
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Admin'
  AND p.module IN ('kavling', 'master_data')
ON CONFLICT DO NOTHING;

-- PJ Sarpras: read, update, verify (verifikasi, tolak, edit, edit catatan, edit hasil)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'PJ Sarpras'
  AND p.module = 'kavling'
  AND p.action IN ('read', 'update', 'verify')
ON CONFLICT DO NOTHING;

-- Wakasek Kesiswaan: read only (lihat data, statistik, detail — no edit/delete/verify)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Wakasek Kesiswaan'
  AND p.module = 'kavling'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;

-- Siswa: create only (input kavling)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Siswa'
  AND p.module = 'kavling'
  AND p.action = 'create'
ON CONFLICT DO NOTHING;

-- Viewer: read
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name = 'Viewer'
  AND p.module = 'kavling'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;

-- PJ Sarpras & Wakasek Kesiswaan also need master_data:read to populate dropdowns
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r, permissions p
WHERE r.name IN ('PJ Sarpras', 'Wakasek Kesiswaan', 'Siswa')
  AND p.module = 'master_data'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;

-- Seed a few sample master rows so dropdowns aren't empty on first load
INSERT INTO master_kelas (nama) VALUES
  ('X Mekatronika A'), ('X Mekatronika B'), ('XI Mekatronika A'), ('XI Mekatronika B'),
  ('X TKJ A'), ('X TKJ B'), ('XI TKJ A'), ('XI TKJ B'),
  ('X RPL A'), ('XI RPL A'), ('X TO A'), ('XI TO A')
ON CONFLICT (nama) DO NOTHING;

INSERT INTO master_ekstrakurikuler (nama) VALUES
  ('PMR'), ('Paskibra'), ('Pramuka'), ('OSIS'), ('MPK'), ('Rohis'), ('Futsal'), ('Basket')
ON CONFLICT (nama) DO NOTHING;
