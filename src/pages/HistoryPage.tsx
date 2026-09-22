import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  History,
  Search,
  Trash2,
  CalendarDays,
  Package,
  Building2,
  Loader2,
} from 'lucide-react';

import {
  useAuth,
} from '../context/AuthContext';

import {
  showToast,
} from '../components/Toast';

import AnimatedBackground from '../components/AnimatedBackground';
import EmptyState from '../components/EmptyState';


const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));


interface BorrowingItem {
  id: string;
  item_type: string;
  item_name: string;
  quantity: number;
  status: string;

  current_status_label:
    | string
    | null;
}


interface Borrowing {
  id: string;
  borrower_name: string;

  borrower_class:
    | string
    | null;

  borrow_date: string;

  return_date:
    | string
    | null;

  status: string;

  purpose:
    | string
    | null;

  notes:
    | string
    | null;

  item_type:
    | string
    | null;

  created_at: string;

  borrowing_items:
    BorrowingItem[];
}


interface Agenda {
  id: string;
  title: string;
  event_date: string;

  end_date:
    | string
    | null;

  location:
    | string
    | null;

  organisasi_jurusan:
    | string
    | null;

  status: string;

  jenis_kegiatan:
    | string
    | null;
}


interface HistoryData {
  borrowings:
    Borrowing[];

  agendas:
    Agenda[];
}


interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}


const statusStyles:
  Record<
    string,
    string
  > = {
    pending:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',

    approved:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',

    rejected:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',

    returned:
      'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',

    completed:
      'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
  };


