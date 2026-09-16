/*
# Add item_type column to workflow_templates

## Purpose
Workflow templates currently have no way to distinguish which item type (barang/fasilitas/lainnya)
they apply to. This causes all non-Lainnya borrowings to use the first active workflow by created_at,
which can route inventory borrowings to PJ Fasilitas. This migration adds an `item_type` column
so the system can select the correct workflow per item type.

## Changes
1. Add column `item_type` (text, nullable) to `workflow_templates`.
   - Values: 'barang', 'fasilitas', 'lainnya', or NULL (legacy/default).
2. Seed existing templates with the correct item_type based on their names:
   - 'Workflow Barang' -> 'barang'
   - 'Workflow Sarpras' -> 'fasilitas'
   - 'Workflow Jurusan' -> 'fasilitas'
   - 'Workflow Lainnya' -> 'lainnya'
3. Add an index on (item_type, is_active) for fast lookup.

## Security
- No RLS changes needed — workflow_templates already has RLS enabled.
- No new tables.

## Notes
- item_type is nullable so existing templates and any future generic templates still work.
- The frontend will query by item_type; if no match is found, it falls back to the first active template.
*/

-- 1. Add item_type column
ALTER TABLE workflow_templates
  ADD COLUMN IF NOT EXISTS item_type text;

-- 2. Seed existing templates
UPDATE workflow_templates SET item_type = 'barang' WHERE name = 'Workflow Barang' AND item_type IS NULL;
UPDATE workflow_templates SET item_type = 'fasilitas' WHERE name = 'Workflow Sarpras' AND item_type IS NULL;
UPDATE workflow_templates SET item_type = 'fasilitas' WHERE name = 'Workflow Jurusan' AND item_type IS NULL;
UPDATE workflow_templates SET item_type = 'lainnya' WHERE name = 'Workflow Lainnya' AND item_type IS NULL;

-- 3. Index for fast lookup
CREATE INDEX IF NOT EXISTS idx_workflow_templates_item_type_active
  ON workflow_templates (item_type, is_active);
