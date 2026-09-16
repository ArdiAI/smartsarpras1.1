-- Add inventory multi-unit support
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS available_quantity integer DEFAULT 0;

-- Initialize available_quantity from quantity
UPDATE inventory SET available_quantity = quantity WHERE available_quantity = 0;

-- Add document upload to borrowings
ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS document_url text DEFAULT '';
ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS document_name text DEFAULT '';

-- Add approval audit trail
ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS approved_by text DEFAULT '';
ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS approver_position text DEFAULT '';
ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS approved_at timestamp with time zone;

-- Rename quantity to borrowed_units for clarity
ALTER TABLE borrowings RENAME COLUMN quantity TO borrowed_units;
