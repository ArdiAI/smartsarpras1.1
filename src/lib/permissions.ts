export type PermissionKey = string;


export interface Permission {
  id: string;
  module: string;
  action: string;
  label: string;
  description: string;
}


export interface AdminProfile {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
}


export interface AdminRoleAssignment {
  role_id: string;
  role_name: string;
  role_level: number;
}


export function hasPermission(
  permissions: Set<PermissionKey> | null,
  module: string,
  action: string,
): boolean {
  if (!permissions) {
    return false;
  }

  return permissions.has(
    `${module}:${action}`
  );
}


export function hasAnyPermission(
  permissions: Set<PermissionKey> | null,
  checks: Array<{
    module: string;
    action: string;
  }>,
): boolean {
  if (!permissions) {
    return false;
  }

  return checks.some(
    (
      check
    ) =>
      permissions.has(
        `${check.module}:${check.action}`
      )
  );
}