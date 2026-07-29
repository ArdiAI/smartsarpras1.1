-- Create kavling table
CREATE TABLE IF NOT EXISTS kavling (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama text NOT NULL,
  kelas_unit text NOT NULL,
  tanggal date NOT NULL,
  file_url text NOT NULL,
  file_name text NOT NULL,
  status_verifikasi text NOT NULL DEFAULT 'Menunggu' CHECK (status_verifikasi IN ('Menunggu', 'Terverifikasi', 'Ditolak')),
  catatan text DEFAULT '',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE kavling ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow authenticated users to read and insert
CREATE POLICY "read_kavling" ON kavling FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "insert_kavling" ON kavling FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "update_kavling" ON kavling FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "delete_kavling" ON kavling FOR DELETE
  TO authenticated USING (true);

-- Create index for better query performance
CREATE INDEX idx_kavling_tanggal ON kavling(tanggal DESC);
CREATE INDEX idx_kavling_kelas_unit ON kavling(kelas_unit);
CREATE INDEX idx_kavling_status ON kavling(status_verifikasi);

-- Add comment
COMMENT ON TABLE kavling IS 'Table for storing kavling data with file uploads';