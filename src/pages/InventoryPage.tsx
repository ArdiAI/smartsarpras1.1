import RemoteImage from '../components/RemoteImage';
import { useEffect, useState } from 'react';
import {
  Package,
  Search,
  MapPin,
  X,
  UserRound,
} from 'lucide-react';

import AnimatedBackground from '../components/AnimatedBackground';
import EmptyState from '../components/EmptyState';

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  quantity: number;
  condition: 'good' | 'fair' | 'poor';
  location: string | null;
  image_url: string | null;
  description: string | null;

  manager_name: string | null;
  manager_role: string | null;
  manager_id: string | null;

  categories: {
    name: string;
  } | null;
}

interface Category {
  id: string;
  name: string;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

const conditionStyles: Record<
  string,
  {
    label: string;
    cls: string;
  }
> = {
  good: {
    label: 'Baik',
    cls:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  },

  fair: {
    label: 'Cukup',
    cls:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  },

  poor: {
    label: 'Buruk',
    cls:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  },
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);

  const [categories, setCategories] = useState<Category[]>([]);

  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');

  const [categoryFilter, setCategoryFilter] = useState('');

  const [previewImage, setPreviewImage] =
    useState<string | null>(null);

  // =========================================================
  // LOAD DATA DARI EXPRESS API -> POSTGRESQL
  // =========================================================

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      setLoading(true);

