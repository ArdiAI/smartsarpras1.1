import {
  useCallback,
  useEffect,
  useState,
} from 'react';

import {
  CheckCircle2,
  XCircle,
  Trash2,
  Search,
  FileText,
  Mail,
  Phone,
  Calendar,
  Package,
  Send,
  Forward,
} from 'lucide-react';

import { cn } from '../../utils/cn';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auditLog';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';


// =====================================================
// TYPES
// =====================================================

interface BorrowingItem {
  id: string;
  borrowing_id: string;

  inventory_id:
    | string
    | null;

  facility_id:
    | string
    | null;

  item_type:
    | string
    | null;

  item_name:
    | string
    | null;

  quantity:
    | number
    | null;

  status:
    | string
    | null;

  current_status_label:
    | string
    | null;

  workflow_template_id:
    | string
    | null;

  current_step:
    | number
    | null;

  assigned_approver_name:
    | string
    | null;

  assigned_approver_role:
    | string
    | null;

  assigned_approver_user_id:
    | string
    | null;

  created_at:
    | string
    | null;

  updated_at:
    | string
    | null;
}


interface BorrowingActions {
  is_current_approver: boolean;
  can_forward: boolean;
}


interface Borrowing {
  id: string;

  inventory_id:
    | string
    | null;

  borrower_name:
    | string
    | null;

  borrower_class:
    | string
    | null;

  borrowed_units:
    | number
    | null;

  borrow_date:
    | string
    | null;

  return_date:
    | string
    | null;

  actual_return_date:
    | string
    | null;

  status:
    | string
    | null;

  notes:
    | string
    | null;

  created_at:
    | string
    | null;

  borrower_email:
    | string
    | null;

  borrower_phone:
    | string
    | null;

  item_type:
    | string
    | null;

  facility_id:
    | string
    | null;

  purpose:
    | string
    | null;

  admin_notes:
    | string
    | null;

  start_time:
    | string
    | null;

  end_time:
    | string
    | null;

  document_url:
    | string
    | null;

  document_name:
    | string
    | null;

  approved_by:
    | string
    | null;

  approver_position:
    | string
    | null;

  approved_at:
    | string
    | null;

  workflow_template_id:
    | string
    | null;

  current_step:
    | number
    | null;

  current_status_label:
    | string
    | null;

  drive_file_id:
    | string
    | null;

  drive_file_url:
    | string
    | null;

  department:
    | string
    | null;

  borrowing_items:
    | BorrowingItem[]
    | null;

  actions?: BorrowingActions;
}


interface AdminUserOption {
  id: string;
  name: string;
  email: string;
}


interface ForwardOptionsData {
  role_id: string;
  role_name: string;
  options: AdminUserOption[];
}


interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}


type LainnyaAction =
  | 'pj-barang'
  | 'pj-fasilitas'
  | null;


// =====================================================
// STATUS
// =====================================================

const STATUS_LABELS: Record<
  string,
  {
    label: string;
    cls: string;
  }
> = {
  pending: {
    label: 'Menunggu',

    cls:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },

  approved: {
    label: 'Disetujui',

    cls:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },

  rejected: {
    label: 'Ditolak',

    cls:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },

  returned: {
    label: 'Dikembalikan',

    cls:
      'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
  },

  processing: {
    label: 'Diproses',

    cls:
      'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  },
};


function statusBadge(
  status: string | null
) {
  const key =
    (status ?? 'pending')
      .toLowerCase();

  const config =
    STATUS_LABELS[
      key
    ] ?? {
      label:
        status ??
        'Pending',

      cls:
        'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300',
    };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        config.cls
      )}
    >
      {config.label}
    </span>
  );
}


function formatDate(
  value: string | null
): string {
  if (!value) {
    return '-';
  }

  try {
    const date =
      new Date(value);

    if (
      Number.isNaN(
        date.getTime()
      )
    ) {
      return value;
    }

    return date.toLocaleDateString(
      'id-ID',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    );
  } catch {
    return value;
  }
}


