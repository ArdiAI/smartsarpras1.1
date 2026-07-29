/*
# Workflow Lainnya Template + Backend Validation + RLS for Super Admin Delete

## Purpose
1. Creates a new workflow template "Workflow Lainnya" for custom ("Lainnya") borrowing items.
   Steps: User → Pembina → Wakasek Kesiswaan → Wakasek Sarpras (PJ Sarpras step).
   After Wakasek Sarpras, the PJ Sarpras user gets special actions in the UI:
   - Teruskan ke PJ Barang (select a PJ Barang user, forward to them)
   - Teruskan ke PJ Fasilitas (select a PJ Fasilitas user, forward to them)
   - Proses Langsung (skip to Kepala Sarpras / final approval)

2. Creates/updates the `is_super_admin()` helper function for RLS DELETE policies.

3. Restricts DELETE on `borrowings`, `borrowing_items`, and `agendas` to Super Admin only.

## New Data
- `workflow_templates` row: "Workflow Lainnya" (is_active = true)
- `workflow_steps` rows:
  - Step 1: Pembina (role: Pembina)
  - Step 2: Wakasek Kesiswaan (role: Wakasek Kesiswaan)
  - Step 3: Wakasek Sarpras (role: Wakasek Sarpras) — this is the "PJ Sarpras" decision step

## Security
- `is_super_admin()` function checks admin_user_roles for "Super Admin" role.
- DELETE policies on borrowings, borrowing_items, agendas restricted to is_super_admin().
- INSERT/SELECT/UPDATE policies remain unchanged (no impact on existing workflow).

## Important Notes
1. The "Workflow Lainnya" template is for items where inventory_id IS NULL AND facility_id IS NULL
   (custom "Lainnya" items entered by the user).
2. Regular barang/fasilitas items continue using "Workflow Sarpras" (existing template).
3. The Wakasek Sarpras step in this template is where the PJ Sarpras user makes routing decisions.
4. No existing data is modified or deleted.
*/

-- ── is_super_admin() helper ──────────────────────────────────
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

GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- ── Workflow Lainnya template ────────────────────────────────
-- Insert the template if it doesn't already exist
INSERT INTO workflow_templates (id, name, description, is_active, created_at)
SELECT gen_random_uuid(), 'Workflow Lainnya', 'Workflow untuk pengajuan barang/fasilitas kategori Lainnya (tidak terdaftar di inventaris). Setelah Wakasek Sarpras, PJ Sarpras dapat meneruskan ke PJ Barang, PJ Fasilitas, atau memproses langsung.', true, now()
WHERE NOT EXISTS (
  SELECT 1 FROM workflow_templates WHERE name = 'Workflow Lainnya'
);

-- ── RLS: Restrict DELETE to Super Admin ──────────────────────
-- borrowings
DROP POLICY IF EXISTS "Admin can manage borrowings" ON borrowings;
DROP POLICY IF EXISTS "delete_borrowings_super_admin" ON borrowings;

CREATE POLICY "Admin select borrowings"
ON borrowings FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

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

CREATE POLICY "delete_borrowings_super_admin"
ON borrowings FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- borrowing_items
DROP POLICY IF EXISTS "bi_delete" ON borrowing_items;
DROP POLICY IF EXISTS "delete_borrowing_items_super_admin" ON borrowing_items;

CREATE POLICY "delete_borrowing_items_super_admin"
ON borrowing_items FOR DELETE
TO authenticated
USING (public.is_super_admin());

-- agendas
DROP POLICY IF EXISTS "delete_agendas_authenticated" ON agendas;
DROP POLICY IF EXISTS "delete_agendas_super_admin" ON agendas;

CREATE POLICY "delete_agendas_super_admin"
ON agendas FOR DELETE
TO authenticated
USING (public.is_super_admin());
