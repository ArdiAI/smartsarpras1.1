-- Create table for mapping roles to approver emails
-- This allows the system to know which email to notify for each workflow step's role
CREATE TABLE IF NOT EXISTS role_approver_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id uuid REFERENCES roles(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  approver_email text NOT NULL,
  approver_name text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role_id)
);

-- Enable RLS
ALTER TABLE role_approver_emails ENABLE ROW LEVEL SECURITY;

-- Policies: only authenticated users can read, only superadmins can write
CREATE POLICY "read_role_approver_emails" ON role_approver_emails
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "insert_role_approver_emails" ON role_approver_emails
  FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "update_role_approver_emails" ON role_approver_emails
  FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "delete_role_approver_emails" ON role_approver_emails
  FOR DELETE TO authenticated USING (true);

-- Seed default approver emails for existing roles
INSERT INTO role_approver_emails (role_id, role_name, approver_email, approver_name)
SELECT id, name, LOWER(REPLACE(name, ' ', '.')) || '@smkn1cimahi.sch.id', name
FROM roles
WHERE name IN ('Pembina', 'Wakasek Kesiswaan', 'Penanggung Jawab Fasilitas', 'Wakasek Sarpras', 'Kepala Bengkel')
ON CONFLICT (role_id) DO NOTHING;
