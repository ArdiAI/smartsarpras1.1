import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

import { getSessionToken } from '../../../lib/appSession';
import { cn } from '../../../utils/cn';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../context/AuthContext';

import {
  Mail,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));

interface ApproverEmail {
  id: string;
  role_id: string | null;
  role_name: string | null;
  approver_email: string;
  approver_name: string;
  is_active: boolean | null;
  created_at: string | null;
  updated_at: string | null;
}

interface Role {
  id: string;
  name: string;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

interface ApproverForm {
  role_id: string;
  role_name: string;
  approver_email: string;
  approver_name: string;
  is_active: boolean;
}

const emptyForm: ApproverForm = {
  role_id: '',
  role_name: '',
  approver_email: '',
  approver_name: '',
  is_active: true,
};

async function getAccessToken() {
  const token =
    getSessionToken();

  if (!token) {
    throw new Error(
      'Sesi login tidak ditemukan. Silakan login kembali.'
    );
  }

  return token;
}

async function adminApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token =
    await getAccessToken();

  const headers =
    new Headers(
      options.headers
    );

  headers.set(
    'Authorization',
    `Bearer ${token}`
  );

  if (
    options.body &&
    !headers.has(
      'Content-Type'
    )
  ) {
    headers.set(
      'Content-Type',
      'application/json'
    );
  }

