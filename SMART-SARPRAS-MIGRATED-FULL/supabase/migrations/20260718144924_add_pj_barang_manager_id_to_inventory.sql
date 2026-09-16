-- Add manager_id to inventory for PJ Barang (Penanggung Jawab Barang Inventaris)
ALTER TABLE inventory ADD COLUMN IF NOT EXISTS manager_id uuid REFERENCES admin_users(id) ON DELETE SET NULL;

-- Create PJ Barang role (same level as PJ Fasilitas)
INSERT INTO roles (name, description, level, is_system, is_active)
SELECT 'PJ Barang', 'Penanggung Jawab Barang Inventaris', 30, false, true
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'PJ Barang');

-- Grant permissions to PJ Barang (same as PJ Fasilitas, plus inventory:read which PJ Fasilitas already has)
INSERT INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
CROSS JOIN permissions p
WHERE r.name = 'PJ Barang'
  AND p.module || ':' || p.action IN (
    'borrowings:approve', 'borrowings:read', 'borrowings:reject',
    'inventory:read', 'facilities:read'
  )
ON CONFLICT DO NOTHING;
