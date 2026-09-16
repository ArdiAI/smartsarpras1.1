/*
# Dynamic Kabeng (Kepala Bengkel) per Jurusan

## Purpose
The school has 9 Kepala Bengkel (Kabeng), one per jurusan (RPL, TKJ, Mekatronika, etc).
Instead of creating 9 separate workflows, we use ONE Workflow Jurusan with a
dynamic step (role_id = NULL) for the Kabeng step. The system auto-assigns the
correct Kabeng based on the jurusan (department) of the facility being borrowed.

## Changes

### 1. Add `department` column to `admin_user_roles`
This lets a Super Admin map a specific Kabeng to a specific jurusan.
For example: admin_user_id = X, role_id = Kabeng, department = 'Mekatronika'
means user X is the Kabeng for Mekatronika.

### 2. Set Workflow Jurusan's Kabeng step to role_id = NULL
The step "Persetujuan Kepala Bengkel" (step_order 2) in Workflow Jurusan
currently has a fixed role_id. We set it to NULL so it becomes a dynamic step.
The system will auto-resolve the correct Kabeng based on the facility's department.

### 3. Add `department` column to `borrowings`
When a user borrows a facility that belongs to a jurusan (e.g. Lab Mekatronika),
the department is stored on the borrowing so the system knows which Kabeng to assign.

## Security
- No RLS changes needed — admin_user_roles already has RLS.
- No new tables.

## Notes
- Super Admin can change the Kabeng-jurusan mapping anytime from the dashboard
  by updating admin_user_roles.department — no code changes needed.
- If no Kabeng is found for a jurusan, the step remains unassigned and the
  admin can manually assign it from the borrowings page.
*/

-- 1. Add department column to admin_user_roles
ALTER TABLE admin_user_roles
  ADD COLUMN IF NOT EXISTS department text;

-- 2. Set Workflow Jurusan's Kabeng step to role_id = NULL (dynamic)
UPDATE workflow_steps
SET role_id = NULL
WHERE workflow_template_id = (
  SELECT id FROM workflow_templates WHERE name = 'Workflow Jurusan'
)
AND step_order = 2;

-- 3. Add department column to borrowings
ALTER TABLE borrowings
  ADD COLUMN IF NOT EXISTS department text;
