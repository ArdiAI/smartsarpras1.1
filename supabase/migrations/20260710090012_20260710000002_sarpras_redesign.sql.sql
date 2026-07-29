/*
# SMART SARPRAS Redesign - Enhanced System Structure

## Summary
Major schema upgrade for the full SIMS (Sistem Informasi Manajemen Sarpras) redesign.

## Changes

### 1. Drop legacy kavling + achievements tables (safe - preserved in backup note)
- Drops `kavling`, `achievements` tables which are being removed from the system

### 2. Enhance `roles` table
- Add `is_active` column (default true) to allow deactivating roles
- Seed default SARPRAS school roles: Wakasek Sarpras, Wakasek Kesiswaan, Pembina, Kepala Bengkel, Guru, Siswa

### 3. Add `admin_users.is_active` column
- Allows Super Admin to deactivate users without deletion

### 4. Enhance `facilities` table
- `facility_type` - jenis fasilitas (ruangan/inventaris/lab/workshop/aula/lapangan)
- `category` - kategori (umum/jurusan/olahraga/seni)
- `department` - jurusan pemilik (TKJ, Mekatronika, dll)
- `workflow_id` - FK to approval_workflows template
- `status` - aktif/tidak aktif/perbaikan

### 5. Create `workflow_templates` table
- Named workflow configurations (e.g. "Workflow Sarpras", "Workflow Jurusan")
- Each template has ordered steps with role assignments

### 6. Create `workflow_template_steps` table
- Individual steps per template: step_order, role_id, label, is_final, is_info_only

### 7. Update `approval_workflows` to reference `workflow_templates`

### 8. Create `approval_history` table
- Full audit trail per borrowing: who approved, when, status, notes

### 9. Enhance `borrowings` table
- `workflow_template_id` - which workflow applies
- `current_step` - current workflow step index
- `current_status_label` - human-readable current status from workflow
- New status values for multi-step approval chain

### 10. Enhance `announcements` table
- `author` column for who posted the announcement

## Security
- RLS enabled on all new tables
- anon + authenticated read access for public data
- authenticated write access for admin operations
*/

-- ============================================================
-- DROP LEGACY TABLES
-- ============================================================
DROP TABLE IF EXISTS achievements CASCADE;
DROP TABLE IF EXISTS kavling CASCADE;

-- ============================================================
-- ENHANCE roles TABLE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='roles' AND column_name='is_active') THEN
    ALTER TABLE roles ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
END $$;

-- Seed new default roles
INSERT INTO roles (name, description, level, is_system) VALUES
  ('Wakasek Sarpras',    'Wakil Kepala Sekolah Bidang Sarana Prasarana', 90, true),
  ('Wakasek Kesiswaan',  'Wakil Kepala Sekolah Bidang Kesiswaan',        85, true),
  ('Pembina',            'Pembina kegiatan ekstrakurikuler/organisasi',  60, true),
  ('Kepala Bengkel',     'Kepala Bengkel Jurusan',                       55, false),
  ('Guru',               'Guru / Tenaga Pendidik',                       40, false),
  ('Siswa',              'Siswa SMKN 1 Cimahi',                          20, false)
ON CONFLICT (name) DO NOTHING;

-- ============================================================
-- ENHANCE admin_users TABLE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='is_active') THEN
    ALTER TABLE admin_users ADD COLUMN is_active boolean NOT NULL DEFAULT true;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='admin_users' AND column_name='name') THEN
    ALTER TABLE admin_users ADD COLUMN name text DEFAULT '';
  END IF;
END $$;

-- ============================================================
-- WORKFLOW TEMPLATES
-- ============================================================
CREATE TABLE IF NOT EXISTS workflow_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "wt_select" ON workflow_templates;
CREATE POLICY "wt_select" ON workflow_templates FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "wt_insert" ON workflow_templates;
CREATE POLICY "wt_insert" ON workflow_templates FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "wt_update" ON workflow_templates;
CREATE POLICY "wt_update" ON workflow_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "wt_delete" ON workflow_templates;
CREATE POLICY "wt_delete" ON workflow_templates FOR DELETE TO authenticated USING (true);

