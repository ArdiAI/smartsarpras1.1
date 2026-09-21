import RemoteImage from '../components/RemoteImage';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { showToast } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';

import {
  MapPin,
  Search,
  FileText,
  Download,
  X,
  ChevronLeft,
  ChevronRight,
  BarChart3,
  TrendingUp,
  Loader2,
  CheckCircle2,
  XCircle,
  Pencil,
  Trash2,
  FileSpreadsheet,
} from 'lucide-react';

import * as XLSX from 'xlsx';

import type {
  Kavling,
  KavlingKategori,
  KavlingStatus,
} from '../types';

import {
  KAVLING_KATEGORI_OPTIONS,
  KAVLING_STATUS_LABELS,
} from '../types';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

const PAGE_SIZE = 10;

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const getKategoriLabel = (
  kategori?: string | null
) => {
  if (kategori === 'Unit') {
    return 'Organisasi';
  }

  return kategori ?? '-';
};

export default function DataKavlingPage() {
  const {
    hasPermission,
    isSuperAdmin,
    session,
  } = useAuth();

  const location = useLocation();

  // =========================================================
  // ADMIN VIEW
  //
  // TRUE:
  // /admin/lainnya/data-kavling
  //
  // FALSE:
  // /kavling/data
  // =========================================================

  const isAdminView =
    location.pathname.startsWith('/admin');

  // =========================================================
  // STATE
  // =========================================================

  const [data, setData] =
    useState<Kavling[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [search, setSearch] =
    useState('');

  const [
    filterKategori,
    setFilterKategori,
  ] = useState('');

  const [
    filterNama,
    setFilterNama,
  ] = useState('');

  const [
    filterBulan,
    setFilterBulan,
  ] = useState('');

  const [
    filterTahun,
    setFilterTahun,
  ] = useState('');

  const [page, setPage] =
    useState(1);

  const [detail, setDetail] =
    useState<Kavling | null>(null);

  const [editing, setEditing] =
    useState<Kavling | null>(null);

  const [saving, setSaving] =
    useState(false);

  const [
    deletingId,
    setDeletingId,
  ] = useState<string | null>(null);

  // =========================================================
  // PERMISSION
  // =========================================================

  const canEdit =
    hasPermission(
      'kavling',
      'update'
    ) || isSuperAdmin;

  const canVerify =
    hasPermission(
      'kavling',
      'verify'
    ) || isSuperAdmin;

  const canDelete =
    hasPermission(
      'kavling',
      'delete'
    ) || isSuperAdmin;

  // =========================================================
  // LOAD DATA
  // =========================================================

  const loadData = async () => {
    setLoading(true);

    try {
      const response =
        await fetch(
          `${API_BASE_URL}/api/kavling`
        );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | ApiResponse<Kavling[]>
          | null;

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.message ??
            'Gagal memuat data kavling'
        );
      }

      setData(
        result.data ?? []
      );
    } catch (err: unknown) {
      showToast(
        err instanceof Error
          ? err.message
          : 'Gagal memuat data kavling',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  // =========================================================
  // FILTER OPTIONS
  // =========================================================

  const tahunOptions =
    useMemo(() => {
      const years =
        new Set<string>();

      data.forEach((d) => {
        if (d.tanggal) {
          years.add(
            d.tanggal.slice(
              0,
              4
            )
          );
        }
      });

      return Array
        .from(years)
        .sort(
          (a, b) =>
            b.localeCompare(a)
        );
    }, [data]);

  const namaOptions =
    useMemo(() => {
      const names =
        new Set<string>();

      data.forEach((d) => {
        if (
          !filterKategori ||
          d.kategori ===
            filterKategori
        ) {
          names.add(
            d.nama_kategori
          );
        }
      });

      return Array
        .from(names)
        .sort(
          (a, b) =>
            a.localeCompare(b)
        );
    }, [
      data,
      filterKategori,
    ]);

  // =========================================================
  // FILTER DATA
  // =========================================================

  const filtered =
    useMemo(() => {
      return data.filter(
        (d) => {
          if (search) {
            const q =
              search
                .toLowerCase()
                .trim();

            const hit =
              d.nama_pj
                ?.toLowerCase()
                .includes(q) ||
              d.judul
                ?.toLowerCase()
                .includes(q) ||
              d.nama_kategori
                ?.toLowerCase()
                .includes(q) ||
              d.lokasi
                ?.toLowerCase()
                .includes(q);

            if (!hit) {
              return false;
            }
          }

          if (
            filterKategori &&
            d.kategori !==
              filterKategori
          ) {
            return false;
          }

          if (
            filterNama &&
            d.nama_kategori !==
              filterNama
          ) {
            return false;
          }

          if (
            filterBulan &&
            d.tanggal
          ) {
            const bulan =
              parseInt(
                d.tanggal.slice(
                  5,
                  7
                ),
                10
              ) - 1;

            if (
              bulan !==
              parseInt(
                filterBulan,
                10
              )
            ) {
              return false;
            }
          }

          if (
            filterTahun &&
            d.tanggal &&
            d.tanggal.slice(
              0,
              4
            ) !== filterTahun
          ) {
            return false;
          }

          return true;
        }
      );
    }, [
      data,
      search,
      filterKategori,
      filterNama,
      filterBulan,
      filterTahun,
    ]);

  // =========================================================
  // PAGINATION
  // =========================================================

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        filtered.length /
          PAGE_SIZE
      )
    );

  const currentPage =
    Math.min(
      page,
      totalPages
    );

  const pageData =
    filtered.slice(
      (currentPage - 1) *
        PAGE_SIZE,

      currentPage *
        PAGE_SIZE
    );

  useEffect(() => {
    setPage(1);
  }, [
    search,
    filterKategori,
    filterNama,
    filterBulan,
    filterTahun,
  ]);

  useEffect(() => {
    setFilterNama('');
  }, [filterKategori]);

  // =========================================================
  // STATISTIK
  // =========================================================

  const stats =
    useMemo(
      () => ({
        total:
          data.length,

        kelas:
          data.filter(
            (d) =>
              d.kategori ===
              'Kelas'
          ).length,

        eskul:
          data.filter(
            (d) =>
              d.kategori ===
              'Ekstrakurikuler'
          ).length,

        unit:
          data.filter(
            (d) =>
              d.kategori ===
              'Unit'
          ).length,
      }),
      [data]
    );

  const distribusi =
    useMemo(() => {
      const map =
        new Map<
          string,
          {
            nama: string;
            kategori: KavlingKategori;
            count: number;
          }
        >();

      data.forEach((d) => {
        const key =
          `${d.kategori}|${d.nama_kategori}`;

        const existing =
          map.get(key);

        if (existing) {
          existing.count += 1;
        } else {
          map.set(
            key,
            {
              nama:
                d.nama_kategori,

              kategori:
                d.kategori,

              count: 1,
            }
          );
        }
      });

      return Array
        .from(
          map.values()
        )
        .sort(
          (a, b) =>
            b.count -
            a.count
        );
    }, [data]);

  const maxCount =
    Math.max(
      1,
      ...distribusi.map(
        (d) => d.count
      )
    );

  const statCards = [
    {
      label:
        'Jumlah Total Kavling',

      value:
        stats.total,

      color:
        'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
    },

    {
      label:
        'Kavling Kelas',

      value:
        stats.kelas,

      color:
        'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
    },

    {
      label:
        'Kavling Ekstrakurikuler',

      value:
        stats.eskul,

      color:
        'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
    },

    {
      label:
        'Kavling Organisasi',

      value:
        stats.unit,

      color:
        'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
    },
  ];

  // =========================================================
  // FILE
  // =========================================================

  const isImage = (
    url?: string | null,
    fileName?: string | null
  ) => {
    if (!url && !fileName) {
      return false;
    }

    if (
      fileName &&
      /\.(jpg|jpeg|png|webp|gif)$/i.test(fileName)
    ) {
      return true;
    }

    if (
      url &&
      /\.(jpg|jpeg|png|webp|gif)(\?.*)?$/i.test(url)
    ) {
      return true;
    }

    if (
      url &&
      (
        url.includes('googleusercontent.com') ||
        url.includes('drive.google.com')
      )
    ) {
      return true;
    }

    return false;
  };

  const getGoogleDriveFileId = (
    url?: string | null
  ) => {
    if (!url) {
      return null;
    }

    // https://drive.google.com/file/d/FILE_ID/view
    const driveFileMatch =
      url.match(/\/file\/d\/([^/?#]+)/);

    if (driveFileMatch?.[1]) {
      return driveFileMatch[1];
    }

    // https://lh3.googleusercontent.com/d/FILE_ID=w1000
    const googleusercontentMatch =
      url.match(/googleusercontent\.com\/d\/([^=/?#]+)/);

    if (googleusercontentMatch?.[1]) {
      return googleusercontentMatch[1];
    }

    // https://drive.google.com/open?id=FILE_ID
    // https://drive.google.com/uc?id=FILE_ID
    // https://drive.google.com/thumbnail?id=FILE_ID
    try {
      const parsed = new URL(url);
      return parsed.searchParams.get('id');
    } catch {
      return null;
    }
  };

  const getImageUrl = (
    url?: string | null
  ) => {
    if (!url) {
      return '';
    }

    // URL hasil migrasi Apps Script sudah berupa direct image URL.
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

    // URL Supabase / URL gambar biasa dipakai apa adanya.
    return url;
  };

  const handleGoogleImageError = (
    event: React.SyntheticEvent<HTMLImageElement>,
    originalUrl?: string | null
  ) => {
    const image = event.currentTarget;

    // Hindari fallback berulang tanpa akhir.
    if (image.dataset.fallback === 'true') {
      return;
    }

    const driveId =
      getGoogleDriveFileId(originalUrl);

    if (!driveId) {
      return;
    }

    image.dataset.fallback = 'true';
    image.src =
      `https://drive.google.com/thumbnail?id=${encodeURIComponent(
        driveId
      )}&sz=w1000`;
  };

  // =========================================================
  // EXPORT EXCEL
  // =========================================================

  const exportExcel = () => {
    if (
      filtered.length === 0
    ) {
      showToast(
        'Tidak ada data untuk diexport',
        'warning'
      );

      return;
    }

    const rows =
      filtered.map(
        (d) => ({
          Tanggal:
            d.tanggal
              ? new Date(
                  d.tanggal
                )
                  .toLocaleDateString(
                    'id-ID'
                  )
              : '',

          'Nama PJ':
            d.nama_pj,

          Kategori:
            getKategoriLabel(
              d.kategori
            ),

          Nama:
            d.nama_kategori,

          Judul:
            d.judul,

          Lokasi:
            d.lokasi,

          Deskripsi:
            d.deskripsi,

          Hasil:
            d.hasil,

          Catatan:
            d.catatan,
        })
      );

    const ws =
      XLSX.utils
        .json_to_sheet(
          rows
        );

    ws['!cols'] = [
      { wch: 12 },
      { wch: 20 },
      { wch: 15 },
      { wch: 20 },
      { wch: 25 },
      { wch: 20 },
      { wch: 30 },
      { wch: 30 },
      { wch: 20 },
    ];

    const wb =
      XLSX.utils
        .book_new();

    XLSX.utils
      .book_append_sheet(
        wb,
        ws,
        'Data Kavling'
      );

    XLSX.writeFile(
      wb,
      `Data-Kavling-${new Date()
        .toISOString()
        .slice(
          0,
          10
        )}.xlsx`
    );
  };

  // =========================================================
  // UPDATE STATUS
  //
  // SECURITY DI FRONTEND:
  // hanya boleh dari halaman admin + permission.
  // =========================================================

  const updateStatus =
    async (
      id: string,
      status: KavlingStatus
    ) => {
      if (
        !isAdminView ||
        !canVerify
      ) {
        showToast(
          'Anda tidak memiliki akses untuk mengubah status kavling.',
          'error'
        );

        return;
      }

      if (
        !session?.access_token
      ) {
        showToast(
          'Session login tidak ditemukan.',
          'error'
        );

        return;
      }

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/admin/kavling/${encodeURIComponent(
              id
            )}/status`,
            {
              method: 'PATCH',

              headers: {
                'Content-Type':
                  'application/json',

                Authorization:
                  `Bearer ${session.access_token}`,
              },

              body: JSON.stringify({
                status,
              }),
            }
          );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | ApiResponse<Kavling>
            | null;

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
          `Status kavling diubah menjadi "${KAVLING_STATUS_LABELS[status]}"`,
          'success'
        );

        await loadData();

        setDetail(null);
      } catch (err: unknown) {
        showToast(
          err instanceof Error
            ? err.message
            : 'Gagal mengubah status',
          'error'
        );
      }
    };

  // =========================================================
  // DELETE
  //
  // HANYA ADMIN + PERMISSION
  // =========================================================

  const handleDelete =
    async (
      id: string
    ) => {
      if (
        !isAdminView ||
        !canDelete
      ) {
        showToast(
          'Anda tidak memiliki akses untuk menghapus data kavling.',
          'error'
        );

        return;
      }

      if (
        !session?.access_token
      ) {
        showToast(
          'Session login tidak ditemukan.',
          'error'
        );

        return;
      }

      if (
        !window.confirm(
          'Yakin ingin menghapus data kavling ini?'
        )
      ) {
        return;
      }

      setDeletingId(id);

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/admin/kavling/${encodeURIComponent(
              id
            )}`,
            {
              method: 'DELETE',

              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
            }
          );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | ApiResponse<{ id: string }>
            | null;

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal menghapus data'
          );
        }

        showToast(
          'Data kavling berhasil dihapus',
          'success'
        );

        await loadData();

        setDetail(null);
      } catch (err: unknown) {
        showToast(
          err instanceof Error
            ? err.message
            : 'Gagal menghapus data',
          'error'
        );
      } finally {
        setDeletingId(null);
      }
    };

  // =========================================================
  // OPEN EDIT
  // =========================================================

  const openEdit = (
    kavling: Kavling
  ) => {
    if (
      !isAdminView ||
      !canEdit
    ) {
      return;
    }

    setEditing(
      kavling
    );
  };

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="relative pb-12">

      {/* =====================================================
          HERO
          ===================================================== */}

      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <div className="relative mx-auto max-w-7xl px-4 text-center">

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <MapPin className="h-7 w-7 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-white">
            Data Kavling
          </h1>

          <p className="mt-2 text-sm text-white/80">
            Daftar seluruh data kavling yang telah diinput
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">

        {/* =================================================
            STATISTIK
            ================================================= */}

        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map(
            (s) => (
              <div
                key={
                  s.label
                }
                className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
              >
                <div
                  className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}
                >
                  <BarChart3 className="h-4 w-4" />
                </div>

                <p className="text-2xl font-bold text-slate-900 dark:text-white">
                  {loading
                    ? 'â€¦'
                    : s.value}
                </p>

                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {s.label}
                </p>
              </div>
            )
          )}
        </div>

        {/* =================================================
            DISTRIBUSI
            ================================================= */}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">

          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-600 dark:text-brand-400" />

            <h2 className="text-base font-semibold text-slate-900 dark:text-white">
              Distribusi Kavling Terbanyak
            </h2>
          </div>

          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(
                (i) => (
                  <div
                    key={i}
                    className="h-8 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                  />
                )
              )}
            </div>
          ) : distribusi.length ===
            0 ? (
            <p className="text-sm text-slate-400">
              Belum ada data.
            </p>
          ) : (
            <div className="space-y-2.5">
              {distribusi
                .slice(
                  0,
                  10
                )
                .map(
                  (
                    d,
                    i
                  ) => (
                    <div
                      key={i}
                      className="flex items-center gap-3"
                    >
                      <span className="w-40 shrink-0 truncate text-sm text-slate-700 dark:text-slate-200">
                        {
                          d.nama
                        }
                      </span>

                      <div className="h-6 flex-1 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                        <div
                          className="flex h-full items-center rounded-lg bg-brand-500/80 px-2 text-xs font-semibold text-white"
                          style={{
                            width:
                              `${(d.count / maxCount) * 100}%`,

                            minWidth:
                              '2.5rem',
                          }}
                        >
                          {
                            d.count
                          }
                        </div>
                      </div>

                      <span className="w-20 shrink-0 text-right text-xs text-slate-400">
                        {
                          getKategoriLabel(
                            d.kategori
                          )
                        }
                      </span>
                    </div>
                  )
                )}
            </div>
          )}
        </div>

        {/* =================================================
            FILTER
            ================================================= */}

        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center">

          {/* SEARCH */}

          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(
                e
              ) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Cari nama PJ, judul, lokasiâ€¦"
              className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* KATEGORI */}

          <select
            value={
              filterKategori
            }
            onChange={(
              e
            ) =>
              setFilterKategori(
                e.target.value
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">
              Semua Kategori
            </option>

            {KAVLING_KATEGORI_OPTIONS.map(
              (k) => (
                <option
                  key={k}
                  value={k}
                >
                  {
                    getKategoriLabel(
                      k
                    )
                  }
                </option>
              )
            )}
          </select>

          {/* NAMA */}

          <select
            value={
              filterNama
            }
            onChange={(
              e
            ) =>
              setFilterNama(
                e.target.value
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">
              Semua{' '}
              {filterKategori
                ? getKategoriLabel(
                    filterKategori
                  )
                : 'Nama'}
            </option>

            {namaOptions.map(
              (n) => (
                <option
                  key={n}
                  value={n}
                >
                  {n}
                </option>
              )
            )}
          </select>

          {/* BULAN */}

          <select
            value={
              filterBulan
            }
            onChange={(
              e
            ) =>
              setFilterBulan(
                e.target.value
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">
              Semua Bulan
            </option>

            {MONTHS.map(
              (
                m,
                i
              ) => (
                <option
                  key={i}
                  value={i}
                >
                  {m}
                </option>
              )
            )}
          </select>

          {/* TAHUN */}

          <select
            value={
              filterTahun
            }
            onChange={(
              e
            ) =>
              setFilterTahun(
                e.target.value
              )
            }
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >
            <option value="">
              Semua Tahun
            </option>

            {tahunOptions.map(
              (t) => (
                <option
                  key={t}
                  value={t}
                >
                  {t}
                </option>
              )
            )}
          </select>

          {/* EXCEL */}

          <button
            type="button"
            onClick={
              exportExcel
            }
            className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
          >
            <FileSpreadsheet className="h-4 w-4" />

            Unduh Excel
          </button>
        </div>

        {/* =================================================
            TABLE
            ================================================= */}

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-brand-500" />
            </div>
          ) : pageData.length ===
            0 ? (
            <EmptyState
              title="Tidak ada data kavling"
              description="Data yang sesuai filter akan muncul di sini."
              className="py-12"
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">

                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">

                    <th className="px-4 py-3 font-semibold">
                      Tanggal
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Nama PJ
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Kategori
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Nama
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Judul
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Lokasi
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Bukti
                    </th>

                    <th className="px-4 py-3 font-semibold">
                      Aksi
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">

                  {pageData.map(
                    (d) => (
                      <tr
                        key={
                          d.id
                        }
                        className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50"
                        onClick={() =>
                          setDetail(
                            d
                          )
                        }
                      >

                        {/* TANGGAL */}

                        <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                          {d.tanggal
                            ? new Date(
                                d.tanggal
                              )
                                .toLocaleDateString(
                                  'id-ID',
                                  {
                                    day:
                                      'numeric',

                                    month:
                                      'short',

                                    year:
                                      'numeric',
                                  }
                                )
                            : '-'}
                        </td>

                        {/* PJ */}

                        <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                          {
                            d.nama_pj
                          }
                        </td>

                        {/* KATEGORI */}

                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {
                            getKategoriLabel(
                              d.kategori
                            )
                          }
                        </td>

                        {/* NAMA */}

                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {
                            d.nama_kategori
                          }
                        </td>

                        {/* JUDUL */}

                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {
                            d.judul
                          }
                        </td>

                        {/* LOKASI */}

                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {
                            d.lokasi
                          }
                        </td>

                        {/* BUKTI */}

                        <td className="px-4 py-3">
                          {!d.file_url ? (
                            <span className="text-xs text-slate-400">
                              -
                            </span>
                          ) : isImage(
                              d.file_url,
                              d.file_name
                            ) ? (
                            <RemoteImage
                              src={
                                getImageUrl(
                                  d.file_url
                                )
                              }
                              alt={
                                d.file_name ||
                                'Bukti Kavling'
                              }
                              referrerPolicy="no-referrer"
                              loading="lazy"
                              onError={(e) =>
                                handleGoogleImageError(
                                  e,
                                  d.file_url
                                )
                              }
                              className="h-10 w-10 rounded-lg object-cover"
                            />
                          ) : (
                            <a
                              href={
                                d.file_url
                              }
                              target="_blank"
                              rel="noreferrer"
                              onClick={(
                                e
                              ) =>
                                e.stopPropagation()
                              }
                              className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800"
                            >
                              <FileText className="h-4 w-4" />
                            </a>
                          )}
                        </td>

                        {/* =====================================
                            ACTION
                            ===================================== */}

                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">

                            {/* DETAIL */}

                            <button
                              type="button"
                              onClick={(
                                e
                              ) => {
                                e.stopPropagation();

                                setDetail(
                                  d
                                );
                              }}
                              className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300"
                            >
                              Detail
                            </button>

                            {/* EDIT ADMIN */}

                            {isAdminView &&
                              canEdit && (
                                <button
                                  type="button"
                                  onClick={(
                                    e
                                  ) => {
                                    e.stopPropagation();

                                    openEdit(
                                      d
                                    );
                                  }}
                                  className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300"
                                  title="Edit"
                                >
                                  <Pencil className="h-3.5 w-3.5" />
                                </button>
                              )}

                            {/* DELETE ADMIN */}

                            {isAdminView &&
                              canDelete && (
                                <button
                                  type="button"
                                  onClick={(
                                    e
                                  ) => {
                                    e.stopPropagation();

                                    void handleDelete(
                                      d.id
                                    );
                                  }}
                                  disabled={
                                    deletingId ===
                                    d.id
                                  }
                                  className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300"
                                  title="Hapus"
                                >
                                  {deletingId ===
                                  d.id ? (
                                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                  ) : (
                                    <Trash2 className="h-3.5 w-3.5" />
                                  )}
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
        </div>

        {/* =================================================
            PAGINATION
            ================================================= */}

        {filtered.length >
          0 && (
          <div className="mt-4 flex items-center justify-between">

            <p className="text-xs text-slate-500 dark:text-slate-400">
              Menampilkan{' '}
              {(currentPage -
                1) *
                PAGE_SIZE +
                1}
              â€“
              {Math.min(
                currentPage *
                  PAGE_SIZE,
                filtered.length
              )}{' '}
              dari{' '}
              {
                filtered.length
              }
            </p>

            <div className="flex items-center gap-1">

              <button
                type="button"
                disabled={
                  currentPage <=
                  1
                }
                onClick={() =>
                  setPage(
                    (p) =>
                      p - 1
                  )
                }
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>

              <span className="px-3 text-sm font-medium text-slate-700 dark:text-slate-200">
                {
                  currentPage
                }{' '}
                /{' '}
                {
                  totalPages
                }
              </span>

              <button
                type="button"
                disabled={
                  currentPage >=
                  totalPages
                }
                onClick={() =>
                  setPage(
                    (p) =>
                      p + 1
                  )
                }
                className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* =====================================================
          DETAIL MODAL
          ===================================================== */}

      {detail && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() =>
            setDetail(
              null
            )
          }
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            onClick={(
              e
            ) =>
              e.stopPropagation()
            }
          >

            {/* HEADER */}

            <div className="mb-4 flex items-center justify-between">

              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Detail Kavling
              </h3>

              <button
                type="button"
                onClick={() =>
                  setDetail(
                    null
                  )
                }
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-sm">

              {/* DATA UTAMA */}

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <DetailItem
                  label="Nama PJ"
                  value={
                    detail.nama_pj
                  }
                />

                <DetailItem
                  label="Kategori"
                  value={
                    getKategoriLabel(
                      detail.kategori
                    )
                  }
                />

                <DetailItem
                  label="Nama Kelas / Eskul / Organisasi"
                  value={
                    detail.nama_kategori
                  }
                />

                <DetailItem
                  label="Tanggal"
                  value={
                    detail.tanggal
                      ? new Date(
                          detail.tanggal
                        )
                          .toLocaleDateString(
                            'id-ID',
                            {
                              day:
                                'numeric',

                              month:
                                'long',

                              year:
                                'numeric',
                            }
                          )
                      : '-'
                  }
                />

                <DetailItem
                  label="Lokasi"
                  value={
                    detail.lokasi
                  }
                />
              </div>

              {/* JUDUL */}

              <div>
                <p className="text-xs text-slate-400">
                  Judul Kegiatan
                </p>

                <p className="font-medium text-slate-900 dark:text-white">
                  {
                    detail.judul
                  }
                </p>
              </div>

              {/* DESKRIPSI */}

              <div>
                <p className="text-xs text-slate-400">
                  Deskripsi Kegiatan
                </p>

                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                  {
                    detail.deskripsi
                  }
                </p>
              </div>

              {/* HASIL */}

              <div>
                <p className="text-xs text-slate-400">
                  Hasil Kavling
                </p>

                <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                  {
                    detail.hasil
                  }
                </p>
              </div>

              {/* CATATAN */}

              {detail.catatan && (
                <div>
                  <p className="text-xs text-slate-400">
                    Catatan
                  </p>

                  <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">
                    {
                      detail.catatan
                    }
                  </p>
                </div>
              )}

              {/* BUKTI */}

              <div>
                <p className="mb-2 text-xs text-slate-400">
                  Bukti Pendukung
                </p>

                {!detail.file_url ? (
                  <p className="text-sm text-slate-400">
                    Tidak ada bukti pendukung.
                  </p>
                ) : (
                  <>
                    {isImage(
                      detail.file_url,
                      detail.file_name
                    ) ? (
                      <RemoteImage
                        src={
                          getImageUrl(
                            detail.file_url
                          )
                        }
                        alt={
                          detail.file_name ||
                          'Bukti Kavling'
                        }
                        referrerPolicy="no-referrer"
                        onError={(e) =>
                          handleGoogleImageError(
                            e,
                            detail.file_url
                          )
                        }
                        className="max-h-64 rounded-lg border border-slate-200 object-contain dark:border-slate-700"
                      />
                    ) : (
                      <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800">

                        <FileText className="h-5 w-5 text-brand-600 dark:text-brand-400" />

                        <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                          {detail.file_name ||
                            'File Pendukung'}
                        </span>
                      </div>
                    )}

                    <a
                      href={
                        detail.file_url
                      }
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                    >
                      <Download className="h-3.5 w-3.5" />

                      Download
                    </a>
                  </>
                )}
              </div>

              {/* VERIFIKASI / TOLAK */}

              {isAdminView &&
                canVerify &&
                detail.status ===
                  'Menunggu Verifikasi' && (
                  <div className="flex flex-wrap gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">

                    <button
                      type="button"
                      onClick={() =>
                        void updateStatus(
                          detail.id,
                          'Diverifikasi'
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />

                      Verifikasi
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void updateStatus(
                          detail.id,
                          'Ditolak'
                        )
                      }
                      className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700"
                    >
                      <XCircle className="h-3.5 w-3.5" />

                      Tolak
                    </button>
                  </div>
                )}

              {/* EDIT DATA */}

              {isAdminView &&
                canEdit && (
                  <div className="flex gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">

                    <button
                      type="button"
                      onClick={() => {
                        const target =
                          detail;

                        setDetail(
                          null
                        );

                        openEdit(
                          target
                        );
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
                    >
                      <Pencil className="h-3.5 w-3.5" />

                      Edit Data
                    </button>
                  </div>
                )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================
          EDIT MODAL
          ===================================================== */}

      {isAdminView &&
        canEdit &&
        editing && (
          <EditKavlingModal
            kavling={
              editing
            }
            onClose={() =>
              setEditing(
                null
              )
            }
            onSaved={async () => {
              setEditing(
                null
              );

              await loadData();
            }}
            saving={
              saving
            }
            setSaving={
              setSaving
            }
          />
        )}
    </div>
  );
}

// ===========================================================
// DETAIL ITEM
// ===========================================================

function DetailItem({
  label,
  value,
}: {
  label: string;
  value:
    | string
    | number
    | null
    | undefined;
}) {
  return (
    <div>
      <p className="text-xs text-slate-400">
        {label}
      </p>

      <p className="font-medium text-slate-900 dark:text-white">
        {value ??
          '-'}
      </p>
    </div>
  );
}

// ===========================================================
// EDIT KAVLING MODAL
// ===========================================================

function EditKavlingModal({
  kavling,
  onClose,
  onSaved,
  saving,
  setSaving,
}: {
  kavling: Kavling;
  onClose: () => void;
  onSaved: () => void;
  saving: boolean;
  setSaving:
    (
      value: boolean
    ) => void;
}) {
  const {
    session,
  } = useAuth();

  const [
    form,
    setForm,
  ] = useState({
    nama_pj:
      kavling.nama_pj,

    nama_kategori:
      kavling.nama_kategori,

    tanggal:
      kavling.tanggal,

    lokasi:
      kavling.lokasi,

    judul:
      kavling.judul,

    deskripsi:
      kavling.deskripsi,

    hasil:
      kavling.hasil,

    catatan:
      kavling.catatan,
  });

  const set = (
    key:
      keyof typeof form,
    value: string
  ) => {
    setForm(
      (prev) => ({
        ...prev,
        [key]:
          value,
      })
    );
  };

  const handleSave =
    async (
      e: React.FormEvent
    ) => {
      e.preventDefault();

      if (saving) {
        return;
      }

      if (
        !session?.access_token
      ) {
        showToast(
          'Session login tidak ditemukan.',
          'error'
        );

        return;
      }

      setSaving(true);

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/admin/kavling/${encodeURIComponent(
              kavling.id
            )}`,
            {
              method: 'PATCH',

              headers: {
                'Content-Type':
                  'application/json',

                Authorization:
                  `Bearer ${session.access_token}`,
              },

              body: JSON.stringify({
                nama_pj:
                  form.nama_pj.trim(),

                nama_kategori:
                  form.nama_kategori.trim(),

                tanggal:
                  form.tanggal,

                lokasi:
                  form.lokasi.trim(),

                judul:
                  form.judul.trim(),

                deskripsi:
                  form.deskripsi.trim(),

                hasil:
                  form.hasil.trim(),

                catatan:
                  form.catatan.trim(),
              }),
            }
          );

        const result =
          (await response
            .json()
            .catch(() => null)) as
            | ApiResponse<Kavling>
            | null;

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal memperbarui data'
          );
        }

        showToast(
          'Data kavling berhasil diperbarui',
          'success'
        );

        onSaved();
      } catch (err: unknown) {
        showToast(
          err instanceof Error
            ? err.message
            : 'Gagal memperbarui data',
          'error'
        );
      } finally {
        setSaving(false);
      }
    };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={
        onClose
      }
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        onClick={(
          e
        ) =>
          e.stopPropagation()
        }
      >

        {/* HEADER */}

        <div className="mb-4 flex items-center justify-between">

          <h3 className="text-lg font-bold text-slate-900 dark:text-white">
            Edit Data Kavling
          </h3>

          <button
            type="button"
            onClick={
              onClose
            }
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* FORM */}

        <form
          onSubmit={
            handleSave
          }
          className="space-y-4 text-sm"
        >

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

            {/* PJ */}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nama PJ
              </label>

              <input
                value={
                  form.nama_pj
                }
                onChange={(
                  e
                ) =>
                  set(
                    'nama_pj',
                    e.target.value
                  )
                }
                disabled={
                  saving
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* NAMA */}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nama Kelas / Eskul / Organisasi
              </label>

              <input
                value={
                  form.nama_kategori
                }
                onChange={(
                  e
                ) =>
                  set(
                    'nama_kategori',
                    e.target.value
                  )
                }
                disabled={
                  saving
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* TANGGAL */}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tanggal
              </label>

              <input
                type="date"
                value={
                  form.tanggal
                }
                onChange={(
                  e
                ) =>
                  set(
                    'tanggal',
                    e.target.value
                  )
                }
                disabled={
                  saving
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* LOKASI */}

            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Lokasi
              </label>

              <input
                value={
                  form.lokasi
                }
                onChange={(
                  e
                ) =>
                  set(
                    'lokasi',
                    e.target.value
                  )
                }
                disabled={
                  saving
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>
          </div>

          {/* JUDUL */}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Judul Kegiatan
            </label>

            <input
              value={
                form.judul
              }
              onChange={(
                e
              ) =>
                set(
                  'judul',
                  e.target.value
                )
              }
              disabled={
                saving
              }
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* DESKRIPSI */}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Deskripsi Kegiatan
            </label>

            <textarea
              rows={3}
              value={
                form.deskripsi
              }
              onChange={(
                e
              ) =>
                set(
                  'deskripsi',
                  e.target.value
                )
              }
              disabled={
                saving
              }
              className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* HASIL */}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Hasil Kavling
            </label>

            <textarea
              rows={3}
              value={
                form.hasil
              }
              onChange={(
                e
              ) =>
                set(
                  'hasil',
                  e.target.value
                )
              }
              disabled={
                saving
              }
              className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* CATATAN */}

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Catatan
            </label>

            <textarea
              rows={2}
              value={
                form.catatan
              }
              onChange={(
                e
              ) =>
                set(
                  'catatan',
                  e.target.value
                )
              }
              disabled={
                saving
              }
              className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />
          </div>

          {/* BUTTON */}

          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">

            <button
              type="button"
              onClick={
                onClose
              }
              disabled={
                saving
              }
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Batal
            </button>

            <button
              type="submit"
              disabled={
                saving
              }
              className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />

                  Menyimpan...
                </>
              ) : (
                <>
                  <Pencil className="h-4 w-4" />

                  Simpan
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}