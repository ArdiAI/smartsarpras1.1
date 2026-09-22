import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  MessageSquare,
  Loader2,
  Search,
  X,
  Send,
  Mail,
  Building2,
  Trash2,
} from 'lucide-react';

import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));


// =====================================================
// TYPES
// =====================================================

interface Aspirasi {
  id: string;

  nama:
    | string
    | null;

  kelas_unit:
    | string
    | null;

  email:
    | string
    | null;

  kategori:
    | string
    | null;

  judul:
    | string
    | null;

  isi:
    | string
    | null;

  status:
    | string
    | null;

  tanggapan:
    | string
    | null;

  created_at:
    | string
    | null;

  updated_at:
    | string
    | null;
}


interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}


// =====================================================
// STATUS
// =====================================================

const statusStyles:
  Record<
    string,
    string
  > = {
    pending:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',

    responded:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',

    resolved:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  };


const statusLabels:
  Record<
    string,
    string
  > = {
    pending:
      'Menunggu',

    responded:
      'Ditanggapi',

    resolved:
      'Selesai',
  };


const categoryLabels:
  Record<
    string,
    string
  > = {
    fasilitas:
      'Fasilitas',

    inventaris:
      'Inventaris',

    pelayanan:
      'Pelayanan',

    lainnya:
      'Lainnya',
  };


function normalizeStatus(
  status:
    | string
    | null
) {
  if (
    status ===
    'in_review'
  ) {
    return 'responded';
  }


  if (
    status ===
      'pending' ||
    status ===
      'responded' ||
    status ===
      'resolved'
  ) {
    return status;
  }


  return 'pending';
}


// =====================================================
// COMPONENT
// =====================================================

