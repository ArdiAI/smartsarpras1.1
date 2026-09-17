import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  ClipboardList,
  Search,
  ShoppingCart,
  Plus,
  Minus,
  Trash2,
  Package,
  Building2,
  Loader2,
  CheckCircle2,
  X,
} from 'lucide-react';

import { showToast } from '../components/Toast';
import AnimatedBackground from '../components/AnimatedBackground';
import EmptyState from '../components/EmptyState';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

interface InventoryItem {
  id: string;
  code: string;
  name: string;
  quantity: number;
  available_quantity: number;
  condition: string;
}

interface Facility {
  id: string;
  name: string;
  capacity: number | null;
  location: string | null;
  department: string | null;
}

interface CartItem {
  key: string;
  inventory_id: string | null;
  facility_id: string | null;
  item_type: 'barang' | 'fasilitas';
  item_name: string;
  quantity: number;
}

interface FormState {
  borrower_name: string;
  borrower_class: string;
  borrower_email: string;
  borrower_phone: string;
  borrow_date: string;
  return_date: string;
  start_time: string;
  end_time: string;
  purpose: string;
  notes: string;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

interface CreateBorrowingResult {
  id: string;
  status: string;
  workflow_template_id: string | null;
  current_step: number | null;
  current_status_label: string | null;
}

const emptyForm: FormState = {
  borrower_name: '',
  borrower_class: '',
  borrower_email: '',
  borrower_phone: '',
  borrow_date: '',
  return_date: '',
  start_time: '',
  end_time: '',
  purpose: '',
  notes: '',
};


// =====================================================
// HELPER
// =====================================================

function extractRows<T>(
  payload: unknown,
  nestedKey?: string
): T[] {
  if (Array.isArray(payload)) {
    return payload as T[];
  }

  if (
    payload &&
    typeof payload === 'object'
  ) {
    const object =
      payload as Record<
        string,
        unknown
      >;

    if (
      Array.isArray(
        object.data
      )
    ) {
      return object.data as T[];
    }

    if (
      nestedKey &&
      object.data &&
      typeof object.data ===
        'object'
    ) {
      const nested =
        object.data as Record<
          string,
          unknown
        >;

      if (
        Array.isArray(
          nested[
            nestedKey
          ]
        )
      ) {
        return nested[
          nestedKey
        ] as T[];
      }
    }

    if (
      nestedKey &&
      Array.isArray(
        object[nestedKey]
      )
    ) {
      return object[
        nestedKey
      ] as T[];
    }
  }

  return [];
}


// =====================================================
// COMPONENT
// =====================================================

export default function BorrowPage() {
  const [
    tab,
    setTab,
  ] =
    useState<
      'barang' |
      'fasilitas'
    >('barang');

  const [
    inventory,
    setInventory,
  ] =
    useState<
      InventoryItem[]
    >([]);

  const [
    facilities,
    setFacilities,
  ] =
    useState<
      Facility[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    search,
    setSearch,
  ] =
    useState('');

  const [
    cart,
    setCart,
  ] =
    useState<
      CartItem[]
    >([]);

  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      emptyForm
    );

  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);

  const [
    success,
    setSuccess,
  ] =
    useState(false);

  const [
    lainnyaMode,
    setLainnyaMode,
  ] =
    useState(false);

  const [
    lainnyaName,
    setLainnyaName,
  ] =
    useState('');


  // =====================================================
  // LOAD INVENTORY + FACILITIES
  // PostgreSQL melalui backend
  // =====================================================

  useEffect(() => {
    let mounted = true;

    const loadData =
      async () => {
        setLoading(true);

        try {
          const [
            inventoryResponse,
            facilitiesResponse,
          ] =
            await Promise.all([
              fetch(
                `${API_BASE_URL}/api/inventory`
              ),

              fetch(
                `${API_BASE_URL}/api/facilities`
              ),
            ]);

          const inventoryJson =
            await inventoryResponse
              .json()
              .catch(
                () => null
              );

          const facilitiesJson =
            await facilitiesResponse
              .json()
              .catch(
                () => null
              );

          if (
            !inventoryResponse.ok
          ) {
            throw new Error(
              'Gagal memuat inventaris'
            );
          }

          if (
            !facilitiesResponse.ok
          ) {
            throw new Error(
              'Gagal memuat fasilitas'
            );
          }

          if (!mounted) {
            return;
          }

          const inventoryRows =
            extractRows<InventoryItem>(
              inventoryJson,
              'inventory'
            );

          const facilityRows =
            extractRows<Facility>(
              facilitiesJson,
              'facilities'
            );

          setInventory(
            inventoryRows
          );

          setFacilities(
            facilityRows
          );
        } catch (error) {
          console.error(
            '[BorrowPage] load error:',
            error
          );

          if (mounted) {
            setInventory([]);
            setFacilities([]);

            showToast(
              error instanceof
                Error
                ? error.message
                : 'Gagal memuat data peminjaman',
              'error'
            );
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


  // =====================================================
  // FORM HELPER
  // =====================================================

  const set = (
    key: keyof FormState,
    value: string
  ) => {
    setForm(
      (previous) => ({
        ...previous,
        [key]:
          value,
      })
    );
  };


  // =====================================================
  // FILTER
  // =====================================================

  const normalizedSearch =
    search
      .trim()
      .toLowerCase();

  const filteredInventory =
    inventory.filter(
      (item) =>
        !normalizedSearch ||
        item.name
          .toLowerCase()
          .includes(
            normalizedSearch
          ) ||
        item.code
          .toLowerCase()
          .includes(
            normalizedSearch
          )
    );

  const filteredFacilities =
    facilities.filter(
      (facility) =>
        !normalizedSearch ||
        facility.name
          .toLowerCase()
          .includes(
            normalizedSearch
          )
    );


  // =====================================================
  // CART
  // =====================================================

  const addToCart = (
    item: CartItem
  ) => {
    setCart(
      (previous) => {
        const existing =
          previous.find(
            (cartItem) =>
              cartItem.key ===
              item.key
          );

        if (existing) {
          return previous.map(
            (cartItem) =>
              cartItem.key ===
              item.key
                ? {
                    ...cartItem,
                    quantity:
                      cartItem.quantity +
                      1,
                  }
                : cartItem
          );
        }

        return [
          ...previous,
          {
            ...item,
            quantity: 1,
          },
        ];
      }
    );
  };


  const removeFromCart = (
    key: string
  ) => {
    setCart(
      (previous) =>
        previous.filter(
          (item) =>
            item.key !== key
        )
    );
  };


  const changeQty = (
    key: string,
    delta: number
  ) => {
    setCart(
      (previous) =>
        previous.map(
          (item) =>
            item.key === key
              ? {
                  ...item,
                  quantity:
                    Math.max(
                      1,
                      item.quantity +
                        delta
                    ),
                }
              : item
        )
    );
  };


  // =====================================================
  // CUSTOM ITEM
  // =====================================================

  const addLainnya =
    () => {
      const cleanName =
        lainnyaName.trim();

      if (!cleanName) {
        showToast(
          'Masukkan nama item terlebih dahulu',
          'error'
        );

        return;
      }

      const key =
        `lainnya-${tab}-${cleanName}`;

      addToCart({
        key,
        inventory_id:
          null,
        facility_id:
          null,
        item_type:
          tab,
        item_name:
          cleanName,
        quantity: 1,
      });

      setLainnyaName(
        ''
      );

      setLainnyaMode(
        false
      );

      showToast(
        'Item "Lainnya" ditambahkan ke keranjang',
        'success'
      );
    };


  // =====================================================
  // VALIDATION
  // =====================================================

  const validate =
    () => {
      if (
        cart.length ===
        0
      ) {
        showToast(
          'Keranjang masih kosong',
          'error'
        );

        return false;
      }

      if (
        !form.borrower_name.trim()
      ) {
        showToast(
          'Nama peminjam wajib diisi',
          'error'
        );

        return false;
      }

      if (
        !form.borrower_class.trim()
      ) {
        showToast(
          'Kelas/Unit peminjam wajib diisi',
          'error'
        );

        return false;
      }

      if (
        !form.borrower_email.trim() ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
          form.borrower_email
        )
      ) {
        showToast(
          'Email valid wajib diisi',
          'error'
        );

        return false;
      }

      if (
        !form.borrow_date
      ) {
        showToast(
          'Tanggal pinjam wajib diisi',
          'error'
        );

        return false;
      }

      if (
        !form.return_date
      ) {
        showToast(
          'Tanggal kembali wajib diisi',
          'error'
        );

        return false;
      }

      if (
        form.return_date <
        form.borrow_date
      ) {
        showToast(
          'Tanggal kembali tidak boleh sebelum tanggal pinjam',
          'error'
        );

        return false;
      }

      if (
        !form.purpose.trim()
      ) {
        showToast(
          'Tujuan peminjaman wajib diisi',
          'error'
        );

        return false;
      }

      return true;
    };


  // =====================================================
  // SUBMIT
  // Seluruh operasi database dilakukan backend
  // =====================================================

  const handleSubmit =
    async (
      event: FormEvent
    ) => {
      event.preventDefault();

      if (!validate()) {
        return;
      }

      setSubmitting(true);

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/borrowings`,
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
                    borrower_name:
                      form.borrower_name.trim(),

                    borrower_class:
                      form.borrower_class.trim(),

                    borrower_email:
                      form.borrower_email.trim(),

                    borrower_phone:
                      form.borrower_phone.trim() ||
                      null,

                    borrow_date:
                      form.borrow_date,

                    return_date:
                      form.return_date,

                    start_time:
                      form.start_time ||
                      null,

                    end_time:
                      form.end_time ||
                      null,

                    purpose:
                      form.purpose.trim(),

                    notes:
                      form.notes.trim() ||
                      null,

                    items:
                      cart.map(
                        (item) => ({
                          inventory_id:
                            item.inventory_id,

                          facility_id:
                            item.facility_id,

                          item_type:
                            item.item_type,

                          item_name:
                            item.item_name,

                          quantity:
                            item.quantity,
                        })
                      ),
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
              | ApiResponse<CreateBorrowingResult>
              | null;

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal membuat pengajuan'
          );
        }

        showToast(
          'Pengajuan peminjaman berhasil dibuat',
          'success'
        );

        setSuccess(
          true
        );
      } catch (error) {
        console.error(
          '[BorrowPage] submit error:',
          error
        );

        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal membuat pengajuan',
          'error'
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };


  // =====================================================
  // RESET
  // =====================================================

  const reset =
    () => {
      setCart([]);
      setForm({
        ...emptyForm,
      });

      setSearch('');
      setLainnyaName('');
      setLainnyaMode(
        false
      );

      setSuccess(
        false
      );
    };


  // =====================================================
  // SUCCESS VIEW
  // =====================================================

  if (success) {
    return (
      <div className="relative min-h-[60vh] overflow-hidden py-12 pb-12">
        <AnimatedBackground />

        <div className="relative mx-auto max-w-lg px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>

            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              Pengajuan Berhasil Dibuat
            </h2>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Pengajuan peminjaman Anda telah tersimpan.
              Notifikasi akan dikirim kepada pihak terkait jika approver tersedia.
            </p>

            <button
              onClick={reset}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Buat Pengajuan Lain
            </button>
          </div>
        </div>
      </div>
    );
  }


  // =====================================================
  // MAIN VIEW
  // =====================================================

  return (
    <div className="relative pb-12">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <AnimatedBackground />

        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <ClipboardList className="h-7 w-7 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-white">
            Pengajuan Peminjaman
          </h1>

          <p className="mt-2 text-sm text-white/80">
            Pilih barang/fasilitas, isi data, lalu kirim pengajuan
          </p>
        </div>
      </div>


      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* LEFT */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">

              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">

                  <button
                    type="button"
                    onClick={() =>
                      setTab(
                        'barang'
                      )
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      tab ===
                      'barang'
                        ? 'bg-white text-brand-700 shadow dark:bg-slate-700 dark:text-brand-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Package className="mr-1.5 inline h-4 w-4" />
                    Barang
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setTab(
                        'fasilitas'
                      )
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                      tab ===
                      'fasilitas'
                        ? 'bg-white text-brand-700 shadow dark:bg-slate-700 dark:text-brand-300'
                        : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    <Building2 className="mr-1.5 inline h-4 w-4" />
                    Fasilitas
                  </button>

                </div>


                <div className="relative sm:w-56">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    value={search}
                    onChange={(
                      event
                    ) =>
                      setSearch(
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Cari..."
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

              </div>


              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[
                    1,
                    2,
                    3,
                    4,
                    5,
                    6,
                  ].map(
                    (item) => (
                      <div
                        key={
                          item
                        }
                        className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                      />
                    )
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">

                  {/* LAINNYA */}
                  {lainnyaMode ? (
                    <div className="flex flex-col justify-center rounded-xl border-2 border-dashed border-brand-400 bg-brand-50 p-3 dark:border-brand-600 dark:bg-brand-900/20">

                      <input
                        value={
                          lainnyaName
                        }
                        onChange={(
                          event
                        ) =>
                          setLainnyaName(
                            event
                              .target
                              .value
                          )
                        }
                        placeholder={`Nama ${tab} lain...`}
                        autoFocus
                        className="mb-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      />

                      <div className="flex gap-1.5">
                        <button
                          type="button"
                          onClick={
                            addLainnya
                          }
                          className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                        >
                          Tambah
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            setLainnyaMode(
                              false
                            );

                            setLainnyaName(
                              ''
                            );
                          }}
                          className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() =>
                        setLainnyaMode(
                          true
                        )
                      }
                      className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-4 text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:hover:border-brand-600 dark:hover:text-brand-400"
                    >
                      <Plus className="h-6 w-6" />

                      <span className="text-xs font-medium">
                        Lainnya...
                      </span>
                    </button>
                  )}


                  {/* INVENTORY */}
                  {tab ===
                  'barang'
                    ? filteredInventory.map(
                        (
                          item
                        ) => (
                          <button
                            type="button"
                            key={
                              item.id
                            }
                            onClick={() =>
                              addToCart(
                                {
                                  key:
                                    `inv-${item.id}`,

                                  inventory_id:
                                    item.id,

                                  facility_id:
                                    null,

                                  item_type:
                                    'barang',

                                  item_name:
                                    item.name,

                                  quantity:
                                    1,
                                }
                              )
                            }
                            disabled={
                              item.available_quantity <=
                              0
                            }
                            className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-400 hover:shadow-md disabled:opacity-50 dark:border-slate-800 dark:bg-slate-800"
                          >
                            <div className="mb-2 flex h-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                              <Package className="h-5 w-5 text-slate-400" />
                            </div>

                            <p className="line-clamp-1 text-xs font-semibold text-slate-900 dark:text-white">
                              {
                                item.name
                              }
                            </p>

                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {
                                item.code
                              }{' '}
                              · Tersedia:{' '}
                              {
                                item.available_quantity
                              }
                            </p>
                          </button>
                        )
                      )
                    : filteredFacilities.map(
                        (
                          facility
                        ) => (
                          <button
                            type="button"
                            key={
                              facility.id
                            }
                            onClick={() =>
                              addToCart(
                                {
                                  key:
                                    `fac-${facility.id}`,

                                  inventory_id:
                                    null,

                                  facility_id:
                                    facility.id,

                                  item_type:
                                    'fasilitas',

                                  item_name:
                                    facility.name,

                                  quantity:
                                    1,
                                }
                              )
                            }
                            className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-800"
                          >
                            <div className="mb-2 flex h-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700">
                              <Building2 className="h-5 w-5 text-slate-400" />
                            </div>

                            <p className="line-clamp-1 text-xs font-semibold text-slate-900 dark:text-white">
                              {
                                facility.name
                              }
                            </p>

                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {facility.location ??
                                '-'}{' '}
                              ·{' '}
                              {facility.capacity ??
                                0}{' '}
                              orang
                            </p>
                          </button>
                        )
                      )}

                </div>
              )}


              {!loading &&
                ((tab ===
                  'barang' &&
                  filteredInventory.length ===
                    0) ||
                  (tab ===
                    'fasilitas' &&
                    filteredFacilities.length ===
                      0)) && (
                  <EmptyState
                    title="Tidak ditemukan"
                    description="Tidak ada item yang cocok dengan pencarian."
                    className="py-6"
                  />
                )}
            </div>
          </div>


          {/* RIGHT */}
          <div className="lg:col-span-1">
            <form
              onSubmit={
                handleSubmit
              }
              className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >

              <div className="mb-4 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-brand-600 dark:text-brand-400" />

                <h3 className="font-bold text-slate-900 dark:text-white">
                  Keranjang (
                  {cart.length})
                </h3>
              </div>


              {cart.length ===
              0 ? (
                <p className="mb-4 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400 dark:bg-slate-800">
                  Keranjang kosong. Pilih item di sebelah kiri.
                </p>
              ) : (
                <div className="mb-4 space-y-2">
                  {cart.map(
                    (
                      item
                    ) => (
                      <div
                        key={
                          item.key
                        }
                        className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-800"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">
                            {
                              item.item_name
                            }
                          </p>

                          <p className="text-[10px] capitalize text-slate-400">
                            {
                              item.item_type
                            }

                            {item.inventory_id ===
                              null &&
                            item.facility_id ===
                              null
                              ? ' · lainnya'
                              : ''}
                          </p>
                        </div>

                        <div className="flex items-center gap-1">

                          <button
                            type="button"
                            onClick={() =>
                              changeQty(
                                item.key,
                                -1
                              )
                            }
                            className="rounded-md bg-white p-1 text-slate-500 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600"
                          >
                            <Minus className="h-3 w-3" />
                          </button>

                          <span className="w-6 text-center text-xs font-semibold text-slate-900 dark:text-white">
                            {
                              item.quantity
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              changeQty(
                                item.key,
                                1
                              )
                            }
                            className="rounded-md bg-white p-1 text-slate-500 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600"
                          >
                            <Plus className="h-3 w-3" />
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              removeFromCart(
                                item.key
                              )
                            }
                            className="rounded-md p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>

                        </div>
                      </div>
                    )
                  )}
                </div>
              )}


              <div className="space-y-3">

                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={
                      form.borrower_name
                    }
                    onChange={(
                      event
                    ) =>
                      set(
                        'borrower_name',
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Nama *"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />

                  <input
                    value={
                      form.borrower_class
                    }
                    onChange={(
                      event
                    ) =>
                      set(
                        'borrower_class',
                        event
                          .target
                          .value
                      )
                    }
                    placeholder="Kelas/Unit *"
                    className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>


                <input
                  type="email"
                  value={
                    form.borrower_email
                  }
                  onChange={(
                    event
                  ) =>
                    set(
                      'borrower_email',
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Email *"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />


                <input
                  value={
                    form.borrower_phone
                  }
                  onChange={(
                    event
                  ) =>
                    set(
                      'borrower_phone',
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="No. HP (opsional)"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />


                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="mb-0.5 block text-[10px] text-slate-500">
                      Tgl Pinjam *
                    </label>

                    <input
                      type="date"
                      value={
                        form.borrow_date
                      }
                      onChange={(
                        event
                      ) =>
                        set(
                          'borrow_date',
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>

                  <div>
                    <label className="mb-0.5 block text-[10px] text-slate-500">
                      Tgl Kembali *
                    </label>

                    <input
                      type="date"
                      value={
                        form.return_date
                      }
                      onChange={(
                        event
                      ) =>
                        set(
                          'return_date',
                          event
                            .target
                            .value
                        )
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />
                  </div>
                </div>


                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="time"
                    value={
                      form.start_time
                    }
                    onChange={(
                      event
                    ) =>
                      set(
                        'start_time',
                        event
                          .target
                          .value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />

                  <input
                    type="time"
                    value={
                      form.end_time
                    }
                    onChange={(
                      event
                    ) =>
                      set(
                        'end_time',
                        event
                          .target
                          .value
                      )
                    }
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>


                <input
                  value={
                    form.purpose
                  }
                  onChange={(
                    event
                  ) =>
                    set(
                      'purpose',
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Tujuan *"
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />


                <textarea
                  value={
                    form.notes
                  }
                  onChange={(
                    event
                  ) =>
                    set(
                      'notes',
                      event
                        .target
                        .value
                    )
                  }
                  placeholder="Catatan (opsional)"
                  rows={2}
                  className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>


              <button
                type="submit"
                disabled={
                  submitting ||
                  cart.length ===
                    0
                }
                className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ClipboardList className="h-4 w-4" />
                )}

                {submitting
                  ? 'Mengirim...'
                  : 'Kirim Pengajuan'}
              </button>

            </form>
          </div>

        </div>
      </div>
    </div>
  );
}