-- Expand aspirasi kategori CHECK to support public-form categories
ALTER TABLE aspirasi DROP CONSTRAINT IF EXISTS aspirasi_kategori_check;
ALTER TABLE aspirasi ADD CONSTRAINT aspirasi_kategori_check
  CHECK (kategori IN ('Sarana','Prasarana','Kebersihan','Keamanan','Kritik','Saran','Laporan','Pertanyaan','Lainnya'));

-- Allow anonymous (public) users to submit aspirasi from the public form
CREATE POLICY "insert_aspirasi_anon" ON aspirasi FOR INSERT
  TO anon WITH CHECK (true);
