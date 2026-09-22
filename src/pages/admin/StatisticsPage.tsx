import {
  useEffect,
  useState,
} from 'react';

import {
  BarChart3,
  Loader2,
  Package,
  Building2,
  ClipboardList,
  FileText,
  TrendingUp,
  Users,
  Megaphone,
} from 'lucide-react';

import { showToast } from '../../components/Toast';
import { cn } from '../../utils/cn';
import { useAuth } from '../../context/AuthContext';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));


// =====================================================
// TYPES
// =====================================================

interface CategoryCount {
  name: string;
  count: number;
}


interface MonthlyTrend {
  month: string;
  count: number;
}


interface StatusCount {
  status: string;
  count: number;
}


interface StatisticsSummary {
  inventory: number;
  facilities: number;
  borrowings: number;
  damageReports: number;
  aspirasi: number;
  announcements: number;
  teamMembers: number;
}


interface StatisticsData {
  summary:
    StatisticsSummary;

  monthlyTrends:
    MonthlyTrend[];

  borrowingsByStatus:
    StatusCount[];

  inventoryByCategory:
    CategoryCount[];
}


interface ApiResponse {
  ok: boolean;
  data?: StatisticsData;
  message?: string;
}


// =====================================================
// HELPERS
// =====================================================

function formatMonth(
  value: string
) {
  const [
    year,
    month,
  ] =
    value.split('-');


  if (
    !year ||
    !month
  ) {
    return value;
  }


  const date =
    new Date(
      Number(year),
      Number(month) - 1,
      1
    );


  return date.toLocaleDateString(
    'id-ID',
    {
      month:
        'short',
    }
  );
}


// =====================================================
// COMPONENT
// =====================================================

