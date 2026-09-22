import RemoteImage from '../components/RemoteImage';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Building2,
  Package,
  FileText,
  CalendarDays,
  CalendarRange,
  Info,
  Megaphone,
  X,
  Maximize2,
} from 'lucide-react';

import { brand } from '../brand/config';
import EmptyState from '../components/EmptyState';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));

interface Announcement {
  id: string;
  title: string;
  description: string;
  priority: string;
  created_at: string;
  image_url: string | null;
}

const quickLinks = [
  {
    to: '/fasilitas',
    label: 'Fasilitas',
    desc: 'Daftar fasilitas tersedia',
    icon: Building2,
  },
  {
    to: '/inventaris',
    label: 'Inventaris',
    desc: 'Daftar barang inventaris',
    icon: Package,
  },
  {
    to: '/laporan',
    label: 'Laporan',
    desc: 'Laporkan kerusakan',
    icon: FileText,
  },
  {
    to: '/agenda',
    label: 'Agenda',
    desc: 'Buat agenda kegiatan',
    icon: CalendarDays,
  },
  {
    to: '/timeline',
    label: 'Timeline',
    desc: 'Kalender kegiatan',
    icon: CalendarRange,
  },
  {
    to: '/tentang',
    label: 'Tentang',
    desc: 'Tentang sistem',
    icon: Info,
  },
];

