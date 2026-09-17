import {
  useEffect,
  useState,
} from 'react';

import {
  Link,
  useNavigate,
} from 'react-router-dom';

import {
  CalendarDays,
  Package,
  ClipboardList,
  FileText,
  Megaphone,
  MessageSquare,
  Building2,
  Users,
  BarChart3,
  ArrowRight,
  Loader2,
  Clock,
} from 'lucide-react';

import { fetchTodayCounts } from '../../lib/timeline';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';


// =====================================================
// TYPES
// =====================================================

interface RecentBorrowing {
  id: string;

  borrower_name:
    | string
    | null;

  item_type:
    | string
    | null;

  borrow_date:
    | string
    | null;

  status:
    | string
    | null;
}


interface DashboardStats {
  inventory: number;
  facilities: number;
  reports: number;
  announcements: number;
}


interface DashboardApiData {
  stats: DashboardStats;

  recentBorrowings:
    RecentBorrowing[];
}


interface DashboardApiResponse {
  ok: boolean;
  data?: DashboardApiData;
  message?: string;
}


// =====================================================
// COMPONENT
// =====================================================

export default function DashboardPage() {
  const navigate =
    useNavigate();

  const {
    hasPermission,
    session,
  } = useAuth();


  const [
    counts,
    setCounts,
  ] =
    useState({
      agendaToday: 0,
      borrowToday: 0,
      weekTotal: 0,
    });


  const [
    loadingCounts,
    setLoadingCounts,
  ] =
    useState(true);


  const [
    recentBorrowings,
    setRecentBorrowings,
  ] =
    useState<
      RecentBorrowing[]
    >([]);


  const [
    loadingBorrowings,
    setLoadingBorrowings,
  ] =
    useState(true);


  const [
    stats,
    setStats,
  ] =
    useState<DashboardStats>({
      inventory: 0,
      facilities: 0,
      reports: 0,
      announcements: 0,
    });


  // =====================================================
  // TIMELINE COUNTS
  // Masih lewat lib/timeline.ts untuk sementara.
  // Nanti file timeline dimigrasi sendiri.
  // =====================================================

  useEffect(() => {
    void (async () => {
      try {
        const result =
          await fetchTodayCounts();

        setCounts(
          result
        );
      } catch {
        showToast(
          'Gagal memuat data hari ini',
          'error'
        );
      } finally {
        setLoadingCounts(
          false
        );
      }
    })();
  }, []);


  // =====================================================
  // DASHBOARD DATA
  // PostgreSQL melalui backend API
  // =====================================================

  useEffect(() => {
    if (
      !session
        ?.access_token
    ) {
      return;
    }


    let mounted =
      true;


    void (async () => {
      setLoadingBorrowings(
        true
      );

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/admin/dashboard`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
            }
          );


        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | DashboardApiResponse
              | null;


        if (
          !response.ok ||
          !result?.ok ||
          !result.data
        ) {
          throw new Error(
            result?.message ??
              'Gagal memuat dashboard'
          );
        }


        if (!mounted) {
          return;
        }


        setStats(
          result.data
            .stats
        );


        setRecentBorrowings(
          result.data
            .recentBorrowings ??
            []
        );
      } catch (error) {
        console.error(
          '[DashboardPage] load error:',
          error
        );


        if (mounted) {
          setRecentBorrowings(
            []
          );

          showToast(
            error instanceof
              Error
              ? error.message
              : 'Gagal memuat dashboard',
            'error'
          );
        }
      } finally {
        if (mounted) {
          setLoadingBorrowings(
            false
          );
        }
      }
    })();


    return () => {
      mounted =
        false;
    };
  }, [
    session
      ?.access_token,
  ]);


  // =====================================================
  // STAT CARDS
  // =====================================================

  const statCards = [
    {
      label:
        'Total Inventaris',

      value:
        stats.inventory,

      icon:
        Package,

      to:
        '/admin/inventory',
    },

    {
      label:
        'Total Fasilitas',

      value:
        stats.facilities,

      icon:
        Building2,

      to:
        '/admin/facilities',
    },

    {
      label:
        'Laporan Kerusakan',

      value:
        stats.reports,

      icon:
        FileText,

      to:
        '/admin/reports',
    },

    {
      label:
        'Pengumuman',

      value:
        stats.announcements,

      icon:
        Megaphone,

      to:
        '/admin/announcements',
    },
  ];


  // =====================================================
  // TODAY WIDGETS
  // =====================================================

  const widgets = [
    {
      label:
        'Agenda Hari Ini',

      value:
        counts.agendaToday,

      icon:
        CalendarDays,
    },

    {
      label:
        'Peminjaman Hari Ini',

      value:
        counts.borrowToday,

      icon:
        ClipboardList,
    },

    {
      label:
        'Aktivitas Minggu Ini',

      value:
        counts.weekTotal,

      icon:
        Clock,
    },
  ];


  // =====================================================
  // QUICK ACTIONS
  // =====================================================

  const quickActions = [
    {
      label:
        'Kelola Inventaris',

      icon:
        Package,

      to:
        '/admin/inventory',

      perm:
        'inventory:read',
    },

    {
      label:
        'Kelola Fasilitas',

      icon:
        Building2,

      to:
        '/admin/facilities',

      perm:
        'facilities:read',
    },

    {
      label:
        'Laporan',

      icon:
        FileText,

      to:
        '/admin/reports',

      perm:
        'reports:read',
    },

    {
      label:
        'Pengumuman',

      icon:
        Megaphone,

      to:
        '/admin/announcements',

      perm:
        'announcements:read',
    },

    {
      label:
        'Aspirasi',

      icon:
        MessageSquare,

      to:
        '/admin/aspirasi',

      perm:
        'aspirasi:read',
    },

    {
      label:
        'Tim',

      icon:
        Users,

      to:
        '/admin/team',

      perm:
        'team:read',
    },

    {
      label:
        'Statistik',

      icon:
        BarChart3,

      to:
        '/admin/statistics',

      perm:
        'statistics:read',
    },

    {
      label:
        'Timeline',

      icon:
        CalendarDays,

      to:
        '/admin/timeline',

      perm:
        'timeline:read',
    },
  ];


  // =====================================================
  // STATUS COLOR
  // =====================================================

  const statusColors:
    Record<
      string,
      string
    > = {
      pending:
        'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',

      approved:
        'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',

      rejected:
        'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',

      returned:
        'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',

      borrowed:
        'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    };


  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="pb-6">

      <div className="mb-6">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Dashboard
        </h1>

        <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
          Ringkasan aktivitas sarana prasarana.
        </p>
      </div>


      {/* STAT CARDS */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">

        {statCards.map(
          (
            stat
          ) => (
            <Link
              key={
                stat.label
              }

              to={
                stat.to
              }

              className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
            >
              <div className="flex items-center justify-between">

                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {
                      stat.label
                    }
                  </p>

                  <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
                    {
                      stat.value
                    }
                  </p>
                </div>


                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 dark:bg-brand-900/30">
                  <stat.icon className="h-4.5 w-4.5 text-brand-700 dark:text-brand-300" />
                </div>

              </div>
            </Link>
          )
        )}

      </div>


      {/* TODAY */}
      <div className="mb-5 grid grid-cols-1 gap-4 sm:grid-cols-3">

        {widgets.map(
          (
            widget
          ) => (
            <button
              key={
                widget.label
              }

              onClick={() =>
                navigate(
                  '/admin/timeline'
                )
              }

              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700"
            >

              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                <widget.icon className="h-4.5 w-4.5 text-brand-700 dark:text-brand-300" />
              </div>


              <div>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {
                    widget.label
                  }
                </p>

                <p className="text-xl font-bold text-slate-900 dark:text-white">

                  {loadingCounts ? (
                    <Loader2 className="h-4 w-4 animate-spin text-slate-400" />
                  ) : (
                    widget.value
                  )}

                </p>
              </div>

            </button>
          )
        )}

      </div>


      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">

        {/* RECENT BORROWINGS */}
        <div className="lg:col-span-2">

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">

            <div className="mb-4 flex items-center justify-between">

              <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                Peminjaman Terbaru
              </h2>


              <Link
                to="/admin/borrowings"

                className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800 dark:text-brand-400"
              >
                Lihat semua

                <ArrowRight className="h-3.5 w-3.5" />
              </Link>

            </div>


            {loadingBorrowings ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
              </div>
            ) : recentBorrowings.length ===
              0 ? (
              <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                Tidak ada peminjaman.
              </p>
            ) : (
              <div className="space-y-2">

                {recentBorrowings.map(
                  (
                    borrowing
                  ) => (
                    <div
                      key={
                        borrowing.id
                      }

                      className="flex items-center justify-between rounded-lg border border-slate-100 px-3.5 py-2.5 dark:border-slate-800"
                    >

                      <div>
                        <p className="text-sm font-medium text-slate-900 dark:text-white">
                          {borrowing.borrower_name ??
                            'Anonim'}
                        </p>

                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {borrowing.item_type ??
                            '-'}{' '}
                          ·{' '}
                          {borrowing.borrow_date ??
                            '-'}
                        </p>
                      </div>


                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          statusColors[
                            borrowing.status ??
                              'pending'
                          ] ??
                          statusColors.pending
                        }`}
                      >
                        {borrowing.status ??
                          'pending'}
                      </span>

                    </div>
                  )
                )}

              </div>
            )}

          </div>
        </div>


        {/* QUICK ACTIONS */}
        <div>

          <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">

            <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
              Aksi Cepat
            </h2>


            <div className="grid grid-cols-2 gap-2.5">

              {quickActions
                .filter(
                  (
                    action
                  ) => {
                    const [
                      module,
                      permission,
                    ] =
                      action.perm.split(
                        ':'
                      );

                    return hasPermission(
                      module,
                      permission
                    );
                  }
                )
                .map(
                  (
                    action
                  ) => (
                    <Link
                      key={
                        action.to
                      }

                      to={
                        action.to
                      }

                      className="flex flex-col items-center gap-2 rounded-lg border border-slate-100 p-3 text-center transition hover:border-brand-300 hover:bg-brand-50 dark:border-slate-800 dark:hover:border-brand-700 dark:hover:bg-brand-900/20"
                    >

                      <action.icon className="h-5 w-5 text-brand-700 dark:text-brand-300" />

                      <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                        {
                          action.label
                        }
                      </span>

                    </Link>
                  )
                )}

            </div>

          </div>
        </div>

      </div>
    </div>
  );
}