  const response =
    await fetch(
      `${API_BASE_URL}${path}`,
      {
        ...options,
        headers,
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

  if (
    !response.ok ||
    !result?.ok
  ) {
    throw new Error(
      result?.message ??
        `HTTP ${response.status}`
    );
  }

  return result;
}

export default function ApproverEmailsPage() {
  const {
    hasPermission,
  } = useAuth();

  const canCreate =
    hasPermission(
      'approver_emails',
      'create'
    );

  const canUpdate =
    hasPermission(
      'approver_emails',
      'update'
    );

  const canDelete =
    hasPermission(
      'approver_emails',
      'delete'
    );

  const [
    emails,
    setEmails,
  ] = useState<
    ApproverEmail[]
  >([]);

  const [
    roles,
    setRoles,
  ] = useState<
    Role[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    form,
    setForm,
  ] =
    useState<ApproverForm>({
      ...emptyForm,
    });

  // =====================================================
  // LOAD APPROVER EMAILS
  // =====================================================

  const fetchEmails =
    async () => {
      setLoading(true);

      try {
        const result =
          await adminApi<
            ApproverEmail[]
          >(
            '/api/admin/approver-emails'
          );

        setEmails(
          result.data ?? []
        );
      } catch (error) {
        console.error(
          '[ApproverEmailsPage] GET error:',
          error
        );

        setEmails([]);

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal memuat email approver',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };

  // =====================================================
  // LOAD ROLES
  // =====================================================

  const fetchRoles =
    async () => {
      try {
        const result =
          await adminApi<
            Role[]
          >(
            '/api/admin/approver-email-roles'
          );

        setRoles(
          result.data ?? []
        );
      } catch (error) {
        console.error(
          '[ApproverEmailsPage] ROLES error:',
          error
        );

        setRoles([]);
      }
    };

  useEffect(() => {
    void fetchEmails();
    void fetchRoles();
  }, []);

  // =====================================================
  // OPEN MODAL
  // =====================================================

  const openCreate =
    () => {
      setEditingId(null);

      setForm({
        ...emptyForm,
      });

      setModalOpen(true);
    };

  const openEdit = (
    approver: ApproverEmail
  ) => {
    setEditingId(
      approver.id
    );

    setForm({
      role_id:
        approver.role_id ??
        '',

      role_name:
        approver.role_name ??
        '',

      approver_email:
        approver.approver_email ??
        '',

      approver_name:
        approver.approver_name ??
        '',

      is_active:
        approver.is_active ??
        true,
    });

    setModalOpen(true);
  };

  const closeModal =
    () => {
      if (submitting) {
        return;
      }

      setModalOpen(false);
      setEditingId(null);

      setForm({
        ...emptyForm,
      });
    };

  // =====================================================
  // FORM
  // =====================================================

  const handleRoleChange =
    (
      roleId: string
    ) => {
      const role =
        roles.find(
          (item) =>
            item.id ===
            roleId
        );

      setForm(
        (previous) => ({
          ...previous,

          role_id:
            roleId,

          role_name:
            role?.name ??
            '',
        })
      );
    };

  const handleChange =
    (
      e: ChangeEvent<HTMLInputElement>
    ) => {
      const {
        name,
        value,
        type,
        checked,
      } = e.target;

      setForm(
        (previous) => ({
          ...previous,

          [name]:
            type ===
            'checkbox'
              ? checked
              : value,
        })
      );
    };

  // =====================================================
  // CREATE / UPDATE
  // =====================================================

  const handleSubmit =
    async (
      e: FormEvent
    ) => {
      e.preventDefault();

      if (!form.role_id) {
        showToast(
          'Role wajib dipilih',
          'warning'
        );

        return;
      }

      if (
        !form.approver_email.trim()
      ) {
        showToast(
          'Email approver wajib diisi',
          'warning'
        );

        return;
      }

      if (
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          form.approver_email.trim()
        )
      ) {
        showToast(
          'Format email tidak valid',
          'warning'
        );

        return;
      }

      if (
        !form.approver_name.trim()
      ) {
        showToast(
          'Nama approver wajib diisi',
          'warning'
        );

        return;
      }

      if (submitting) {
        return;
      }

      setSubmitting(true);

      const payload = {
        role_id:
          form.role_id,

        approver_email:
          form.approver_email.trim(),

        approver_name:
          form.approver_name.trim(),

        is_active:
          form.is_active,
      };

      try {
        if (editingId) {
          await adminApi<ApproverEmail>(
            `/api/admin/approver-emails/${encodeURIComponent(
              editingId
            )}`,
            {
              method:
                'PATCH',

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

          showToast(
            'Email approver berhasil diperbarui'
          );
        } else {
          await adminApi<ApproverEmail>(
            '/api/admin/approver-emails',
            {
              method:
                'POST',

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

          showToast(
            'Email approver berhasil ditambahkan'
          );
        }

        setModalOpen(false);
        setEditingId(null);

        setForm({
          ...emptyForm,
        });

        await fetchEmails();
      } catch (error) {
        console.error(
          '[ApproverEmailsPage] SAVE error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal menyimpan email approver',
          'error'
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete =
    async (
      approver: ApproverEmail
    ) => {
      const confirmed =
        window.confirm(
          `Hapus email approver "${approver.approver_email}"?`
        );

      if (!confirmed) {
        return;
      }

      try {
        await adminApi<null>(
          `/api/admin/approver-emails/${encodeURIComponent(
            approver.id
          )}`,
          {
            method:
              'DELETE',
          }
        );

        showToast(
          'Email approver berhasil dihapus'
        );

        await fetchEmails();
      } catch (error) {
        console.error(
          '[ApproverEmailsPage] DELETE error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal menghapus email approver',
          'error'
        );
      }
    };

  return (
    <div className="pb-6">
      {/* HEADER */}

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Mail className="h-6 w-6" />
            Email Approver
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kelola email penanggung jawab persetujuan untuk setiap role.
          </p>
        </div>

        {canCreate && (
          <button
            onClick={
              openCreate
            }
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Tambah Email
          </button>
        )}
      </div>

      {/* TABLE */}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : emails.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Belum ada email approver.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  Role
                </th>

                <th className="px-4 py-3 font-semibold">
                  Nama Approver
                </th>

                <th className="px-4 py-3 font-semibold">
                  Email
                </th>

                <th className="px-4 py-3 font-semibold">
                  Status
                </th>

                <th className="px-4 py-3 text-right font-semibold">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {emails.map(
                (
                  approver
                ) => (
                  <tr
                    key={
                      approver.id
                    }
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3">
                      <span className="inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        {approver.role_name ??
                          '-'}
                      </span>
                    </td>

                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {
                        approver.approver_name
                      }
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {
                        approver.approver_email
                      }
                    </td>

                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',

                          approver.is_active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        )}
                      >
                        {approver.is_active
                          ? 'Aktif'
                          : 'Nonaktif'}
                      </span>
                    </td>

                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-2">
                        {canUpdate && (
                          <button
                            onClick={() =>
                              openEdit(
                                approver
                              )
                            }
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Pencil className="mr-1 inline h-3.5 w-3.5" />
                            Edit
                          </button>
                        )}

                        {canDelete && (
                          <button
                            onClick={() =>
                              void handleDelete(
                                approver
                              )
                            }
                            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingId
                  ? 'Edit Email Approver'
                  : 'Tambah Email Approver'}
              </h2>

              <button
                type="button"
                onClick={
                  closeModal
                }
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-4"
            >
              {/* ROLE */}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Role *
                </label>

                <select
                  value={
                    form.role_id
                  }
                  onChange={(
                    e
                  ) =>
                    handleRoleChange(
                      e.target
                        .value
                    )
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">
                    — Pilih Role —
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
              </div>

              {/* NAME */}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama Approver *
                </label>

                <input
                  name="approver_name"
                  value={
                    form.approver_name
                  }
                  onChange={
                    handleChange
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* EMAIL */}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email Approver *
                </label>

                <input
                  name="approver_email"
                  type="email"
                  value={
                    form.approver_email
                  }
                  onChange={
                    handleChange
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* ACTIVE */}

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input
                    name="is_active"
                    type="checkbox"
                    checked={
                      form.is_active
                    }
                    onChange={
                      handleChange
                    }
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />

                  Aktif
                </label>
              </div>

              {/* ACTION */}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={
                    submitting
                  }
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
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
                  {submitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

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