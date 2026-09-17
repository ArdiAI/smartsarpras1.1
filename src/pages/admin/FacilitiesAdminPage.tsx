import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { uploadFileToDrive } from '../../lib/upload';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';

import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  MapPin,
  Users,
  Upload,
} from 'lucide-react';

const IMG_BUCKET = 'facility-images';

const MAX_IMG_SIZE = 10 * 1024 * 1024;

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

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

interface Facility {
  id: string;
  name: string | null;
  description: string | null;
  location: string | null;
  capacity: number | null;
  image_url: string | null;
  facility_type: string | null;
  category: string | null;
  department: string | null;
  workflow_template_id: string | null;
  status: string | null;
  manager_name: string | null;
  manager_role: string | null;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

interface FacilityPayload {
  name: string;
  description: string | null;
  location: string | null;
  capacity: number | null;
  image_url: string | null;
  facility_type: string | null;
  category: string | null;
  department: string | null;
  status: string;
  manager_name: string | null;
  manager_role: string | null;
}

const emptyForm = {
  name: '',
  description: '',
  location: '',
  capacity: '',
  facility_type: '',
  category: '',
  department: '',
  status: 'available',
  manager_name: '',
  manager_role: '',
  image_url: '',
};

const statusStyles: Record<string, string> = {
  available:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',

  in_use:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',

  maintenance:
    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',

  unavailable:
    'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
};

const statusLabels: Record<string, string> = {
  available: 'Tersedia',
  in_use: 'Digunakan',
  maintenance: 'Pemeliharaan',
  unavailable: 'Tidak Tersedia',
};

async function getAccessToken() {
  const {
    data,
    error,
  } = await supabase.auth.getSession();

  if (error) {
    throw new Error(error.message);
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
      `API HTTP ${response.status}`
    );
  }

  if (
    !response.ok ||
    !result.ok
  ) {
    throw new Error(
      result.message ??
        `API HTTP ${response.status}`
    );
  }

  return result;
}

