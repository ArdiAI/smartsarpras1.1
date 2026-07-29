/*
# Create kavling module table

1. New Tables
- `kavling` — stores kavling (pembagian area/tugas) submissions from students/units.
  - id (uuid, PK)
  - nama_pj (text, NOT NULL) — nama penanggung jawab
  - kelas_unit (text, NOT NULL) — kelas / ekstrakurikuler / unit (dropdown sumber)
  - kategori (text, NOT NULL) — 'Kelas' | 'Ekstrakurikuler' | 'Unit'
  - nama_kategori (text, NOT NULL) — nama kelas / eskul / unit spesifik
  - tanggal (date, NOT NULL) — tanggal pelaksanaan
  - lokasi (text, NOT NULL) — lokasi kavling
  - judul (text, NOT NULL) — judul kegiatan
  - deskripsi (text, NOT NULL) — deskripsi kegiatan
  - hasil (text, NOT NULL) — hasil kavling
  - catatan (text, default '') — catatan tambahan
  - file_url (text, NOT NULL) — URL bukti pendukung di Supabase Storage
  - file_name (text, NOT NULL) — nama file asli
  - status (text, NOT NULL default 'Menunggu') — 'Menunggu' | 'Selesai' | 'Ditolak'
  - created_by (uuid, nullable) — user yang membuat (jika login)
  - created_at (timestamptz, default now())
  - updated_at (timestamptz, default now())

2. Security
- Enable RLS on `kavling`.
- SELECT: TO anon, authenticated USING (true) — data kavling bersifat publik/dibagikan.
- INSERT: TO anon, authenticated WITH CHECK (true) — siswa/anon dapat mengirim kavling dari form publik.
- UPDATE: TO authenticated USING (true) WITH CHECK (true) — admin dapat memperbarui status.
- DELETE: TO authenticated USING (true) — admin dapat menghapus.

3. Indexes
- idx_kavling_tanggal (tanggal DESC)
- idx_kavling_kategori (kategori)
- idx_kavling_nama_kategori (nama_kategori)
- idx_kavling_status (status)
- idx_kavling_created_at (created_at DESC)

4. Notes
- Tidak mengubah tabel lain.
- Menggunakan bucket Supabase Storage `kavling-files` yang sudah ada.
- File URL disimpan ke kolom file_url seperti konvensi project.
*/

CREATE TABLE IF NOT EXISTS kavling (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nama_pj text NOT NULL,
  kelas_unit text NOT NULL,
  kategori text NOT NULL CHECK (kategori IN ('Kelas', 'Ekstrakurikuler', 'Unit')),
  nama_kategori text NOT NULL,
  tanggal date NOT NULL,
  lokasi text NOT NULL,
  judul text NOT NULL,
  deskripsi text NOT NULL,
  hasil text NOT NULL,
  catatan text DEFAULT '',
  file_url text NOT NULL,
  file_name text NOT NULL,
  status text NOT NULL DEFAULT 'Menunggu' CHECK (status IN ('Menunggu', 'Selesai', 'Ditolak')),
  created_by uuid,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

ALTER TABLE kavling ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_kavling" ON kavling;
CREATE POLICY "select_kavling" ON kavling FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "insert_kavling" ON kavling;
CREATE POLICY "insert_kavling" ON kavling FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "update_kavling" ON kavling;
CREATE POLICY "update_kavling" ON kavling FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "delete_kavling" ON kavling;
CREATE POLICY "delete_kavling" ON kavling FOR DELETE
  TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_kavling_tanggal ON kavling(tanggal DESC);
CREATE INDEX IF NOT EXISTS idx_kavling_kategori ON kavling(kategori);
CREATE INDEX IF NOT EXISTS idx_kavling_nama_kategori ON kavling(nama_kategori);
CREATE INDEX IF NOT EXISTS idx_kavling_status ON kavling(status);
CREATE INDEX IF NOT EXISTS idx_kavling_created_at ON kavling(created_at DESC);

COMMENT ON TABLE kavling IS 'Table for storing kavling (area/task division) submissions with file uploads';
