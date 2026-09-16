import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import { cn } from '../../../utils/cn';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../context/AuthContext';
import { logActivity } from '../../../lib/auditLog';

import {
  Workflow,
  Plus,
  Trash2,
  X,
  Loader2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  Info,
} from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

interface WorkflowTemplate {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean | null;
  item_type: string | null;
  created_at: string | null;
  updated_at: string | null;
}

interface WorkflowStep {
  id: string;
  workflow_template_id: string;
  step_order: number;
  role_id: string | null;
  step_label: string;
  is_info_only: boolean | null;
  created_at: string | null;
  role_name?: string | null;
}

interface Role {
  id: string;
  name: string;
}

interface WorkflowStepForm {
  step_order: number;
  role_id: string;
  step_label: string;
  is_info_only: boolean;
}

interface WorkflowListResponse {
  ok: boolean;

  data?: {
    templates: WorkflowTemplate[];
    steps: WorkflowStep[];
    roles: Role[];
  };

  message?: string;
}

interface ApiResponse<T = unknown> {
  ok: boolean;
  data?: T;
  message?: string;
}


// =====================================================
// COMPONENT
// =====================================================

export default function ApprovalWorkflowPage() {
  const {
    hasPermission,
    adminProfile,
    userRoleNames,
    session,
  } = useAuth();

  const canManage =
    hasPermission(
      'workflows',
      'manage'
    );

  const [
    templates,
    setTemplates,
  ] =
    useState<
      WorkflowTemplate[]
    >([]);

  const [
    steps,
    setSteps,
  ] =
    useState<
      Record<
        string,
        WorkflowStep[]
      >
    >({});

  const [
    roles,
    setRoles,
  ] =
    useState<Role[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    modalOpen,
    setModalOpen,
  ] =
    useState(false);

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    tplName,
    setTplName,
  ] =
    useState('');

  const [
    tplDesc,
    setTplDesc,
  ] =
    useState('');

  const [
    tplItemType,
    setTplItemType,
  ] =
    useState('');

  const [
    stepList,
    setStepList,
  ] =
    useState<
      WorkflowStepForm[]
    >([]);


  // =====================================================
  // AUTH FETCH
  // =====================================================

  const authFetch =
    useCallback(
      async <T,>(
        path: string,
        options:
          RequestInit = {}
      ): Promise<{
        response: Response;
        result:
          | ApiResponse<T>
          | null;
      }> => {
        if (
          !session
            ?.access_token
        ) {
          throw new Error(
            'Session login tidak ditemukan'
          );
        }

        const response =
          await fetch(
            `${API_BASE_URL}${path}`,
            {
              ...options,

              headers: {
                'Content-Type':
                  'application/json',

                Authorization:
                  `Bearer ${session.access_token}`,

                ...(options.headers ??
                  {}),
              },
            }
          );

        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | ApiResponse<T>
              | null;

        return {
          response,
          result,
        };
      },
      [
        session
          ?.access_token,
      ]
    );


  // =====================================================
  // LOAD WORKFLOW
  // =====================================================

  const fetchTemplates =
    useCallback(
      async () => {
        setLoading(true);

        try {
          const response =
            await fetch(
              `${API_BASE_URL}/api/admin/workflows`,
              {
                headers: {
                  Authorization:
                    `Bearer ${session?.access_token ?? ''}`,
                },
              }
            );

          const result =
            (await response
              .json()
              .catch(
                () => null
              )) as
              | WorkflowListResponse
              | null;

          if (
            !response.ok ||
            !result?.ok ||
            !result.data
          ) {
            showToast(
              result?.message ??
                'Gagal memuat workflow',
              'error'
            );

            setTemplates([]);
            setSteps({});
            setRoles([]);

            return;
          }

          const loadedTemplates =
            result.data
              .templates ??
            [];

          const loadedSteps =
            result.data.steps ??
            [];

          const loadedRoles =
            result.data.roles ??
            [];

          const stepMap: Record<
            string,
            WorkflowStep[]
          > = {};

          loadedSteps.forEach(
            (step) => {
              const templateId =
                step.workflow_template_id;

              if (
                !stepMap[
                  templateId
                ]
              ) {
                stepMap[
                  templateId
                ] = [];
              }

              stepMap[
                templateId
              ].push(step);
            }
          );

          Object.keys(
            stepMap
          ).forEach(
            (templateId) => {
              stepMap[
                templateId
              ].sort(
                (
                  a,
                  b
                ) =>
                  a.step_order -
                  b.step_order
              );
            }
          );

          setTemplates(
            loadedTemplates
          );

          setSteps(
            stepMap
          );

          setRoles(
            loadedRoles
          );
        } catch (error) {
          console.error(
            '[ApprovalWorkflowPage] load error:',
            error
          );

          showToast(
            'Gagal memuat workflow',
            'error'
          );
        } finally {
          setLoading(false);
        }
      },
      [
        session
          ?.access_token,
      ]
    );


  // =====================================================
  // INITIAL LOAD
  // =====================================================

  useEffect(() => {
    if (
      !session
        ?.access_token
    ) {
      return;
    }

    void fetchTemplates();
  }, [
    session
      ?.access_token,
    fetchTemplates,
  ]);


  // =====================================================
  // CREATE MODAL
  // =====================================================

  const openCreate =
    () => {
      setTplName('');
      setTplDesc('');
      setTplItemType('');

      setStepList([
        {
          step_order: 1,
          role_id: '',
          step_label: '',
          is_info_only:
            false,
        },
      ]);

      setModalOpen(true);
    };


  // =====================================================
  // STEP BUILDER
  // =====================================================

  const addStep =
    () => {
      setStepList(
        (prev) => [
          ...prev,

          {
            step_order:
              prev.length +
              1,

            role_id: '',
            step_label: '',
            is_info_only:
              false,
          },
        ]
      );
    };


  const removeStep =
    (idx: number) => {
      setStepList(
        (prev) =>
          prev
            .filter(
              (
                _,
                i
              ) =>
                i !== idx
            )
            .map(
              (
                step,
                i
              ) => ({
                ...step,
                step_order:
                  i + 1,
              })
            )
      );
    };


  const moveStep =
    (
      idx: number,
      dir: -1 | 1
    ) => {
      setStepList(
        (prev) => {
          const next = [
            ...prev,
          ];

          const target =
            idx + dir;

          if (
            target < 0 ||
            target >=
              next.length
          ) {
            return prev;
          }

          [
            next[idx],
            next[target],
          ] = [
            next[target],
            next[idx],
          ];

          return next.map(
            (
              step,
              i
            ) => ({
              ...step,
              step_order:
                i + 1,
            })
          );
        }
      );
    };


  const updateStep =
    (
      idx: number,
      field:
        keyof WorkflowStepForm,
      value:
        string |
        boolean |
        number
    ) => {
      setStepList(
        (prev) =>
          prev.map(
            (
              step,
              i
            ) =>
              i === idx
                ? {
                    ...step,
                    [field]:
                      value,
                  }
                : step
          )
      );
    };


  // =====================================================
  // CREATE WORKFLOW
  // =====================================================

  const handleCreate =
    async (
      e: FormEvent
    ) => {
      e.preventDefault();

      const cleanName =
        tplName.trim();

      if (!cleanName) {
        showToast(
          'Nama workflow wajib diisi',
          'warning'
        );

        return;
      }

      const validSteps =
        stepList.filter(
          (step) =>
            step.step_label.trim()
        );

      if (
        validSteps.length ===
        0
      ) {
        showToast(
          'Minimal satu langkah dengan label diperlukan',
          'warning'
        );

        return;
      }

      setSubmitting(true);

      try {
        const {
          response,
          result,
        } =
          await authFetch<WorkflowTemplate>(
            '/api/admin/workflows',
            {
              method:
                'POST',

              body:
                JSON.stringify(
                  {
                    name:
                      cleanName,

                    description:
                      tplDesc.trim() ||
                      null,

                    item_type:
                      tplItemType ||
                      null,

                    steps:
                      validSteps.map(
                        (
                          step,
                          index
                        ) => ({
                          step_order:
                            index +
                            1,

                          role_id:
                            step.role_id ||
                            null,

                          step_label:
                            step.step_label.trim(),

                          is_info_only:
                            step.is_info_only,
                        })
                      ),
                  }
                ),
            }
          );

        if (
          !response.ok ||
          !result?.ok
        ) {
          showToast(
            result?.message ??
              'Gagal membuat workflow',
            'error'
          );

          return;
        }

        showToast(
          'Workflow berhasil dibuat'
        );

        try {
          await logActivity({
            adminUserId:
              adminProfile?.id,

            adminName:
              adminProfile?.name,

            adminEmail:
              adminProfile?.email,

            adminRole:
              userRoleNames.join(
                ', '
              ) ||
              adminProfile?.role,

            activityType:
              'CREATE',

            module:
              'Workflow',

            description:
              `${
                adminProfile?.name ??
                'Admin'
              } membuat workflow ${cleanName}`,
          });
        } catch (error) {
          console.error(
            '[ApprovalWorkflowPage] audit create error:',
            error
          );
        }

        setModalOpen(
          false
        );

        await fetchTemplates();
      } catch (error) {
        console.error(
          '[ApprovalWorkflowPage] create error:',
          error
        );

        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal membuat workflow',
          'error'
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };


  // =====================================================
  // TOGGLE STATUS
  // =====================================================

  const toggleActive =
    async (
      template:
        WorkflowTemplate
    ) => {
      try {
        const newStatus =
          !Boolean(
            template.is_active
          );

        const {
          response,
          result,
        } =
          await authFetch<WorkflowTemplate>(
            `/api/admin/workflows/${encodeURIComponent(
              template.id
            )}/status`,
            {
              method:
                'PATCH',

              body:
                JSON.stringify(
                  {
                    is_active:
                      newStatus,
                  }
                ),
            }
          );

        if (
          !response.ok ||
          !result?.ok
        ) {
          showToast(
            result?.message ??
              'Gagal mengubah status',
            'error'
          );

          return;
        }

        showToast(
          'Status workflow diperbarui'
        );

        try {
          await logActivity({
            adminUserId:
              adminProfile?.id,

            adminName:
              adminProfile?.name,

            adminEmail:
              adminProfile?.email,

            adminRole:
              userRoleNames.join(
                ', '
              ) ||
              adminProfile?.role,

            activityType:
              'UPDATE',

            module:
              'Workflow',

            description:
              `${
                adminProfile?.name ??
                'Admin'
              } ${
                template.is_active
                  ? 'menonaktifkan'
                  : 'mengaktifkan'
              } workflow ${
                template.name
              }`,
          });
        } catch (error) {
          console.error(
            '[ApprovalWorkflowPage] audit status error:',
            error
          );
        }

        await fetchTemplates();
      } catch (error) {
        console.error(
          '[ApprovalWorkflowPage] status error:',
          error
        );

        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal mengubah status',
          'error'
        );
      }
    };


  // =====================================================
  // DELETE WORKFLOW
  // =====================================================

  const handleDelete =
    async (
      template:
        WorkflowTemplate
    ) => {
      const confirmed =
        window.confirm(
          `Hapus workflow "${template.name}"? Semua langkah akan ikut terhapus.`
        );

      if (!confirmed) {
        return;
      }

      try {
        const {
          response,
          result,
        } =
          await authFetch<{
            id: string;
            name: string;
          }>(
            `/api/admin/workflows/${encodeURIComponent(
              template.id
            )}`,
            {
              method:
                'DELETE',
            }
          );

        if (
          !response.ok ||
          !result?.ok
        ) {
          showToast(
            result?.message ??
              'Gagal menghapus workflow',
            'error'
          );

          return;
        }

        showToast(
          'Workflow berhasil dihapus'
        );

        try {
          await logActivity({
            adminUserId:
              adminProfile?.id,

            adminName:
              adminProfile?.name,

            adminEmail:
              adminProfile?.email,

            adminRole:
              userRoleNames.join(
                ', '
              ) ||
              adminProfile?.role,

            activityType:
              'DELETE',

            module:
              'Workflow',

            description:
              `${
                adminProfile?.name ??
                'Admin'
              } menghapus workflow ${
                template.name
              }`,
          });
        } catch (error) {
          console.error(
            '[ApprovalWorkflowPage] audit delete error:',
            error
          );
        }

        await fetchTemplates();
      } catch (error) {
        console.error(
          '[ApprovalWorkflowPage] delete error:',
          error
        );

        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal menghapus workflow',
          'error'
        );
      }
    };


  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="pb-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Workflow className="h-6 w-6" />
            Workflow Persetujuan
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
            <Plus className="h-4 w-4" />
            Tambah Workflow
          </button>
        )}
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />

        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">
            Cara Kerja
          </p>

          <p className="mt-0.5">
            Setiap workflow terdiri dari langkah berurutan.
            Setiap langkah memiliki role yang bertugas dan label.
            Langkah "info only" hanya memberi tahu tanpa perlu persetujuan.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : templates.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Belum ada workflow.
        </div>
      ) : (
        <div className="space-y-6">
          {templates.map(
            (template) => {
              const templateSteps =
                steps[
                  template.id
                ] ?? [];

              return (
                <div
                  key={
                    template.id
                  }
                  className={cn(
                    'rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900',

                    template.is_active
                      ? 'border-slate-200 dark:border-slate-800'
                      : 'border-slate-200 opacity-60 dark:border-slate-800'
                  )}
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold text-slate-900 dark:text-white">
                          {
                            template.name
                          }
                        </h3>

                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-medium',

                            template.is_active
                              ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                              : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                          )}
                        >
                          {template.is_active
                            ? 'Aktif'
                            : 'Nonaktif'}
                        </span>

                        {template.item_type && (
                          <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                            {template.item_type ===
                            'barang'
                              ? 'Barang'
                              : template.item_type ===
                                  'fasilitas'
                                ? 'Fasilitas'
                                : 'Lainnya'}
                          </span>
                        )}
                      </div>

                      {template.description && (
                        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                          {
                            template.description
                          }
                        </p>
                      )}
                    </div>

                    {canManage && (
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          onClick={() =>
                            void toggleActive(
                              template
                            )
                          }
                          className={cn(
                            'rounded-lg border px-3 py-1.5 text-xs font-medium',

                            template.is_active
                              ? 'border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/20'
                              : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20'
                          )}
                        >
                          {template.is_active
                            ? 'Nonaktifkan'
                            : 'Aktifkan'}
                        </button>

                        <button
                          onClick={() =>
                            void handleDelete(
                              template
                            )
                          }
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                          Hapus
                        </button>
                      </div>
                    )}
                  </div>

                  {templateSteps.length ===
                  0 ? (
                    <p className="text-sm text-slate-400">
                      Belum ada langkah.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {templateSteps.map(
                        (
                          step,
                          idx
                        ) => (
                          <div
                            key={
                              step.id
                            }
                            className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-800/50"
                          >
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
                              {idx +
                                1}
                            </div>

                            <div className="flex-1">
                              <p className="font-medium text-slate-900 dark:text-white">
                                {
                                  step.step_label
                                }
                              </p>

                              <p className="text-xs text-slate-500 dark:text-slate-400">
                                Role:{' '}
                                {step.role_name ??
                                  'Dynamic (tidak ada role)'}

                                {step.is_info_only
                                  ? ' · (Info only)'
                                  : ''}
                              </p>
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  )}
                </div>
              );
            }
          )}
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
                onClick={() =>
                  setModalOpen(
                    false
                  )
                }
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={
                handleCreate
              }
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama Workflow *
                </label>

                <input
                  type="text"
                  value={tplName}
                  onChange={(
                    e
                  ) =>
                    setTplName(
                      e.target
                        .value
                    )
                  }
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
                  onChange={(
                    e
                  ) =>
                    setTplDesc(
                      e.target
                        .value
                    )
                  }
                  rows={2}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tipe Item
                </label>

                <select
                  value={
                    tplItemType
                  }
                  onChange={(
                    e
                  ) =>
                    setTplItemType(
                      e.target
                        .value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">
                    — Tidak ada
                    (default) —
                  </option>

                  <option value="barang">
                    Barang
                    (Inventaris)
                  </option>

                  <option value="fasilitas">
                    Fasilitas
                  </option>

                  <option value="lainnya">
                    Lainnya
                  </option>
                </select>

                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Menentukan tipe
                  pengajuan yang akan
                  menggunakan workflow
                  ini.
                </p>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Langkah-langkah
                  </label>

                  <button
                    type="button"
                    onClick={
                      addStep
                    }
                    className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Tambah Langkah
                  </button>
                </div>

                <div className="space-y-3">
                  {stepList.map(
                    (
                      step,
                      idx
                    ) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2 rounded-xl border border-slate-200 p-3 dark:border-slate-700"
                      >
                        <div className="flex flex-col items-center pt-1">
                          <GripVertical className="h-4 w-4 text-slate-300" />

                          <span className="text-xs font-bold text-slate-400">
                            {idx +
                              1}
                          </span>
                        </div>

                        <div className="flex-1 space-y-2">
                          <input
                            type="text"
                            placeholder="Label langkah (mis. 'Approval Ketua')"
                            value={
                              step.step_label
                            }
                            onChange={(
                              e
                            ) =>
                              updateStep(
                                idx,
                                'step_label',
                                e
                                  .target
                                  .value
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          />

                          <select
                            value={
                              step.role_id
                            }
                            onChange={(
                              e
                            ) =>
                              updateStep(
                                idx,
                                'role_id',
                                e
                                  .target
                                  .value
                              )
                            }
                            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                          >
                            <option value="">
                              — Dynamic
                              Step (tidak
                              ada role) —
                            </option>

                            {roles.map(
                              (
                                role
                              ) => (
                                <option
                                  key={
                                    role.id
                                  }
                                  value={
                                    role.id
                                  }
                                >
                                  {
                                    role.name
                                  }
                                </option>
                              )
                            )}
                          </select>

                          {step.role_id ===
                            '' && (
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              Langkah
                              dinamis:
                              approver
                              akan
                              ditentukan
                              manual pada
                              saat
                              pengajuan.
                            </p>
                          )}

                          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 dark:text-slate-400">
                            <input
                              type="checkbox"
                              checked={
                                step.is_info_only
                              }
                              onChange={(
                                e
                              ) =>
                                updateStep(
                                  idx,
                                  'is_info_only',
                                  e
                                    .target
                                    .checked
                                )
                              }
                              className="h-3.5 w-3.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                            />

                            Hanya
                            informasi
                            (tidak perlu
                            persetujuan)
                          </label>
                        </div>

                        <div className="flex flex-col gap-1">
                          <button
                            type="button"
                            onClick={() =>
                              moveStep(
                                idx,
                                -1
                              )
                            }
                            disabled={
                              idx ===
                              0
                            }
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              moveStep(
                                idx,
                                1
                              )
                            }
                            disabled={
                              idx ===
                              stepList.length -
                                1
                            }
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removeStep(
                                idx
                              )
                            }
                            disabled={
                              stepList.length ===
                              1
                            }
                            className="rounded p-1 text-red-400 hover:bg-red-50 disabled:opacity-30 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    setModalOpen(
                      false
                    )
                  }
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={
                    submitting
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}

                  {submitting
                    ? 'Menyimpan...'
                    : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}