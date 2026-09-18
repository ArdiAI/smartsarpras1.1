import {
  useState,
  useEffect,
  useCallback,
  useMemo,
} from 'react';

import { supabase } from '../../lib/supabase';
import { cn } from '../../utils/cn';
import { showToast } from '../../components/Toast';

import {
  ScrollText,
  Search,
  X,
  ChevronLeft,
  ChevronRight,
  Eye,
  Filter,
  Loader2,
} from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

interface ActivityLog {
  id: string;
  admin_user_id: string | null;
  admin_name: string | null;
  admin_email: string | null;
  admin_role: string | null;
  activity_type: string;
  module: string;
  description: string | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface ActivityLogsResponse {
  ok: boolean;
  data?: ActivityLog[];
  total?: number;
  page?: number;
  pageSize?: number;
  message?: string;
}

const PAGE_SIZE = 15;

const ACTIVITY_BADGE: Record<string, string> = {
  APPROVE:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',

  CREATE:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',

  VIEW:
    'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',

  ACTION:
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',

  UPDATE:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',

  DELETE:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',

  REJECT:
    'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',

  FORWARD:
    'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',

  LOGIN:
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',

  LOGOUT:
    'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',

  RETURN:
    'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',

  COMPLETE:
    'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',

  UPLOAD:
    'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300',

  DOWNLOAD:
    'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',

  EXPORT:
    'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300',

  IMPORT:
    'bg-fuchsia-100 text-fuchsia-700 dark:bg-fuchsia-900/30 dark:text-fuchsia-300',
};

const ACTIVITY_TYPES =
  Object.keys(ACTIVITY_BADGE);

const MODULES = [
  'Admin',
  'Agenda',
  'Borrowings',
  'Inventory',
  'Users',
  'Roles',
  'Workflow',
  'Announcements',
  'Settings',
  'System Config',
  'Dashboard',
  'Rooms',
  'Facilities',
  'Reports',
  'Timeline',
  'Activity Logs',
  'Barang',
  'Kavling',
  'Auth',
];

function formatDate(
  iso: string
): string {
  try {
    return new Date(
      iso
    ).toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

async function getAccessToken() {
  const {
    data,
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    throw new Error(
      error.message
    );
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

export default function ActivityLogsPage() {
  const [
    logs,
    setLogs,
  ] = useState<
    ActivityLog[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    total,
    setTotal,
  ] = useState(0);

  const [
    page,
    setPage,
  ] = useState(1);

  const [
    filterDate,
    setFilterDate,
  ] = useState('');

  const [
    filterAdmin,
    setFilterAdmin,
  ] = useState('');

  const [
    filterRole,
    setFilterRole,
  ] = useState('');

  const [
    filterModule,
    setFilterModule,
  ] = useState('');

  const [
    filterActivity,
    setFilterActivity,
  ] = useState('');

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    detailLog,
    setDetailLog,
  ] =
    useState<ActivityLog | null>(
      null
    );

  const fetchLogs =
    useCallback(async () => {
      setLoading(true);

      try {
        const token =
          await getAccessToken();

        const params =
          new URLSearchParams();

        params.set(
          'page',
          String(page)
        );

        if (filterDate) {
          params.set(
            'date',
            filterDate
          );
        }

        if (filterAdmin) {
          params.set(
            'admin',
            filterAdmin
          );
        }

        if (filterRole) {
          params.set(
            'role',
            filterRole
          );
        }

        if (filterModule) {
          params.set(
            'module',
            filterModule
          );
        }

        if (filterActivity) {
          params.set(
            'activity',
            filterActivity
          );
        }

        if (search) {
          params.set(
            'search',
            search
          );
        }

        const response =
          await fetch(
            `${API_BASE_URL}/api/admin/activity-logs?${params.toString()}`,
            {
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );

        const result =
          (await response.json()) as ActivityLogsResponse;

        if (
          !response.ok ||
          !result.ok
        ) {
          throw new Error(
            result.message ??
              'Gagal memuat log aktivitas'
          );
        }

        setLogs(
          result.data ?? []
        );

        setTotal(
          result.total ?? 0
        );
      } catch (error) {
        console.error(
          '[ActivityLogsPage] GET error:',
          error
        );

        setLogs([]);
        setTotal(0);

        showToast(
          error instanceof Error
            ? error.message
            : 'Terjadi kesalahan saat memuat log',
          'error'
        );
      } finally {
        setLoading(false);
      }
    }, [
      page,
      filterDate,
      filterAdmin,
      filterRole,
      filterModule,
      filterActivity,
      search,
    ]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total / PAGE_SIZE
      )
    );

  const handleFilterChange =
    () => {
      setPage(1);
    };

  const resetFilters = () => {
    setFilterDate('');
    setFilterAdmin('');
    setFilterRole('');
    setFilterModule('');
    setFilterActivity('');
    setSearch('');
    setPage(1);
  };

  const hasActiveFilters =
    useMemo(
      () =>
        !!(
          filterDate ||
          filterAdmin ||
          filterRole ||
          filterModule ||
          filterActivity ||
          search
        ),
      [
        filterDate,
        filterAdmin,
        filterRole,
        filterModule,
        filterActivity,
        search,
      ]
    );

  return (
    <div className="pb-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <ScrollText className="h-6 w-6" />
          Activity Logs
        </h1>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Catatan audit seluruh aktivitas admin di sistem Smart Sarpras.
        </p>
      </div>

      <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
          <Filter className="h-4 w-4" />
          Filter
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Tanggal
            </label>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => {
                setFilterDate(
                  e.target.value
                );
                handleFilterChange();
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Nama Admin
            </label>

            <input
              type="text"
              value={filterAdmin}
              onChange={(e) => {
                setFilterAdmin(
                  e.target.value
                );
                handleFilterChange();
              }}
              placeholder="Cari nama..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Role
            </label>

            <input
              type="text"
              value={filterRole}
              onChange={(e) => {
                setFilterRole(
                  e.target.value
                );
                handleFilterChange();
              }}
              placeholder="Cari role..."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Module
            </label>

            <select
              value={filterModule}
              onChange={(e) => {
                setFilterModule(
                  e.target.value
                );
                handleFilterChange();
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">
                Semua
              </option>

              {MODULES.map(
                (module) => (
                  <option
                    key={
                      module
                    }
                    value={
                      module
                    }
                  >
                    {module}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Activity Type
            </label>

            <select
              value={
                filterActivity
              }
              onChange={(e) => {
                setFilterActivity(
                  e.target.value
                );
                handleFilterChange();
              }}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            >
              <option value="">
                Semua
              </option>

              {ACTIVITY_TYPES.map(
                (activity) => (
                  <option
                    key={
                      activity
                    }
                    value={
                      activity
                    }
                  >
                    {
                      activity
                    }
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
              Search
            </label>

            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(
                    e.target.value
                  );
                  handleFilterChange();
                }}
                placeholder="Cari..."
                className="w-full rounded-lg border border-slate-200 py-2 pl-8 pr-3 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <button
            onClick={
              resetFilters
            }
            className="mt-3 flex items-center gap-1 text-xs font-semibold text-brand-600 hover:underline"
          >
            <X className="h-3.5 w-3.5" />
            Reset Filter
          </button>
        )}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
              <tr>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                  Tanggal
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                  Nama Admin
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                  Role
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                  Module
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                  Activity
                </th>
                <th className="px-4 py-3 font-semibold text-slate-700 dark:text-slate-200">
                  Description
                </th>
                <th className="px-4 py-3 text-center font-semibold text-slate-700 dark:text-slate-200">
                  Aksi
                </th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                  </td>
                </tr>
              ) : logs.length ===
                0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-12 text-center text-slate-500"
                  >
                    Tidak ada log aktivitas
                  </td>
                </tr>
              ) : (
                logs.map(
                  (log) => (
                    <tr
                      key={
                        log.id
                      }
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {formatDate(
                          log.created_at
                        )}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-800 dark:text-slate-100">
                        {log.admin_name ??
                          '-'}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {log.admin_role ??
                          '-'}
                      </td>

                      <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                        {
                          log.module
                        }
                      </td>

                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={cn(
                            'rounded-full px-2.5 py-1 text-xs font-semibold',
                            ACTIVITY_BADGE[
                              log
                                .activity_type
                            ] ??
                              'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                          )}
                        >
                          {
                            log.activity_type
                          }
                        </span>
                      </td>

                      <td
                        className="max-w-xs truncate px-4 py-3 text-xs text-slate-600 dark:text-slate-300"
                        title={
                          log.description ??
                          ''
                        }
                      >
                        {log.description ??
                          '-'}
                      </td>

                      <td className="px-4 py-3 text-center">
                        <button
                          onClick={() =>
                            setDetailLog(
                              log
                            )
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Detail
                        </button>
                      </td>
                    </tr>
                  )
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-4 py-3 dark:border-slate-800">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Menampilkan{' '}
            {logs.length ===
            0
              ? 0
              : (page - 1) *
                  PAGE_SIZE +
                1}
            –
            {Math.min(
              page *
                PAGE_SIZE,
              total
            )}{' '}
            dari {total} log
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setPage((p) =>
                  Math.max(
                    1,
                    p - 1
                  )
                )
              }
              disabled={
                page === 1
              }
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              Hal {page} /{' '}
              {totalPages}
            </span>

            <button
              onClick={() =>
                setPage((p) =>
                  Math.min(
                    totalPages,
                    p + 1
                  )
                )
              }
              disabled={
                page ===
                totalPages
              }
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {detailLog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() =>
            setDetailLog(
              null
            )
          }
        >
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                <Eye className="h-5 w-5" />
                Detail Log
              </h2>

              <button
                onClick={() =>
                  setDetailLog(
                    null
                  )
                }
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Nama
                </span>

                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {detailLog.admin_name ??
                    '-'}
                </span>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Email
                </span>

                <span className="text-sm text-slate-800 dark:text-slate-100">
                  {detailLog.admin_email ??
                    '-'}
                </span>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Role
                </span>

                <span className="text-sm text-slate-800 dark:text-slate-100">
                  {detailLog.admin_role ??
                    '-'}
                </span>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Module
                </span>

                <span className="text-sm text-slate-800 dark:text-slate-100">
                  {
                    detailLog.module
                  }
                </span>
              </div>

              <div className="flex justify-between border-b border-slate-100 pb-2 dark:border-slate-800">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Activity
                </span>

                <span
                  className={cn(
                    'rounded-full px-2.5 py-1 text-xs font-semibold',
                    ACTIVITY_BADGE[
                      detailLog
                        .activity_type
                    ] ??
                      'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  )}
                >
                  {
                    detailLog.activity_type
                  }
                </span>
              </div>

              <div className="border-b border-slate-100 pb-2 dark:border-slate-800">
                <p className="mb-1 text-sm font-medium text-slate-500 dark:text-slate-400">
                  Description
                </p>

                <p className="text-sm text-slate-800 dark:text-slate-100">
                  {detailLog.description ??
                    '-'}
                </p>
              </div>

              <div className="flex justify-between">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  Tanggal
                </span>

                <span className="text-sm text-slate-800 dark:text-slate-100">
                  {formatDate(
                    detailLog.created_at
                  )}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}