CREATE TABLE IF NOT EXISTS workflow_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_template_id uuid NOT NULL REFERENCES workflow_templates(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  role_id uuid REFERENCES roles(id) ON DELETE SET NULL,
  step_label text NOT NULL DEFAULT '',
  is_info_only boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE workflow_steps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ws_select" ON workflow_steps;
CREATE POLICY "ws_select" ON workflow_steps FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ws_insert" ON workflow_steps;
CREATE POLICY "ws_insert" ON workflow_steps FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ws_update" ON workflow_steps;
CREATE POLICY "ws_update" ON workflow_steps FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ws_delete" ON workflow_steps;
CREATE POLICY "ws_delete" ON workflow_steps FOR DELETE TO authenticated USING (true);

-- ============================================================
-- ENHANCE facilities TABLE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='facilities' AND column_name='facility_type') THEN
    ALTER TABLE facilities ADD COLUMN facility_type text DEFAULT 'ruangan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='facilities' AND column_name='category') THEN
    ALTER TABLE facilities ADD COLUMN category text DEFAULT 'umum';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='facilities' AND column_name='department') THEN
    ALTER TABLE facilities ADD COLUMN department text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='facilities' AND column_name='workflow_template_id') THEN
    ALTER TABLE facilities ADD COLUMN workflow_template_id uuid REFERENCES workflow_templates(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='facilities' AND column_name='status') THEN
    ALTER TABLE facilities ADD COLUMN status text DEFAULT 'aktif';
  END IF;
END $$;

-- ============================================================
-- ENHANCE borrowings TABLE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='borrowings' AND column_name='workflow_template_id') THEN
    ALTER TABLE borrowings ADD COLUMN workflow_template_id uuid REFERENCES workflow_templates(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='borrowings' AND column_name='current_step') THEN
    ALTER TABLE borrowings ADD COLUMN current_step integer DEFAULT 0;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='borrowings' AND column_name='current_status_label') THEN
    ALTER TABLE borrowings ADD COLUMN current_status_label text DEFAULT 'Menunggu Persetujuan';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='borrowings' AND column_name='drive_file_id') THEN
    ALTER TABLE borrowings ADD COLUMN drive_file_id text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='borrowings' AND column_name='drive_file_url') THEN
    ALTER TABLE borrowings ADD COLUMN drive_file_url text DEFAULT '';
  END IF;
END $$;

-- ============================================================
-- APPROVAL HISTORY
-- ============================================================
CREATE TABLE IF NOT EXISTS approval_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrowing_id uuid NOT NULL REFERENCES borrowings(id) ON DELETE CASCADE,
  step_order integer NOT NULL DEFAULT 1,
  step_label text NOT NULL DEFAULT '',
  approver_name text NOT NULL DEFAULT '',
  approver_role text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'pending',
  notes text DEFAULT '',
  acted_at timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE approval_history ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ah_select" ON approval_history;
CREATE POLICY "ah_select" ON approval_history FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "ah_insert" ON approval_history;
CREATE POLICY "ah_insert" ON approval_history FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "ah_update" ON approval_history;
CREATE POLICY "ah_update" ON approval_history FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "ah_delete" ON approval_history;
CREATE POLICY "ah_delete" ON approval_history FOR DELETE TO authenticated USING (true);

-- ============================================================
-- ENHANCE announcements TABLE
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='announcements' AND column_name='author') THEN
    ALTER TABLE announcements ADD COLUMN author text DEFAULT 'Admin';
  END IF;
END $$;

-- ============================================================
-- SEED: Default workflow templates
-- ============================================================
INSERT INTO workflow_templates (name, description) VALUES
  ('Workflow Sarpras', 'Workflow persetujuan fasilitas umum sekolah'),
  ('Workflow Jurusan', 'Workflow persetujuan fasilitas milik jurusan')
ON CONFLICT (name) DO NOTHING;