export default function StatisticsPage() {
  const {
    session,
  } = useAuth();


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    summary,
    setSummary,
  ] =
    useState<StatisticsSummary>({
      inventory: 0,

      facilities: 0,

      borrowings: 0,

      damageReports: 0,

      aspirasi: 0,

      announcements: 0,

      teamMembers: 0,
    });


  const [
    monthlyTrends,
    setMonthlyTrends,
  ] =
    useState<
      MonthlyTrend[]
    >([]);


  const [
    borrowingsByStatus,
    setBorrowingsByStatus,
  ] =
    useState<
      StatusCount[]
    >([]);


  const [
    inventoryByCategory,
    setInventoryByCategory,
  ] =
    useState<
      CategoryCount[]
    >([]);


  // =====================================================
  // LOAD STATISTICS
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
      setLoading(
        true
      );


      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/admin/statistics`,
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
              | ApiResponse
              | null;


        if (
          !response.ok ||
          !result?.ok ||
          !result.data
        ) {
          throw new Error(
            result?.message ??
              'Gagal memuat statistik'
          );
        }


        if (!mounted) {
          return;
        }


        setSummary(
          result.data
            .summary
        );


        setMonthlyTrends(
          result.data
            .monthlyTrends ??
            []
        );


        setBorrowingsByStatus(
          result.data
            .borrowingsByStatus ??
            []
        );


        setInventoryByCategory(
          result.data
            .inventoryByCategory ??
            []
        );
      } catch (error) {
        console.error(
          '[StatisticsPage] load:',
          error
        );


        if (
          mounted
        ) {
          showToast(
            error instanceof
              Error
              ? error.message
              : 'Gagal memuat statistik',
            'error'
          );
        }
      } finally {
        if (
          mounted
        ) {
          setLoading(
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
  // CARDS
  // =====================================================

  const summaryCards = [
    {
      label:
        'Inventaris',

      value:
        summary.inventory,

      icon:
        Package,

      color:
        'bg-blue-500',
    },

    {
      label:
        'Fasilitas',

      value:
        summary.facilities,

      icon:
        Building2,

      color:
        'bg-emerald-500',
    },

    {
      label:
        'Peminjaman',

      value:
        summary.borrowings,

      icon:
        ClipboardList,

      color:
        'bg-purple-500',
    },

    {
      label:
        'Laporan',

      value:
        summary.damageReports,

      icon:
        FileText,

      color:
        'bg-amber-500',
    },

    {
      label:
        'Aspirasi',

      value:
        summary.aspirasi,

      icon:
        Users,

      color:
        'bg-pink-500',
    },

    {
      label:
        'Pengumuman',

      value:
        summary.announcements,

      icon:
        Megaphone,

      color:
        'bg-indigo-500',
    },
  ];


  const statusColors:
    Record<
      string,
      string
    > = {
      pending:
        'bg-amber-500',

      approved:
        'bg-emerald-500',

      rejected:
        'bg-red-500',

      returned:
        'bg-slate-500',

      borrowed:
        'bg-purple-500',

      processing:
        'bg-blue-500',
    };


  const statusLabels:
    Record<
      string,
      string
    > = {
      pending:
        'Menunggu',

      approved:
        'Disetujui',

      rejected:
        'Ditolak',

      returned:
        'Dikembalikan',

      borrowed:
        'Dipinjam',

      processing:
        'Diproses',
    };


  const maxTrend =
    Math.max(
      ...monthlyTrends.map(
        (
          trend
        ) =>
          Number(
            trend.count
          )
      ),
      1
    );


  const maxBorStatus =
    Math.max(
      ...borrowingsByStatus.map(
        (
          status
        ) =>
          Number(
            status.count
          )
      ),
      1
    );


  const maxInvCat =
    Math.max(
      ...inventoryByCategory.map(
        (
          category
        ) =>
          Number(
            category.count
          )
      ),
      1
    );


  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="pb-6">

      <div className="mb-6">

        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">

          <BarChart3 className="h-6 w-6" />

          Statistik

        </h1>


        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Ringkasan data sarana prasarana.
        </p>

      </div>


      {loading ? (
        <div className="flex items-center justify-center py-20">

          <Loader2 className="h-10 w-10 animate-spin text-brand-600" />

        </div>
      ) : (
        <>

          {/* SUMMARY */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">

            {summaryCards.map(
              (
                card
              ) => (
                <div
                  key={
                    card.label
                  }

                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >

                  <div
                    className={cn(
                      'mb-3 flex h-10 w-10 items-center justify-center rounded-xl',

                      card.color
                    )}
                  >
                    <card.icon className="h-5 w-5 text-white" />
                  </div>


                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {
                      card.value
                    }
                  </p>


                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {
                      card.label
                    }
                  </p>

                </div>
              )
            )}

          </div>


          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">

            {/* MONTHLY TRENDS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">

              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">

                <TrendingUp className="h-5 w-5" />

                Tren Peminjaman (6 Bulan)

              </h2>


              {monthlyTrends.length ===
              0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Tidak ada data.
                </p>
              ) : (
                <div
                  className="flex items-end justify-between gap-3"

                  style={{
                    height:
                      '200px',
                  }}
                >

                  {monthlyTrends.map(
                    (
                      trend
                    ) => {
                      const count =
                        Number(
                          trend.count
                        ) ||
                        0;


                      return (
                        <div
                          key={
                            trend.month
                          }

                          className="flex flex-1 flex-col items-center gap-2"
                        >

                          <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                            {
                              count
                            }
                          </span>


                          <div
                            className="flex w-full items-end justify-center"

                            style={{
                              height:
                                '150px',
                            }}
                          >

                            <div
                              className="w-full max-w-[40px] rounded-t-lg bg-brand-500 transition-all"

                              style={{
                                height:
                                  `${(
                                    count /
                                    maxTrend
                                  ) * 100}%`,

                                minHeight:
                                  count >
                                  0
                                    ? '4px'
                                    : '0',
                              }}
                            />

                          </div>


                          <span className="text-xs text-slate-500 dark:text-slate-400">
                            {formatMonth(
                              trend.month
                            )}
                          </span>

                        </div>
                      );
                    }
                  )}

                </div>
              )}

            </div>


            {/* BORROWING STATUS */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">

              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">

                <ClipboardList className="h-5 w-5" />

                Peminjaman per Status

              </h2>


              {borrowingsByStatus.length ===
              0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Tidak ada data.
                </p>
              ) : (
                <div className="space-y-3">

                  {borrowingsByStatus.map(
                    (
                      status
                    ) => {
                      const count =
                        Number(
                          status.count
                        ) ||
                        0;


                      return (
                        <div
                          key={
                            status.status
                          }
                        >

                          <div className="mb-1 flex items-center justify-between text-sm">

                            <span className="text-slate-700 dark:text-slate-300">
                              {statusLabels[
                                status.status
                              ] ??
                                status.status}
                            </span>


                            <span className="font-semibold text-slate-900 dark:text-white">
                              {
                                count
                              }
                            </span>

                          </div>


                          <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">

                            <div
                              className={cn(
                                'h-full rounded-full transition-all',

                                statusColors[
                                  status.status
                                ] ??
                                  'bg-slate-500'
                              )}

                              style={{
                                width:
                                  `${(
                                    count /
                                    maxBorStatus
                                  ) * 100}%`,
                              }}
                            />

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>
              )}

            </div>


            {/* INVENTORY CATEGORY */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">

              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">

                <Package className="h-5 w-5" />

                Inventaris per Kategori

              </h2>


              {inventoryByCategory.length ===
              0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                  Tidak ada data.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">

                  {inventoryByCategory.map(
                    (
                      category
                    ) => {
                      const count =
                        Number(
                          category.count
                        ) ||
                        0;


                      return (
                        <div
                          key={
                            category.name
                          }
                        >

                          <div className="mb-1 flex items-center justify-between text-sm">

                            <span className="text-slate-700 dark:text-slate-300">
                              {
                                category.name
                              }
                            </span>


                            <span className="font-semibold text-slate-900 dark:text-white">
                              {
                                count
                              }
                            </span>

                          </div>


                          <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">

                            <div
                              className="h-full rounded-full bg-blue-500 transition-all"

                              style={{
                                width:
                                  `${(
                                    count /
                                    maxInvCat
                                  ) * 100}%`,
                              }}
                            />

                          </div>

                        </div>
                      );
                    }
                  )}

                </div>
              )}

            </div>

          </div>

        </>
      )}

    </div>
  );
}