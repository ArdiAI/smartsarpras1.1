-- Add reporter_unit column to damage_reports
ALTER TABLE damage_reports ADD COLUMN IF NOT EXISTS reporter_unit text DEFAULT '';
ALTER TABLE damage_reports ADD COLUMN IF NOT EXISTS reporter_email text DEFAULT '';
ALTER TABLE damage_reports ADD COLUMN IF NOT EXISTS reporter_phone text DEFAULT '';
ALTER TABLE damage_reports ADD COLUMN IF NOT EXISTS location text DEFAULT '';

-- Create aspirasi table
CREATE TABLE IF NOT EXISTS aspirasi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  kelas_unit text NOT NULL,
  email text DEFAULT '',
  kategori text NOT NULL DEFAULT 'Sarana' CHECK (kategori IN ('Sarana', 'Prasarana', 'Kebersihan', 'Keamanan', 'Lainnya')),
  judul text NOT NULL,
  isi text NOT NULL,
  status text NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Menunggu', 'Dibaca', 'Diproses', 'Selesai')),
  tanggapan text DEFAULT '',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS on aspirasi
ALTER TABLE aspirasi ENABLE ROW LEVEL SECURITY;

-- RLS policies for aspirasi - allow authenticated users to read and insert
CREATE POLICY "read_aspirasi" ON aspirasi FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_aspirasi" ON aspirasi FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_aspirasi" ON aspirasi FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_aspirasi" ON aspirasi FOR DELETE
  TO authenticated USING (true);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_aspirasi_status ON aspirasi(status);
CREATE INDEX IF NOT EXISTS idx_aspirasi_kategori ON aspirasi(kategori);
CREATE INDEX IF NOT EXISTS idx_aspirasi_created ON aspirasi(created_at DESC);

COMMENT ON TABLE aspirasi IS 'Table for storing aspirations/suggestions from users about facilities';