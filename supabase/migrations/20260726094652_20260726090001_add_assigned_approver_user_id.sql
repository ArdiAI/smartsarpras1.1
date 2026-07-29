-- Add assigned_approver_user_id to borrowing_items for user-level dynamic approver assignment.
-- Old columns (assigned_approver_name, assigned_approver_role) are kept for display/backward compat.
ALTER TABLE borrowing_items
  ADD COLUMN IF NOT EXISTS assigned_approver_user_id UUID NULL;
