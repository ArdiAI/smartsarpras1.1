-- Create school agenda table
CREATE TABLE IF NOT EXISTS agendas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  category text DEFAULT 'sekolah',
  event_date date NOT NULL,
  start_time time DEFAULT '08:00',
  end_time time DEFAULT '16:00',
  location text DEFAULT '',
  organizer text DEFAULT '',
  description text DEFAULT '',
  created_at timestamp with time zone DEFAULT now()
);

-- Create organizations table
CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  type text DEFAULT 'ekstrakurikuler',
  advisor text DEFAULT '',
  leader text DEFAULT '',
  description text DEFAULT '',
  schedule text DEFAULT '',
  contact text DEFAULT '',
  logo_url text DEFAULT '',
  "order" integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now()
);

-- Create proposals table
CREATE TABLE IF NOT EXISTS proposals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_name text NOT NULL,
  organization text DEFAULT '',
  proposer_name text NOT NULL,
  proposer_email text DEFAULT '',
  proposer_phone text DEFAULT '',
  event_date date,
  event_location text DEFAULT '',
  description text DEFAULT '',
  document_url text DEFAULT '',
  document_name text DEFAULT '',
  status text DEFAULT 'pending',
  admin_notes text DEFAULT '',
  reviewed_by text DEFAULT '',
  reviewed_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now()
);

-- Create achievements table
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name text NOT NULL,
  student_class text DEFAULT '',
  student_major text DEFAULT '',
  achievement_name text NOT NULL,
  category text DEFAULT 'non_akademik',
  level text DEFAULT 'sekolah',
  year integer DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
  advisor text DEFAULT '',
  photo_url text DEFAULT '',
  description text DEFAULT '',
  created_at timestamp with time zone DEFAULT now()
);

-- Disable RLS on all new tables
ALTER TABLE agendas DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE proposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE achievements DISABLE ROW LEVEL SECURITY;
