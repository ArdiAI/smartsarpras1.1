-- =====================================================
-- Single dynamic workflow: Workflow Lainnya (5 steps)
-- Step 4 role_id = NULL (dynamic approver chosen by PJ Sarpras)
-- =====================================================

DO $$
DECLARE
  v_lainnya_tpl_id uuid;
BEGIN
  SELECT id INTO v_lainnya_tpl_id FROM workflow_templates WHERE name = 'Workflow Lainnya';
  IF v_lainnya_tpl_id IS NULL THEN
    INSERT INTO workflow_templates (name, description, is_active)
    VALUES ('Workflow Lainnya', 'Alur persetujuan dinamis: Pembina -> Staff Kesiswaan -> PJ Sarpras -> (PJ Barang/PJ Fasilitas) -> Staff Sarpras', true)
    RETURNING id INTO v_lainnya_tpl_id;
  ELSE
    UPDATE workflow_templates SET is_active = true, description = 'Alur persetujuan dinamis: Pembina -> Wakasek Kesiswaan -> PJ Sarpras -> (PJ Barang/PJ Fasilitas) -> Staff Sarpras', updated_at = now() WHERE id = v_lainnya_tpl_id;
  END IF;

  -- Replace all steps with the 5-step dynamic flow
  DELETE FROM workflow_steps WHERE workflow_template_id = v_lainnya_tpl_id;

  INSERT INTO workflow_steps (workflow_template_id, step_order, role_id, step_label, is_info_only) VALUES
    (v_lainnya_tpl_id, 1, '56c5eb5b-b675-4165-ba0b-884ca8ef6003', 'Persetujuan Pembina', false),
    (v_lainnya_tpl_id, 2, '1d251fc8-d9c2-4551-a246-900c4a68b721', 'Persetujuan Wakasek Kesiswaan', false),
    (v_lainnya_tpl_id, 3, '99da1595-971b-46b1-8041-bd012e8c59fb', 'Persetujuan PJ Sarpras', false),
    -- Step 4: dynamic approver (role_id NULL — assigned at runtime by PJ Sarpras)
    (v_lainnya_tpl_id, 4, NULL, 'Persetujuan PJ Barang / PJ Fasilitas', false),
    (v_lainnya_tpl_id, 5, '137e85e7-3ce7-4b7e-bda8-d4b54e67c353', 'Persetujuan Staff Sarpras', false);

  -- Deactivate the separate Barang/Fasilitas workflows (no longer needed)
  UPDATE workflow_templates SET is_active = false, updated_at = now() WHERE name IN ('Workflow Barang', 'Workflow Fasilitas');
END $$;
