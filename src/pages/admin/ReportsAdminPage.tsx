import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import { supabase } from '../../lib/supabase';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

import {
  FileText,
  Loader2,
  Search,
  X,
  Save,
  AlertTriangle,
  Trash2,
} from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

interface DamageReport {
  id: string;
  inventory_id: string | null;
  reporter_name: string | null;
  description: string | null;
  image_url: string | null;
  severity: string | null;
  status: string | null;
  resolution_notes: string | null;
  created_at: string | null;
  resolved_at: string | null;
  reporter_unit: string | null;
  reporter_email: string | null;
  reporter_phone: string | null;
  location: string | null;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

const severityStyles: Record<
  string,
  string
> = {
  low:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  minor:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',

  medium:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  moderate:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',

  high:
    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  severe:
    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const severityLabels: Record<
  string,
  string
> = {
  low: 'Ringan',
  minor: 'Ringan',
  medium: 'Sedang',
  moderate: 'Sedang',
  high: 'Berat',
  severe: 'Berat',
};

const statusStyles: Record<
  string,
  string
> = {
  pending:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',

  in_progress:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',

  resolved:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const statusLabels: Record<
  string,
  string
> = {
  pending: 'Menunggu',
  in_progress: 'Diproses',
  resolved: 'Selesai',
};


function getGoogleDriveFileId(
  url?: string | null
) {
  if (!url) {
    return null;
  }

  const fileMatch =
    url.match(/\/file\/d\/([^/?#]+)/);

  if (fileMatch?.[1]) {
    return fileMatch[1];
  }

  const googleusercontentMatch =
    url.match(/googleusercontent\.com\/d\/([^=/?#]+)/);

  if (googleusercontentMatch?.[1]) {
    return googleusercontentMatch[1];
  }

  try {
    const parsed = new URL(url);
    return parsed.searchParams.get('id');
  } catch {
    return null;
  }
}

function getReportImageUrl(
  url?: string | null
) {
  if (!url) {
    return '';
  }

  if (url.includes('googleusercontent.com')) {
    return url;
  }

  const driveId =
    getGoogleDriveFileId(url);

  if (driveId) {
    return `https://lh3.googleusercontent.com/d/${encodeURIComponent(
      driveId
    )}=w1000`;
  }

  return url;
}

function handleReportImageError(
  event: React.SyntheticEvent<HTMLImageElement>,
  originalUrl?: string | null
) {
  const image = event.currentTarget;
  const driveId =
    getGoogleDriveFileId(originalUrl);

  if (!driveId) {
    return;
  }

  if (image.dataset.fallback === 'thumbnail') {
    return;
  }

  image.dataset.fallback = 'thumbnail';
  image.src =
    `https://drive.google.com/thumbnail?id=${encodeURIComponent(
      driveId
    )}&sz=w1000`;
}

async function getAccessToken() {
  const {
    data: { session },
    error,
  } =
    await supabase.auth.getSession();

  if (error) {
    throw new Error(
      error.message
    );
  }

  const token =
    session?.access_token;

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
      `HTTP ${response.status}`
    );
  }

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new Error(
      result.message ??
        `HTTP ${response.status}`
    );
  }

  return result;
}

export default function ReportsAdminPage() {
  const {
    hasPermission,
    isSuperAdmin,
  } = useAuth();

  const canManage =
    hasPermission(
      'reports',
      'manage'
    );

  const [
    deleteTarget,
    setDeleteTarget,
  ] =
    useState<DamageReport | null>(
      null
    );

  const [
    deleting,
    setDeleting,
  ] = useState(false);

  const [
    reports,
    setReports,
  ] = useState<
    DamageReport[]
  >([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    filterStatus,
    setFilterStatus,
  ] = useState('all');

  const [
    filterSeverity,
    setFilterSeverity,
  ] = useState('all');

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editingReport,
    setEditingReport,
  ] =
    useState<DamageReport | null>(
      null
    );

  const [
    statusUpdate,
    setStatusUpdate,
  ] = useState('');

  const [
    resolutionNotes,
    setResolutionNotes,
  ] = useState('');

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  // =====================================================
  // LOAD REPORTS DARI POSTGRESQL
  // =====================================================

  const fetchReports =
    async () => {
      setLoading(true);

      try {
        const result =
          await adminApi<
            DamageReport[]
          >(
            '/api/admin/reports'
          );

        setReports(
          result.data ?? []
        );
      } catch (error) {
        console.error(
          '[ReportsAdminPage] GET error:',
          error
        );

        setReports([]);

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal memuat laporan',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void fetchReports();
  }, []);

  // =====================================================
  // FILTER
  // =====================================================

  const filtered =
    reports.filter(
      (report) => {
        const q =
          search.toLowerCase();

        const matchSearch =
          (
            report.reporter_name ??
            ''
          )
            .toLowerCase()
            .includes(q) ||
          (
            report.description ??
            ''
          )
            .toLowerCase()
            .includes(q) ||
          (
            report.location ??
            ''
          )
            .toLowerCase()
            .includes(q);

        const matchStatus =
          filterStatus ===
            'all' ||
          report.status ===
            filterStatus;

        const matchSeverity =
          filterSeverity ===
            'all' ||
          report.severity ===
            filterSeverity;

        return (
          matchSearch &&
          matchStatus &&
          matchSeverity
        );
      }
    );

  // =====================================================
  // MODAL EDIT
  // =====================================================

  const openModal = (
    report: DamageReport
  ) => {
    setEditingReport(
      report
    );

    setStatusUpdate(
      report.status ??
        'pending'
    );

    setResolutionNotes(
      report.resolution_notes ??
        ''
    );

    setModalOpen(true);
  };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete =
    async () => {
      if (!deleteTarget) {
        return;
      }

      setDeleting(true);

      try {
        // File laporan disimpan di Google Drive.
        // Record PostgreSQL dapat dihapus tanpa bergantung pada Supabase Storage.

        // Data laporan dihapus dari PostgreSQL
        await adminApi<null>(
          `/api/admin/reports/${encodeURIComponent(
            deleteTarget.id
          )}`,
          {
            method: 'DELETE',
          }
        );

        showToast(
          'Laporan berhasil dihapus.'
        );

        setDeleteTarget(
          null
        );

        await fetchReports();
      } catch (error) {
        console.error(
          '[ReportsAdminPage] DELETE error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal menghapus laporan',
          'error'
        );
      } finally {
        setDeleting(false);
      }
    };

  // =====================================================
  // UPDATE REPORT
  // =====================================================

  const handleSubmit =
    async (
      e: FormEvent
    ) => {
      e.preventDefault();

      if (!editingReport) {
        return;
      }

      setSubmitting(true);

      try {
        await adminApi<DamageReport>(
          `/api/admin/reports/${encodeURIComponent(
            editingReport.id
          )}`,
          {
            method: 'PATCH',

            body:
              JSON.stringify({
                status:
                  statusUpdate,

                resolution_notes:
                  resolutionNotes ||
                  null,
              }),
          }
        );

        showToast(
          'Laporan berhasil diperbarui'
        );

        setModalOpen(false);

        setEditingReport(
          null
        );

        await fetchReports();
      } catch (error) {
        console.error(
          '[ReportsAdminPage] PATCH error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal memperbarui laporan',
          'error'
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };

  return (
    <div className="pb-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <FileText className="h-6 w-6" />
          Laporan Kerusakan
        </h1>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Kelola laporan kerusakan inventaris.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            value={search}
            onChange={(e) =>
              setSearch(
                e.target.value
              )
            }
            placeholder="Cari pelapor, deskripsi, lokasi..."
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(
              e.target.value
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

          <option value="in_progress">
            Diproses
          </option>

          <option value="resolved">
            Selesai
          </option>
        </select>

        <select
          value={
            filterSeverity
          }
          onChange={(e) =>
            setFilterSeverity(
              e.target.value
            )
          }
          className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">
            Semua Tingkat
          </option>

          <option value="low">
            Rendah
          </option>

          <option value="medium">
            Sedang
          </option>

          <option value="high">
            Tinggi
          </option>
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : filtered.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Tidak ada laporan.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map(
            (report) => (
              <div
                key={
                  report.id
                }
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                  {report.image_url ? (
                    <a
                      href={report.image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="block h-24 w-24 shrink-0"
                      title="Buka bukti asli"
                    >
                      <img
                        src={
                          getReportImageUrl(
                            report.image_url
                          )
                        }
                        onError={(event) =>
                          handleReportImageError(
                            event,
                            report.image_url
                          )
                        }
                        alt="Bukti"
                        className="h-24 w-24 rounded-xl object-cover"
                      />
                    </a>
                  ) : (
                    <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                      <AlertTriangle className="h-8 w-8 text-slate-400" />
                    </div>
                  )}

                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {report.reporter_name ??
                          'Anonim'}
                      </h3>

                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',

                          severityStyles[
                            report.severity ??
                              'low'
                          ] ??
                            severityStyles.low
                        )}
                      >
                        {severityLabels[
                          report.severity ??
                            'low'
                        ] ??
                          report.severity}
                      </span>

                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',

                          statusStyles[
                            report.status ??
                              'pending'
                          ] ??
                            statusStyles.pending
                        )}
                      >
                        {statusLabels[
                          report.status ??
                            'pending'
                        ] ??
                          report.status}
                      </span>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-400">
                      {report.description ??
                        '-'}
                    </p>

                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                      <span>
                        Lokasi:{' '}
                        {report.location ??
                          '-'}
                      </span>

                      <span>
                        Unit:{' '}
                        {report.reporter_unit ??
                          '-'}
                      </span>

                      {report.reporter_email && (
                        <span>
                          Email:{' '}
                          {
                            report.reporter_email
                          }
                        </span>
                      )}

                      {report.reporter_phone && (
                        <span>
                          Telp:{' '}
                          {
                            report.reporter_phone
                          }
                        </span>
                      )}

                      <span>
                        Tanggal:{' '}
                        {report.created_at
                          ? new Date(
                              report.created_at
                            ).toLocaleDateString(
                              'id-ID'
                            )
                          : '-'}
                      </span>
                    </div>

                    {report.resolution_notes && (
                      <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                        <p className="font-medium text-slate-700 dark:text-slate-300">
                          Catatan Resolusi:
                        </p>

                        <p className="text-slate-600 dark:text-slate-400">
                          {
                            report.resolution_notes
                          }
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 flex-col gap-2">
                    {canManage && (
                      <button
                        onClick={() =>
                          openModal(
                            report
                          )
                        }
                        className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
                      >
                        Kelola
                      </button>
                    )}

                    {isSuperAdmin && (
                      <button
                        onClick={() =>
                          setDeleteTarget(
                            report
                          )
                        }
                        className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                        Hapus
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {modalOpen &&
        editingReport && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Kelola Laporan
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

              <div className="mb-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {editingReport.description ??
                    ''}
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Pelapor:{' '}
                  {editingReport.reporter_name ??
                    '-'}
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
                    onChange={(e) =>
                      setStatusUpdate(
                        e.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="pending">
                      Menunggu
                    </option>

                    <option value="in_progress">
                      Diproses
                    </option>

                    <option value="resolved">
                      Selesai
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Catatan Resolusi
                  </label>

                  <textarea
                    value={
                      resolutionNotes
                    }
                    onChange={(e) =>
                      setResolutionNotes(
                        e.target
                          .value
                      )
                    }
                    rows={4}
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
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
                    ) : (
                      <Save className="h-4 w-4" />
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

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>

              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Hapus Laporan
              </h2>
            </div>

            <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
              Apakah Anda yakin ingin menghapus laporan ini?
              Tindakan ini tidak dapat dibatalkan.
            </p>

            <div className="flex justify-end gap-3">
              <button
                onClick={() =>
                  setDeleteTarget(
                    null
                  )
                }
                className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
              >
                Batal
              </button>

              <button
                onClick={
                  handleDelete
                }
                disabled={
                  deleting
                }
                className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}

                {deleting
                  ? 'Menghapus...'
                  : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}