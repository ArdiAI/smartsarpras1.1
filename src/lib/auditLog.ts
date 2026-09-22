import { getSessionToken } from './appSession';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));

export type ActivityType =
  | 'LOGIN'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'APPROVE'
  | 'REJECT'
  | 'FORWARD'
  | 'RETURN'
  | 'COMPLETE'
  | 'UPLOAD'
  | 'DOWNLOAD'
  | 'EXPORT'
  | 'IMPORT';

export interface AuditLogInput {
  adminUserId?: string | null;
  adminName?: string | null;
  adminEmail?: string | null;
  adminRole?: string | null;
  activityType: ActivityType;
  module: string;
  description?: string | null;
}

export async function logActivity(
  input: AuditLogInput
): Promise<void> {
  try {
    const token =
      getSessionToken();

    if (!token) {
      console.warn(
        '[auditLog] tidak ada session login'
      );
      return;
    }

    const response = await fetch(
      `${API_BASE_URL}/api/admin/activity-logs`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          activityType: input.activityType,
          module: input.module,
          description:
            input.description ?? null,
        }),
      }
    );

    if (!response.ok) {
      const result = await response
        .json()
        .catch(() => null);

      console.error(
        '[auditLog] insert failed:',
        result?.message ??
          `HTTP ${response.status}`
      );
    }
  } catch (err) {
    console.error(
      '[auditLog] unexpected error:',
      err
    );
  }
}