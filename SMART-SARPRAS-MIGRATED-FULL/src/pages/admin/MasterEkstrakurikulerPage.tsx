import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  Trophy,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
} from 'lucide-react';

import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auditLog';
import { cn } from '../../utils/cn';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';


interface MasterEkstrakurikuler {
  id: string;
  nama: string;
  is_active: boolean;
  created_at: string;
}


interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}


export default function MasterEkstrakurikulerPage() {
  const {
    hasPermission,
    isSuperAdmin,
    adminProfile,
    userRoleNames,
    session,
  } = useAuth();


  const canManage =
    hasPermission(
      'master_data',
      'manage'
    ) ||
    isSuperAdmin;


  const [
    items,
    setItems,
  ] =
    useState<
      MasterEkstrakurikuler[]
    >([]);


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
    editingId,
    setEditingId,
  ] =
    useState<
      string | null
    >(null);


  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);


  const [
    nama,
    setNama,
  ] =
    useState('');


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
                Authorization:
                  `Bearer ${session.access_token}`,

                ...(options.body
                  ? {
                      'Content-Type':
                        'application/json',
                    }
                  : {}),

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
  // LOAD
  // =====================================================

  const fetchItems =
    useCallback(
      async () => {
        if (
          !session
            ?.access_token
        ) {
          return;
        }


        setLoading(
          true
        );


        try {
          const {
            response,
            result,
          } =
            await authFetch<
              MasterEkstrakurikuler[]
            >(
              '/api/admin/master-ekstrakurikuler'
            );


          if (
            !response.ok ||
            !result?.ok
          ) {
            throw new Error(
              result?.message ??
                'Gagal memuat master ekstrakurikuler'
            );
          }


          setItems(
            result.data ??
              []
          );
        } catch (error) {
          console.error(
            '[MasterEkstrakurikulerPage] load:',
            error
          );

          showToast(
            'Gagal memuat master ekstrakurikuler',
            'error'
          );

          setItems(
            []
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        authFetch,
        session
          ?.access_token,
      ]
    );


  useEffect(() => {
    void fetchItems();
  }, [
    fetchItems,
  ]);


  // =====================================================
  // MODAL
  // =====================================================

  const openCreate =
    () => {
      setEditingId(
        null
      );

      setNama('');

      setModalOpen(
        true
      );
    };


  const openEdit =
    (
      item:
        MasterEkstrakurikuler
    ) => {
      setEditingId(
        item.id
      );

      setNama(
        item.nama
      );

      setModalOpen(
        true
      );
    };


  // =====================================================
  // CREATE / EDIT
  // =====================================================

  const handleSubmit =
    async (
      event:
        FormEvent
    ) => {
      event.preventDefault();


      const cleanNama =
        nama.trim();


      if (!cleanNama) {
        showToast(
          'Nama ekstrakurikuler wajib diisi',
          'warning'
        );

        return;
      }


      setSubmitting(
        true
      );


      try {
        if (
          editingId
        ) {
          const {
            response,
            result,
          } =
            await authFetch<MasterEkstrakurikuler>(
              `/api/admin/master-ekstrakurikuler/${encodeURIComponent(
                editingId
              )}`,
              {
                method:
                  'PATCH',

                body:
                  JSON.stringify({
                    nama:
                      cleanNama,
                  }),
              }
            );


          if (
            !response.ok ||
            !result?.ok
          ) {
            throw new Error(
              result?.message ??
                'Gagal memperbarui ekstrakurikuler'
            );
          }


          showToast(
            'Ekstrakurikuler berhasil diperbarui',
            'success'
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
                'Master Data',

              description:
                `${
                  adminProfile?.name ??
                  'Admin'
                } memperbarui ekstrakurikuler ${cleanNama}`,
            });
          } catch {
            // noop
          }
        }

        else {
          const {
            response,
            result,
          } =
            await authFetch<MasterEkstrakurikuler>(
              '/api/admin/master-ekstrakurikuler',
              {
                method:
                  'POST',

                body:
                  JSON.stringify({
                    nama:
                      cleanNama,
                  }),
              }
            );


          if (
            !response.ok ||
            !result?.ok
          ) {
            throw new Error(
              result?.message ??
                'Gagal menambahkan ekstrakurikuler'
            );
          }


          showToast(
            'Ekstrakurikuler berhasil ditambahkan',
            'success'
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
                'Master Data',

              description:
                `${
                  adminProfile?.name ??
                  'Admin'
                } menambah ekstrakurikuler ${cleanNama}`,
            });
          } catch {
            // noop
          }
        }


        setModalOpen(
          false
        );

        await fetchItems();
      } catch (error) {
        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal menyimpan',
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
      id: string,
      itemName: string
    ) => {
      if (
        !window.confirm(
          `Yakin ingin menghapus ekstrakurikuler "${itemName}"?`
        )
      ) {
        return;
      }


      try {
        const {
          response,
          result,
        } =
          await authFetch(
            `/api/admin/master-ekstrakurikuler/${encodeURIComponent(
              id
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
          throw new Error(
            result?.message ??
              'Gagal menghapus ekstrakurikuler'
          );
        }


        showToast(
          'Ekstrakurikuler berhasil dihapus',
          'success'
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
              'Master Data',

            description:
              `${
                adminProfile?.name ??
                'Admin'
              } menghapus ekstrakurikuler ${itemName}`,
          });
        } catch {
          // noop
        }


        await fetchItems();
      } catch (error) {
        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal menghapus',
          'error'
        );
      }
    };


  // =====================================================
  // TOGGLE
  // =====================================================

  const toggleActive =
    async (
      item:
        MasterEkstrakurikuler
    ) => {
      try {
        const {
          response,
          result,
        } =
          await authFetch<MasterEkstrakurikuler>(
            `/api/admin/master-ekstrakurikuler/${encodeURIComponent(
              item.id
            )}/status`,
            {
              method:
                'PATCH',

              body:
                JSON.stringify({
                  is_active:
                    !item.is_active,
                }),
            }
          );


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal mengubah status'
          );
        }


        await fetchItems();
      } catch (error) {
        console.error(
          '[MasterEkstrakurikulerPage] status:',
          error
        );

        showToast(
          'Gagal mengubah status',
          'error'
        );
      }
    };


  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="pb-6">

      <div className="mb-6 flex items-center justify-between">

        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">

            <Trophy className="h-6 w-6" />

            Master Ekstrakurikuler
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Daftar ekstrakurikuler untuk dropdown Input Kavling.
          </p>
        </div>


        {canManage && (
          <button
            onClick={
              openCreate
            }

            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />

            Tambah
          </button>
        )}

      </div>


      {loading ? (
        <div className="flex items-center justify-center py-12">

          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />

        </div>
      ) : items.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Belum ada data ekstrakurikuler.
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">

          <table className="w-full text-left text-sm">

            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">

              <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">

                <th className="px-4 py-3 font-semibold">
                  Nama Ekstrakurikuler
                </th>

                <th className="px-4 py-3 font-semibold">
                  Status
                </th>

                <th className="px-4 py-3 font-semibold">
                  Aksi
                </th>

              </tr>

            </thead>


            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">

              {items.map(
                (
                  item
                ) => (
                  <tr
                    key={
                      item.id
                    }

                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >

                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {
                        item.nama
                      }
                    </td>


                    <td className="px-4 py-3">

                      <button
                        onClick={() =>
                          canManage &&
                          void toggleActive(
                            item
                          )
                        }

                        disabled={
                          !canManage
                        }

                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',

                          item.is_active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400'
                        )}
                      >
                        {item.is_active
                          ? 'Aktif'
                          : 'Nonaktif'}
                      </button>

                    </td>


                    <td className="px-4 py-3">

                      <div className="flex gap-2">

                        {canManage && (
                          <button
                            onClick={() =>
                              openEdit(
                                item
                              )
                            }

                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}


                        {canManage && (
                          <button
                            onClick={() =>
                              void handleDelete(
                                item.id,
                                item.nama
                              )
                            }

                            className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-4 w-4" />
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
                  ? 'Edit Ekstrakurikuler'
                  : 'Tambah Ekstrakurikuler'}
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
                handleSubmit
              }

              className="space-y-4"
            >

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama Ekstrakurikuler *
                </label>


                <input
                  value={
                    nama
                  }

                  onChange={(
                    event
                  ) =>
                    setNama(
                      event
                        .target
                        .value
                    )
                  }

                  autoFocus

                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"

                  placeholder="Contoh: Pramuka"
                />

              </div>


              <div className="flex justify-end gap-3">

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

                  Simpan
                </button>

              </div>

            </form>

          </div>

        </div>
      )}

    </div>
  );
}