export default function HistoryPage() {
  const {
    hasPermission,
    session,
  } =
    useAuth();


  const canDelete =
    hasPermission(
      'history',
      'delete'
    );


  const [
    borrowings,
    setBorrowings,
  ] =
    useState<
      Borrowing[]
    >([]);


  const [
    agendas,
    setAgendas,
  ] =
    useState<
      Agenda[]
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
    statusFilter,
    setStatusFilter,
  ] =
    useState('');


  const [
    deleting,
    setDeleting,
  ] =
    useState<
      string | null
    >(null);


  const authFetch =
    useCallback(
      async (
        input:
          RequestInfo | URL,

        init:
          RequestInit = {}
      ) => {
        if (
          !session
            ?.access_token
        ) {
          throw new Error(
            'Session login tidak ditemukan'
          );
        }


        return fetch(
          input,
          {
            ...init,

            headers: {
              ...init.headers,

              Authorization:
                `Bearer ${session.access_token}`,
            },
          }
        );
      },
      [
        session
          ?.access_token,
      ]
    );


  // =====================================================
  // LOAD HISTORY
  // =====================================================

  const fetchData =
    useCallback(
      async () => {
        if (
          !session
            ?.access_token
        ) {
          setLoading(
            false
          );

          return;
        }


        setLoading(
          true
        );


        try {
          const response =
            await authFetch(
              `${API_BASE_URL}/api/history`
            );


          const result =
            (await response
              .json()
              .catch(
                () => null
              )) as
                | ApiResponse<HistoryData>
                | null;


          if (
            !response.ok ||
            !result?.ok ||
            !result.data
          ) {
            throw new Error(
              result?.message ??
                'Gagal memuat riwayat'
            );
          }


          setBorrowings(
            result.data
              .borrowings ??
              []
          );


          setAgendas(
            result.data
              .agendas ??
              []
          );
        } catch (error) {
          console.error(
            '[HistoryPage] load:',
            error
          );


          showToast(
            error instanceof
              Error
              ? error.message
              : 'Gagal memuat riwayat',
            'error'
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
    void fetchData();
  }, [
    fetchData,
  ]);


  // =====================================================
  // FILTER
  // =====================================================

  const filteredBorrowings =
    borrowings.filter(
      (
        borrowing
      ) => {
        const query =
          search
            .toLowerCase();


        const matchSearch =
          !search ||

          borrowing
            .borrower_name
            .toLowerCase()
            .includes(
              query
            ) ||

          (
            borrowing.purpose ??
            ''
          )
            .toLowerCase()
            .includes(
              query
            );


        const matchStatus =
          !statusFilter ||
          borrowing.status ===
            statusFilter;


        return (
          matchSearch &&
          matchStatus
        );
      }
    );


  const filteredAgendas =
    agendas.filter(
      (
        agenda
      ) => {
        const query =
          search
            .toLowerCase();


        return (
          !search ||

          agenda.title
            .toLowerCase()
            .includes(
              query
            ) ||

          (
            agenda.organisasi_jurusan ??
            ''
          )
            .toLowerCase()
            .includes(
              query
            )
        );
      }
    );


  // =====================================================
  // DELETE BORROWING
  // =====================================================

  const handleDeleteBorrowing =
    async (
      id:
        string
    ) => {
      if (
        !window.confirm(
          'Yakin ingin menghapus data peminjaman ini?'
        )
      ) {
        return;
      }


      setDeleting(
        id
      );


      try {
        const response =
          await authFetch(
            `${API_BASE_URL}/api/admin/history/borrowings/${id}`,
            {
              method:
                'DELETE',
            }
          );


        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | ApiResponse<{
                  id: string;
                }>
              | null;


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal menghapus'
          );
        }


        showToast(
          'Data peminjaman dihapus',
          'success'
        );


        await fetchData();
      } catch (error) {
        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal menghapus',
          'error'
        );
      } finally {
        setDeleting(
          null
        );
      }
    };


  // =====================================================
  // DELETE AGENDA
  // =====================================================

  const handleDeleteAgenda =
    async (
      id:
        string
    ) => {
      if (
        !window.confirm(
          'Yakin ingin menghapus agenda ini?'
        )
      ) {
        return;
      }


      setDeleting(
        id
      );


      try {
        const response =
          await authFetch(
            `${API_BASE_URL}/api/admin/history/agendas/${id}`,
            {
              method:
                'DELETE',
            }
          );


        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | ApiResponse<{
                  id: string;
                  title?: string;
                }>
              | null;


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal menghapus'
          );
        }


        showToast(
          'Agenda dihapus',
          'success'
        );


        await fetchData();
      } catch (error) {
        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal menghapus',
          'error'
        );
      } finally {
        setDeleting(
          null
        );
      }
    };


  return (
    <div className="relative pb-12">

      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">

        <AnimatedBackground />


        <div className="relative mx-auto max-w-7xl px-4 text-center">

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">

            <History className="h-7 w-7 text-white" />

          </div>


          <h1 className="text-3xl font-bold text-white">
            Riwayat
          </h1>


          <p className="mt-2 text-sm text-white/80">
            Riwayat peminjaman dan agenda kegiatan
          </p>

        </div>

      </div>


      <div className="mx-auto max-w-7xl px-4 py-8">

        {/* FILTER */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">

          <div className="relative flex-1">

            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />


            <input
              value={
                search
              }

              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }

              placeholder="Cari nama / tujuan / agenda…"

              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />

          </div>


          <select
            value={
              statusFilter
            }

            onChange={(
              event
            ) =>
              setStatusFilter(
                event.target.value
              )
            }

            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >

            <option value="">
              Semua Status
            </option>

            <option value="pending">
              Pending
            </option>

            <option value="approved">
              Approved
            </option>

            <option value="rejected">
              Rejected
            </option>

            <option value="returned">
              Returned
            </option>

          </select>

        </div>


        {/* BORROWING */}
        <div className="mb-8">

          <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">
            Riwayat Peminjaman
          </h2>


          {loading ? (
            <div className="space-y-3">

              {[1, 2, 3].map(
                (
                  item
                ) => (
                  <div
                    key={
                      item
                    }

                    className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
                  />
                )
              )}

            </div>
          ) : filteredBorrowings.length ===
            0 ? (
            <EmptyState
              title="Tidak ada riwayat"

              description="Belum ada data peminjaman yang cocok."

              icon={
                <History className="h-8 w-8 text-slate-400" />
              }
            />
          ) : (
            <div className="space-y-3">

              {filteredBorrowings.map(
                (
                  borrowing
                ) => (
                  <div
                    key={
                      borrowing.id
                    }

                    className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  >

                    <div className="flex flex-wrap items-start justify-between gap-2">

                      <div className="min-w-0 flex-1">

                        <div className="flex items-center gap-2">

                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {
                              borrowing.borrower_name
                            }
                          </h3>


                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                              statusStyles[
                                borrowing.status
                              ] ??
                              statusStyles.pending
                            }`}
                          >
                            {
                              borrowing.status
                            }
                          </span>

                        </div>


                        {borrowing.borrower_class && (
                          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                            {
                              borrowing.borrower_class
                            }
                          </p>
                        )}


                        {borrowing.purpose && (
                          <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
                            {
                              borrowing.purpose
                            }
                          </p>
                        )}


                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">

                          <span>
                            Pinjam:{' '}
                            {
                              borrowing.borrow_date
                            }
                          </span>


                          {borrowing.return_date && (
                            <span>
                              Kembali:{' '}
                              {
                                borrowing.return_date
                              }
                            </span>
                          )}

                        </div>


                        {borrowing.borrowing_items?.length >
                          0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">

                            {borrowing.borrowing_items.map(
                              (
                                item
                              ) => (
                                <span
                                  key={
                                    item.id
                                  }

                                  className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                                >

                                  {item.item_type ===
                                  'fasilitas' ? (
                                    <Building2 className="h-3 w-3" />
                                  ) : (
                                    <Package className="h-3 w-3" />
                                  )}


                                  {
                                    item.item_name
                                  }{' '}
                                  ({
                                    item.quantity
                                  })

                                </span>
                              )
                            )}

                          </div>
                        )}

                      </div>


                      {canDelete && (
                        <button
                          onClick={() =>
                            void handleDeleteBorrowing(
                              borrowing.id
                            )
                          }

                          disabled={
                            deleting ===
                            borrowing.id
                          }

                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                        >

                          {deleting ===
                          borrowing.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}

                          Hapus

                        </button>
                      )}

                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </div>


        {/* AGENDA */}
        <div>

          <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">
            Riwayat Agenda
          </h2>


          {loading ? (
            <div className="space-y-3">

              {[1, 2].map(
                (
                  item
                ) => (
                  <div
                    key={
                      item
                    }

                    className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800"
                  />
                )
              )}

            </div>
          ) : filteredAgendas.length ===
            0 ? (
            <EmptyState
              title="Tidak ada agenda"

              description="Belum ada agenda yang cocok."

              icon={
                <CalendarDays className="h-8 w-8 text-slate-400" />
              }
            />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">

              {filteredAgendas.map(
                (
                  agenda
                ) => (
                  <div
                    key={
                      agenda.id
                    }

                    className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
                  >

                    <div className="flex items-start justify-between gap-2">

                      <div className="min-w-0 flex-1">

                        <div className="flex items-center gap-2">

                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {
                              agenda.title
                            }
                          </h3>


                          <span
                            className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                              statusStyles[
                                agenda.status
                              ] ??
                              'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'
                            }`}
                          >
                            {
                              agenda.status
                            }
                          </span>

                        </div>


                        {agenda.jenis_kegiatan && (
                          <span className="mt-1 inline-block rounded-md bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                            {
                              agenda.jenis_kegiatan
                            }
                          </span>
                        )}


                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">

                          <span>
                            {
                              agenda.event_date
                            }

                            {agenda.end_date
                              ? ` - ${agenda.end_date}`
                              : ''}
                          </span>


                          {agenda.location && (
                            <span>
                              ·{' '}
                              {
                                agenda.location
                              }
                            </span>
                          )}


                          {agenda.organisasi_jurusan && (
                            <span>
                              ·{' '}
                              {
                                agenda.organisasi_jurusan
                              }
                            </span>
                          )}

                        </div>

                      </div>


                      {canDelete && (
                        <button
                          onClick={() =>
                            void handleDeleteAgenda(
                              agenda.id
                            )
                          }

                          disabled={
                            deleting ===
                            agenda.id
                          }

                          className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30"
                        >

                          {deleting ===
                          agenda.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}

                          Hapus

                        </button>
                      )}

                    </div>

                  </div>
                )
              )}

            </div>
          )}

        </div>

      </div>

    </div>
  );
}