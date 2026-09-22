import RemoteImage from '../../components/RemoteImage';
import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

import { getSessionToken } from '../../lib/appSession';
import { uploadFileToDrive } from '../../lib/upload';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auditLog';
import { cn } from '../../utils/cn';

import {
  Megaphone,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  ImagePlus,
} from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

interface Announcement {
  id: string;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  author: string | null;
  image_url: string | null;
}

interface AnnouncementForm {
  title: string;
  description: string;
  priority: string;
  status: string;
  author: string;
  imageUrl: string;
}

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

const emptyForm: AnnouncementForm = {
  title: '',
  description: '',
  priority: 'normal',
  status: 'draft',
  author: '',
  imageUrl: '',
};

const priorityStyles: Record<string, string> = {
  low:
    'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',

  normal:
    'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',

  high:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',

  urgent:
    'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const priorityLabels: Record<string, string> = {
  low: 'Rendah',
  normal: 'Normal',
  high: 'Tinggi',
  urgent: 'Mendesak',
};

const statusStyles: Record<string, string> = {
  draft:
    'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',

  published:
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',

  archived:
    'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const statusLabels: Record<string, string> = {
  draft: 'Draf',
  published: 'Dipublikasi',
  archived: 'Diarsipkan',
};

async function getAccessToken() {
  const token =
    getSessionToken();

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
  const token = await getAccessToken();

  const headers = new Headers(options.headers);

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

  const result =
    (await response
      .json()
      .catch(() => null)) as
      | ApiResponse<T>
      | null;

  if (
    !response.ok ||
    !result?.ok
  ) {
    throw new Error(
      result?.message ??
        `HTTP ${response.status}`
    );
  }

  return result;
}