      try {
        const [inventoryResponse, categoryResponse] =
          await Promise.all([
            fetch(`${API_BASE_URL}/api/inventory`),
            fetch(`${API_BASE_URL}/api/categories`),
          ]);

        if (!inventoryResponse.ok) {
          throw new Error(
            `Inventory API HTTP ${inventoryResponse.status}`
          );
        }

        if (!categoryResponse.ok) {
          throw new Error(
            `Categories API HTTP ${categoryResponse.status}`
          );
        }

        const inventoryResult =
          (await inventoryResponse.json()) as ApiResponse<
            InventoryItem[]
          >;

        const categoryResult =
          (await categoryResponse.json()) as ApiResponse<
            Category[]
          >;

        if (!inventoryResult.ok) {
          throw new Error(
            inventoryResult.message ??
              'Gagal mengambil data inventaris'
          );
        }

        if (!categoryResult.ok) {
          throw new Error(
            categoryResult.message ??
              'Gagal mengambil kategori'
          );
        }

        if (!mounted) {
          return;
        }

        setItems(inventoryResult.data ?? []);
        setCategories(categoryResult.data ?? []);
      } catch (error) {
        console.error(
          '[InventoryPage] Gagal mengambil data dari PostgreSQL API:',
          error
        );

        if (mounted) {
          setItems([]);
          setCategories([]);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      mounted = false;
    };
  }, []);

  // =========================================================
  // FULLSCREEN IMAGE
  // =========================================================

  useEffect(() => {
    if (!previewImage) {
      return;
    }

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow = 'hidden';

    const handleEscape = (
      event: KeyboardEvent
    ) => {
      if (event.key === 'Escape') {
        setPreviewImage(null);
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
  // FILTER
  // =========================================================

  const filtered = items.filter(
    (item) => {
      const q = search
        .toLowerCase()
        .trim();

      const matchSearch =
        !q ||
        (item.name ?? '')
          .toLowerCase()
          .includes(q) ||
        (item.code ?? '')
          .toLowerCase()
          .includes(q) ||
        (item.manager_name ?? '')
          .toLowerCase()
          .includes(q) ||
        (item.manager_role ?? '')
          .toLowerCase()
          .includes(q) ||
        (item.location ?? '')
          .toLowerCase()
          .includes(q);

      const matchCategory =
        !categoryFilter ||
        item.categories?.name ===
          categoryFilter;

      return (
        matchSearch &&
        matchCategory
      );
    }
  );

  return (
    <div className="relative pb-12">

      {/* =====================================================
          HERO
          ===================================================== */}

      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">

        <AnimatedBackground />

        <div className="relative mx-auto max-w-7xl px-4 text-center">

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">

            <Package className="h-7 w-7 text-white" />

          </div>

          <h1 className="text-3xl font-bold text-white">
            Inventaris Sekolah
          </h1>

          <p className="mt-2 text-sm text-white/80">
            Daftar barang inventaris yang tersedia
          </p>

        </div>
      </div>

      {/* =====================================================
          CONTENT
          ===================================================== */}

      <div className="mx-auto max-w-7xl px-4 py-8">

        {/* SEARCH & FILTER */}

        <div className="mb-6 flex flex-col gap-3 sm:flex-row">

          {/* SEARCH */}

          <div className="relative flex-1">

            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

            <input
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
              placeholder="Cari barang / kode / PJ…"
              className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
            />

          </div>

          {/* CATEGORY */}

          <select
            value={categoryFilter}
            onChange={(e) =>
              setCategoryFilter(
                e.target.value
              )
            }
            className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          >

            <option value="">
              Semua Kategori
            </option>

            {categories.map(
              (category) => (
                <option
                  key={category.id}
                  value={category.name}
                >
                  {category.name}
                </option>
              )
            )}

          </select>

        </div>

        {/* =====================================================
            LOADING
            ===================================================== */}

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

            {[
              1,
              2,
              3,
              4,
              5,
              6,
              7,
              8,
            ].map(
              (i) => (
                <div
                  key={i}
                  className="animate-pulse overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >

                  <div className="h-40 bg-slate-200 dark:bg-slate-800" />

                  <div className="p-4">

                    <div className="h-10 rounded-lg bg-slate-200 dark:bg-slate-800" />

                    <div className="mt-4 h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" />

                    <div className="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />

                  </div>
                </div>
              )
            )}

          </div>
        ) : filtered.length === 0 ? (

          <EmptyState
            title="Tidak ada inventaris"
            description="Belum ada barang yang tersedia atau cocok dengan filter."
            icon={
              <Package className="h-8 w-8 text-slate-400" />
            }
          />

        ) : (

          /* ===================================================
             INVENTORY GRID
             =================================================== */

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

            {filtered.map(
              (item) => {
                const condition =
                  conditionStyles[
                    item.condition
                  ] ??
                  conditionStyles.fair;

                const imageUrl =
                  item.image_url;

                return (
                  <div
                    key={item.id}
                    className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900"
                  >

                    {/* ===========================================
                        IMAGE
                        =========================================== */}

                    <div className="flex h-40 items-center justify-center bg-slate-100 p-2 dark:bg-slate-800">

                      {imageUrl ? (

                        <button
                          type="button"
                          onClick={() =>
                            setPreviewImage(
                              imageUrl
                            )
                          }
                          className="h-full w-full cursor-zoom-in overflow-hidden rounded-lg"
                          title="Klik untuk melihat gambar"
                        >

                          <RemoteImage
                            src={imageUrl}
                            alt={item.name}
                            className="h-full w-full object-contain transition-transform duration-200 hover:scale-[1.02]"
                          />

                        </button>

                      ) : (

                        <Package className="h-8 w-8 text-slate-400" />

                      )}

                    </div>

                    {/* ===========================================
                        PJ INVENTARIS
                        TEPAT DI BAWAH GAMBAR
                        =========================================== */}

                    {item.manager_name && (

                      <div className="border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-800/50">

                        <div className="flex items-center gap-2">

                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-300">

                            <UserRound className="h-4 w-4" />

                          </div>

                          <div className="min-w-0">

                            <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                              PJ Inventaris
                            </p>

                            <p className="truncate text-xs font-semibold text-slate-700 dark:text-slate-200">
                              {item.manager_name}
                            </p>

                            {item.manager_role && (

                              <p className="truncate text-[10px] text-slate-400">
                                {item.manager_role}
                              </p>

                            )}

                          </div>

                        </div>

                      </div>

                    )}

                    {/* ===========================================
                        ITEM DETAIL
                        =========================================== */}

                    <div className="p-4">

                      {/* NAME + CONDITION */}

                      <div className="flex items-start justify-between gap-2">

                        <h3 className="font-semibold text-slate-900 dark:text-white">
                          {item.name}
                        </h3>

                        <span
                          className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${condition.cls}`}
                        >
                          {condition.label}
                        </span>

                      </div>

                      {/* CODE */}

                      <p className="mt-1 text-xs text-slate-400">
                        Kode:{' '}
                        {item.code}
                      </p>

                      {/* CATEGORY */}

                      {item.categories?.name && (

                        <span className="mt-2 inline-block rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                          {item.categories.name}
                        </span>

                      )}

                      {/* QUANTITY + LOCATION */}

                      <div className="mt-3 flex items-center justify-between gap-3 text-xs text-slate-500 dark:text-slate-400">

                        <span className="shrink-0 font-medium">
                          Jml:{' '}
                          {item.quantity}
                        </span>

                        {item.location && (

                          <span className="inline-flex min-w-0 items-center gap-1">

                            <MapPin className="h-3 w-3 shrink-0" />

                            <span className="truncate">
                              {item.location}
                            </span>

                          </span>

                        )}

                      </div>

                      {/* DESCRIPTION */}

                      {item.description && (

                        <p className="mt-3 line-clamp-3 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {item.description}
                        </p>

                      )}

                    </div>
                  </div>
                );
              }
            )}

          </div>
        )}

      </div>

      {/* =====================================================
          FULLSCREEN IMAGE PREVIEW
          ===================================================== */}

      {previewImage && (

        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() =>
            setPreviewImage(null)
          }
          role="dialog"
          aria-modal="true"
          aria-label="Preview gambar inventaris"
        >

          {/* CLOSE BUTTON */}

          <button
            type="button"
            onClick={() =>
              setPreviewImage(null)
            }
            className="absolute right-5 top-5 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            aria-label="Tutup gambar"
          >

            <X className="h-6 w-6" />

          </button>

          {/* IMAGE */}

          <RemoteImage
            src={previewImage}
            alt="Preview inventaris"
            className="max-h-[90vh] max-w-[95vw] object-contain"
            onClick={(e) =>
              e.stopPropagation()
            }
          />

        </div>

      )}

    </div>
  );
}