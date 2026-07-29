import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../context/AuthContext';
import { logActivity } from '../../../lib/auditLog';
import { Workflow, Plus, Trash2, X, Loader2, ArrowUp, ArrowDown, GripVertical, Info } from 'lucide-react';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface WorkflowStep {
  id: string;
  workflow_template_id: string;
  step_order: number;
  role_id: string;
  step_label: string;
  is_info_only: boolean | null;
  created_at: string | null;
  role_name?: string;
}

interface Role {
  id: string;
  name: string;
}

export default function ApprovalWorkflowPage() {
  const { hasPermission, adminProfile, userRoleNames } = useAuth();
  const canManage = hasPermission('workflows', 'manage');

  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [steps, setSteps] = useState<Record<string, WorkflowStep[]>>({});
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplDesc, setTplDesc] = useState('');
  const [stepList, setStepList] = useState<
    { step_order: number; role_id: string; step_label: string; is_info_only: boolean }[]
  >([]);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workflow_templates')
        .select('id, name, description, is_active, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (error) {
        showToast('Gagal memuat workflow', 'error');
        return;
      }
      const tpls = (data ?? []) as unknown as WorkflowTemplate[];
      setTemplates(tpls);

      // Fetch all steps for all templates
      const { data: stepData } = await supabase
        .from('workflow_steps')
        .select('id, workflow_template_id, step_order, role_id, step_label, is_info_only, created_at')
        .order('step_order', { ascending: true });
      const stepMap: Record<string, WorkflowStep[]> = {};
      (stepData ?? []).forEach((s: any) => {
        const tid = s.workflow_template_id as string;
        if (!stepMap[tid]) stepMap[tid] = [];
        stepMap[tid].push(s as unknown as WorkflowStep);
      });

      // Fetch role names
      const { data: roleData } = await supabase
        .from('roles')
        .select('id, name')
        .eq('is_active', true);
      const roleMap = new Map<string, string>();
      (roleData ?? []).forEach((r: any) => roleMap.set(r.id as string, r.name as string));

      // Enrich steps with role names
      Object.keys(stepMap).forEach((tid) => {
        stepMap[tid] = stepMap[tid].map((s) => ({
          ...s,
          role_name: roleMap.get(s.role_id) ?? 'Unknown',
        }));
      });

      setSteps(stepMap);
    } catch {
      showToast('Gagal memuat workflow', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const { data } = await supabase.from('roles').select('id, name').eq('is_active', true).order('name');
      setRoles((data ?? []) as unknown as Role[]);
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    fetchTemplates();
    fetchRoles();
  }, []);

  const openCreate = () => {
    setTplName('');
    setTplDesc('');
    setStepList([{ step_order: 1, role_id: '', step_label: '', is_info_only: false }]);
    setModalOpen(true);
  };

  const addStep = () => {
    setStepList((prev) => [
      ...prev,
      { step_order: prev.length + 1, role_id: '', step_label: '', is_info_only: false },
    ]);
  };

  const removeStep = (idx: number) => {
    setStepList((prev) =>
      prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, step_order: i + 1 }))
    );
  };

  const moveStep = (idx: number, dir: -1 | 1) => {
    setStepList((prev) => {
      const next = [...prev];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[idx], next[target]] = [next[target], next[idx]];
      return next.map((s, i) => ({ ...s, step_order: i + 1 }));
    });
  };

  const updateStep = (idx: number, field: string, value: string | boolean) => {
    setStepList((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, [field]: value } : s))
    );
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim()) {
      showToast('Nama workflow wajib diisi', 'warning');
      return;
    }
    // Validate steps
    const validSteps = stepList.filter((s) => s.role_id && s.step_label.trim());
    if (validSteps.length === 0) {
      showToast('Minimal satu langkah dengan role dan label diperlukan', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const { data: tpl, error: tplErr } = await supabase
        .from('workflow_templates')
        .insert({
          name: tplName.trim(),
          description: tplDesc.trim() || null,
          is_active: true,
        })
        .select('id')
        .single();
      if (tplErr || !tpl) {
        showToast('Gagal membuat workflow: ' + (tplErr?.message ?? ''), 'error');
        return;
      }
      const tplId = (tpl as any).id as string;

      const stepPayload = validSteps.map((s, i) => ({
        workflow_template_id: tplId,
        step_order: i + 1,
        role_id: s.role_id,
        step_label: s.step_label.trim(),
        is_info_only: s.is_info_only,
      }));

      const { error: stepErr } = await supabase.from('workflow_steps').insert(stepPayload);
      if (stepErr) {
        showToast('Gagal menambahkan langkah: ' + stepErr.message, 'error');
        return;
      }

      showToast('Workflow berhasil dibuat');
      await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'CREATE', module: 'Workflow', description: `${adminProfile?.name ?? 'Admin'} membuat workflow ${tplName.trim()}` });
      setModalOpen(false);
      await fetchTemplates();
    } catch {
      showToast('Gagal membuat workflow', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (t: WorkflowTemplate) => {
    try {
      const { error } = await supabase
        .from('workflow_templates')
        .update({ is_active: !t.is_active, updated_at: new Date().toISOString() })
        .eq('id', t.id);
      if (error) {
        showToast('Gagal mengubah status', 'error');
        return;
      }
      showToast('Status workflow diperbarui');
      await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'UPDATE', module: 'Workflow', description: `${adminProfile?.name ?? 'Admin'} ${t.is_active ? 'menonaktifkan' : 'mengaktifkan'} workflow ${t.name}` });
      await fetchTemplates();
    } catch {
      showToast('Gagal mengubah status', 'error');
    }
  };

  const handleDelete = async (t: WorkflowTemplate) => {
    if (!window.confirm(`Hapus workflow "${t.name}"? Semua langkah akan ikut terhapus.`)) return;
    try {
      await supabase.from('workflow_steps').delete().eq('workflow_template_id', t.id);
      const { error } = await supabase.from('workflow_templates').delete().eq('id', t.id);
      if (error) {
        showToast('Gagal menghapus: ' + error.message, 'error');
        return;
      }
      showToast('Workflow berhasil dihapus');
      await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'DELETE', module: 'Workflow', description: `${adminProfile?.name ?? 'Admin'} menghapus workflow ${t.name}` });
      await fetchTemplates();
    } catch {
      showToast('Gagal menghapus workflow', 'error');
    }
  };

  return (
    <div className="pb-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Workflow className="h-6 w-6" /> Workflow Persetujuan
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kelola template dan langkah-langkah workflow persetujuan.
          </p>
        </div>
        {canManage && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Tambah Workflow
          </button>
        )}
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />
        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">Cara Kerja</p>
          <p className="mt-0.5">
            Setiap workflow terdiri dari langkah berururan. Setiap langkah memiliki role yang
            bertugas dan label. Langkah "info only" hanya memberi tahu tanpa perlu persetujuan.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Belum ada workflow.
        </div>
      ) : (
        <div className="space-y-6">
          {templates.map((t) => {
            const tSteps = steps[t.id] ?? [];
            return (
              <div
                key={t.id}
                className={cn(
                  'rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900',
                  t.is_active
                    ? 'border-slate-200 dark:border-slate-800'
                    : 'border-slate-200 opacity-60 dark:border-slate-800'
                )}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                        {t.name}
                      </h3>
                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',
                          t.is_active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        )}
                      >
                        {t.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </div>
                    {t.description && (
                      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                        {t.description}
                      </p>
                    )}
                  </div>
                  {canManage && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleActive(t)}
                        className={cn(
                          'rounded-lg border px-3 py-1.5 text-xs font-medium',
                          t.is_active
                            ? 'border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/20'
                            : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20'
                        )}
                      >
                        {t.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="mr-1 inline h-3.5 w-3.5" /> Hapus
                      </button>
                    </div>
                  )}
                </div>

                {tSteps.length === 0 ? (
                  <p className="text-sm text-slate-400">Belum ada langkah.</p>
                ) : (
                  <div className="space-y-2">
                    {tSteps.map((s, idx) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                      >
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-slate-900 dark:text-white">
                            {s.step_label}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">
                            Role: {s.role_name ?? 'Unknown'}
                            {s.is_info_only ? ' · (Info only)' : ''}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Tambah Workflow
              </h2>
              <button
                onClick={() => setModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama Workflow *
                </label>
                <input
                  type="text"
                  value={tplName}
                  onChange={(e) => setTplName(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Deskripsi
                </label>
                <textarea
                  value={tplDesc}
                  onChange={(e) => setTplDesc(e.target.value)}
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Dynamic Step Builder */}
              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Langkah-langkah
                  </label>
                  <button
                    type="button"
                    onClick={addStep}
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Plus className="h-3.5 w-3.5" /> Tambah Langkah
                  </button>
                </div>
                <div className="space-y-3">
                  {stepList.map((s, idx) => (
                    <div
                      key={idx}
                      className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                    >
                      <div className="flex flex-col items-center pt-1">
                        <GripVertical className="h-4 w-4 text-slate-300" />
                        <span className="text-xs font-bold text-slate-400">{idx + 1}</span>
                      </div>
                      <div className="flex-1 space-y-2">
                        <input
                          type="text"
                          placeholder="Label langkah (mis. 'Approval Ketua')"
                          value={s.step_label}
                          onChange={(e) => updateStep(idx, 'step_label', e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        />
                        <select
                          value={s.role_id}
                          onChange={(e) => updateStep(idx, 'role_id', e.target.value)}
                          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="">— Pilih Role —</option>
                          {roles.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                        </select>
                        <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                          <input
                            type="checkbox"
                            checked={s.is_info_only}
                            onChange={(e) => updateStep(idx, 'is_info_only', e.target.checked)}
                            className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                          />
                          Hanya informasi (tidak perlu persetujuan)
                        </label>
                      </div>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => moveStep(idx, -1)}
                          disabled={idx === 0}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => moveStep(idx, 1)}
                          disabled={idx === stepList.length - 1}
                          className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                        >
                          <ArrowDown className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => removeStep(idx)}
                          disabled={stepList.length === 1}
                          className="rounded p-1 text-red-400 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
