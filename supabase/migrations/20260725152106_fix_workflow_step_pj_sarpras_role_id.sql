-- Fix mismatch: workflow_steps step_label "Persetujuan PJ Sarpras" was pointing to
-- role "Staff Sarpras" (137e85e7-3ce7-4b7e-bda8-d4b54e67c353) instead of
-- role "PJ Sarpras" (99da1595-971b-46b1-8041-bd012e8c59fb).
-- Only role_id is corrected; step_order, workflow_template_id, and step_label are unchanged.

UPDATE workflow_steps
SET role_id = '99da1595-971b-46b1-8041-bd012e8c59fb'
WHERE id = '47b8cb18-ceff-4a11-8a84-a9f8b8b5c18d'
  AND step_label ILIKE '%PJ Sarpras%'
  AND role_id = '137e85e7-3ce7-4b7e-bda8-d4b54e67c353';
