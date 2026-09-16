/*
# Add UPDATE policy to admin_user_roles

## Purpose
The `admin_user_roles` table has INSERT, SELECT, and DELETE policies but is missing
an UPDATE policy. When UserManagementPage calls `supabase.from('admin_user_roles').upsert()`
with `onConflict: 'admin_user_id,role_id'`, PostgREST executes
`INSERT ... ON CONFLICT DO UPDATE`, which requires both INSERT and UPDATE RLS policies.
Without an UPDATE policy, changing an existing role assignment fails.

## Changes
- Adds `aur_update` UPDATE policy on `admin_user_roles` for authenticated users.

## Security
- No new security risks — the existing INSERT/DELETE policies already allow
  authenticated users to manage role assignments. This just adds the missing UPDATE.
*/

DROP POLICY IF EXISTS "aur_update" ON admin_user_roles;
CREATE POLICY "aur_update"
ON admin_user_roles FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);
