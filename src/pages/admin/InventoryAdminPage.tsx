import { useEffect, useState } from 'react';
import { uploadFileToDrive } from '../../lib/upload';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auditLog';
import { cn } from '../../utils/cn';

import {
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Search,
  Upload,
  Image as ImageIcon,
} from 'lucide-react';

const IMG_BUCKET = 'facility-images';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

const MAX_IMG_SIZE =
  10 * 1024 * 1024;

const ALLOWED_IMG_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
];

const ALLOWED_IMG_EXTS = [
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
];

interface InventoryItem {
  id: string;
  code: string | null;
  name: string | null;
  category_id: string | null;
  quantity: number | null;
  condition: string | null;
  location: string | null;
  image_url: string | null;
  purchase_date: string | null;
  price: number | null;
  description: string | null;
  available_quantity: number | null;

  manager_name: string | null;
  manager_role: string | null;
  manager_id: string | null;

  categories:
    | {
        name: string;
      }
    | null;
}

interface Category {
  id: string;
  name: string;
}

const emptyForm = {
  code: '',
  name: '',
  category_id: '',
  quantity: '',
  condition: 'good',
  location: '',
  purchase_date: '',
  price: '',
  description: '',
  manager_name: '',
  image_url: '',
};

const conditionStyles: Record<string, string> = {
  good:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',

  fair:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',

  poor:
    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const conditionLabels: Record<string, string> = {
  good: 'Baik',
  fair: 'Cukup',
  poor: 'Rusak',
};

export default function InventoryAdminPage() {
  const {
    hasPermission,
    adminProfile,
    userRoleNames,
    session,
  } = useAuth();

  const canCreate =
    hasPermission(
      'inventory',
      'create'
    );

  const canUpdate =
    hasPermission(
      'inventory',
      'update'
    );

  const canDelete =
    hasPermission(
      'inventory',
      'delete'
    );

  const [
    items,
    setItems,
  ] = useState<InventoryItem[]>([]);

  const [
    categories,
    setCategories,
  ] = useState<Category[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    modalOpen,
    setModalOpen,
  ] = useState(false);

  const [
    editingId,
    setEditingId,
  ] = useState<string | null>(
    null
  );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    form,
    setForm,
  ] = useState({
    ...emptyForm,
  });

  const [
    imgFile,
    setImgFile,
  ] = useState<File | null>(
    null
  );

  const [
    imgPreview,
    setImgPreview,
  ] = useState('');

  const [
    previewImg,
    setPreviewImg,
  ] = useState<string | null>(
    null
  );

  // =========================================================
  // AUTH HEADER
  // =========================================================

  const getAuthHeaders =
    () => {
      const token =
        session?.access_token;

      if (!token) {
        throw new Error(
          'Session login tidak ditemukan'
        );
      }

      return {
        Authorization:
          `Bearer ${token}`,
      };
    };


  // =========================================================
  // LOAD INVENTORY
  // =========================================================

  const fetchItems =
    async () => {
      setLoading(true);

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/admin/inventory`,
            {
              headers:
                getAuthHeaders(),
            }
          );

        const result =
          await response
            .json()
            .catch(
              () => null
            );

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              `HTTP ${response.status}`
          );
        }

        setItems(
          Array.isArray(
            result.data
          )
            ? result.data
            : []
        );
      } catch (error) {
        console.error(
          '[InventoryAdminPage] Fetch error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal memuat inventaris',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };


  // =========================================================
  // LOAD CATEGORY
  // =========================================================

  const fetchCategories =
    async () => {
      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/categories`
          );

        const result =
          await response
            .json()
            .catch(
              () => null
            );

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              `HTTP ${response.status}`
          );
        }

        setCategories(
          Array.isArray(
            result.data
          )
            ? result.data
            : []
        );
      } catch (error) {
        console.error(
          '[InventoryAdminPage] Category fetch error:',
          error
        );
      }
    };


  useEffect(() => {
    if (
      session?.access_token
    ) {
      void fetchItems();
      void fetchCategories();
    } else {
      setLoading(false);
    }
  }, [
    session?.access_token,
  ]);


  // =========================================================
  // FILTER
  // =========================================================

  const filtered =
    items.filter(
      (
        item
      ) => {
        const q =
          search
            .toLowerCase()
            .trim();

        if (
          !q
        ) {
          return true;
        }

        return (
          (
            item.name ??
            ''
          )
            .toLowerCase()
            .includes(
              q
            ) ||
          (
            item.code ??
            ''
          )
            .toLowerCase()
            .includes(
              q
            ) ||
          (
            item.location ??
            ''
          )
            .toLowerCase()
            .includes(
              q
            ) ||
          (
            item.manager_name ??
            ''
          )
            .toLowerCase()
            .includes(
              q
            )
        );
      }
    );

  // =========================================================
  // CREATE
  // =========================================================

  const openCreate =
    () => {
      setEditingId(
        null
      );

      setForm({
        ...emptyForm,
      });

      setImgFile(
        null
      );

      setImgPreview(
        ''
      );

      setModalOpen(
        true
      );
    };

  // =========================================================
  // EDIT
  // =========================================================

  const openEdit = (
    item:
      InventoryItem
  ) => {
    setEditingId(
      item.id
    );

    setForm({
      code:
        item.code ??
        '',

      name:
        item.name ??
        '',

      category_id:
        item.category_id ??
        '',

      quantity:
        String(
          item.quantity ??
            ''
        ),

      condition:
        item.condition ??
        'good',

      location:
        item.location ??
        '',

      purchase_date:
        item.purchase_date ??
        '',

      price:
        String(
          item.price ??
            ''
        ),

      description:
        item.description ??
        '',

      manager_name:
        item.manager_name ??
        '',

      image_url:
        item.image_url ??
        '',
    });

    setImgFile(
      null
    );

    setImgPreview(
      item.image_url ??
        ''
    );

    setModalOpen(
      true
    );
  };

  // =========================================================
  // FORM CHANGE
  // =========================================================

  const handleChange = (
    e:
      React.ChangeEvent<
        | HTMLInputElement
        | HTMLSelectElement
        | HTMLTextAreaElement
      >
  ) => {
    const {
      name,
      value,
    } = e.target;

    setForm(
      (
        prev
      ) => ({
        ...prev,

        [name]:
          value,
      })
    );
  };

  // =========================================================
  // IMAGE
  // =========================================================

  const handleImgFile = (
    file:
      | File
      | null
  ) => {
    if (
      !file
    ) {
      return;
    }

    const ext =
      '.' +
      (
        file.name
          .split(
            '.'
          )
          .pop() ??
        ''
      ).toLowerCase();

    if (
      !ALLOWED_IMG_EXTS.includes(
        ext
      ) ||
      !ALLOWED_IMG_TYPES.includes(
        file.type
      )
    ) {
      showToast(
        'Format foto harus JPG, JPEG, PNG, atau WEBP',
        'error'
      );

      return;
    }

    if (
      file.size >
      MAX_IMG_SIZE
    ) {
      showToast(
        'Ukuran foto maksimal 10 MB',
        'error'
      );

      return;
    }

    setImgFile(
      file
    );

    setImgPreview(
      URL.createObjectURL(
        file
      )
    );
  };

  // =========================================================
  // SUBMIT
  // =========================================================

  const handleSubmit =
    async (
      e:
        React.FormEvent
    ) => {
      e.preventDefault();

      if (
        !form.name
          .trim()
      ) {
        showToast(
          'Nama barang wajib diisi',
          'warning'
        );

        return;
      }

      if (
        !imgFile &&
        !form.image_url
          .trim()
      ) {
        showToast(
          'Wajib upload foto atau isi URL gambar',
          'warning'
        );

        return;
      }

      setSubmitting(
        true
      );

      let imageUrl:
        | string
        | null =
        form.image_url
          .trim() ||
        null;

      try {
        // =====================================================
        // UPLOAD FOTO KE GOOGLE DRIVE
        // =====================================================

        if (imgFile) {
          const uploaded =
            await uploadFileToDrive(
              imgFile,
              `inventory-${Date.now()}-${imgFile.name}`,
              'inventory'
            );

          if (!uploaded?.url) {
            showToast(
              'Gagal upload foto ke Google Drive',
              'error'
            );
            return;
          }

          imageUrl = uploaded.url;
        }

        // =====================================================
        // QUANTITY
        // =====================================================

        const quantity =
          form.quantity
            ? parseInt(
                form.quantity,
                10
              )
            : 0;

        // =====================================================
        // PAYLOAD
        // =====================================================

        const payload = {
          code:
            form.code
              .trim() ||
            null,

          name:
            form.name
              .trim(),

          category_id:
            form.category_id ||
            null,

          quantity,

          available_quantity:
            quantity,

          condition:
            form.condition,

          location:
            form.location
              .trim() ||
            null,

          purchase_date:
            form.purchase_date ||
            null,

          price:
            form.price
              ? parseFloat(
                  form.price
                )
              : null,

          description:
            form.description
              .trim() ||
            null,

          manager_name:
            form.manager_name
              .trim() ||
            null,

          manager_id:
            null,

          manager_role:
            null,

          image_url:
            imageUrl,
        };

        const isEditing =
          Boolean(
            editingId
          );

        const endpoint =
          isEditing
            ? `${API_BASE_URL}/api/admin/inventory/${encodeURIComponent(
                editingId!
              )}`
            : `${API_BASE_URL}/api/admin/inventory`;

        const response =
          await fetch(
            endpoint,
            {
              method:
                isEditing
                  ? 'PATCH'
                  : 'POST',

              headers: {
                ...getAuthHeaders(),

                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

        const result =
          await response
            .json()
            .catch(
              () => null
            );

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              (
                isEditing
                  ? 'Gagal memperbarui inventaris'
                  : 'Gagal menambahkan inventaris'
              )
          );
        }

        if (
          isEditing
        ) {
          showToast(
            'Inventaris berhasil diperbarui',
            'success'
          );

          await logActivity({
            adminUserId:
              adminProfile?.id,

            adminName:
              adminProfile?.name,

            adminEmail:
              adminProfile?.email,

            adminRole:
              userRoleNames.join(
                ', '
              ) ||
              adminProfile?.role,

            activityType:
              'UPDATE',

            module:
              'Inventory',

            description:
              `${adminProfile?.name ?? 'Admin'} memperbarui inventaris ${form.name}`,
          });
        } else {
          showToast(
            'Inventaris berhasil ditambahkan',
            'success'
          );

          await logActivity({
            adminUserId:
              adminProfile?.id,

            adminName:
              adminProfile?.name,

            adminEmail:
              adminProfile?.email,

            adminRole:
              userRoleNames.join(
                ', '
              ) ||
              adminProfile?.role,

            activityType:
              'CREATE',

            module:
              'Inventory',

            description:
              `${adminProfile?.name ?? 'Admin'} menambah inventaris ${form.name}`,
          });
        }

        setModalOpen(
          false
        );

        setImgFile(
          null
        );

        setImgPreview(
          ''
        );

        await fetchItems();
      } catch (
        error
      ) {
        console.error(
          '[InventoryAdminPage] Save error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal menyimpan inventaris',
          'error'
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };


  // =========================================================
  // DELETE
  // =========================================================

  const handleDelete =
    async (
      id:
        string
    ) => {
      if (
        !window.confirm(
          'Apakah Anda yakin ingin menghapus barang ini?'
        )
      ) {
        return;
      }

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/admin/inventory/${encodeURIComponent(
              id
            )}`,
            {
              method:
                'DELETE',

              headers:
                getAuthHeaders(),
            }
          );

        const result =
          await response
            .json()
            .catch(
              () => null
            );

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal menghapus inventaris'
          );
        }

        showToast(
          'Barang berhasil dihapus',
          'success'
        );

        await logActivity({
          adminUserId:
            adminProfile?.id,

          adminName:
            adminProfile?.name,

          adminEmail:
            adminProfile?.email,

          adminRole:
            userRoleNames.join(
              ', '
            ) ||
            adminProfile?.role,

          activityType:
            'DELETE',

          module:
            'Inventory',

          description:
            `${adminProfile?.name ?? 'Admin'} menghapus inventaris ${id}`,
        });

        await fetchItems();
      } catch (
        error
      ) {
        console.error(
          '[InventoryAdminPage] Delete error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal menghapus',
          'error'
        );
      }
    };


  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="pb-6">

      {/* =====================================================
          HEADER
          ===================================================== */}

      <div className="mb-6 flex items-center justify-between">

        <div>

          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">

            <Package className="h-6 w-6" />

            Kelola Inventaris

          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kelola barang inventaris sekolah beserta penanggung jawabnya.
          </p>

        </div>

        {canCreate && (

          <button
            type="button"
            onClick={
              openCreate
            }
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >

            <Plus className="h-4 w-4" />

            Tambah

          </button>

        )}

      </div>

      {/* =====================================================
          SEARCH
          ===================================================== */}

      <div className="relative mb-4">

        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

        <input
          value={
            search
          }
          onChange={(
            e
          ) =>
            setSearch(
              e.target.value
            )
          }
          placeholder="Cari nama, kode, lokasi, atau PJ inventaris..."
          className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />

      </div>

      {/* =====================================================
          TABLE
          ===================================================== */}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

        {loading ? (

          <div className="flex items-center justify-center py-12">

            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />

          </div>

        ) : filtered.length ===
          0 ? (

          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">
            Tidak ada data.
          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">

                <tr>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Foto
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Kode
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Nama
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Kategori
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Jumlah
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Kondisi
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Lokasi
                  </th>

                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    PJ Inventaris
                  </th>

                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">
                    Aksi
                  </th>

                </tr>

              </thead>

              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">

                {filtered.map(
                  (
                    item
                  ) => (

                    <tr
                      key={
                        item.id
                      }
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >

                      {/* FOTO */}

                      <td className="px-4 py-3">

                        {item.image_url ? (

                          <button
                            type="button"
                            onClick={() =>
                              setPreviewImg(
                                item.image_url!
                              )
                            }
                            className="block"
                          >

                            <img
                              src={
                                item.image_url
                              }
                              alt={
                                item.name ??
                                ''
                              }
                              className="h-10 w-10 rounded-lg bg-slate-100 object-contain p-0.5 dark:bg-slate-800"
                            />

                          </button>

                        ) : (

                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">

                            <ImageIcon className="h-4 w-4 text-slate-400" />

                          </div>

                        )}

                      </td>

                      {/* KODE */}

                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {
                          item.code ??
                          '-'
                        }
                      </td>

                      {/* NAMA */}

                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                        {
                          item.name ??
                          '-'
                        }
                      </td>

                      {/* KATEGORI */}

                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {
                          item.categories
                            ?.name ??
                          '-'
                        }
                      </td>

                      {/* JUMLAH */}

                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {
                          item.quantity ??
                          0
                        }
                      </td>

                      {/* KONDISI */}

                      <td className="px-4 py-3">

                        <span
                          className={cn(
                            'rounded-full px-2.5 py-0.5 text-xs font-medium',

                            conditionStyles[
                              item.condition ??
                                'good'
                            ] ??
                              conditionStyles.good
                          )}
                        >

                          {
                            conditionLabels[
                              item.condition ??
                                'good'
                            ] ??
                            item.condition
                          }

                        </span>

                      </td>

                      {/* LOKASI */}

                      <td className="px-4 py-3 text-slate-600 dark:text-slate-400">
                        {
                          item.location ??
                          '-'
                        }
                      </td>

                      {/* PJ INVENTARIS */}

                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">

                        {
                          item.manager_name ??
                          '-'
                        }

                      </td>

                      {/* AKSI */}

                      <td className="px-4 py-3">

                        <div className="flex justify-end gap-1">

                          {canUpdate && (

                            <button
                              type="button"
                              onClick={() =>
                                openEdit(
                                  item
                                )
                              }
                              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                              title="Edit"
                            >

                              <Pencil className="h-4 w-4" />

                            </button>

                          )}

                          {canDelete && (

                            <button
                              type="button"
                              onClick={() =>
                                void handleDelete(
                                  item.id
                                )
                              }
                              className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                              title="Hapus"
                            >

                              <Trash2 className="h-4 w-4" />

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

      {/* =====================================================
          MODAL CREATE / EDIT
          ===================================================== */}

      {modalOpen && (

        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">

            {/* HEADER */}

            <div className="mb-4 flex items-center justify-between">

              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">

                {
                  editingId
                    ? 'Edit Barang'
                    : 'Tambah Barang'
                }

              </h2>

              <button
                type="button"
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

            <form
              onSubmit={
                handleSubmit
              }
              className="grid grid-cols-1 gap-4 md:grid-cols-2"
            >

              {/* KODE */}

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kode
                </label>

                <input
                  name="code"
                  value={
                    form.code
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>

              {/* NAMA */}

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama *
                </label>

                <input
                  name="name"
                  value={
                    form.name
                  }
                  onChange={
                    handleChange
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>

              {/* KATEGORI */}

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kategori
                </label>

                <select
                  name="category_id"
                  value={
                    form.category_id
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >

                  <option value="">
                    Pilih kategori
                  </option>

                  {categories.map(
                    (
                      category
                    ) => (

                      <option
                        key={
                          category.id
                        }
                        value={
                          category.id
                        }
                      >

                        {
                          category.name
                        }

                      </option>

                    )
                  )}

                </select>

              </div>

              {/* JUMLAH */}

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Jumlah
                </label>

                <input
                  name="quantity"
                  type="number"
                  min="0"
                  value={
                    form.quantity
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>

              {/* KONDISI */}

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kondisi
                </label>

                <select
                  name="condition"
                  value={
                    form.condition
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >

                  <option value="good">
                    Baik
                  </option>

                  <option value="fair">
                    Cukup
                  </option>

                  <option value="poor">
                    Rusak
                  </option>

                </select>

              </div>

              {/* LOKASI */}

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Lokasi
                </label>

                <input
                  name="location"
                  value={
                    form.location
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>

              {/* TANGGAL BELI */}

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tanggal Beli
                </label>

                <input
                  name="purchase_date"
                  type="date"
                  value={
                    form.purchase_date
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>

              {/* HARGA */}

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Harga
                </label>

                <input
                  name="price"
                  type="number"
                  min="0"
                  value={
                    form.price
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>

              {/* =================================================
                  PJ INVENTARIS
                  ================================================= */}

              <div className="md:col-span-2">

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Penanggung Jawab Inventaris
                </label>

                <input
                  name="manager_name"
                  value={
                    form.manager_name
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Contoh: Pak Asep"
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                <p className="mt-1 text-xs text-slate-400">
                  Ketik nama penanggung jawab inventaris secara langsung.
                </p>

              </div>

              {/* DESKRIPSI */}

              <div className="md:col-span-2">

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Deskripsi
                </label>

                <textarea
                  name="description"
                  value={
                    form.description
                  }
                  onChange={
                    handleChange
                  }
                  rows={
                    3
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>

              {/* =================================================
                  FOTO
                  ================================================= */}

              <div className="md:col-span-2">

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Foto Barang *
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">

                  <div className="flex-1">

                    {imgPreview ? (

                      <div className="relative inline-block">

                        <img
                          src={
                            imgPreview
                          }
                          alt="Preview"
                          className="h-28 w-28 rounded-xl border border-slate-200 object-contain dark:border-slate-700"
                        />

                        <button
                          type="button"
                          onClick={() => {
                            setImgFile(
                              null
                            );

                            setImgPreview(
                              form.image_url ||
                                ''
                            );
                          }}
                          className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"
                        >

                          <X className="h-3.5 w-3.5" />

                        </button>

                      </div>

                    ) : (

                      <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-center transition hover:border-brand-400 dark:border-slate-700">

                        <Upload className="h-6 w-6 text-slate-400" />

                        <span className="mt-1 text-xs text-slate-400">
                          Upload
                        </span>

                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp"
                          className="hidden"
                          onChange={(
                            e
                          ) =>
                            handleImgFile(
                              e.target
                                .files?.[
                                  0
                                ] ??
                                null
                            )
                          }
                        />

                      </label>

                    )}

                    <p className="mt-1 text-xs text-slate-400">
                      JPG, JPEG, PNG, WEBP Ã‚Â· Maks 10 MB
                    </p>

                  </div>

                  <div className="flex-1">

                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Atau isi URL gambar
                    </label>

                    <input
                      name="image_url"
                      value={
                        form.image_url
                      }
                      onChange={(
                        e
                      ) => {
                        handleChange(
                          e
                        );

                        if (
                          !imgFile
                        ) {
                          setImgPreview(
                            e.target.value
                          );
                        }
                      }}
                      placeholder="https://..."
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />

                    <p className="mt-1 text-xs text-slate-400">
                      Jika URL diisi, upload file tidak wajib.
                    </p>

                  </div>

                </div>

              </div>

              {/* BUTTON */}

              <div className="flex justify-end gap-3 md:col-span-2">

                <button
                  type="button"
                  onClick={() =>
                    setModalOpen(
                      false
                    )
                  }
                  disabled={
                    submitting
                  }
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
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

                  {submitting && (

                    <Loader2 className="h-4 w-4 animate-spin" />

                  )}

                  {
                    submitting
                      ? 'Menyimpan...'
                      : 'Simpan'
                  }

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

      {/* =====================================================
          FULLSCREEN IMAGE
          ===================================================== */}

      {previewImg && (

        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          onClick={() =>
            setPreviewImg(
              null
            )
          }
        >

          <button
            type="button"
            onClick={() =>
              setPreviewImg(
                null
              )
            }
            className="absolute right-5 top-5 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
          >

            <X className="h-6 w-6" />

          </button>

          <img
            src={
              previewImg
            }
            alt="Preview inventaris"
            className="max-h-[90vh] max-w-[95vw] object-contain"
            onClick={(
              e
            ) =>
              e.stopPropagation()
            }
          />

        </div>

      )}

    </div>
  );
}