export default function FacilitiesAdminPage() {
  const { hasPermission } =
    useAuth();

  const canCreate =
    hasPermission(
      'facilities',
      'create'
    );

  const canUpdate =
    hasPermission(
      'facilities',
      'update'
    );

  const canDelete =
    hasPermission(
      'facilities',
      'delete'
    );

  const [
    facilities,
    setFacilities,
  ] = useState<Facility[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(true);

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

  // =====================================================
  // LOAD FACILITIES DARI POSTGRESQL API
  // =====================================================

  const fetchFacilities =
    async () => {
      setLoading(true);

      try {
        const result =
          await adminApi<
            Facility[]
          >(
            '/api/admin/facilities'
          );

        setFacilities(
          result.data ?? []
        );
      } catch (error) {
        console.error(
          '[FacilitiesAdminPage] GET error:',
          error
        );

        setFacilities([]);

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal memuat fasilitas',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void fetchFacilities();
  }, []);

  // =====================================================
  // OPEN CREATE
  // =====================================================

  const openCreate = () => {
    setEditingId(null);

    setForm({
      ...emptyForm,
    });

    setImgFile(null);
    setImgPreview('');
    setModalOpen(true);
  };

  // =====================================================
  // OPEN EDIT
  // =====================================================

  const openEdit = (
    f: Facility
  ) => {
    setEditingId(f.id);

    setForm({
      name:
        f.name ?? '',

      description:
        f.description ?? '',

      location:
        f.location ?? '',

      capacity:
        String(
          f.capacity ?? ''
        ),

      facility_type:
        f.facility_type ?? '',

      category:
        f.category ?? '',

      department:
        f.department ?? '',

      status:
        f.status ??
        'available',

      manager_name:
        f.manager_name ?? '',

      manager_role:
        f.manager_role ?? '',

      image_url:
        f.image_url ?? '',
    });

    setImgFile(null);

    setImgPreview(
      f.image_url ?? ''
    );

    setModalOpen(true);
  };

  // =====================================================
  // FORM CHANGE
  // =====================================================

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

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // =====================================================
  // IMAGE
  // =====================================================

  const handleImgFile = (
    f: File | null
  ) => {
    if (!f) return;

    const ext =
      '.' +
      (
        f.name
          .split('.')
          .pop() ?? ''
      ).toLowerCase();

    if (
      !ALLOWED_IMG_EXTS.includes(
        ext
      ) ||
      !ALLOWED_IMG_TYPES.includes(
        f.type
      )
    ) {
      showToast(
        'Format foto harus JPG, JPEG, PNG, atau WEBP',
        'error'
      );

      return;
    }

    if (
      f.size >
      MAX_IMG_SIZE
    ) {
      showToast(
        'Ukuran foto maksimal 10 MB',
        'error'
      );

      return;
    }

    setImgFile(f);

    setImgPreview(
      URL.createObjectURL(f)
    );
  };

  // =====================================================
  // CREATE / UPDATE
  // =====================================================

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    if (
      !form.name.trim()
    ) {
      showToast(
        'Nama fasilitas wajib diisi',
        'warning'
      );

      return;
    }

    if (
      !imgFile &&
      !form.image_url.trim()
    ) {
      showToast(
        'Wajib upload foto atau isi URL gambar',
        'warning'
      );

      return;
    }

    setSubmitting(true);

    let imageUrl =
      form.image_url.trim() ||
      null;

    try {
      // ===============================================
      // UPLOAD FOTO KE GOOGLE DRIVE
      // ===============================================

      if (imgFile) {
        const uploaded =
          await uploadFileToDrive(
            imgFile,
            `fasilitas-${Date.now()}-${imgFile.name}`,
            'fasilitas'
          );

        if (!uploaded?.url) {
          throw new Error(
            'Gagal upload foto ke Google Drive'
          );
        }

        imageUrl = uploaded.url;

        showToast(
          'Foto berhasil diupload',
          'success'
        );
      }

      const capacityValue =
        form.capacity
          ? Number.parseInt(
              form.capacity,
              10
            )
          : null;

      const payload: FacilityPayload =
        {
          name:
            form.name.trim(),

          description:
            form.description.trim() ||
            null,

          location:
            form.location.trim() ||
            null,

          capacity:
            capacityValue,

          facility_type:
            form.facility_type.trim() ||
            null,

          category:
            form.category.trim() ||
            null,

          department:
            form.department.trim() ||
            null,

          status:
            form.status,

          manager_name:
            form.manager_name.trim() ||
            null,

          manager_role:
            form.manager_role.trim() ||
            null,

          image_url:
            imageUrl,
        };

      if (editingId) {
        await adminApi<Facility>(
          `/api/admin/facilities/${encodeURIComponent(
            editingId
          )}`,
          {
            method: 'PATCH',

            body:
              JSON.stringify(
                payload
              ),
          }
        );

        showToast(
          'Fasilitas berhasil diperbarui',
          'success'
        );
      } else {
        await adminApi<Facility>(
          '/api/admin/facilities',
          {
            method: 'POST',

            body:
              JSON.stringify(
                payload
              ),
          }
        );

        showToast(
          'Fasilitas berhasil ditambahkan',
          'success'
        );
      }

      setModalOpen(false);

      setImgFile(null);

      setImgPreview('');

      await fetchFacilities();
    } catch (error) {
      console.error(
        '[FacilitiesAdminPage] SAVE error:',
        error
      );

      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan fasilitas',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete =
    async (
      id: string
    ) => {
      if (
        !window.confirm(
          'Apakah Anda yakin ingin menghapus fasilitas ini?'
        )
      ) {
        return;
      }

      try {
        await adminApi<null>(
          `/api/admin/facilities/${encodeURIComponent(
            id
          )}`,
          {
            method: 'DELETE',
          }
        );

        showToast(
          'Fasilitas berhasil dihapus',
          'success'
        );

        await fetchFacilities();
      } catch (error) {
        console.error(
          '[FacilitiesAdminPage] DELETE error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal menghapus fasilitas',
          'error'
        );
      }
    };

  return (
    <div className="pb-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Building2 className="h-6 w-6" />
            Kelola Fasilitas
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            CRUD fasilitas sarana prasarana.
          </p>
        </div>

        {canCreate && (
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />
            Tambah
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : facilities.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Belum ada fasilitas.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {facilities.map(
            (f) => (
              <div
                key={f.id}
                className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                {f.image_url ? (
                  <button
                    type="button"
                    onClick={() =>
                      setPreviewImg(
                        f.image_url
                      )
                    }
                    className="block h-40 w-full"
                  >
                    <img
                      src={
                        f.image_url
                      }
                      alt={
                        f.name ?? ''
                      }
                      className="h-40 w-full object-cover"
                    />
                  </button>
                ) : (
                  <div className="flex h-40 items-center justify-center bg-slate-100 dark:bg-slate-800">
                    <Building2 className="h-10 w-10 text-slate-400" />
                  </div>
                )}

                <div className="p-5">
                  <div className="mb-2 flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">
                      {f.name ??
                        'Tanpa Nama'}
                    </h3>

                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium',

                        statusStyles[
                          f.status ??
                            'available'
                        ] ??
                          statusStyles.available
                      )}
                    >
                      {statusLabels[
                        f.status ??
                          'available'
                      ] ??
                        f.status}
                    </span>
                  </div>

                  {f.description && (
                    <p className="mb-3 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                      {
                        f.description
                      }
                    </p>
                  )}

                  <div className="space-y-1 text-xs text-slate-600 dark:text-slate-400">
                    <p className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5" />

                      {f.location ??
                        '-'}
                    </p>

                    <p className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />

                      Kapasitas:{' '}
                      {f.capacity ??
                        '-'}
                    </p>

                    {f.facility_type && (
                      <p>
                        Tipe:{' '}
                        {
                          f.facility_type
                        }
                      </p>
                    )}

                    {f.department && (
                      <p>
                        Departemen:{' '}
                        {
                          f.department
                        }
                      </p>
                    )}

                    {f.manager_name && (
                      <p>
                        PJ:{' '}
                        {
                          f.manager_name
                        }
                      </p>
                    )}
                  </div>

                  <div className="mt-4 flex gap-2">
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() =>
                          openEdit(f)
                        }
                        className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Pencil className="mr-1 inline h-4 w-4" />
                        Edit
                      </button>
                    )}

                    {canDelete && (
                      <button
                        type="button"
                        onClick={() =>
                          handleDelete(
                            f.id
                          )
                        }
                        className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          )}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingId
                  ? 'Edit Fasilitas'
                  : 'Tambah Fasilitas'}
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
              <div className="md:col-span-2">
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
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

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

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kapasitas
                </label>

                <input
                  name="capacity"
                  type="number"
                  min="0"
                  value={
                    form.capacity
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Tipe Fasilitas
                </label>

                <input
                  name="facility_type"
                  value={
                    form.facility_type
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Kategori
                </label>

                <input
                  name="category"
                  value={
                    form.category
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Departemen
                </label>

                <input
                  name="department"
                  value={
                    form.department
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Status
                </label>

                <select
                  name="status"
                  value={
                    form.status
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="available">
                    Tersedia
                  </option>

                  <option value="in_use">
                    Digunakan
                  </option>

                  <option value="maintenance">
                    Pemeliharaan
                  </option>

                  <option value="unavailable">
                    Tidak Tersedia
                  </option>
                </select>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama PJ
                </label>

                <input
                  name="manager_name"
                  value={
                    form.manager_name
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Peran PJ
                </label>

                <input
                  name="manager_role"
                  value={
                    form.manager_role
                  }
                  onChange={
                    handleChange
                  }
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Foto Fasilitas *
                </label>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    {imgPreview ? (
                      <div className="relative inline-block">
                        <img
                          src={
                            imgPreview
                          }
                          alt="preview"
                          className="h-28 w-28 rounded-xl border border-slate-200 object-cover dark:border-slate-700"
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
                              e
                                .target
                                .files?.[0] ??
                                null
                            )
                          }
                        />
                      </label>
                    )}

                    <p className="mt-1 text-xs text-slate-400">
                      JPG, JPEG,
                      PNG, WEBP ·
                      Maks 10 MB
                    </p>
                  </div>

                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">
                      Atau isi URL
                      gambar
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
                            e
                              .target
                              .value
                          );
                        }
                      }}
                      placeholder="https://..."
                      className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    />

                    <p className="mt-1 text-xs text-slate-400">
                      Jika URL
                      diisi,
                      upload file
                      tidak wajib.
                    </p>
                  </div>
                </div>
              </div>

              <div className="md:col-span-2 flex justify-end gap-3">
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
                  ) : null}

                  {submitting
                    ? 'Menyimpan...'
                    : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {previewImg && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() =>
            setPreviewImg(
              null
            )
          }
        >
          <button
            type="button"
            className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white"
            onClick={() =>
              setPreviewImg(
                null
              )
            }
          >
            <X className="h-6 w-6" />
          </button>

          <img
            src={previewImg}
            alt="preview"
            className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain"
            onClick={(e) =>
              e.stopPropagation()
            }
          />
        </div>
      )}
    </div>
  );
}