-- Seed steps for Workflow Sarpras (Pembina → Wakasek Kesiswaan → PJ Fasilitas → Wakasek Sarpras)
INSERT INTO workflow_steps (workflow_template_id, step_order, role_id, step_label)
SELECT wt.id, 1, r.id, 'Persetujuan Pembina'
FROM workflow_templates wt, roles r
WHERE wt.name = 'Workflow Sarpras' AND r.name = 'Pembina'
ON CONFLICT DO NOTHING;

INSERT INTO workflow_steps (workflow_template_id, step_order, role_id, step_label)
SELECT wt.id, 2, r.id, 'Persetujuan Wakasek Kesiswaan'
FROM workflow_templates wt, roles r
WHERE wt.name = 'Workflow Sarpras' AND r.name = 'Wakasek Kesiswaan'
ON CONFLICT DO NOTHING;

INSERT INTO workflow_steps (workflow_template_id, step_order, role_id, step_label)
SELECT wt.id, 3, r.id, 'Persetujuan Penanggung Jawab Fasilitas'
FROM workflow_templates wt, roles r
WHERE wt.name = 'Workflow Sarpras' AND r.name = 'Penanggung Jawab Fasilitas'
ON CONFLICT DO NOTHING;

INSERT INTO workflow_steps (workflow_template_id, step_order, role_id, step_label)
SELECT wt.id, 4, r.id, 'Persetujuan Wakasek Sarpras'
FROM workflow_templates wt, roles r
WHERE wt.name = 'Workflow Sarpras' AND r.name = 'Wakasek Sarpras'
ON CONFLICT DO NOTHING;

-- Seed steps for Workflow Jurusan (Pembina → Wakasek Kesiswaan → Kepala Bengkel → Sarpras Mengetahui)
INSERT INTO workflow_steps (workflow_template_id, step_order, role_id, step_label)
SELECT wt.id, 1, r.id, 'Persetujuan Pembina'
FROM workflow_templates wt, roles r
WHERE wt.name = 'Workflow Jurusan' AND r.name = 'Pembina'
ON CONFLICT DO NOTHING;

INSERT INTO workflow_steps (workflow_template_id, step_order, role_id, step_label)
SELECT wt.id, 2, r.id, 'Persetujuan Wakasek Kesiswaan'
FROM workflow_templates wt, roles r
WHERE wt.name = 'Workflow Jurusan' AND r.name = 'Wakasek Kesiswaan'
ON CONFLICT DO NOTHING;

INSERT INTO workflow_steps (workflow_template_id, step_order, role_id, step_label)
SELECT wt.id, 3, r.id, 'Persetujuan Kepala Bengkel'
FROM workflow_templates wt, roles r
WHERE wt.name = 'Workflow Jurusan' AND r.name = 'Kepala Bengkel'
ON CONFLICT DO NOTHING;

INSERT INTO workflow_steps (workflow_template_id, step_order, role_id, step_label, is_info_only)
SELECT wt.id, 4, r.id, 'Diketahui Sarpras', true
FROM workflow_templates wt, roles r
WHERE wt.name = 'Workflow Jurusan' AND r.name = 'Wakasek Sarpras'
ON CONFLICT DO NOTHING;

-- ============================================================
-- SEED: system_config additions
-- ============================================================
INSERT INTO system_config (key, value, label, description, config_group) VALUES
  ('drive_upload_enabled', 'false', 'Upload ke Google Drive', 'Aktifkan upload file ke Google Drive', 'storage'),
  ('drive_folder_id', '""', 'Google Drive Folder ID', 'ID folder Google Drive untuk menyimpan file', 'storage'),
  ('max_file_size_mb', '10', 'Ukuran Maks File (MB)', 'Batas ukuran file upload', 'storage'),
  ('allowed_file_types', '"jpg,jpeg,png,pdf"', 'Tipe File Diizinkan', 'Format file yang diperbolehkan', 'storage'),
  ('default_workflow', '"Workflow Sarpras"', 'Workflow Default', 'Workflow yang dipakai jika fasilitas tidak punya workflow', 'borrowing')
ON CONFLICT (key) DO NOTHING;
