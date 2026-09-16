import {
  useEffect,
  useState,
} from 'react';

import {
  ClipboardList,
  Upload,
  Loader2,
  AlertTriangle,
  FileText,
  X,
} from 'lucide-react';

import { uploadFileToDrive } from '../lib/upload';
import { showToast } from '../components/Toast';
import AnimatedBackground from '../components/AnimatedBackground';
import EmptyState from '../components/EmptyState';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

interface DamageReport {
  id: string;
  reporter_name: string;
  description: string;
  location: string | null;
  severity: string;
  status: string;
  image_url: string | null;
  created_at: string;
}

interface FormState {
  reporter_name: string;
  reporter_email: string;
  reporter_unit: string;
  reporter_phone: string;
  description: string;
  location: string;
  severity:
    | 'minor'
    | 'moderate'
    | 'severe';
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

const empty: FormState = {
  reporter_name: '',
  reporter_email: '',
  reporter_unit: '',
  reporter_phone: '',
  description: '',
  location: '',
  severity: 'minor',
};

const severityOptions = [
  {
    value: 'minor',
    label: 'Ringan',
    desc: 'Kerusakan kecil, tidak mengganggu fungsi',
    color:
      'text-emerald-600 dark:text-emerald-400',
  },
  {
    value: 'moderate',
    label: 'Sedang',
    desc: 'Kerusakan cukup, perlu perbaikan',
    color:
      'text-amber-600 dark:text-amber-400',
  },
  {
    value: 'severe',
    label: 'Berat',
    desc: 'Kerusakan parah, tidak dapat digunakan',
    color:
      'text-red-600 dark:text-red-400',
  },
] as const;

const severityStyles: Record<
  string,
  string
> = {
  minor:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',

  moderate:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',

  severe:
    'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const reportStatusStyles: Record<
  string,
  string
> = {
  pending:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',

  in_progress:
    'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',

  resolved:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

const reportStatusLabels: Record<
  string,
  string
> = {
  pending: 'Menunggu',
  in_progress: 'Diproses',
  resolved: 'Selesai',
};

const severityLabels: Record<
  string,
  string
> = {
  minor: 'Ringan',
  moderate: 'Sedang',
  severe: 'Berat',
};

export default function ReportPage() {
  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      empty
    );

  const [
    file,
    setFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    preview,
    setPreview,
  ] =
    useState<string | null>(
      null
    );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    recent,
    setRecent,
  ] =
    useState<
      DamageReport[]
    >([]);

  const [
    loadingRecent,
    setLoadingRecent,
  ] = useState(true);

  const set = (
    key: keyof FormState,
    value: string
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  // =====================================================
  // FILE
  // =====================================================

  const handleFile = (
    selectedFile:
      File | null
  ) => {
    if (!selectedFile) {
      return;
    }

    if (
      selectedFile.size >
      5 * 1024 * 1024
    ) {
      showToast(
        'Ukuran file maksimal 5MB',
        'error'
      );

      return;
    }

    if (preview) {
      URL.revokeObjectURL(
        preview
      );
    }

    setFile(
      selectedFile
    );

    setPreview(
      URL.createObjectURL(
        selectedFile
      )
    );
  };

  const removeFile =
    () => {
      setFile(null);

      if (preview) {
        URL.revokeObjectURL(
          preview
        );
      }

      setPreview(null);
    };

  // =====================================================
  // RIWAYAT LAPORAN DARI POSTGRESQL
  // =====================================================

  const fetchRecent =
    async (
      email: string
    ) => {
      const cleanEmail =
        email.trim();

      if (!cleanEmail) {
        setRecent([]);
        setLoadingRecent(
          false
        );

        return;
      }

      setLoadingRecent(
        true
      );

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/reports/recent?email=${encodeURIComponent(
              cleanEmail
            )}`
          );

        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
            | ApiResponse<
                DamageReport[]
              >
            | null;

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal mengambil riwayat laporan'
          );
        }

        setRecent(
          result.data ??
            []
        );
      } catch (error) {
        console.error(
          '[ReportPage] Recent reports error:',
          error
        );

        setRecent([]);
      } finally {
        setLoadingRecent(
          false
        );
      }
    };

  useEffect(() => {
    setLoadingRecent(
      false
    );
  }, []);

  // =====================================================
  // VALIDASI
  // =====================================================

  const validate =
    () => {
      if (
        !form.reporter_name.trim()
      ) {
        showToast(
          'Nama pelapor wajib diisi',
          'error'
        );

        return false;
      }

      if (
        !form.reporter_email.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          form.reporter_email
        )
      ) {
        showToast(
          'Email valid wajib diisi',
          'error'
        );

        return false;
      }

      if (
        !form.reporter_unit.trim()
      ) {
        showToast(
          'Unit/Kelas pelapor wajib diisi',
          'error'
        );

        return false;
      }

      if (
        !form.description.trim()
      ) {
        showToast(
          'Deskripsi kerusakan wajib diisi',
          'error'
        );

        return false;
      }

      if (
        !form.location.trim()
      ) {
        showToast(
          'Lokasi wajib diisi',
          'error'
        );

        return false;
      }

      return true;
    };

  // =====================================================
  // SUBMIT KE POSTGRESQL
  // =====================================================

  const handleSubmit =
    async (
      e: React.FormEvent
    ) => {
      e.preventDefault();

      if (!validate()) {
        return;
      }

      if (submitting) {
        return;
      }

      setSubmitting(true);

      try {
        let image_url:
          | string
          | null =
          null;

        // Upload file/foto tetap menggunakan
        // mekanisme upload yang sekarang.
        if (file) {
          const result =
            await uploadFileToDrive(
              file,
              `laporan-${Date.now()}-${file.name}`
            );

          if (result) {
            image_url =
              result.url;
          }
        }

        const email =
          form.reporter_email.trim();

        const response =
          await fetch(
            `${API_BASE_URL}/api/reports`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify(
                  {
                    reporter_name:
                      form.reporter_name.trim(),

                    reporter_email:
                      email,

                    reporter_unit:
                      form.reporter_unit.trim(),

                    reporter_phone:
                      form.reporter_phone.trim() ||
                      null,

                    description:
                      form.description.trim(),

                    location:
                      form.location.trim(),

                    severity:
                      form.severity,

                    image_url,
                  }
                ),
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
                created_at: string;
              }>
            | null;

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal mengirim laporan'
          );
        }

        showToast(
          'Laporan kerusakan berhasil dikirim',
          'success'
        );

        // Ambil ulang riwayat
        // dari PostgreSQL.
        await fetchRecent(
          email
        );

        setForm(empty);

        removeFile();
      } catch (error) {
        console.error(
          '[ReportPage] Submit error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal mengirim laporan',
          'error'
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };

  return (
    <div className="relative pb-12">
      {/* HERO */}

      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <AnimatedBackground />

        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <ClipboardList className="h-7 w-7 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-white">
            Lapor Kerusakan
          </h1>

          <p className="mt-2 text-sm text-white/80">
            Laporkan kerusakan sarana dan prasarana
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* FORM */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <form
              onSubmit={
                handleSubmit
              }
              className="space-y-4"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {/* NAMA */}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Nama Pelapor *
                  </label>

                  <input
                    value={
                      form.reporter_name
                    }
                    onChange={(
                      e
                    ) =>
                      set(
                        'reporter_name',
                        e.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Nama lengkap"
                  />
                </div>

                {/* EMAIL */}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Email *
                  </label>

                  <input
                    type="email"
                    value={
                      form.reporter_email
                    }
                    onChange={(
                      e
                    ) =>
                      set(
                        'reporter_email',
                        e.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="email@gmail.com"
                  />
                </div>

                {/* UNIT */}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Unit / Kelas *
                  </label>

                  <input
                    value={
                      form.reporter_unit
                    }
                    onChange={(
                      e
                    ) =>
                      set(
                        'reporter_unit',
                        e.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Mis. XII RPL 1"
                  />
                </div>

                {/* HP */}

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    No. HP
                    (opsional)
                  </label>

                  <input
                    value={
                      form.reporter_phone
                    }
                    onChange={(
                      e
                    ) =>
                      set(
                        'reporter_phone',
                        e.target
                          .value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="08xxxxxxxxxx"
                  />
                </div>
              </div>

              {/* LOKASI */}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Lokasi *
                </label>

                <input
                  value={
                    form.location
                  }
                  onChange={(
                    e
                  ) =>
                    set(
                      'location',
                      e.target
                        .value
                    )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Lokasi barang/fasilitas"
                />
              </div>

              {/* DESKRIPSI */}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Deskripsi Kerusakan *
                </label>

                <textarea
                  value={
                    form.description
                  }
                  onChange={(
                    e
                  ) =>
                    set(
                      'description',
                      e.target
                        .value
                    )
                  }
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Jelaskan kerusakan..."
                />
              </div>

              {/* SEVERITY */}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tingkat
                  Kerusakan *
                </label>

                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {severityOptions.map(
                    (
                      severity
                    ) => (
                      <label
                        key={
                          severity.value
                        }
                        className={`flex cursor-pointer flex-col rounded-xl border p-3 transition ${
                          form.severity ===
                          severity.value
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                            : 'border-slate-200 hover:border-brand-300 dark:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="severity"
                            value={
                              severity.value
                            }
                            checked={
                              form.severity ===
                              severity.value
                            }
                            onChange={(
                              e
                            ) =>
                              set(
                                'severity',
                                e
                                  .target
                                  .value
                              )
                            }
                            className="h-4 w-4 accent-brand-600"
                          />

                          <span
                            className={`text-sm font-semibold ${severity.color}`}
                          >
                            {
                              severity.label
                            }
                          </span>
                        </div>

                        <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                          {
                            severity.desc
                          }
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* FOTO */}

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Foto
                  (opsional)
                </label>

                {preview ? (
                  <div className="relative inline-block">
                    <img
                      src={
                        preview
                      }
                      alt="Preview"
                      className="h-32 w-auto rounded-xl border border-slate-200 dark:border-slate-700"
                    />

                    <button
                      type="button"
                      onClick={
                        removeFile
                      }
                      className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-lg"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-brand-400 dark:border-slate-700 dark:hover:border-brand-600">
                    <Upload className="h-6 w-6 text-slate-400" />

                    <span className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      Klik untuk
                      upload foto
                      (max 5MB)
                    </span>

                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(
                        e
                      ) =>
                        handleFile(
                          e.target
                            .files?.[0] ??
                            null
                        )
                      }
                    />
                  </label>
                )}
              </div>

              {/* SUBMIT */}

              <button
                type="submit"
                disabled={
                  submitting
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardList className="h-4 w-4" />
                )}

                {submitting
                  ? 'Mengirim...'
                  : 'Kirim Laporan'}
              </button>
            </form>
          </div>

          {/* RIWAYAT */}

          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <FileText className="h-5 w-5 text-brand-600 dark:text-brand-400" />

              Laporan Terbaru
              Anda
            </h3>

            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
              Isi email pada
              form, lalu kirim
              laporan untuk
              melihat riwayat
              di sini.
            </p>

            {loadingRecent ? (
              <div className="space-y-2">
                {[1, 2].map(
                  (
                    index
                  ) => (
                    <div
                      key={
                        index
                      }
                      className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                    />
                  )
                )}
              </div>
            ) : recent.length ===
              0 ? (
              <EmptyState
                title="Belum ada laporan"
                description="Laporan yang Anda kirim akan muncul di sini."
                icon={
                  <AlertTriangle className="h-8 w-8 text-slate-400" />
                }
                className="py-6"
              />
            ) : (
              <div className="space-y-2">
                {recent.map(
                  (
                    report
                  ) => (
                    <div
                      key={
                        report.id
                      }
                      className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {
                            report.description
                          }
                        </p>

                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${
                            reportStatusStyles[
                              report.status
                            ] ??
                            reportStatusStyles.pending
                          }`}
                        >
                          {reportStatusLabels[
                            report.status
                          ] ??
                            report.status}
                        </span>
                      </div>

                      <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span
                          className={`rounded-md px-1.5 py-0.5 ${
                            severityStyles[
                              report.severity
                            ] ??
                            severityStyles.minor
                          }`}
                        >
                          {severityLabels[
                            report.severity
                          ] ??
                            report.severity}
                        </span>

                        {report.location && (
                          <span>
                            ·{' '}
                            {
                              report.location
                            }
                          </span>
                        )}

                        <span>
                          ·{' '}
                          {new Date(
                            report.created_at
                          ).toLocaleDateString(
                            'id-ID'
                          )}
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}