// =====================================================
// COMPONENT
// =====================================================

export default function BorrowingsAdminPage() {
  const {
    isSuperAdmin,
    userRoleNames,
    hasPermission,
    adminProfile,
    session,
  } = useAuth();


  const [
    borrowings,
    setBorrowings,
  ] =
    useState<
      Borrowing[]
    >([]);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    searchTerm,
    setSearchTerm,
  ] =
    useState('');


  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState(
      'all'
    );


  const [
    actionLoadingId,
    setActionLoadingId,
  ] =
    useState<
      string | null
    >(null);


  const [
    lainnyaAction,
    setLainnyaAction,
  ] =
    useState<LainnyaAction>(
      null
    );


  const [
    lainnyaBorrowing,
    setLainnyaBorrowing,
  ] =
    useState<
      Borrowing | null
    >(null);


  const [
    pjOptions,
    setPjOptions,
  ] =
    useState<
      AdminUserOption[]
    >([]);


  const [
    selectedPjId,
    setSelectedPjId,
  ] =
    useState('');


  const [
    forwardRoleName,
    setForwardRoleName,
  ] =
    useState('');


  const [
    lainnyaSubmitting,
    setLainnyaSubmitting,
  ] =
    useState(
      false
    );


  const canApprove =
    hasPermission(
      'borrowings',
      'approve'
    );


  const canReject =
    hasPermission(
      'borrowings',
      'reject'
    );


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
  // LOAD DATA
  // =====================================================

  const fetchBorrowings =
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
          const params =
            new URLSearchParams();


          params.set(
            'status',
            statusFilter
          );


          if (
            searchTerm.trim()
          ) {
            params.set(
              'search',
              searchTerm.trim()
            );
          }


          const {
            response,
            result,
          } =
            await authFetch<
              Borrowing[]
            >(
              `/api/admin/borrowings?${params.toString()}`
            );


          if (
            !response.ok ||
            !result?.ok
          ) {
            showToast(
              result?.message ??
                'Gagal memuat data peminjaman',
              'error'
            );

            setBorrowings(
              []
            );

            return;
          }


          setBorrowings(
            result.data ??
              []
          );
        } catch (error) {
          console.error(
            '[BorrowingsAdminPage] load error:',
            error
          );

          showToast(
            'Gagal memuat data peminjaman',
            'error'
          );

          setBorrowings(
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
        searchTerm,
        session
          ?.access_token,
        statusFilter,
      ]
    );


  useEffect(() => {
    void fetchBorrowings();
  }, [
    fetchBorrowings,
  ]);


  // =====================================================
  // APPROVE
  // =====================================================

  const handleApprove =
    async (
      borrowing:
        Borrowing
    ) => {
      if (!canApprove) {
        showToast(
          'Anda tidak memiliki izin menyetujui peminjaman',
          'error'
        );

        return;
      }


      setActionLoadingId(
        borrowing.id
      );


      try {
        const {
          response,
          result,
        } =
          await authFetch(
            `/api/admin/borrowings/${encodeURIComponent(
              borrowing.id
            )}/approve`,
            {
              method:
                'POST',
            }
          );


        if (
          !response.ok ||
          !result?.ok
        ) {
          showToast(
            result?.message ??
              'Gagal menyetujui peminjaman',
            'error'
          );

          return;
        }


        showToast(
          'Proses persetujuan berhasil',
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
              'APPROVE',

            module:
              'Borrowings',

            description:
              `${
                adminProfile?.name ??
                'Admin'
              } menyetujui peminjaman ${
                borrowing.borrower_name ??
                ''
              }`,
          });
        } catch (error) {
          console.error(
            '[BorrowingsAdminPage] audit approve:',
            error
          );
        }


        await fetchBorrowings();
      } catch (error) {
        console.error(
          '[BorrowingsAdminPage] approve:',
          error
        );

        showToast(
          error instanceof
            Error
            ? error.message
            : 'Terjadi kesalahan saat menyetujui',
          'error'
        );
      } finally {
        setActionLoadingId(
          null
        );
      }
    };


  // =====================================================
  // REJECT
  // =====================================================

  const handleReject =
    async (
      borrowing:
        Borrowing
    ) => {
      if (!canReject) {
        showToast(
          'Anda tidak memiliki izin menolak peminjaman',
          'error'
        );

        return;
      }


      setActionLoadingId(
        borrowing.id
      );


      try {
        const {
          response,
          result,
        } =
          await authFetch(
            `/api/admin/borrowings/${encodeURIComponent(
              borrowing.id
            )}/reject`,
            {
              method:
                'POST',
            }
          );


        if (
          !response.ok ||
          !result?.ok
        ) {
          showToast(
            result?.message ??
              'Gagal menolak peminjaman',
            'error'
          );

          return;
        }


        showToast(
          'Peminjaman ditolak',
          'info'
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
              'REJECT',

            module:
              'Borrowings',

            description:
              `${
                adminProfile?.name ??
                'Admin'
              } menolak peminjaman ${
                borrowing.borrower_name ??
                ''
              }`,
          });
        } catch (error) {
          console.error(
            '[BorrowingsAdminPage] audit reject:',
            error
          );
        }


        await fetchBorrowings();
      } catch (error) {
        console.error(
          '[BorrowingsAdminPage] reject:',
          error
        );

        showToast(
          error instanceof
            Error
            ? error.message
            : 'Terjadi kesalahan saat menolak',
          'error'
        );
      } finally {
        setActionLoadingId(
          null
        );
      }
    };


  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete =
    async (
      borrowing:
        Borrowing
    ) => {
      if (!isSuperAdmin) {
        return;
      }


      const confirmed =
        window.confirm(
          `Hapus peminjaman oleh ${
            borrowing.borrower_name ??
            'pengguna'
          }? Tindakan ini tidak dapat dibatalkan.`
        );


      if (!confirmed) {
        return;
      }


      setActionLoadingId(
        borrowing.id
      );


      try {
        const {
          response,
          result,
        } =
          await authFetch(
            `/api/admin/borrowings/${encodeURIComponent(
              borrowing.id
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
              'Gagal menghapus peminjaman',
            'error'
          );

          return;
        }


        showToast(
          'Peminjaman berhasil dihapus.',
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
              'Borrowings',

            description:
              `${
                adminProfile?.name ??
                'Admin'
              } menghapus peminjaman ${
                borrowing.borrower_name ??
                ''
              }`,
          });
        } catch (error) {
          console.error(
            '[BorrowingsAdminPage] audit delete:',
            error
          );
        }


        await fetchBorrowings();
      } catch (error) {
        console.error(
          '[BorrowingsAdminPage] delete:',
          error
        );

        showToast(
          'Terjadi kesalahan saat menghapus',
          'error'
        );
      } finally {
        setActionLoadingId(
          null
        );
      }
    };


  // =====================================================
  // OPEN FORWARD MODAL
  // =====================================================

  const openLainnyaModal =
    async (
      borrowing:
        Borrowing,

      action:
        | 'pj-barang'
        | 'pj-fasilitas'
    ) => {
      const target =
        action ===
        'pj-barang'
          ? 'barang'
          : 'fasilitas';


      setLainnyaBorrowing(
        borrowing
      );

      setLainnyaAction(
        action
      );

      setSelectedPjId(
        ''
      );

      setPjOptions(
        []
      );

      setForwardRoleName(
        ''
      );


      try {
        const {
          response,
          result,
        } =
          await authFetch<ForwardOptionsData>(
            `/api/admin/borrowings/${encodeURIComponent(
              borrowing.id
            )}/forward-options?target=${encodeURIComponent(
              target
            )}`
          );


        if (
          !response.ok ||
          !result?.ok ||
          !result.data
        ) {
          showToast(
            result?.message ??
              'Gagal memuat daftar PJ',
            'error'
          );

          return;
        }


        setPjOptions(
          result.data
            .options ??
            []
        );


        setForwardRoleName(
          result.data
            .role_name ??
            ''
        );


        if (
          (
            result.data
              .options ??
            []
          ).length ===
          0
        ) {
          showToast(
            `Tidak ada pengguna aktif dengan role "${
              result.data
                .role_name ??
              'Specialist'
            }"`,
            'info'
          );
        }
      } catch (error) {
        console.error(
          '[BorrowingsAdminPage] forward options:',
          error
        );

        showToast(
          'Gagal memuat daftar PJ',
          'error'
        );
      }
    };


  // =====================================================
  // CLOSE FORWARD
  // =====================================================

  const closeLainnyaModal =
    () => {
      setLainnyaAction(
        null
      );

      setLainnyaBorrowing(
        null
      );

      setSelectedPjId(
        ''
      );

      setPjOptions(
        []
      );

      setForwardRoleName(
        ''
      );

      setLainnyaSubmitting(
        false
      );
    };


  // =====================================================
  // SUBMIT FORWARD
  // =====================================================

  const submitLainnyaForward =
    async () => {
      if (
        !lainnyaBorrowing ||
        !lainnyaAction ||
        !selectedPjId
      ) {
        return;
      }


      const selectedPj =
        pjOptions.find(
          (option) =>
            option.id ===
            selectedPjId
        );


      if (!selectedPj) {
        showToast(
          'Silakan pilih PJ',
          'error'
        );

        return;
      }


      const target =
        lainnyaAction ===
        'pj-barang'
          ? 'barang'
          : 'fasilitas';


      setLainnyaSubmitting(
        true
      );


      try {
        const {
          response,
          result,
        } =
          await authFetch(
            `/api/admin/borrowings/${encodeURIComponent(
              lainnyaBorrowing.id
            )}/forward`,
            {
              method:
                'POST',

              body:
                JSON.stringify(
                  {
                    target,

                    admin_user_id:
                      selectedPj.id,
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
              'Gagal meneruskan peminjaman',
            'error'
          );

          return;
        }


        showToast(
          `Peminjaman diteruskan ke ${selectedPj.name}`,
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
              'FORWARD',

            module:
              'Borrowings',

            description:
              `${
                adminProfile?.name ??
                'Admin'
              } meneruskan peminjaman ${
                lainnyaBorrowing.borrower_name ??
                ''
              } ke ${
                forwardRoleName ||
                'PJ'
              } (${selectedPj.name})`,
          });
        } catch (error) {
          console.error(
            '[BorrowingsAdminPage] audit forward:',
            error
          );
        }


        closeLainnyaModal();

        await fetchBorrowings();
      } catch (error) {
        console.error(
          '[BorrowingsAdminPage] forward:',
          error
        );

        showToast(
          error instanceof
            Error
            ? error.message
            : 'Terjadi kesalahan saat meneruskan',
          'error'
        );
      } finally {
        setLainnyaSubmitting(
          false
        );
      }
    };


  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="pb-6">

      <div className="mb-6 flex flex-col gap-1">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
          Peminjaman Sarana Prasarana
        </h1>

        <p className="text-sm text-slate-500 dark:text-slate-400">
          Kelola dan setujui pengajuan peminjaman barang dan fasilitas.
        </p>
      </div>


      {/* FILTERS */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            type="text"

            placeholder="Cari nama, kelas, atau email..."

            value={
              searchTerm
            }

            onChange={(
              event
            ) =>
              setSearchTerm(
                event
                  .target
                  .value
              )
            }

            className="input pl-9"
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
              event
                .target
                .value
            )
          }

          className="input sm:w-48"
        >
          <option value="all">
            Semua Status
          </option>

          <option value="pending">
            Menunggu
          </option>

          <option value="processing">
            Diproses
          </option>

          <option value="approved">
            Disetujui
          </option>

          <option value="rejected">
            Ditolak
          </option>

          <option value="returned">
            Dikembalikan
          </option>
        </select>

      </div>


      {/* DATA */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand-600" />
        </div>
      ) : borrowings.length ===
        0 ? (
        <div className="card flex flex-col items-center justify-center py-16 text-center">

          <FileText className="mb-3 h-10 w-10 text-slate-300" />

          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Belum ada data peminjaman
          </p>

        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">

          {borrowings.map(
            (
              borrowing
            ) => {
              const items =
                borrowing.borrowing_items ??
                [];


              const busy =
                actionLoadingId ===
                borrowing.id;


              const showForward =
                Boolean(
                  borrowing
                    .actions
                    ?.can_forward
                );


              const isCurrentApprover =
                Boolean(
                  borrowing
                    .actions
                    ?.is_current_approver
                );


              return (
                <div
                  key={
                    borrowing.id
                  }

                  className="card flex flex-col gap-4"
                >

                  {/* HEADER */}
                  <div className="flex items-start justify-between gap-3">

                    <div className="flex items-start gap-3">

                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                        <Package className="h-5 w-5" />
                      </div>


                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {borrowing.borrower_name ??
                            'Tanpa Nama'}
                        </h3>

                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {borrowing.borrower_class ??
                            '-'}
                        </p>
                      </div>

                    </div>


                    <div className="flex items-center gap-2">

                      {statusBadge(
                        borrowing.status
                      )}


                      {isSuperAdmin && (
                        <button
                          type="button"

                          onClick={() =>
                            void handleDelete(
                              borrowing
                            )
                          }

                          disabled={
                            busy
                          }

                          className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-900/20"

                          title="Hapus peminjaman"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}

                    </div>

                  </div>


                  {/* INFO */}
                  <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 dark:text-slate-300">

                    <div className="flex items-center gap-1.5">
                      <Mail className="h-3.5 w-3.5 text-slate-400" />

                      <span className="truncate">
                        {borrowing.borrower_email ??
                          '-'}
                      </span>
                    </div>


                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-slate-400" />

                      <span className="truncate">
                        {borrowing.borrower_phone ??
                          '-'}
                      </span>
                    </div>


                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />

                      <span>
                        {formatDate(
                          borrowing.borrow_date
                        )}
                      </span>
                    </div>


                    <div className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />

                      <span>
                        Kembali:{' '}

                        {formatDate(
                          borrowing.return_date
                        )}
                      </span>
                    </div>

                  </div>


                  {/* PURPOSE */}
                  {borrowing.purpose && (
                    <p className="rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">

                      <span className="font-medium">
                        Tujuan:{' '}
                      </span>

                      {
                        borrowing.purpose
                      }

                    </p>
                  )}


                  {/* ITEMS */}
                  {items.length >
                  0 ? (
                    <div className="flex flex-col gap-1.5">

                      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                        Item Dipinjam:
                      </span>


                      {items.map(
                        (
                          item
                        ) => (
                          <div
                            key={
                              item.id
                            }

                            className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 text-xs dark:border-slate-800"
                          >
                            <span className="font-medium text-slate-700 dark:text-slate-200">
                              {item.item_name ??
                                'Item'}
                            </span>

                            <span className="text-slate-500 dark:text-slate-400">
                              {item.quantity ??
                                0}{' '}
                              unit
                            </span>
                          </div>
                        )
                      )}

                    </div>
                  ) : (
                    borrowing.item_type && (
                      <div className="flex items-center justify-between rounded-lg border border-slate-100 px-3 py-1.5 text-xs dark:border-slate-800">

                        <span className="font-medium text-slate-700 dark:text-slate-200">
                          {
                            borrowing.item_type
                          }
                        </span>

                        <span className="text-slate-500 dark:text-slate-400">
                          {borrowing.borrowed_units ??
                            0}{' '}
                          unit
                        </span>

                      </div>
                    )
                  )}


                  {/* FLOW STATUS */}
                  {borrowing.current_status_label && (
                    <div className="text-xs text-slate-500 dark:text-slate-400">

                      <span className="font-medium">
                        Status alur:{' '}
                      </span>

                      {
                        borrowing.current_status_label
                      }

                    </div>
                  )}


                  {/* DOCUMENT */}
                  {borrowing.document_url && (
                    <a
                      href={
                        borrowing.document_url
                      }

                      target="_blank"

                      rel="noreferrer"

                      className="inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline dark:text-brand-400"
                    >
                      <FileText className="h-3.5 w-3.5" />

                      {borrowing.document_name ??
                        'Lihat dokumen'}
                    </a>
                  )}


                  {/* ACTIONS */}
                  <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3 dark:border-slate-800">

                    {showForward ? (
                      <>
                        <button
                          type="button"

                          onClick={() =>
                            void openLainnyaModal(
                              borrowing,
                              'pj-barang'
                            )
                          }

                          disabled={
                            busy
                          }

                          className="btn-secondary text-xs"
                        >
                          <Forward className="h-3.5 w-3.5" />

                          Teruskan ke PJ Barang
                        </button>


                        <button
                          type="button"

                          onClick={() =>
                            void openLainnyaModal(
                              borrowing,
                              'pj-fasilitas'
                            )
                          }

                          disabled={
                            busy
                          }

                          className="btn-secondary text-xs"
                        >
                          <Forward className="h-3.5 w-3.5" />

                          Teruskan ke PJ Fasilitas
                        </button>
                      </>
                    ) : String(
                        borrowing.status ??
                          ''
                      ) ===
                        'pending' &&
                      isCurrentApprover ? (
                      <>

                        {canApprove && (
                          <button
                            type="button"

                            onClick={() =>
                              void handleApprove(
                                borrowing
                              )
                            }

                            disabled={
                              busy
                            }

                            className="btn-primary text-xs"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />

                            Setujui
                          </button>
                        )}


                        {canReject && (
                          <button
                            type="button"

                            onClick={() =>
                              void handleReject(
                                borrowing
                              )
                            }

                            disabled={
                              busy
                            }

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
            }
          )}

        </div>
      )}


      {/* FORWARD MODAL */}
      {lainnyaAction &&
        lainnyaBorrowing && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

            <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900">

              <div className="mb-4 flex items-center gap-3">

                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                  <Send className="h-5 w-5" />
                </div>


                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">
                    {lainnyaAction ===
                    'pj-barang'
                      ? 'Teruskan ke PJ Barang'
                      : 'Teruskan ke PJ Fasilitas'}
                  </h3>

                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Pilih penerima untuk meneruskan peminjaman.
                  </p>
                </div>

              </div>


              <div className="mb-4">

                <label className="label">
                  Penerima
                </label>


                <select
                  value={
                    selectedPjId
                  }

                  onChange={(
                    event
                  ) =>
                    setSelectedPjId(
                      event
                        .target
                        .value
                    )
                  }

                  className="input"
                >
                  <option value="">
                    — Pilih{' '}

                    {forwardRoleName ||
                      (lainnyaAction ===
                      'pj-barang'
                        ? 'PJ Barang'
                        : 'PJ Fasilitas')}{' '}

                    —
                  </option>


                  {pjOptions.map(
                    (
                      option
                    ) => (
                      <option
                        key={
                          option.id
                        }

                        value={
                          option.id
                        }
                      >
                        {
                          option.name
                        }{' '}

                        (
                        {
                          option.email
                        }
                        )
                      </option>
                    )
                  )}

                </select>


                {pjOptions.length ===
                  0 && (
                  <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
                    Tidak ada pengguna aktif dengan role ini.
                  </p>
                )}

              </div>


              <div className="flex justify-end gap-2">

                <button
                  type="button"

                  onClick={
                    closeLainnyaModal
                  }

                  className="btn-secondary"

                  disabled={
                    lainnyaSubmitting
                  }
                >
                  Batal
                </button>


                <button
                  type="button"

                  onClick={() =>
                    void submitLainnyaForward()
                  }

                  disabled={
                    !selectedPjId ||
                    lainnyaSubmitting
                  }

                  className="btn-primary"
                >
                  {lainnyaSubmitting
                    ? 'Mengirim...'
                    : 'Kirim'}
                </button>

              </div>

            </div>
          </div>
        )}

    </div>
  );
}