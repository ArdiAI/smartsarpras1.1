/*
# Restrict damage_reports DELETE to Super Admin only

## Purpose
The existing "Admin can manage damage reports" policy is a FOR ALL policy that allows
any authenticated user to DELETE damage reports. This is a security gap — only Super Admin
should be able to delete reports.

## Changes
- Drops the existing "Admin can manage damage reports" FOR ALL policy
- Creates separate SELECT, INSERT, UPDATE policies for authenticated users (preserving existing behavior)
- Creates a DELETE policy restricted to Super Admin via is_super_admin()

## Security
- DELETE is now restricted to Super Admin only at the database level
- SELECT, INSERT, UPDATE remain available to authenticated users
- Public SELECT and public INSERT policies remain unchanged
*/

-- Drop the overly permissive FOR ALL policy
DROP POLICY IF EXISTS "Admin can manage damage reports" ON damage_reports;

-- Re-add SELECT for authenticated users (public SELECT policy already exists)
CREATE POLICY "damage_reports_select_authenticated"
ON damage_reports FOR SELECT
TO authenticated
USING (true);

-- Re-add INSERT for authenticated users (public INSERT policy already exists)
CREATE POLICY "damage_reports_insert_authenticated"
ON damage_reports FOR INSERT
TO authenticated
WITH CHECK (true);

-- Re-add UPDATE for authenticated users
CREATE POLICY "damage_reports_update_authenticated"
ON damage_reports FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Restrict DELETE to Super Admin only
CREATE POLICY "delete_damage_reports_super_admin"
ON damage_reports FOR DELETE
TO authenticated
USING (is_super_admin());
