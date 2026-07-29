/*
  # Create Team and About Tables

  1. New Tables
    - `team_members`
      - `id` (uuid, primary key)
      - `name` (text)
      - `position` (text)
      - `role` (text)
      - `photo_url` (text)
      - `description` (text)
      - `email` (text)
      - `phone` (text)
      - `order` (integer)
      - `is_active` (boolean)
      - `created_at` (timestamp)
    
    - `about_settings`
      - `id` (uuid, primary key)
      - `section` (text)
      - `content` (jsonb)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on both tables
    - Public read access, admin write access
*/

-- Team Members Table
CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position text NOT NULL,
  role text DEFAULT 'staff',
  photo_url text,
  description text,
  email text,
  phone text,
  "order" integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view active team members"
  ON team_members FOR SELECT
  TO public
  USING (is_active = true);

CREATE POLICY "Admins can manage team members"
  ON team_members FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- About Settings Table
CREATE TABLE IF NOT EXISTS about_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section text UNIQUE NOT NULL,
  content jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE about_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public can view about settings"
  ON about_settings FOR SELECT
  TO public
  USING (true);

CREATE POLICY "Admins can manage about settings"
  ON about_settings FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Insert default about settings
INSERT INTO about_settings (section, content) VALUES
  ('profile', '{
    "name": "Unit Sarana dan Prasarana",
    "fullname": "Unit Sarana dan Prasarana SMK Negeri 1 Cimahi",
    "description": "Unit Sarana dan Prasarana bertanggung jawab dalam pengelolaan, pemeliharaan, dan pengembangan sarana prasarana sekolah untuk mendukung kegiatan belajar mengajar.",
    "established": "2010"
  }'),
  ('vision', '{
    "text": "Menyediakan fasilitas yang mendukung penuh visi utama sekolah, yaitu menciptakan lulusan yang unggul, berakhlak mulia, berbudaya kerja, berjiwa technopreneurship, dan berwawasan global.",
    "description": "Kami berkomitmen untuk memberikan layanan terbaik dalam pengelolaan sarana prasarana sekolah."
  }'),
  ('mission', '{
    "items": [
      "Menyediakan dan merawat fasilitas pendidikan yang sesuai dengan kebutuhan industri."
    ]
  }'),
  ('tasks', '{
    "items": [
      {
        "title": "Perencanaan Kebutuhan",
        "description": "Menyusun rencana kebutuhan sarana prasarana berdasarkan analisis kebutuhan sekolah"
      },
      {
        "title": "Pengadaan Barang",
        "description": "Melaksanakan pengadaan barang dan jasa sesuai dengan prosedur yang berlaku"
      },
      {
        "title": "Pencatatan Inventaris",
        "description": "Mencatat dan mendokumentasikan seluruh inventaris barang milik sekolah"
      },
      {
        "title": "Pemeliharaan Fasilitas",
        "description": "Melakukan pemeliharaan rutin dan perbaikan fasilitas sekolah"
      },
      {
        "title": "Pengelolaan Peminjaman",
        "description": "Mengatur dan mengelola peminjaman fasilitas dan inventaris sekolah"
      },
      {
        "title": "Monitoring dan Evaluasi",
        "description": "Memantau kondisi sarana prasarana dan mengevaluasi kinerja pengelolaan"
      }
    ]
  }'),
  ('structure', '{
    "chart_url": null,
    "description": "Struktur organisasi Unit Sarana dan Prasarana SMK Negeri 1 Cimahi terdiri dari Koordinator, Seksi Perencanaan, Seksi Pemeliharaan, dan Seksi Inventaris."
  }')
ON CONFLICT (section) DO NOTHING;

-- Insert sample team members
INSERT INTO team_members (name, position, role, description, email, "order", is_active) VALUES
  ('Agus Priyatmono Nugroho, S.Pd,M.Si', 'Kepala Sekolah', 'head', 'Penanggung jawab utama pengelolaan sarana prasarana sekolah', 'kepsek@smkn1cimahi.sch.id', 1, true),
  ('H. Ahmad Hidayat, S.T.', 'Koordinator Sarpras', 'coordinator', 'Mengkoordinasikan seluruh kegiatan pengelolaan sarana prasarana sekolah', 'sarpras@smkn1cimahi.sch.id', 2, true),
  ('Ir. Siti Rahayu', 'Seksi Perencanaan', 'staff', 'Menyusun rencana kebutuhan dan pengadaan sarana prasarana', 'perencanaan@smkn1cimahi.sch.id', 3, true),
  ('Dedi Kurniawan, S.Pd.', 'Seksi Pemeliharaan', 'staff', 'Mengelola pemeliharaan dan perbaikan fasilitas sekolah', 'pemeliharaan@smkn1cimahi.sch.id', 4, true),
  ('Rina Marlina, S.E.', 'Seksi Inventaris', 'staff', 'Mencatat dan mengelola inventaris barang milik sekolah', 'inventaris@smkn1cimahi.sch.id', 5, true),
  ('Agus Setiawan', 'Teknisi', 'staff', 'Melaksanakan perbaikan dan pemeliharaan teknis fasilitas', 'teknisi@smkn1cimahi.sch.id', 6, true)
ON CONFLICT DO NOTHING;

-- Create index for ordering
CREATE INDEX IF NOT EXISTS idx_team_members_order ON team_members("order");
