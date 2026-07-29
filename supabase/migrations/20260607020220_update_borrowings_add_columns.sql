-- Add new columns to borrowings table
ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS borrower_email text DEFAULT '';
ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS borrower_phone text DEFAULT '';
ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS item_type text DEFAULT 'barang';
ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS facility_id uuid REFERENCES facilities(id);
ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS purpose text DEFAULT '';
ALTER TABLE borrowings ADD COLUMN IF NOT EXISTS admin_notes text DEFAULT '';

-- Disable RLS on borrowings for public access
ALTER TABLE borrowings DISABLE ROW LEVEL SECURITY;

-- Create index for schedule conflict checking
CREATE INDEX IF NOT EXISTS idx_borrowings_item_dates ON borrowings (inventory_id, borrow_date, return_date) WHERE status IN ('approved', 'completed');
CREATE INDEX IF NOT EXISTS idx_borrowings_facility_dates ON borrowings (facility_id, borrow_date, return_date) WHERE status IN ('approved', 'completed');
