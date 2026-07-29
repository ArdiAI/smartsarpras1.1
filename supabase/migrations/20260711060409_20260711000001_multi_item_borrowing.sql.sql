-- ============================================================
-- MULTI-ITEM BORROWING SYSTEM
-- One pengajuan can contain multiple items, each with its own
-- approval status, workflow, and assigned approver (PJ Fasilitas)
-- ============================================================

-- borrowing_items: each row = one item in a borrowing request
CREATE TABLE IF NOT EXISTS borrowing_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  borrowing_id uuid NOT NULL REFERENCES borrowings(id) ON DELETE CASCADE,
  inventory_id uuid REFERENCES inventory(id) ON DELETE SET NULL,
  facility_id uuid REFERENCES facilities(id) ON DELETE SET NULL,
  item_type text NOT NULL DEFAULT 'barang', -- barang | ruangan
  item_name text NOT NULL DEFAULT '',       -- snapshot name at time of request
  quantity integer NOT NULL DEFAULT 1,
  status text NOT NULL DEFAULT 'pending',  -- pending | approved | rejected | in_use | returned
  current_status_label text DEFAULT 'Menunggu Persetujuan',
  workflow_template_id uuid REFERENCES workflow_templates(id) ON DELETE SET NULL,
  current_step integer DEFAULT 0,
  assigned_approver_name text DEFAULT '',
  assigned_approver_role text DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE borrowing_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "bi_select" ON borrowing_items;
CREATE POLICY "bi_select" ON borrowing_items FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "bi_insert" ON borrowing_items;
CREATE POLICY "bi_insert" ON borrowing_items FOR INSERT TO authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "bi_update" ON borrowing_items;
CREATE POLICY "bi_update" ON borrowing_items FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "bi_delete" ON borrowing_items;
CREATE POLICY "bi_delete" ON borrowing_items FOR DELETE TO authenticated USING (true);

-- approval_history: link to borrowing_item_id (nullable for backward compat)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='approval_history' AND column_name='borrowing_item_id') THEN
    ALTER TABLE approval_history ADD COLUMN borrowing_item_id uuid REFERENCES borrowing_items(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Index for performance
CREATE INDEX IF NOT EXISTS idx_borrowing_items_borrowing_id ON borrowing_items(borrowing_id);
CREATE INDEX IF NOT EXISTS idx_approval_history_item_id ON approval_history(borrowing_item_id);

-- Update borrowings: overall status is derived from items
-- (kept for backward compat, but now reflects aggregate of all items)
-- Values: pending (at least one item pending), partially_approved, approved (all approved), rejected (any rejected), completed, cancelled

-- Add facility manager assignment column to facilities
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='facilities' AND column_name='manager_name') THEN
    ALTER TABLE facilities ADD COLUMN manager_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='facilities' AND column_name='manager_role') THEN
    ALTER TABLE facilities ADD COLUMN manager_role text DEFAULT 'Penanggung Jawab Fasilitas';
  END IF;
END $$;

-- Add manager_name to inventory (for item-level PJ assignment)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='manager_name') THEN
    ALTER TABLE inventory ADD COLUMN manager_name text DEFAULT '';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='inventory' AND column_name='manager_role') THEN
    ALTER TABLE inventory ADD COLUMN manager_role text DEFAULT 'Penanggung Jawab Fasilitas';
  END IF;
END $$;
