import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { FunctionsHttpError, FunctionsRelayError, FunctionsFetchError } from '@supabase/supabase-js';
import { cn } from '../../utils/cn';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { getDefaultWorkflow, getWorkflowSteps, getWorkflowLainnya } from '../../lib/workflow';
import { logActivity } from '../../lib/auditLog';
import type { WorkflowTemplate, WorkflowStep } from '../../lib/workflow';
import {
  CheckCircle2,
  XCircle,
  Trash2,
  Search,
  FileText,
  User,
  Mail,
  Phone,
  Calendar,
  Package,
  Send,
  Forward,
} from 'lucide-react';

// ---- Types ----
interface BorrowingItem {
  id: string;
  borrowing_id: string;
  inventory_id: string | null;
  facility_id: string | null;
  item_type: string | null;
  item_name: string | null;
  quantity: number | null;
  status: string | null;
  current_status_label: string | null;
  workflow_template_id: string | null;
  current_step: number | null;
  assigned_approver_name: string | null;
  assigned_approver_role: string | null;
  assigned_approver_user_id: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Borrowing {
  id: string;
  inventory_id: string | null;
  borrower_name: string | null;
  borrower_class: string | null;
  borrowed_units: number | null;
  borrow_date: string | null;
  return_date: string | null;
  actual_return_date: string | null;
  status: string | null;
  notes: string | null;
  created_at: string | null;
  borrower_email: string | null;
  borrower_phone: string | null;
  item_type: string | null;
  facility_id: string | null;
  purpose: string | null;
  admin_notes: string | null;
  start_time: string | null;
  end_time: string | null;
  document_url: string | null;
  document_name: string | null;
  approved_by: string | null;
  approver_position: string | null;
  approved_at: string | null;
  workflow_template_id: string | null;
  current_step: number | null;
  current_status_label: string | null;
  drive_file_id: string | null;
  drive_file_url: string | null;
  borrowing_items: BorrowingItem[] | null;
}

interface AdminUserOption {
  id: string;
  name: string;
  email: string;
}

type LainnyaAction = 'pj-barang' | 'pj-fasilitas' | null;

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  pending: { label: 'Menunggu', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  approved: { label: 'Disetujui', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  rejected: { label: 'Ditolak', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
  returned: { label: 'Dikembalikan', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' },
  processing: { label: 'Diproses', cls: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' },
};

function statusBadge(status: string | null) {
  const key = (status ?? 'pending').toLowerCase();
  const conf = STATUS_LABELS[key] ?? { label: status ?? 'Pending', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300' };
  return (
    <span className={cn('inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium', conf.cls)}>
      {conf.label}
    </span>
  );
}

function formatDate(value: string | null): string {
  if (!value) return '-';
  try {
    const d = new Date(value);
    if (isNaN(d.getTime())) return value;
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return value;
  }
}

export default function BorrowingsAdminPage() {
  const { isSuperAdmin, userRoleNames, hasPermission, adminProfile } = useAuth();

  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Lainnya modal state
  const [lainnyaAction, setLainnyaAction] = useState<LainnyaAction>(null);
  const [lainnyaBorrowing, setLainnyaBorrowing] = useState<Borrowing | null>(null);
  const [pjOptions, setPjOptions] = useState<AdminUserOption[]>([]);
  const [selectedPjId, setSelectedPjId] = useState('');
  const [lainnyaSubmitting, setLainnyaSubmitting] = useState(false);
  const [workflowStepsMap, setWorkflowStepsMap] = useState<Record<string, WorkflowStep[]>>({});
  const [roleNameMap, setRoleNameMap] = useState<Record<string, string>>({});

  const canApprove = hasPermission('borrowings', 'approve');
  const canReject = hasPermission('borrowings', 'reject');

  // ---- Data fetching (useCallback, primitive deps only) ----
  const fetchBorrowings = useCallback(async () => {
    setLoading(true);
    let query = supabase.from('borrowings').select('*, borrowing_items(*)').order('created_at', { ascending: false });
    if (statusFilter !== 'all') {
      query = query.eq('status', statusFilter);
    }
    if (searchTerm.trim()) {
      query = query.or(`borrower_name.ilike.%${searchTerm.trim()}%,borrower_class.ilike.%${searchTerm.trim()}%,borrower_email.ilike.%${searchTerm.trim}%`);
    }
    const { data, error } = await query;
    if (error) {
      showToast('Gagal memuat data peminjaman', 'error');
      setBorrowings([]);
    } else {
      setBorrowings((data as unknown as Borrowing[]) ?? []);
    }
    setLoading(false);
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    fetchBorrowings();
  }, [fetchBorrowings]);

  // Fetch all active workflow templates + steps and role names for approver filtering
  useEffect(() => {
    (async () => {
      const { data: roles } = await supabase.from('roles').select('id, name');
      const rMap: Record<string, string> = {};
      for (const r of (roles ?? []) as { id: string; name: string }[]) {
        rMap[r.id] = r.name;
      }
      setRoleNameMap(rMap);

      const { data: templates } = await supabase.from('workflow_templates').select('id').eq('is_active', true);
      const wsMap: Record<string, WorkflowStep[]> = {};
      for (const t of (templates ?? []) as { id: string }[]) {
        wsMap[t.id] = await getWorkflowSteps(t.id);
      }
      setWorkflowStepsMap(wsMap);
    })();
  }, []);

  // ---- Helpers ----
  function isLainnyaBorrowing(b: Borrowing): boolean {
    const items = b.borrowing_items ?? [];
    if (items.length === 0) {
      // fallback to header-level fields
      return b.inventory_id == null && b.facility_id == null;
    }
    return items.every((it) => it.inventory_id == null && it.facility_id == null);
  }

  // Resolve the active workflow step for a borrowing from the cached workflow_steps
  const getCurrentWorkflowStep = useCallback((b: Borrowing): WorkflowStep | null => {
    if (!b.workflow_template_id || b.current_step == null) return null;
    const steps = workflowStepsMap[b.workflow_template_id];
    if (!steps || steps.length === 0) return null;
    return steps.find((s) => s.step_order === b.current_step) ?? null;
  }, [workflowStepsMap]);

  // Does the logged-in user hold the role assigned to the borrowing's active step?
  // For the dynamic step 4 (role_id is null), the assigned approver role is stored on
  // borrowing_items.assigned_approver_role — match that against the user's roles.
  const isCurrentApprover = useCallback((b: Borrowing): boolean => {
    const step = getCurrentWorkflowStep(b);
    if (!step || step.is_info_only) return false;
    if (step.role_id) {
      const stepRoleName = roleNameMap[step.role_id] ?? null;
      if (!stepRoleName) return false;
      return userRoleNames.includes(stepRoleName);
    }
    // Dynamic step (role_id null): only the exact user assigned via assigned_approver_user_id
    // may see/approve/reject. assigned_approver_role is informational only — never used for access.
    const items = b.borrowing_items ?? [];
    const assignedItem = items.find((it) => it.assigned_approver_user_id);
    if (!assignedItem?.assigned_approver_user_id) return false;
    return adminProfile?.id === assignedItem.assigned_approver_user_id;
  }, [getCurrentWorkflowStep, roleNameMap, userRoleNames, adminProfile]);

  // Forward buttons appear only when the active step is PJ Sarpras (the branching step in Lainnya).
  const canForward = useCallback((b: Borrowing): boolean => {
    if (!isLainnyaBorrowing(b) || (b.status ?? '') !== 'pending') return false;
    const step = getCurrentWorkflowStep(b);
    if (!step || step.is_info_only) return false;
    const stepRoleName = step.role_id ? (roleNameMap[step.role_id] ?? null) : null;
    return stepRoleName === 'PJ Sarpras' && userRoleNames.includes(stepRoleName);
  }, [getCurrentWorkflowStep, roleNameMap, userRoleNames]);

  // ---- Regular workflow: Approve ----
  const handleApprove = async (b: Borrowing) => {
    if (!canApprove) {
      showToast('Anda tidak memiliki izin menyetujui peminjaman', 'error');
      return;
    }
    if (!b.workflow_template_id) {
      showToast('Template workflow tidak ditemukan', 'error');
      return;
    }
    setActionLoadingId(b.id);
    try {
      const steps = await getWorkflowSteps(b.workflow_template_id);
      const currentStep = b.current_step ?? 1;
      const currentStepDef = steps.find((s) => s.step_order === currentStep);

      // Find next non-info-only step
      let nextStepOrder = currentStep;
      let nextStepDef: WorkflowStep | undefined;
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        if (s.step_order > currentStep) {
          nextStepOrder = s.step_order;
          nextStepDef = s;
          if (!s.is_info_only) break;
        }
      }

      const isLastApproval = !nextStepDef || steps.every((s) => s.step_order <= currentStep || s.is_info_only);
      const newStatus = isLastApproval ? 'approved' : 'pending';
      const newStepLabel = isLastApproval ? 'Disetujui' : (nextStepDef?.step_label ?? 'Lanjut');
      const nowIso = new Date().toISOString();

      const { error: borrowErr } = await supabase
        .from('borrowings')
        .update({
          status: newStatus,
          current_step: isLastApproval ? currentStep : nextStepOrder,
          current_status_label: newStepLabel,
          approved_by: adminProfile?.id ?? null,
          approver_position: currentStepDef?.step_label ?? null,
          approved_at: nowIso,
        })
        .eq('id', b.id);
      if (borrowErr) {
        console.error('[BorrowingsAdminPage] Error UPDATE borrowings:', borrowErr);
        showToast('Gagal menyetujui peminjaman', 'error');
        setActionLoadingId(null);
        return;
      }

      // Update borrowing_items
      const items = b.borrowing_items ?? [];
      if (items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('borrowing_items')
          .update({
            status: newStatus,
            current_step: isLastApproval ? currentStep : nextStepOrder,
            current_status_label: newStepLabel,
            updated_at: nowIso,
          })
          .eq('borrowing_id', b.id);
        if (itemsErr) {
          console.error('[BorrowingsAdminPage] Error UPDATE borrowing_items:', itemsErr);
        }
      }

      // Send email notification
      try {
        if (isLastApproval) {
          // Email borrower about approval
          if (b.borrower_email) {
            const borrowerMessage = `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#0f766e;">Peminjaman Disetujui</h2>
                <p>Halo ${b.borrower_name ?? 'Peminjam'},</p>
                <p>Pengajuan peminjaman Anda telah <strong>disetujui</strong> oleh ${currentStepDef?.step_label ?? 'approver'}.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:6px 12px;font-weight:bold;">Nama</td><td style="padding:6px 12px;">${b.borrower_name ?? '-'}</td></tr>
                  <tr><td style="padding:6px 12px;font-weight:bold;">Tanggal</td><td style="padding:6px 12px;">${b.borrow_date ?? '-'} s/d ${b.return_date ?? '-'}</td></tr>
                </table>
                <p>Silakan ambil barang/fasilitas yang dipinjam sesuai jadwal.</p>
              </div>`;
            const { data: emailData, error: emailErr } = await supabase.functions.invoke('send-borrowing-email', {
              body: { recipientEmail: b.borrower_email, subject: 'Peminjaman Disetujui - Smart Sarpras', message: borrowerMessage },
            });
            console.log('[BorrowingsAdminPage] invoke response data (borrower):', emailData);
            console.log('[BorrowingsAdminPage] invoke response error (borrower):', emailErr);
            if (emailErr) {
              console.error('[BorrowingsAdminPage] Gagal kirim email ke peminjam:', emailErr);
              if (emailErr instanceof FunctionsHttpError) {
                const errStatus = emailErr.context.status;
                const errBody = await emailErr.context.text();
                console.error('[BorrowingsAdminPage] Edge Function status (borrower):', errStatus);
                console.error('[BorrowingsAdminPage] Edge Function body (borrower):', errBody);
              } else if (emailErr instanceof FunctionsRelayError) {
                console.error('[BorrowingsAdminPage] Relay error (borrower):', emailErr.message);
              } else if (emailErr instanceof FunctionsFetchError) {
                console.error('[BorrowingsAdminPage] Fetch error (borrower):', emailErr.message);
              }
            }
          }
        } else if (nextStepDef?.role_id) {
          // Email next approver (role-based: Pembina, Wakasek, PJ Sarpras, etc.)
          const { data: approver } = await supabase
            .from('role_approver_emails')
            .select('approver_email, approver_name')
            .eq('role_id', nextStepDef.role_id)
            .eq('is_active', true)
            .maybeSingle();
          const recipientEmail = (approver as unknown as { approver_email: string } | null)?.approver_email ?? '';
          if (recipientEmail) {
            const approverMessage = `
              <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                <h2 style="color:#0f766e;">Pengajuan Peminjaman Menunggu Persetujuan Anda</h2>
                <p>Ada pengajuan peminjaman yang memerlukan persetujuan Anda pada tahap: <strong>${nextStepDef.step_label}</strong>.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                  <tr><td style="padding:6px 12px;font-weight:bold;">Nama Pemohon</td><td style="padding:6px 12px;">${b.borrower_name ?? '-'}</td></tr>
                  <tr><td style="padding:6px 12px;font-weight:bold;">Kelas/Unit</td><td style="padding:6px 12px;">${b.borrower_class ?? '-'}</td></tr>
                  <tr><td style="padding:6px 12px;font-weight:bold;">Tanggal</td><td style="padding:6px 12px;">${b.borrow_date ?? '-'} s/d ${b.return_date ?? '-'}</td></tr>
                  <tr><td style="padding:6px 12px;font-weight:bold;">Tujuan</td><td style="padding:6px 12px;">${b.purpose ?? '-'}</td></tr>
                </table>
                <a href="${window.location.origin}/admin/borrowings" style="display:inline-block;margin-top:16px;background:#0f766e;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Lihat Pengajuan</a>
              </div>`;
              const { data: emailData, error: emailErr } = await supabase.functions.invoke('send-borrowing-email', {
              body: { recipientEmail, subject: 'Pengajuan Peminjaman Menunggu Persetujuan - Smart Sarpras', message: approverMessage },
            });
            if (emailErr) {
              console.error('[BorrowingsAdminPage] Gagal kirim email ke approver berikutnya:', emailErr);
            }
          }
        } else if (nextStepDef && !nextStepDef.role_id) {
          // Dynamic step (role_id null, e.g. step 4 PJ Barang / PJ Fasilitas):
          // Do NOT use role_approver_emails. Read assigned_approver_user_id from
          // borrowing_items, look up admin_users.email, and send to that exact user.
          const assignedItem = (b.borrowing_items ?? []).find((it) => it.assigned_approver_user_id);
          const assignedUserId = assignedItem?.assigned_approver_user_id ?? null;
          if (assignedUserId) {
            const { data: assignedUser } = await supabase
              .from('admin_users')
              .select('email, name')
              .eq('id', assignedUserId)
              .maybeSingle();
            const recipientEmail = (assignedUser as unknown as { email: string } | null)?.email ?? '';
            if (recipientEmail) {
              const approverMessage = `
                <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
                  <h2 style="color:#0f766e;">Pengajuan Peminjaman Menunggu Persetujuan Anda</h2>
                  <p>Ada pengajuan peminjaman yang memerlukan persetujuan Anda pada tahap: <strong>${nextStepDef.step_label}</strong>.</p>
                  <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                    <tr><td style="padding:6px 12px;font-weight:bold;">Nama Pemohon</td><td style="padding:6px 12px;">${b.borrower_name ?? '-'}</td></tr>
                    <tr><td style="padding:6px 12px;font-weight:bold;">Kelas/Unit</td><td style="padding:6px 12px;">${b.borrower_class ?? '-'}</td></tr>
                    <tr><td style="padding:6px 12px;font-weight:bold;">Tanggal</td><td style="padding:6px 12px;">${b.borrow_date ?? '-'} s/d ${b.return_date ?? '-'}</td></tr>
                    <tr><td style="padding:6px 12px;font-weight:bold;">Tujuan</td><td style="padding:6px 12px;">${b.purpose ?? '-'}</td></tr>
                  </table>
                  <a href="${window.location.origin}/admin/borrowings" style="display:inline-block;margin-top:16px;background:#0f766e;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Lihat Pengajuan</a>
                </div>`;
              const { error: emailErr } = await supabase.functions.invoke('send-borrowing-email', {
                body: { recipientEmail, subject: 'Pengajuan Peminjaman Menunggu Persetujuan - Smart Sarpras', message: approverMessage },
              });
              if (emailErr) {
                console.error('[BorrowingsAdminPage] Gagal kirim email ke dynamic approver:', emailErr);
              }
            }
          }
        }
      } catch (emailErr) {
        console.error('[BorrowingsAdminPage] Error saat mengirim email (non-blocking):', emailErr);
      }

      showToast(isLastApproval ? 'Peminjaman berhasil disetujui' : 'Peminjaman diteruskan ke approver berikutnya', 'success');
      await logActivity({
        adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email,
        adminRole: userRoleNames.join(', ') || adminProfile?.role,
        activityType: 'APPROVE', module: 'Borrowings',
        description: `${adminProfile?.name ?? 'Admin'} menyetujui peminjaman ${b.borrower_name ?? ''} (${currentStepDef?.step_label ?? 'approver'})`,
      });
      await fetchBorrowings();
    } catch (err) {
      console.error('[BorrowingsAdminPage] Error tidak terduga saat approve:', err);
      showToast('Terjadi kesalahan saat menyetujui', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ---- Regular workflow: Reject ----
  const handleReject = async (b: Borrowing) => {
    if (!canReject) {
      showToast('Anda tidak memiliki izin menolak peminjaman', 'error');
      return;
    }
    setActionLoadingId(b.id);
    try {
      const nowIso = new Date().toISOString();
      const { error: borrowErr } = await supabase
        .from('borrowings')
        .update({
          status: 'rejected',
          current_status_label: 'Ditolak',
          approved_by: adminProfile?.id ?? null,
          approver_position: adminProfile?.role ?? null,
          approved_at: nowIso,
        })
        .eq('id', b.id);
      if (borrowErr) {
        console.error('[BorrowingsAdminPage] Error UPDATE borrowings (reject):', borrowErr);
        showToast('Gagal menolak peminjaman', 'error');
        setActionLoadingId(null);
        return;
      }

      const items = b.borrowing_items ?? [];
      if (items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('borrowing_items')
          .update({ status: 'rejected', current_status_label: 'Ditolak', updated_at: nowIso })
          .eq('borrowing_id', b.id);
        if (itemsErr) {
          console.error('[BorrowingsAdminPage] Error UPDATE borrowing_items (reject):', itemsErr);
        }
      }

      // Send rejection email to borrower
      try {
        if (b.borrower_email) {
          const rejectMessage = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#dc2626;">Peminjaman Ditolak</h2>
              <p>Halo ${b.borrower_name ?? 'Peminjam'},</p>
              <p>Mohon maaf, pengajuan peminjaman Anda telah <strong>ditolak</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:6px 12px;font-weight:bold;">Nama</td><td style="padding:6px 12px;">${b.borrower_name ?? '-'}</td></tr>
                <tr><td style="padding:6px 12px;font-weight:bold;">Kelas/Unit</td><td style="padding:6px 12px;">${b.borrower_class ?? '-'}</td></tr>
                <tr><td style="padding:6px 12px;font-weight:bold;">Tanggal</td><td style="padding:6px 12px;">${b.borrow_date ?? '-'} s/d ${b.return_date ?? '-'}</td></tr>
                <tr><td style="padding:6px 12px;font-weight:bold;">Tujuan</td><td style="padding:6px 12px;">${b.purpose ?? '-'}</td></tr>
              </table>
              <p>Jika Anda memiliki pertanyaan, silakan hubungi bagian Sarana Prasarana.</p>
            </div>`;
          const { data: emailData, error: emailErr } = await supabase.functions.invoke('send-borrowing-email', {
            body: { recipientEmail: b.borrower_email, subject: 'Peminjaman Ditolak - Smart Sarpras', message: rejectMessage },
          });
          console.log('[BorrowingsAdminPage] invoke response data (reject):', emailData);
          console.log('[BorrowingsAdminPage] invoke response error (reject):', emailErr);
          if (emailErr) {
            console.error('[BorrowingsAdminPage] Gagal kirim email penolakan ke peminjam:', emailErr);
            if (emailErr instanceof FunctionsHttpError) {
              const errStatus = emailErr.context.status;
              const errBody = await emailErr.context.text();
              console.error('[BorrowingsAdminPage] Edge Function status (reject):', errStatus);
              console.error('[BorrowingsAdminPage] Edge Function body (reject):', errBody);
            }
          }
        }
      } catch (emailErr) {
        console.error('[BorrowingsAdminPage] Error saat mengirim email penolakan (non-blocking):', emailErr);
      }

      showToast('Peminjaman ditolak', 'info');
      await logActivity({
        adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email,
        adminRole: userRoleNames.join(', ') || adminProfile?.role,
        activityType: 'REJECT', module: 'Borrowings',
        description: `${adminProfile?.name ?? 'Admin'} menolak peminjaman ${b.borrower_name ?? ''}`,
      });
      await fetchBorrowings();
    } catch (err) {
      console.error('[BorrowingsAdminPage] Error tidak terduga saat reject:', err);
      showToast('Terjadi kesalahan saat menolak', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ---- Super admin delete ----
  const handleDelete = async (b: Borrowing) => {
    if (!isSuperAdmin) return;
    const confirmed = window.confirm(`Hapus peminjaman oleh ${b.borrower_name ?? 'pengguna'}? Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmed) return;
    setActionLoadingId(b.id);
    try {
      const { error: itemsErr } = await supabase.from('borrowing_items').delete().eq('borrowing_id', b.id);
      if (itemsErr) {
        showToast('Gagal menghapus item peminjaman', 'error');
        setActionLoadingId(null);
        return;
      }
      const { error: borrowErr } = await supabase.from('borrowings').delete().eq('id', b.id);
      if (borrowErr) {
        showToast('Gagal menghapus peminjaman', 'error');
        setActionLoadingId(null);
        return;
      }
      showToast('Peminjaman berhasil dihapus.', 'success');
      await logActivity({
        adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email,
        adminRole: userRoleNames.join(', ') || adminProfile?.role,
        activityType: 'DELETE', module: 'Borrowings',
        description: `${adminProfile?.name ?? 'Admin'} menghapus peminjaman ${b.borrower_name ?? ''}`,
      });
      await fetchBorrowings();
    } catch {
      showToast('Terjadi kesalahan saat menghapus', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  // ---- Lainnya: open modal ----
  // Resolve PJ Barang / PJ Fasilitas users by role name directly.
  // No workflow switching — the single Workflow Lainnya handles all steps.
  const openLainnyaModal = async (b: Borrowing, action: 'pj-barang' | 'pj-fasilitas') => {
    setLainnyaBorrowing(b);
    setLainnyaAction(action);
    setSelectedPjId('');
    setPjOptions([]);
    try {
      const targetRoleName = action === 'pj-barang' ? 'PJ Barang' : 'Penanggung Jawab Fasilitas';
      const { data: roleData } = await supabase.from('roles').select('id').eq('name', targetRoleName).eq('is_active', true).maybeSingle();
      const roleId = (roleData as unknown as { id: string } | null)?.id;
      if (!roleId) {
        showToast(`Role "${targetRoleName}" tidak ditemukan`, 'error');
        return;
      }
      const { data: links } = await supabase.from('admin_user_roles').select('admin_user_id').eq('role_id', roleId);
      const adminIds = ((links ?? []) as unknown as { admin_user_id: string }[]).map((l) => l.admin_user_id);
      if (adminIds.length === 0) {
        setPjOptions([]);
        return;
      }
      const { data: admins } = await supabase.from('admin_users').select('id, name, email').in('id', adminIds).eq('is_active', true);
      setPjOptions((admins as unknown as AdminUserOption[]) ?? []);
      if (((admins as unknown as AdminUserOption[]) ?? []).length === 0) {
        showToast(`Tidak ada pengguna aktif dengan role "${targetRoleName}"`, 'info');
      }
    } catch {
      showToast('Gagal memuat daftar PJ', 'error');
    }
  };

  const closeLainnyaModal = () => {
    setLainnyaAction(null);
    setLainnyaBorrowing(null);
    setSelectedPjId('');
    setPjOptions([]);
    setLainnyaSubmitting(false);
  };

  // ---- Lainnya: submit forward ----
  // Stay on the SAME workflow (Workflow Lainnya). Only advance current_step to 4
  // and record the assigned approver on borrowing_items. No workflow switching,
  // no new steps, no hardcoded approval.
  const submitLainnyaForward = async () => {
    if (!lainnyaBorrowing || !lainnyaAction || !selectedPjId) return;
    setLainnyaSubmitting(true);
    try {
      const selectedPj = pjOptions.find((p) => p.id === selectedPjId);
      if (!selectedPj) {
        showToast('Silakan pilih PJ', 'error');
        setLainnyaSubmitting(false);
        return;
      }
      const targetRoleName = lainnyaAction === 'pj-barang' ? 'PJ Barang' : 'Penanggung Jawab Fasilitas';
      const newStatusLabel = `Menunggu Persetujuan ${targetRoleName}`;
      const nowIso = new Date().toISOString();

      const { error: borrowErr } = await supabase
        .from('borrowings')
        .update({
          status: 'pending',
          current_status_label: newStatusLabel,
          current_step: 4,
        })
        .eq('id', lainnyaBorrowing.id);
      if (borrowErr) {
        console.error('[BorrowingsAdminPage] Error UPDATE borrowings (forward):', borrowErr);
        showToast('Gagal meneruskan peminjaman', 'error');
        setLainnyaSubmitting(false);
        return;
      }

      const items = lainnyaBorrowing.borrowing_items ?? [];
      if (items.length > 0) {
        const { error: itemsErr } = await supabase
          .from('borrowing_items')
          .update({
            status: 'pending',
            current_status_label: newStatusLabel,
            assigned_approver_name: selectedPj.name,
            assigned_approver_role: targetRoleName,
            assigned_approver_user_id: selectedPj.id,
            current_step: 4,
            updated_at: nowIso,
          })
          .eq('borrowing_id', lainnyaBorrowing.id);
        if (itemsErr) {
          console.error('[BorrowingsAdminPage] Error UPDATE borrowing_items (forward):', itemsErr);
        }
      }

      // Send email to the selected PJ (the user chosen by PJ Sarpras).
      // Email comes from admin_users (selectedPj.email), not role_approver_emails.
      try {
        const recipientEmail = selectedPj.email ?? '';
        if (recipientEmail) {
          const forwardMessage = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#0f766e;">Pengajuan Peminjaman Menunggu Persetujuan Anda</h2>
              <p>Ada pengajuan peminjaman yang diteruskan kepada Anda sebagai <strong>${targetRoleName}</strong>.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:6px 12px;font-weight:bold;">Nama Pemohon</td><td style="padding:6px 12px;">${lainnyaBorrowing.borrower_name ?? '-'}</td></tr>
                <tr><td style="padding:6px 12px;font-weight:bold;">Kelas/Unit</td><td style="padding:6px 12px;">${lainnyaBorrowing.borrower_class ?? '-'}</td></tr>
                <tr><td style="padding:6px 12px;font-weight:bold;">Tanggal</td><td style="padding:6px 12px;">${lainnyaBorrowing.borrow_date ?? '-'} s/d ${lainnyaBorrowing.return_date ?? '-'}</td></tr>
                <tr><td style="padding:6px 12px;font-weight:bold;">Tujuan</td><td style="padding:6px 12px;">${lainnyaBorrowing.purpose ?? '-'}</td></tr>
              </table>
              <a href="${window.location.origin}/admin/borrowings" style="display:inline-block;margin-top:16px;background:#0f766e;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Lihat Pengajuan</a>
            </div>`;
          const { data: emailData, error: emailErr } = await supabase.functions.invoke('send-borrowing-email', {
            body: { recipientEmail, subject: 'Pengajuan Peminjaman Menunggu Persetujuan - Smart Sarpras', message: forwardMessage },
          });
          console.log('[BorrowingsAdminPage] invoke response data (forward):', emailData);
          console.log('[BorrowingsAdminPage] invoke response error (forward):', emailErr);
          if (emailErr) {
            console.error('[BorrowingsAdminPage] Gagal kirim email forward ke PJ:', emailErr);
            if (emailErr instanceof FunctionsHttpError) {
              const errStatus = emailErr.context.status;
              const errBody = await emailErr.context.text();
              console.error('[BorrowingsAdminPage] Edge Function status (forward):', errStatus);
              console.error('[BorrowingsAdminPage] Edge Function body (forward):', errBody);
            }
          }
        } else {
          console.warn('[BorrowingsAdminPage] Email PJ tujuan tidak ditemukan, email forward tidak dikirim');
        }
      } catch (emailErr) {
        console.error('[BorrowingsAdminPage] Error saat mengirim email forward (non-blocking):', emailErr);
      }

      showToast(`Peminjaman diteruskan ke ${selectedPj.name}`, 'success');
      await logActivity({
        adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email,
        adminRole: userRoleNames.join(', ') || adminProfile?.role,
        activityType: 'FORWARD', module: 'Borrowings',
        description: `${adminProfile?.name ?? 'Admin'} meneruskan peminjaman ${lainnyaBorrowing.borrower_name ?? ''} ke ${targetRoleName} (${selectedPj.name})`,
      });
      closeLainnyaModal();
      await fetchBorrowings();
    } catch (err) {
      console.error('[BorrowingsAdminPage] Error tidak terduga saat forward:', err);
      showToast('Terjadi kesalahan saat meneruskan', 'error');
      setLainnyaSubmitting(false);
    }
  };

  // Filter borrowings: super admin sees all; approvers only see pending borrowings at their step
  const visibleBorrowings = useMemo(() => {
    if (isSuperAdmin) return borrowings;
    return borrowings.filter((b) => (b.status ?? '') === 'pending' && isCurrentApprover(b));
  }, [borrowings, isSuperAdmin, isCurrentApprover]);

  // ---- Render ----
  return (
    <div className="pb-6">
      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Peminjaman Sarana Prasarana</h1>
        <p className="text-sm text-slate-500 dark:text-slate-400">Kelola dan setujui pengajuan peminjaman barang dan fasilitas.</p>
      </div>

      {/* Filters */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari nama, kelas, atau email..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="input pl-9"
          />
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="input sm:w-48">
          <option value="all">Semua Status</option>
          <option value="pending">Menunggu</option>
          <option value="processing">Diproses</option>
          <option value="approved">Disetujui</option>
          <option value="rejected">Ditolak</option>
          <option value="returned">Dikembalikan</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
        </div>
      ) : visibleBorrowings.length === 0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">
          <FileText className="mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Belum ada data peminjaman</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {visibleBorrowings.map((b) => {
            const lainnya = isLainnyaBorrowing(b);
            const items = b.borrowing_items ?? [];
            const showLainnyaActions = canForward(b);
            const busy = actionLoadingId === b.id;

            return (
              <div key={b.id} className="card flex flex-col gap-4">
                {/* Header */}
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                      <Package className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{b.borrower_name ?? 'Tanpa Nama'}</h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">{b.borrower_class ?? '-'}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(b.status)}
                    {isSuperAdmin && (
                      <button
                        type="button"
                        onClick={() => handleDelete(b)}
                        disabled={busy}
                        className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"
                        title="Hapus peminjaman"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Borrower info */}
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">{b.borrower_email ?? '-'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-slate-400" />
                    <span className="truncate">{b.borrower_phone ?? '-'}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>{formatDate(b.borrow_date)}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 text-slate-400" />
                    <span>Kembali: {formatDate(b.return_date)}</span>
                  </div>
                </div>

                {/* Purpose */}
                {b.purpose && (
                  <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    <span className="font-medium">Tujuan: </span>
                    {b.purpose}
                  </p>
                )}

                {/* Items */}
                {items.length > 0 ? (
                  <div className="flex flex-col gap-1.5">
                    <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Item Dipinjam:</span>
                    {items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 text-xs dark:border-slate-800">
                        <span className="font-medium text-slate-700 dark:text-slate-200">{it.item_name ?? 'Item'}</span>
                        <span className="text-slate-500 dark:text-slate-400">{it.quantity ?? 0} unit</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  b.item_type && (
                    <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 text-xs dark:border-slate-800">
                      <span className="font-medium text-slate-700 dark:text-slate-200">{b.item_type}</span>
                      <span className="text-slate-500 dark:text-slate-400">{b.borrowed_units ?? 0} unit</span>
                    </div>
                  )
                )}

                {/* Current status label */}
                {b.current_status_label && (
                  <div className="text-xs text-slate-500 dark:text-slate-400">
                    <span className="font-medium">Status alur: </span>
                    {b.current_status_label}
                  </div>
                )}

                {/* Document */}
                {b.document_url && (
                  <a
                    href={b.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    {b.document_name ?? 'Lihat dokumen'}
                  </a>
                )}

                {/* Actions */}
                <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">
                  {showLainnyaActions ? (
                    <>
                      <button
                        type="button"
                        onClick={() => openLainnyaModal(b, 'pj-barang')}
                        disabled={busy}
                        className="btn-secondary text-xs"
                      >
                        <Forward className="h-3.5 w-3.5" />
                        Teruskan ke PJ Barang
                      </button>
                      <button
                        type="button"
                        onClick={() => openLainnyaModal(b, 'pj-fasilitas')}
                        disabled={busy}
                        className="btn-secondary text-xs"
                      >
                        <Forward className="h-3.5 w-3.5" />
                        Teruskan ke PJ Fasilitas
                      </button>
                    </>
                  ) : (b.status ?? '') === 'pending' && isCurrentApprover(b) ? (
                    <>
                      {canApprove && (
                        <button
                          type="button"
                          onClick={() => handleApprove(b)}
                          disabled={busy}
                          className="btn-primary text-xs"
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Setujui
                        </button>
                      )}
                      {canReject && (
                        <button
                          type="button"
                          onClick={() => handleReject(b)}
                          disabled={busy}
                          className="btn-secondary text-xs"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Tolak
                        </button>
                      )}
                    </>
                  ) : null}
                  {busy && (
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Lainnya forward modal */}
      {lainnyaAction && lainnyaBorrowing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                <Send className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">
                  {lainnyaAction === 'pj-barang' ? 'Teruskan ke PJ Barang' : 'Teruskan ke PJ Fasilitas'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Pilih penerima untuk meneruskan peminjaman.</p>
              </div>
            </div>

            <div className="mb-4">
              <label className="label">Penerima</label>
              <select
                value={selectedPjId}
                onChange={(e) => setSelectedPjId(e.target.value)}
                className="input"
              >
                <option value="">— Pilih {lainnyaAction === 'pj-barang' ? 'PJ Barang' : 'PJ Fasilitas'} —</option>
                {pjOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.email})
                  </option>
                ))}
              </select>
              {pjOptions.length === 0 && (
                <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                  Tidak ada pengguna aktif dengan role ini.
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <button type="button" onClick={closeLainnyaModal} className="btn-secondary" disabled={lainnyaSubmitting}>
                Batal
              </button>
              <button
                type="button"
                onClick={submitLainnyaForward}
                disabled={!selectedPjId || lainnyaSubmitting}
                className="btn-primary"
              >
                {lainnyaSubmitting ? 'Mengirim...' : 'Kirim'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
