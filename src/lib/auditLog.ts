import { supabase } from './supabase';

export type ActivityType =
  | 'LOGIN' | 'LOGOUT' | 'CREATE' | 'UPDATE' | 'DELETE'
  | 'APPROVE' | 'REJECT' | 'FORWARD' | 'RETURN' | 'COMPLETE'
  | 'UPLOAD' | 'DOWNLOAD' | 'EXPORT' | 'IMPORT';

export interface AuditLogInput {
  adminUserId?: string | null;
  adminName?: string | null;
  adminEmail?: string | null;
  adminRole?: string | null;
  activityType: ActivityType;
  module: string;
  description?: string | null;
}

/**
 * Insert a single audit log row into system_activity_logs.
 * Fire-and-forget: errors are logged to console but never thrown,
 * so a failed log never breaks the calling action.
 */
export async function logActivity(input: AuditLogInput): Promise<void> {
  try {
    const { error } = await supabase.from('system_activity_logs').insert({
      admin_user_id: input.adminUserId ?? null,
      admin_name: input.adminName ?? null,
      admin_email: input.adminEmail ?? null,
      admin_role: input.adminRole ?? null,
      activity_type: input.activityType,
      module: input.module,
      description: input.description ?? null,
    });
    if (error) console.error('[auditLog] insert failed:', error.message);
  } catch (err) {
    console.error('[auditLog] unexpected error:', err);
  }
}