export default function LandingPage() {
  const [stats, setStats] = useState({
    inventory: 0,
    facilities: 0,
    agendas: 0,
  });

  const [announcements, setAnnouncements] =
    useState<Announcement[]>([]);

  const [loading, setLoading] = useState(true);

  // =========================================================
  // PREVIEW GAMBAR PENGUMUMAN
  // =========================================================

  const [previewImage, setPreviewImage] =
    useState<string | null>(null);

  const [previewTitle, setPreviewTitle] =
    useState('');

  // =========================================================
  // LOAD DATA DASHBOARD
  // =========================================================

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/landing-dashboard`
        );

        const result = await response.json();

        if (!response.ok || !result?.ok) {
          throw new Error(
            result?.message ??
              'Gagal memuat dashboard'
          );
        }

        setStats({
          inventory:
            result.data?.stats?.inventory ?? 0,
          facilities:
            result.data?.stats?.facilities ?? 0,
          agendas:
            result.data?.stats?.agendas ?? 0,
        });

        setAnnouncements(
          (result.data?.announcements ??
            []) as Announcement[]
        );
      } catch (error) {
        console.error(
          'Gagal memuat dashboard:',
          error
        );
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  // =========================================================
  // ESC + BODY SCROLL SAAT PREVIEW TERBUKA
  // =========================================================

  useEffect(() => {
    if (!previewImage) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      'hidden';

    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        setPreviewImage(null);
        setPreviewTitle('');
      }
    };

    window.addEventListener(
      'keydown',
      handleEscape
    );

    return () => {
      window.removeEventListener(
        'keydown',
        handleEscape
      );

      document.body.style.overflow =
        previousOverflow;
    };
  }, [previewImage]);

  // =========================================================
  // PREVIEW
  // =========================================================

  const openPreview = (
    imageUrl: string,
    title: string
  ) => {
    setPreviewImage(imageUrl);
    setPreviewTitle(title);
  };

  const closePreview = () => {
    setPreviewImage(null);
    setPreviewTitle('');
  };

  // =========================================================
  // STAT ITEMS
  // =========================================================

  const statItems = [
    {
      label: 'Inventaris',
      value: stats.inventory,
      icon: Package,
    },
    {
      label: 'Fasilitas',
      value: stats.facilities,
      icon: Building2,
    },
    {
      label: 'Agenda',
      value: stats.agendas,
      icon: CalendarDays,
    },
  ];

  return (
    <>
      {/* =====================================================
          WRAPPER UTAMA

          PENTING:
          background dark ada di sini supaya tulisan SMART
          SARPRAS tetap terlihat saat dark mode.
          ===================================================== */}

      <div className="min-h-screen bg-slate-50 transition-colors duration-200 dark:bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 pb-10">

          {/* =================================================
              HERO
              ================================================= */}

          <section className="flex flex-col items-center py-12 text-center sm:py-16">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-700 text-white">
              <Building2 className="h-6 w-6" />
            </div>

            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
              {brand.name}
            </h1>

            <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">
              {brand.school}
            </p>

            <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-300">
              {brand.description}
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Link
                to="/laporan"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800"
              >
                <FileText className="h-4 w-4" />
                Buat Laporan
              </Link>

              <Link
                to="/agenda"
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
              >
                <CalendarDays className="h-4 w-4" />
                Buat Agenda
              </Link>
            </div>
          </section>

          {/* =================================================
              STATS
              ================================================= */}

          <section className="mx-auto max-w-3xl">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {statItems.map((s) => (
                <div
                  key={s.label}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                      <s.icon className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                    </div>

                    <div>
                      <p className="text-xl font-bold text-slate-900 dark:text-white">
                        {loading
                          ? '…'
                          : s.value}
                      </p>

                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {s.label}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* =================================================
              QUICK ACCESS
              ================================================= */}

          <section className="mt-8">
            <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">
              Akses Cepat
            </h2>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {quickLinks.map((q) => (
                <Link
                  key={q.to}
                  to={q.to}
                  className="rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-brand-300 hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700 dark:hover:bg-slate-800"
                >
                  <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                    <q.icon className="h-4 w-4" />
                  </div>

                  <p className="text-sm font-semibold text-slate-900 dark:text-white">
                    {q.label}
                  </p>

                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    {q.desc}
                  </p>
                </Link>
              ))}
            </div>
          </section>

          {/* =================================================
              PENGUMUMAN TERBARU
              ================================================= */}

          <section className="mt-8">
            <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm transition-colors dark:border-slate-800 dark:bg-slate-900">

              {/* HEADER */}

              <div className="mb-4 flex items-center gap-2">
                <Megaphone className="h-5 w-5 text-brand-700 dark:text-brand-300" />

                <h2 className="text-base font-semibold text-slate-900 dark:text-white">
                  Pengumuman Terbaru
                </h2>
              </div>

              {/* LOADING */}

              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800"
                    />
                  ))}
                </div>
              ) : announcements.length === 0 ? (
                <EmptyState
                  title="Tidak ada pengumuman"
                  description="Pengumuman akan muncul di sini saat dipublikasikan."
                />
              ) : (
                <div className="space-y-2">
                  {announcements.map((a) => (
                    <div
                      key={a.id}
                      className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3.5 transition-colors dark:border-slate-800 dark:bg-slate-800/50"
                    >

                      {/* PRIORITY */}

                      <span
                        className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                          a.priority === 'tinggi'
                            ? 'bg-red-500'
                            : a.priority === 'sedang'
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                        }`}
                      />

                      <div className="min-w-0 flex-1">

                        {/* TITLE */}

                        <p className="text-sm font-semibold text-slate-900 dark:text-white">
                          {a.title}
                        </p>

                        {/* =====================================
                            GAMBAR
                            KLIK → FULLSCREEN
                            ===================================== */}

                        {a.image_url && (
                          <button
                            type="button"
                            onClick={() =>
                              openPreview(
                                a.image_url!,
                                a.title
                              )
                            }
                            className="group relative mt-2 block w-fit max-w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 outline-none transition hover:border-brand-400 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-950"
                            title="Klik untuk melihat gambar penuh"
                          >
                            <RemoteImage
                              src={a.image_url}
                              alt={
                                a.title ||
                                'Pengumuman'
                              }
                              className="max-h-40 max-w-full cursor-zoom-in object-contain"
                            />

                            {/* ICON ZOOM */}

                            <div className="absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-black/60 text-white opacity-0 backdrop-blur-sm transition-opacity group-hover:opacity-100">
                              <Maximize2 className="h-4 w-4" />
                            </div>
                          </button>
                        )}

                        {/* DESCRIPTION */}

                        <p className="mt-1.5 line-clamp-2 text-sm text-slate-500 dark:text-slate-300">
                          {a.description}
                        </p>

                        {/* DATE */}

                        <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                          {new Date(
                            a.created_at
                          ).toLocaleDateString(
                            'id-ID',
                            {
                              day:
                                'numeric',
                              month:
                                'long',
                              year:
                                'numeric',
                            }
                          )}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* =====================================================
          FULLSCREEN PREVIEW GAMBAR
          ===================================================== */}

      {previewImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={closePreview}
          role="dialog"
          aria-modal="true"
          aria-label="Preview gambar pengumuman"
        >

          {/* TOMBOL TUTUP */}

          <button
            type="button"
            onClick={closePreview}
            className="absolute right-4 top-4 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            title="Tutup"
            aria-label="Tutup gambar"
          >
            <X className="h-6 w-6" />
          </button>

          {/* GAMBAR */}

          <div
            className="flex max-h-full max-w-6xl flex-col items-center justify-center"
            onClick={(e) =>
              e.stopPropagation()
            }
          >
            <RemoteImage
              src={previewImage}
              alt={
                previewTitle ||
                'Gambar pengumuman'
              }
              className="max-h-[85vh] max-w-full rounded-lg object-contain"
            />

            {/* JUDUL */}

            {previewTitle && (
              <p className="mt-3 max-w-3xl text-center text-sm font-medium text-white">
                {previewTitle}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}