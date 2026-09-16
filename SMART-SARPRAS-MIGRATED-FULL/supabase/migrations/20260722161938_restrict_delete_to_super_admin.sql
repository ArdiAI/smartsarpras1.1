/*
# Restrict DELETE on borrowings, borrowing_items, and agendas to Super Admin only

## Purpose
Currently the DELETE policies on `borrowings`, `borrowing_items`, and `agendas` allow ANY
authenticated user to delete rows. This migration tightens security so only users with the
"Super Admin" role (level 100) can perform DELETE operations on these tables.

## Changes
1. Creates a helper SQL function `is_super_admin()` that checks whether the current
   authenticated user has the "Super Admin" role via the `admin_user_roles` join table.
2. Drops the existing permissive DELETE policies on `borrowings`, `borrowing_items`,
   and `agendas`.
3. Creates new DELETE policies scoped to `is_super_admin()` on all three tables.

## Security
- DELETE on `borrowings`: only Super Admin
- DELETE on `borrowing_items`: only Super Admin
- DELETE on `agendas`: only Super Admin
- All other CRUD policies (SELECT, INSERT, UPDATE) remain unchanged.
- Non-super-admin users attempting DELETE will get a PostgREST error (permission denied).
*/

-- Helper function: returns true if the current authenticated user has the Super Admin role
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM admin_user_roles aur
    JOIN roles r ON r.id = aur.role_id
    WHERE aur.admin_user_id IN (
      SELECT id FROM admin_users WHERE user_id = auth.uid()
    )
    AND r.name = 'Super Admin'
    AND r.is_active = true
  );
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- ── borrowings ──────────────────────────────────────────────
-- Drop old permissive delete policy (the "Admin can manage borrowings" FOR ALL policy
-- covers DELETE with qual true). We replace it with a super-admin-only DELETE policy.
-- First, drop the FOR ALL policy and recreate it without DELETE coverage, then add
-- a separate DELETE policy.

DROP POLICY IF EXISTS "Admin can manage borrowings" ON borrowings;
DROP POLICY IF EXISTS "delete_borrowings_super_admin" ON borrowings;

-- Recreate the admin CRUD policy for SELECT/INSERT/UPDATE (not DELETE)
CREATE POLICY "Admin can manage borrowings"
ON borrowings FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

-- We also need INSERT and UPDATE for authenticated on borrowings
-- (the old FOR ALL policy covered these; recreate them)
DROP POLICY IF EXISTS "Admin insert borrowings" ON borrowings;
CREATE POLICY "Admin insert borrowings"
ON borrowings FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Admin update borrowings" ON borrowings;
CREATE POLICY "Admin update borrowings"
ON borrowings FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- New DELETE policy: only Super Admin
CREATE POLICY "delete_borrowings_super_admin"
ON borrowings FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- ── borrowing_items ──────────────────────────────────────────
DROP POLICY IF EXISTS "bi_delete" ON borrowing_items;
DROP POLICY IF EXISTS "delete_borrowing_items_super_admin" ON borrowing_items;

CREATE POLICY "delete_borrowing_items_super_admin"
ON borrowing_items FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- ── agendas ──────────────────────────────────────────────────
DROP POLICY IF EXISTS "delete_agendas_authenticated" ON agendas;
DROP POLICY IF EXISTS "delete_agendas_super_admin" ON agendas;

CREATE POLICY "delete_agendas_super_admin"
ON agendas FOR DELETE
TO authenticated
USING (public.is_super_admin());
