-- =====================================================
-- System Activity Logs (Audit Log)
-- =====================================================
CREATE TABLE IF NOT EXISTS system_activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID,
  admin_name TEXT,
  admin_email TEXT,
  admin_role TEXT,
  activity_type TEXT NOT NULL,
  module TEXT NOT NULL,
  description TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for common filter queries
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_created_at ON system_activity_logs (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_admin_user_id ON system_activity_logs (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_module ON system_activity_logs (module);
CREATE INDEX IF NOT EXISTS idx_system_activity_logs_activity_type ON system_activity_logs (activity_type);

-- RLS
ALTER TABLE system_activity_logs ENABLE ROW LEVEL SECURITY;

-- Only Super Admin can read logs (role check via admin_user_roles join)
CREATE POLICY "read_logs_super_admin" ON system_activity_logs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM admin_user_roles aur
      JOIN roles r ON r.id = aur.role_id
      WHERE aur.admin_user_id = (
        SELECT id FROM admin_users WHERE user_id = auth.uid() LIMIT 1
      )
      AND r.name = 'Super Admin'
      AND r.is_active = true
    )
  );

-- Any authenticated admin can insert logs (actions log themselves)
CREATE POLICY "insert_logs_authenticated" ON system_activity_logs FOR INSERT
  TO authenticated WITH CHECK (true);
