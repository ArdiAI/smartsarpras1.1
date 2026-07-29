-- =====================================================
-- Workflow Barang & Workflow Fasilitas (5 steps each)
-- =====================================================
-- Step 1: Pembina
-- Step 2: Wakasek Kesiswaan
-- Step 3: PJ Sarpras
-- Step 4: PJ Barang  /  PJ Fasilitas
-- Step 5: Wakasek Sarpras
-- =====================================================

-- Reuse existing role IDs (do NOT recreate roles)
-- Pembina:               56c5eb5b-b675-4165-ba0b-884ca8ef6003
-- Wakasek Kesiswaan:     1d251fc8-d9c2-4551-a246-900c4a68b721
-- PJ Sarpras:            99da1595-971b-46b1-8041-bd012e8c59fb
-- PJ Barang:             58fd8306-ed51-42f5-a875-df3bb791acba
-- Penanggung Jawab Fasilitas: eca4a251-dca7-4251-9d42-e9876cfb4ff0
-- Wakasek Sarpras:       137e85e7-3ce7-4b7e-bda8-d4b54e67c353

DO $$
DECLARE
  v_barang_tpl_id uuid;
  v_fasilitas_tpl_id uuid;
BEGIN
  -- 1) Create Workflow Barang template
  INSERT INTO workflow_templates (name, description, is_active)
  VALUES ('Workflow Barang', 'Alur persetujuan peminjaman barang: Pembina -> Wakasek Kesiswaan -> PJ Sarpras -> PJ Barang -> Wakasek Sarpras', true)
  ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_active = true, updated_at = now()
  RETURNING id INTO v_barang_tpl_id;

  -- Remove existing steps for this template (idempotent)
  DELETE FROM workflow_steps WHERE workflow_template_id = v_barang_tpl_id;

  INSERT INTO workflow_steps (workflow_template_id, step_order, role_id, step_label, is_info_only) VALUES
    (v_barang_tpl_id, 1, '56c5eb5b-b675-4165-ba0b-884ca8ef6003', 'Persetujuan Pembina', false),
    (v_barang_tpl_id, 2, '1d251fc8-d9c2-4551-a246-900c4a68b721', 'Persetujuan Wakasek Kesiswaan', false),
    (v_barang_tpl_id, 3, '99da1595-971b-46b1-8041-bd012e8c59fb', 'Persetujuan PJ Sarpras', false),
    (v_barang_tpl_id, 4, '58fd8306-ed51-42f5-a875-df3bb791acba', 'Persetujuan PJ Barang', false),
    (v_barang_tpl_id, 5, '137e85e7-3ce7-4b7e-bda8-d4b54e67c353', 'Persetujuan Wakasek Sarpras', false);

  -- 2) Create Workflow Fasilitas template
  INSERT INTO workflow_templates (name, description, is_active)
  VALUES ('Workflow Fasilitas', 'Alur persetujuan peminjaman fasilitas: Pembina -> Wakasek Kesiswaan -> PJ Sarpras -> PJ Fasilitas -> Wakasek Sarpras', true)
  ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, is_active = true, updated_at = now()
  RETURNING id INTO v_fasilitas_tpl_id;

  DELETE FROM workflow_steps WHERE workflow_template_id = v_fasilitas_tpl_id;

  INSERT INTO workflow_steps (workflow_template_id, step_order, role_id, step_label, is_info_only) VALUES
    (v_fasilitas_tpl_id, 1, '56c5eb5b-b675-4165-ba0b-884ca8ef6003', 'Persetujuan Pembina', false),
    (v_fasilitas_tpl_id, 2, '1d251fc8-d9c2-4551-a246-900c4a68b721', 'Persetujuan Wakasek Kesiswaan', false),
    (v_fasilitas_tpl_id, 3, '99da1595-971b-46b1-8041-bd012e8c59fb', 'Persetujuan PJ Sarpras', false),
    (v_fasilitas_tpl_id, 4, 'eca4a251-dca7-4251-9d42-e9876cfb4ff0', 'Persetujuan PJ Fasilitas', false),
    (v_fasilitas_tpl_id, 5, '137e85e7-3ce7-4b7e-bda8-d4b54e67c353', 'Persetujuan Wakasek Sarpras', false);

  -- 3) Ensure role_approver_emails has an entry for PJ Barang (role_id 58fd8306-...)
  --    so email routing works for the PJ Barang step.
  INSERT INTO role_approver_emails (role_id, role_name, approver_email, approver_name, is_active)
  SELECT '58fd8306-ed51-42f5-a875-df3bb791acba', 'PJ Barang', au.email, au.name, true
  FROM admin_user_roles aur
  JOIN admin_users au ON au.id = aur.admin_user_id
  WHERE aur.role_id = '58fd8306-ed51-42f5-a875-df3bb791acba' AND au.is_active = true
  ORDER BY au.created_at
  LIMIT 1
  ON CONFLICT DO NOTHING;
END $$;