export default function AspirasiAdminPage() {
  const {
    hasPermission,
    isSuperAdmin,
    session,
  } = useAuth();


  const canUpdate =
    hasPermission(
      'aspirasi',
      'update'
    );


  const [
    aspirasi,
    setAspirasi,
  ] =
    useState<
      Aspirasi[]
    >([]);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    search,
    setSearch,
  ] =
    useState('');


  const [
    filterStatus,
    setFilterStatus,
  ] =
    useState('all');


  const [
    modalOpen,
    setModalOpen,
  ] =
    useState(false);


  const [
    editingItem,
    setEditingItem,
  ] =
    useState<
      Aspirasi | null
    >(null);


  const [
    replyText,
    setReplyText,
  ] =
    useState('');


  const [
    statusUpdate,
    setStatusUpdate,
  ] =
    useState(
      'pending'
    );


  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);


  const [
    deletingId,
    setDeletingId,
  ] =
    useState<
      string | null
    >(null);


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
  // LOAD ASPIRASI
  // =====================================================

  const fetchAspirasi =
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
              Aspirasi[]
            >(
              '/api/admin/aspirasi'
            );


          if (
            !response.ok ||
            !result?.ok
          ) {
            throw new Error(
              result?.message ??
                'Gagal memuat aspirasi'
            );
          }


          setAspirasi(
            result.data ??
              []
          );
        } catch (error) {
          console.error(
            '[AspirasiAdminPage] load:',
            error
          );


          showToast(
            error instanceof
              Error
              ? error.message
              : 'Gagal memuat aspirasi',
            'error'
          );


          setAspirasi(
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
    void fetchAspirasi();
  }, [
    fetchAspirasi,
  ]);


  // =====================================================
  // FILTER
  // =====================================================

  const filtered =
    aspirasi.filter(
      (
        item
      ) => {
        const query =
          search
            .trim()
            .toLowerCase();


        const matchSearch =
          !query ||
          (
            item.nama ??
            ''
          )
            .toLowerCase()
            .includes(
              query
            ) ||
          (
            item.judul ??
            ''
          )
            .toLowerCase()
            .includes(
              query
            ) ||
          (
            item.isi ??
            ''
          )
            .toLowerCase()
            .includes(
              query
            );


        const normalized =
          normalizeStatus(
            item.status
          );


        const matchStatus =
          filterStatus ===
            'all' ||
          normalized ===
            filterStatus;


        return (
          matchSearch &&
          matchStatus
        );
      }
    );


  // =====================================================
  // MODAL
  // =====================================================

  const openModal =
    (
      item:
        Aspirasi
    ) => {
      setEditingItem(
        item
      );


      setReplyText(
        item.tanggapan ??
          ''
      );


      setStatusUpdate(
        normalizeStatus(
          item.status
        )
      );


      setModalOpen(
        true
      );
    };


  const closeModal =
    () => {
      if (
        submitting
      ) {
        return;
      }


      setModalOpen(
        false
      );


      setEditingItem(
        null
      );


      setReplyText(
        ''
      );


      setStatusUpdate(
        'pending'
      );
    };


  // =====================================================
  // SIMPAN TANGGAPAN
  // =====================================================

  const handleSubmit =
    async (
      event:
        FormEvent<HTMLFormElement>
    ) => {
      event.preventDefault();


      if (
        !editingItem
      ) {
        return;
      }


      if (
        !canUpdate
      ) {
        showToast(
          'Anda tidak memiliki izin untuk memperbarui aspirasi',
          'error'
        );

        return;
      }


      setSubmitting(
        true
      );


      try {
        const {
          response,
          result,
        } =
          await authFetch<Aspirasi>(
            `/api/admin/aspirasi/${encodeURIComponent(
              editingItem.id
            )}`,
            {
              method:
                'PATCH',

              body:
                JSON.stringify({
                  tanggapan:
                    replyText.trim() ||
                    null,

                  status:
                    statusUpdate,
                }),
            }
          );


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal menyimpan tanggapan'
          );
        }


        showToast(
          'Aspirasi berhasil diperbarui',
          'success'
        );


        setModalOpen(
          false
        );


        setEditingItem(
          null
        );


        setReplyText(
          ''
        );


        setStatusUpdate(
          'pending'
        );


        await fetchAspirasi();
      } catch (error) {
        console.error(
          '[AspirasiAdminPage] update:',
          error
        );


        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal memperbarui aspirasi',
          'error'
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };


  // =====================================================
  // QUICK STATUS
  // =====================================================

  const quickStatusUpdate =
    async (
      item:
        Aspirasi,

      newStatus:
        string
    ) => {
      if (
        !canUpdate
      ) {
        showToast(
          'Anda tidak memiliki izin untuk mengubah status',
          'error'
        );

        return;
      }


      try {
        const {
          response,
          result,
        } =
          await authFetch<Aspirasi>(
            `/api/admin/aspirasi/${encodeURIComponent(
              item.id
            )}`,
            {
              method:
                'PATCH',

              body:
                JSON.stringify({
                  status:
                    newStatus,
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


        showToast(
          'Status berhasil diperbarui',
          'success'
        );


        await fetchAspirasi();
      } catch (error) {
        console.error(
          '[AspirasiAdminPage] status:',
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
  // DELETE SUPER ADMIN
  // =====================================================

  const handleDelete =
    async (
      item:
        Aspirasi
    ) => {
      if (
        !isSuperAdmin
      ) {
        showToast(
          'Hanya Super Admin yang dapat menghapus aspirasi',
          'error'
        );

        return;
      }


      const confirmed =
        window.confirm(
          `Yakin ingin menghapus aspirasi "${
            item.judul ??
            'Tanpa Judul'
          }"?\n\nData yang dihapus tidak dapat dikembalikan.`
        );


      if (!confirmed) {
        return;
      }


      setDeletingId(
        item.id
      );


      try {
        const {
          response,
          result,
        } =
          await authFetch(
            `/api/admin/aspirasi/${encodeURIComponent(
              item.id
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
              'Gagal menghapus aspirasi'
          );
        }


        setAspirasi(
          (
            previous
          ) =>
            previous.filter(
              (
                existing
              ) =>
                existing.id !==
                item.id
            )
        );


        showToast(
          'Aspirasi berhasil dihapus',
          'success'
        );
      } catch (error) {
        console.error(
          '[AspirasiAdminPage] delete:',
          error
        );


        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal menghapus aspirasi',
          'error'
        );
      } finally {
        setDeletingId(
          null
        );
      }
    };


  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="pb-6">

      {/* HEADER */}
      <div className="mb-6">

        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <MessageSquare className="h-6 w-6" />

          Kelola Aspirasi
        </h1>


        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Tinjau dan tanggapi aspirasi pengguna.
        </p>

      </div>


      {/* FILTER */}
      <div className="mb-4 flex flex-wrap items-center gap-3">

        <div className="relative min-w-[200px] flex-1">

          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />


          <input
            value={
              search
            }

            onChange={(
              event
            ) =>
              setSearch(
                event
                  .target
                  .value
              )
            }

            placeholder="Cari nama, judul, isi..."

            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />

        </div>


        <select
          value={
            filterStatus
          }

          onChange={(
            event
          ) =>
            setFilterStatus(
              event
                .target
                .value
            )
          }

          className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">
            Semua Status
          </option>

          <option value="pending">
            Menunggu
          </option>

          <option value="responded">
            Ditanggapi
          </option>

          <option value="resolved">
            Selesai
          </option>
        </select>

      </div>


      {/* LIST */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : filtered.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Tidak ada aspirasi.
        </div>
      ) : (
        <div className="space-y-4">

          {filtered.map(
            (
              item
            ) => {
              const normalizedStatus =
                normalizeStatus(
                  item.status
                );


              return (
                <div
                  key={
                    item.id
                  }

                  className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >

                  {/* HEADER CARD */}
                  <div className="mb-3 flex flex-wrap items-start justify-between gap-2">

                    <div>

                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {item.judul ??
                          'Tanpa Judul'}
                      </h3>


                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">

                        <span>
                          Oleh:{' '}
                          {item.nama ??
                            '-'}
                        </span>


                        <span className="flex items-center gap-1">
                          <Building2 className="h-3 w-3" />

                          {item.kelas_unit ??
                            '-'}
                        </span>


                        {item.email && (
                          <span className="flex items-center gap-1">
                            <Mail className="h-3 w-3" />

                            {
                              item.email
                            }
                          </span>
                        )}


                        {item.kategori && (
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">
                            {categoryLabels[
                              item.kategori
                            ] ??
                              item.kategori}
                          </span>
                        )}

                      </div>

                    </div>


                    <span
                      className={cn(
                        'rounded-full px-2.5 py-0.5 text-xs font-medium',

                        statusStyles[
                          normalizedStatus
                        ] ??
                          statusStyles.pending
                      )}
                    >
                      {statusLabels[
                        normalizedStatus
                      ] ??
                        normalizedStatus}
                    </span>

                  </div>


                  {/* ISI */}
                  <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">
                    {item.isi ??
                      '-'}
                  </p>


                  {/* TANGGAPAN */}
                  {item.tanggapan && (
                    <div className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-900/20">

                      <p className="font-medium text-emerald-700 dark:text-emerald-300">
                        Tanggapan:
                      </p>


                      <p className="text-emerald-600 dark:text-emerald-400">
                        {
                          item.tanggapan
                        }
                      </p>

                    </div>
                  )}


                  {/* ACTION */}
                  <div className="flex flex-wrap items-center gap-2">

                    {canUpdate && (
                      <>
                        <button
                          type="button"

                          onClick={() =>
                            openModal(
                              item
                            )
                          }

                          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700"
                        >
                          <Send className="h-4 w-4" />

                          Tanggapi
                        </button>


                        <select
                          value={
                            normalizedStatus
                          }

                          onChange={(
                            event
                          ) =>
                            void quickStatusUpdate(
                              item,
                              event
                                .target
                                .value
                            )
                          }

                          className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                        >
                          <option value="pending">
                            Menunggu
                          </option>

                          <option value="responded">
                            Ditanggapi
                          </option>

                          <option value="resolved">
                            Selesai
                          </option>
                        </select>
                      </>
                    )}


                    {isSuperAdmin && (
                      <button
                        type="button"

                        onClick={() =>
                          void handleDelete(
                            item
                          )
                        }

                        disabled={
                          deletingId ===
                          item.id
                        }

                        className="inline-flex items-center gap-1.5 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {deletingId ===
                        item.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}


                        {deletingId ===
                        item.id
                          ? 'Menghapus...'
                          : 'Hapus'}
                      </button>
                    )}


                    <span className="ml-auto text-xs text-slate-400">
                      {item.created_at
                        ? new Date(
                            item.created_at
                          ).toLocaleDateString(
                            'id-ID'
                          )
                        : ''}
                    </span>

                  </div>

                </div>
              );
            }
          )}

        </div>
      )}


      {/* MODAL */}
      {modalOpen &&
        editingItem && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"

            onClick={
              closeModal
            }
          >

            <div
              className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"

              onClick={(
                event
              ) =>
                event.stopPropagation()
              }
            >

              <div className="mb-4 flex items-center justify-between">

                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Tanggapi Aspirasi
                </h2>


                <button
                  type="button"

                  onClick={
                    closeModal
                  }

                  disabled={
                    submitting
                  }

                  className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-50 dark:hover:bg-slate-800"
                >
                  <X className="h-5 w-5" />
                </button>

              </div>


              <div className="mb-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">

                <p className="font-medium text-slate-900 dark:text-white">
                  {editingItem.judul ??
                    ''}
                </p>


                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  {editingItem.isi ??
                    ''}
                </p>


                <p className="mt-1 text-xs text-slate-500">
                  Oleh:{' '}
                  {editingItem.nama ??
                    '-'}{' '}
                  (
                  {editingItem.kelas_unit ??
                    '-'}
                  )
                </p>

              </div>


              <form
                onSubmit={
                  handleSubmit
                }

                className="space-y-4"
              >

                <div>

                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Status
                  </label>


                  <select
                    value={
                      statusUpdate
                    }

                    onChange={(
                      event
                    ) =>
                      setStatusUpdate(
                        event
                          .target
                          .value
                      )
                    }

                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="pending">
                      Menunggu
                    </option>

                    <option value="responded">
                      Ditanggapi
                    </option>

                    <option value="resolved">
                      Selesai
                    </option>
                  </select>

                </div>


                <div>

                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Tanggapan
                  </label>


                  <textarea
                    value={
                      replyText
                    }

                    onChange={(
                      event
                    ) =>
                      setReplyText(
                        event
                          .target
                          .value
                      )
                    }

                    rows={
                      4
                    }

                    placeholder="Tulis tanggapan..."

                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />

                </div>


                <div className="flex justify-end gap-3">

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

                    className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
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