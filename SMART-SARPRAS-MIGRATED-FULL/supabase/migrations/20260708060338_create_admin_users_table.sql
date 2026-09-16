-- Create admin_users table to whitelist admin accounts
CREATE TABLE IF NOT EXISTS admin_users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  name text DEFAULT '',
  role text DEFAULT 'admin',
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id),
  UNIQUE(email)
);

-- Disable RLS for admin_users
ALTER TABLE admin_users DISABLE ROW LEVEL SECURITY;

-- Insert default admin (update with actual admin email after signup)
-- INSERT INTO admin_users (email, name, role) VALUES ('admin@smkn1cimahi.sch.id', 'Administrator', 'superadmin');