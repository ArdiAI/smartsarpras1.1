import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import { supabase } from '../../../lib/supabase';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../context/AuthContext';

import {
  Building2,
  Plus,
  Trash2,
  X,
  Loader2,
  Info,
  Star,
} from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

interface Facility {
  id: string;
  name: string;
}

interface AdminUser {
  id: string;
  email: string;
  name: string | null;
}

interface FacilityManager {
  id: string;
  facility_id: string;
  admin_user_id: string;
  is_primary: boolean | null;
  notes: string | null;
  assigned_at: string | null;
  facility_name?: string;
  admin_email?: string;
  admin_name?: string | null;
}

interface ManagerOptions {
  facilities: Facility[];
  adminUsers: AdminUser[];
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

async function getAccessToken() {
  const {
    data,
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
  }

  const token =
    data.session?.access_token;

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
    new Headers(options.headers);

  headers.set(
    'Authorization',
    `Bearer ${token}`
  );

  if (
    options.body &&
    !headers.has('Content-Type')
  ) {
    headers.set(
      'Content-Type',
      'application/json'
    );
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers,
    }
  );

  let result: ApiResponse<T>;

  try {
    result =
      (await response.json()) as ApiResponse<T>;
  } catch {
    throw new Error(
      `API HTTP ${response.status}`
    );
  }

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new Error(
      result.message ??
        `API HTTP ${response.status}`
    );
  }

  return result;
}