export default function AnnouncementsAdminPage() {
  const {
    hasPermission,
    adminProfile,
    userRoleNames,
  } = useAuth();

  const canCreate =
    hasPermission(
      'announcements',
      'create'
    );

  const canUpdate =
    hasPermission(
      'announcements',
      'update'
    );

  const canDelete =
    hasPermission(
      'announcements',
      'delete'
    );

  const [
    announcements,
    setAnnouncements,
  ] = useState<Announcement[]>([]);

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
  ] =
    useState<string | null>(
      null
    );

  const [
    submitting,
    setSubmitting,
  ] = useState(false);

  const [
    form,
    setForm,
  ] =
    useState<AnnouncementForm>({
      ...emptyForm,
    });

  const [
    imageFile,
    setImageFile,
  ] =
    useState<File | null>(
      null
    );

  const [
    uploadingImage,
    setUploadingImage,
  ] = useState(false);

  // =====================================================
  // LOAD ANNOUNCEMENTS
  // =====================================================

  const fetchAnnouncements =
    async () => {
      setLoading(true);

      try {
        const result =
          await adminApi<
            Announcement[]
          >(
            '/api/admin/announcements'
          );

        setAnnouncements(
          result.data ?? []
        );
      } catch (error) {
        console.error(
          '[AnnouncementsAdminPage] GET error:',
          error
        );

        setAnnouncements([]);

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal memuat pengumuman',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    void fetchAnnouncements();
  }, []);

  // =====================================================
  // MODAL
  // =====================================================

  const openCreate =
    () => {
      setEditingId(null);

      setForm({
        ...emptyForm,
      });

      setImageFile(null);

      setModalOpen(true);
    };

  const openEdit = (
    announcement: Announcement
  ) => {
    setEditingId(
      announcement.id
    );

    setForm({
      title:
        announcement.title ??
        '',

      description:
        announcement.description ??
        '',

      priority:
        announcement.priority ??
        'normal',

      status:
        announcement.status ??
        'draft',

      author:
        announcement.author ??
        '',

      imageUrl:
        announcement.image_url ??
        '',
    });

    setImageFile(null);

    setModalOpen(true);
  };

  const closeModal =
    () => {
      if (
        submitting ||
        uploadingImage
      ) {
        return;
      }

      setModalOpen(false);
      setEditingId(null);
      setImageFile(null);

      setForm({
        ...emptyForm,
      });
    };

  // =====================================================
  // FORM
  // =====================================================

  const handleChange =
    (
      e: ChangeEvent<
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
        (previous) => ({
          ...previous,
          [name]: value,
        })
      );
    };

  const handleImageChange =
    (
      e: ChangeEvent<HTMLInputElement>
    ) => {
      const selectedFile =
        e.target.files?.[0] ??
        null;

      setImageFile(
        selectedFile
      );

      if (selectedFile) {
        setForm(
          (previous) => ({
            ...previous,
            imageUrl:
              selectedFile.name,
          })
        );
      } else {
        setForm(
          (previous) => ({
            ...previous,
            imageUrl: '',
          })
        );
      }
    };

  // =====================================================
  // UPLOAD GAMBAR KE GOOGLE DRIVE
  // =====================================================

  const uploadImage =
    async (): Promise<
      string | null
    > => {
      if (!imageFile) {
        return (
          form.imageUrl ||
          null
        );
      }

      setUploadingImage(true);

      try {
        const uploaded =
          await uploadFileToDrive(
            imageFile,
            `pengumuman-${Date.now()}-${imageFile.name}`,
            'foto_pengumuman'
          );

        if (!uploaded?.url) {
          throw new Error(
            'Google Drive tidak mengembalikan URL file'
          );
        }

        return uploaded.url;
      } catch (error) {
        console.error(
          '[AnnouncementsAdminPage] upload error:',
          error
        );

        showToast(
          error instanceof Error
            ? `Gagal upload gambar: ${error.message}`
            : 'Gagal upload gambar',
          'error'
        );

        return null;
      } finally {
        setUploadingImage(false);
      }
    };


  const handleSubmit =
    async (
      e: FormEvent
    ) => {
      e.preventDefault();

      if (
        !form.title.trim()
      ) {
        showToast(
          'Judul wajib diisi',
          'warning'
        );

        return;
      }

      if (submitting) {
        return;
      }

      setSubmitting(true);

      try {
        let imageUrl =
          form.imageUrl;

        if (imageFile) {
          const uploaded =
            await uploadImage();

          if (!uploaded) {
            return;
          }

          imageUrl =
            uploaded;
        }

        const payload = {
          title:
            form.title.trim(),

          description:
            form.description.trim() ||
            null,

          priority:
            form.priority,

          status:
            form.status,

          author:
            form.author.trim() ||
            null,

          image_url:
            imageUrl ||
            null,
        };

        if (editingId) {
          await adminApi<Announcement>(
            `/api/admin/announcements/${encodeURIComponent(
              editingId
            )}`,
            {
              method:
                'PATCH',

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

          showToast(
            'Pengumuman berhasil diperbarui'
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
              'Announcements',

            description:
              `${adminProfile?.name ?? 'Admin'} memperbarui pengumuman ${form.title.trim()}`,
          });
        } else {
          await adminApi<Announcement>(
            '/api/admin/announcements',
            {
              method:
                'POST',

              body:
                JSON.stringify(
                  payload
                ),
            }
          );

          showToast(
            'Pengumuman berhasil ditambahkan'
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
              'Announcements',

            description:
              `${adminProfile?.name ?? 'Admin'} menambah pengumuman ${form.title.trim()}`,
          });
        }

        setModalOpen(false);
        setEditingId(null);
        setImageFile(null);

        setForm({
          ...emptyForm,
        });

        await fetchAnnouncements();
      } catch (error) {
        console.error(
          '[AnnouncementsAdminPage] SAVE error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal menyimpan pengumuman',
          'error'
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };

  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete =
    async (
      announcement: Announcement
    ) => {
      const confirmed =
        window.confirm(
          `Apakah Anda yakin ingin menghapus pengumuman "${announcement.title ?? ''}"?`
        );

      if (!confirmed) {
        return;
      }

      try {
        await adminApi<null>(
          `/api/admin/announcements/${encodeURIComponent(
            announcement.id
          )}`,
          {
            method:
              'DELETE',
          }
        );

        showToast(
          'Pengumuman berhasil dihapus'
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
            'Announcements',

          description:
            `${adminProfile?.name ?? 'Admin'} menghapus pengumuman ${announcement.title ?? announcement.id}`,
        });

        await fetchAnnouncements();
      } catch (error) {
        console.error(
          '[AnnouncementsAdminPage] DELETE error:',
          error
        );

        showToast(
          error instanceof Error
            ? error.message
            : 'Gagal menghapus pengumuman',
          'error'
        );
      }
    };

  return (
    <div className="pb-6">
      {/* HEADER */}

      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Megaphone className="h-6 w-6" />
            Kelola Pengumuman
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            CRUD pengumuman sarana prasarana.
          </p>
        </div>

        {canCreate && (
          <button
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

      {/* LIST */}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : announcements.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Belum ada pengumuman.
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map(
            (
              announcement
            ) => (
              <div
                key={
                  announcement.id
                }
                className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {announcement.title ??
                          'Tanpa Judul'}
                      </h3>

                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',

                          priorityStyles[
                            announcement.priority ??
                              'normal'
                          ] ??
                            priorityStyles.normal
                        )}
                      >
                        {priorityLabels[
                          announcement.priority ??
                            'normal'
                        ] ??
                          announcement.priority}
                      </span>

                      <span
                        className={cn(
                          'rounded-full px-2.5 py-0.5 text-xs font-medium',

                          statusStyles[
                            announcement.status ??
                              'draft'
                          ] ??
                            statusStyles.draft
                        )}
                      >
                        {statusLabels[
                          announcement.status ??
                            'draft'
                        ] ??
                          announcement.status}
                      </span>
                    </div>

                    {announcement.image_url && (
                      <RemoteImage
                        src={
                          announcement.image_url
                        }
                        alt={
                          announcement.title ??
                          'Pengumuman'
                        }
                        className="mt-2 max-h-40 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                      />
                    )}

                    {announcement.description && (
                      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                        {
                          announcement.description
                        }
                      </p>
                    )}

                    <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-slate-500 dark:text-slate-400">
                      {announcement.author && (
                        <span>
                          Oleh:{' '}
                          {
                            announcement.author
                          }
                        </span>
                      )}

                      {announcement.published_at && (
                        <span>
                          Dipublikasi:{' '}
                          {new Date(
                            announcement.published_at
                          ).toLocaleDateString(
                            'id-ID'
                          )}
                        </span>
                      )}

                      <span>
                        Dibuat:{' '}
                        {announcement.created_at
                          ? new Date(
                              announcement.created_at
                            ).toLocaleDateString(
                              'id-ID'
                            )
                          : '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    {canUpdate && (
                      <button
                        onClick={() =>
                          openEdit(
                            announcement
                          )
                        }
                        className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                    )}

                    {canDelete && (
                      <button
                        onClick={() =>
                          void handleDelete(
                            announcement
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

      {/* MODAL */}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingId
                  ? 'Edit Pengumuman'
                  : 'Tambah Pengumuman'}
              </h2>

              <button
                type="button"
                onClick={
                  closeModal
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
              className="space-y-4"
            >
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Judul *
                </label>

                <input
                  name="title"
                  value={
                    form.title
                  }
                  onChange={
                    handleChange
                  }
                  required
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
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
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Gambar
                  (Opsional)
                </label>

                <div className="flex items-center gap-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                    <ImagePlus className="h-4 w-4" />

                    Pilih Gambar

                    <input
                      type="file"
                      accept="image/*"
                      onChange={
                        handleImageChange
                      }
                      className="hidden"
                    />
                  </label>

                  {form.imageUrl && (
                    <span className="max-w-[300px] truncate text-sm text-slate-500 dark:text-slate-400">
                      {
                        form.imageUrl
                      }
                    </span>
                  )}
                </div>

                {form.imageUrl &&
                  !imageFile && (
                    <RemoteImage
                      src={
                        form.imageUrl
                      }
                      alt="Preview"
                      className="mt-2 max-h-32 rounded-lg border border-slate-200 object-cover dark:border-slate-700"
                    />
                  )}
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Prioritas
                  </label>

                  <select
                    name="priority"
                    value={
                      form.priority
                    }
                    onChange={
                      handleChange
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >
                    <option value="low">
                      Rendah
                    </option>

                    <option value="normal">
                      Normal
                    </option>

                    <option value="high">
                      Tinggi
                    </option>

                    <option value="urgent">
                      Mendesak
                    </option>
                  </select>
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
                    <option value="draft">
                      Draf
                    </option>

                    <option value="published">
                      Dipublikasi
                    </option>

                    <option value="archived">
                      Diarsipkan
                    </option>
                  </select>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Penulis
                  </label>

                  <input
                    name="author"
                    value={
                      form.author
                    }
                    onChange={
                      handleChange
                    }
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={
                    closeModal
                  }
                  disabled={
                    submitting ||
                    uploadingImage
                  }
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>

                <button
                  type="submit"
                  disabled={
                    submitting ||
                    uploadingImage
                  }
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {(submitting ||
                    uploadingImage) && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}

                  {uploadingImage
                    ? 'Mengunggah...'
                    : submitting
                      ? 'Menyimpan...'
                      : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}