-- Create announcements table
CREATE TABLE IF NOT EXISTS announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  priority text NOT NULL DEFAULT 'sedang' CHECK (priority IN ('tinggi', 'sedang', 'rendah')),
  status text NOT NULL DEFAULT 'aktif' CHECK (status IN ('aktif', 'nonaktif')),
  published_at timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

-- RLS policies - allow public read for active announcements
CREATE POLICY "read_active_announcements" ON announcements FOR SELECT
  TO anon, authenticated USING (status = 'aktif');

-- RLS policies - allow admin full access
CREATE POLICY "admin_announcements_all" ON announcements FOR ALL
  TO authenticated USING (
    EXISTS (SELECT 1 FROM admin_users WHERE user_id = auth.uid())
  );

-- Create index for better query performance
CREATE INDEX idx_announcements_status_published ON announcements(status, published_at DESC);

-- Add description comment
COMMENT ON TABLE announcements IS 'Table for storing system announcements';