export default function FacilityManagersPage() {
  const { hasPermission } =
    useAuth();

  const canCreate =
    hasPermission(
      'facility_managers',
      'create'
    );

  const canDelete =
    hasPermission(
      'facility_managers',
      'delete'
    );

  const [
    managers,
    setManagers,
  ] = useState<
    FacilityManager[]
  >([]);

  const [
    facilities,
    setFacilities,
  ] = useState<Facility[]>([]);

  const [
    adminUsers,
    setAdminUsers,
  ] = useState<AdminUser[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    facilityId,
    setFacilityId,
  ] = useState('');

  const [
    adminUserId,
    setAdminUserId,
  ] = useState('');

  const [
    isPrimary,
    setIsPrimary,
  ] = useState(false);

  const [
    notes,
    setNotes,
  ] = useState('');

  // =====================================================
  // LOAD MANAGERS DARI POSTGRESQL
  // =====================================================

  const fetchManagers =
    async () => {
      setLoading(true);

      try {
        const result =
          await adminApi<
            FacilityManager[]
          >(
            '/api/admin/facility-managers'
          );

        setManagers(
          result.data ?? []
        );
      } catch (error) {
        console.error(
          '[FacilityManagersPage] GET error:',
          error
        );

        setManagers([]);

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal memuat data PJ fasilitas',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };

  // =====================================================
  // LOAD PILIHAN FASILITAS + ADMIN
  // =====================================================

  const fetchOptions =
    async () => {
      try {
        const result =
          await adminApi<
            ManagerOptions
          >(
            '/api/admin/facility-manager-options'
          );

        setFacilities(
          result.data?.facilities ??
            []
        );

        setAdminUsers(
          result.data?.adminUsers ??
            []
        );
      } catch (error) {
        console.error(
          '[FacilityManagersPage] OPTIONS error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal memuat pilihan PJ fasilitas',
          'error'
        );
      }
    };

  useEffect(() => {
    void fetchManagers();
    void fetchOptions();
  }, []);

  // =====================================================
  // OPEN CREATE
  // =====================================================

  const openCreate = () => {
    setFacilityId('');
    setAdminUserId('');
    setIsPrimary(false);
    setNotes('');
    setModalOpen(true);
  };

  // =====================================================
  // ADD MANAGER
  // =====================================================

  const handleAdd = async (
    e: FormEvent
  ) => {
    e.preventDefault();

    if (
      !facilityId ||
      !adminUserId
    ) {
      showToast(
        'Fasilitas dan pengguna wajib dipilih',
        'warning'
      );

      return;
    }

    setSubmitting(true);

    try {
      await adminApi<FacilityManager>(
        '/api/admin/facility-managers',
        {
          method: 'POST',

          body: JSON.stringify({
            facility_id:
              facilityId,

            admin_user_id:
              adminUserId,

            is_primary:
              isPrimary,

            notes:
              notes.trim() ||
              null,
          }),
        }
      );

      showToast(
        'PJ fasilitas berhasil ditambahkan'
      );

      setModalOpen(false);

      await fetchManagers();
    } catch (error) {
      console.error(
        '[FacilityManagersPage] POST error:',
        error
      );

      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal menambahkan PJ fasilitas',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================================
  // DELETE MANAGER
  // =====================================================

  const handleDelete =
    async (
      manager: FacilityManager
    ) => {
      if (
        !window.confirm(
          'Hapus PJ fasilitas ini?'
        )
      ) {
        return;
      }

      try {
        await adminApi<null>(
          `/api/admin/facility-managers/${encodeURIComponent(
            manager.id
          )}`,
          {
            method: 'DELETE',
          }
        );

        showToast(
          'PJ fasilitas berhasil dihapus'
        );

        await fetchManagers();
      } catch (error) {
        console.error(
          '[FacilityManagersPage] DELETE error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal menghapus PJ fasilitas',
          'error'
        );
      }
    };

  return (
    <div className="pb-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Building2 className="h-6 w-6" />
            PJ Fasilitas
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kelola penanggung jawab untuk setiap fasilitas.
          </p>
        </div>

        {canCreate && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Tambah PJ
          </button>
        )}
      </div>

      <div className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-900/20">
        <Info className="mt-0.5 h-5 w-5 shrink-0 text-blue-600 dark:text-blue-400" />

        <div className="text-sm text-blue-700 dark:text-blue-300">
          <p className="font-medium">
            Informasi
          </p>

          <p className="mt-0.5">
            Penanggung Jawab (PJ) fasilitas adalah admin
            yang bertanggung jawab atas fasilitas tertentu.
            Satu fasilitas dapat memiliki beberapa PJ dengan
            satu PJ utama (is_primary).
          </p>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : managers.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Belum ada PJ fasilitas.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">
                  Fasilitas
                </th>

                <th className="px-4 py-3 font-semibold">
                  PJ (Email)
                </th>

                <th className="px-4 py-3 font-semibold">
                  Nama
                </th>

                <th className="px-4 py-3 font-semibold">
                  Utama
                </th>

                <th className="px-4 py-3 font-semibold">
                  Catatan
                </th>

                <th className="px-4 py-3 text-right font-semibold">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {managers.map(
                (manager) => (
                  <tr
                    key={
                      manager.id
                    }
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {manager.facility_name ??
                        'Unknown'}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {manager.admin_email ??
                        'Unknown'}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {manager.admin_name ??
                        '-'}
                    </td>

                    <td className="px-4 py-3">
                      {manager.is_primary ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/40 dark:text-amber-300">
                          <Star className="h-3 w-3" />
                          Utama
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          -
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {manager.notes ??
                        '-'}
                    </td>

                    <td className="px-4 py-3 text-right">
                      {canDelete && (
                        <button
                          onClick={() =>
                            handleDelete(
                              manager
                            )
                          }
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="mr-1 inline h-3.5 w-3.5" />
                          Hapus
                        </button>
                      )}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Tambah PJ Fasilitas
              </h2>

              <button
                type="button"
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
                handleAdd
              }
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Fasilitas *
                </label>

                <select
                  value={
                    facilityId
                  }
                  onChange={(
                    e
                  ) =>
                    setFacilityId(
                      e.target
                        .value
                    )
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">
                    — Pilih Fasilitas —
                  </option>

                  {facilities.map(
                    (facility) => (
                      <option
                        key={
                          facility.id
                        }
                        value={
                          facility.id
                        }
                      >
                        {
                          facility.name
                        }
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Pengguna (Admin) *
                </label>

                <select
                  value={
                    adminUserId
                  }
                  onChange={(
                    e
                  ) =>
                    setAdminUserId(
                      e.target
                        .value
                    )
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">
                    — Pilih Pengguna —
                  </option>

                  {adminUsers.map(
                    (admin) => (
                      <option
                        key={
                          admin.id
                        }
                        value={
                          admin.id
                        }
                      >
                        {
                          admin.email
                        }
                        {admin.name
                          ? ` (${admin.name})`
                          : ''}
                      </option>
                    )
                  )}
                </select>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input
                    type="checkbox"
                    checked={
                      isPrimary
                    }
                    onChange={(
                      e
                    ) =>
                      setIsPrimary(
                        e.target
                          .checked
                      )
                    }
                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />

                  Jadikan PJ Utama
                </label>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Catatan
                </label>

                <textarea
                  value={notes}
                  onChange={(
                    e
                  ) =>
                    setNotes(
                      e.target
                        .value
                    )
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
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