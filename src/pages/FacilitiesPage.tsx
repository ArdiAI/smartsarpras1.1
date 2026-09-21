import RemoteImage from '../components/RemoteImage';
import { useEffect, useState } from 'react';
import {
  Building2,
  Search,
  MapPin,
  Users,
  X,
} from 'lucide-react';

import AnimatedBackground from '../components/AnimatedBackground';
import EmptyState from '../components/EmptyState';

interface Facility {
  id: string;
  name: string;
  description: string | null;
  location: string | null;
  capacity: number | null;
  image_url: string | null;
  facility_type: string | null;
  category: string | null;
  status: string | null;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

const pexelsFallback = (seed: string) =>
  `https://images.pexels.com/photos/${
    (seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 1000) +
    1000000
  }/pexels-photo-${
    (seed.split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 1000) +
    1000000
  }.jpeg?auto=compress&cs=tinysrgb&w=600`;

export default function FacilitiesPage() {
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(
    null
  );

  // Mengambil data fasilitas dari PostgreSQL melalui backend API
  useEffect(() => {
    let mounted = true;

    const loadFacilities = async () => {
      setLoading(true);

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/facilities`
        );

        if (!response.ok) {
          throw new Error(
            `Facilities API HTTP ${response.status}`
          );
        }

        const result =
          (await response.json()) as ApiResponse<Facility[]>;

        if (!result.ok) {
          throw new Error(
            result.message ?? 'Gagal mengambil data fasilitas'
          );
        }

        if (!mounted) {
          return;
        }

        setFacilities(result.data ?? []);
      } catch (error) {
        console.error(
          '[FacilitiesPage] Gagal mengambil data dari PostgreSQL API:',
          error
        );

        if (mounted) {
          setFacilities([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadFacilities();

    return () => {
      mounted = false;
    };
  }, []);

  // Tutup preview dengan tombol ESC
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewImage(null);
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('keydown', handleEscape);
    };
  }, []);

  const filtered = facilities.filter((f) => {
    const q = search.toLowerCase();

    return (
      !search ||
      f.name.toLowerCase().includes(q) ||
      (f.location ?? '').toLowerCase().includes(q) ||
      (f.category ?? '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="relative pb-12">
      {/* HERO */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <AnimatedBackground />

        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <Building2 className="h-7 w-7 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-white">
            Fasilitas Sekolah
          </h1>

          <p className="mt-2 text-sm text-white/80">
            Jelajahi fasilitas yang tersedia di sekolah
          </p>
        </div>
      </div>

      {/* CONTENT */}
      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* SEARCH */}
        <div className="relative mb-6 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari fasilitas…"
            className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>

        {/* LOADING */}
        {loading ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="animate-pulse rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="h-40 rounded-t-2xl bg-slate-200 dark:bg-slate-800" />

                <div className="space-y-2 p-4">
                  <div className="h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />
                  <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Tidak ada fasilitas"
            description="Belum ada fasilitas yang tersedia atau cocok dengan pencarian."
            icon={
              <Building2 className="h-8 w-8 text-slate-400" />
            }
          />
        ) : (
          /* FACILITIES GRID */
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((f) => {
              const imageSrc =
                f.image_url || pexelsFallback(f.id);

              return (
                <div
                  key={f.id}
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                >
                  {/* IMAGE */}
                  <div className="relative h-40 overflow-hidden bg-slate-100 dark:bg-slate-800">
                    <button
                      type="button"
                      onClick={() =>
                        setPreviewImage(imageSrc)
                      }
                      className="h-full w-full cursor-zoom-in"
                      title="Klik untuk melihat gambar"
                    >
                      <RemoteImage
                        src={imageSrc}
                        alt={f.name}
                        className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                        onError={(e) => {
                          e.currentTarget.src =
                            pexelsFallback(f.id);
                        }}
                      />
                    </button>
                  </div>

                  {/* FACILITY INFO */}
                  <div className="p-4">
                    <h3 className="font-bold text-slate-900 dark:text-white">
                      {f.name}
                    </h3>

                    {f.facility_type && (
                      <span className="mt-1 inline-block rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                        {f.facility_type}
                      </span>
                    )}

                    {f.description && (
                      <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                        {f.description}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                      {f.location && (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {f.location}
                        </span>
                      )}

                      {f.capacity != null && (
                        <span className="inline-flex items-center gap-1">
                          <Users className="h-3.5 w-3.5" />
                          {f.capacity} orang
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* FULLSCREEN IMAGE PREVIEW */}
      {previewImage && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() => setPreviewImage(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Preview gambar fasilitas"
        >
          {/* CLOSE BUTTON */}
          <button
            type="button"
            onClick={() => setPreviewImage(null)}
            className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Tutup gambar"
          >
            <X className="h-6 w-6" />
          </button>

          {/* FULL IMAGE */}
          <RemoteImage
            src={previewImage}
            alt="Preview fasilitas"
            className="max-h-[90vh] max-w-[95vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}