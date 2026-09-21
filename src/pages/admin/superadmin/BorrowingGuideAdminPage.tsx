import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  ArrowDown,
  ArrowUp,
  BookOpenCheck,
  Eye,
  EyeOff,
  ImagePlus,
  Loader2,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from 'lucide-react';

import { showToast } from '../../../components/Toast';
import {
  deleteBorrowingGuideStep,
  fetchBorrowingGuide,
  saveBorrowingGuideStep,
  type BorrowingGuideStep,
} from '../../../lib/borrowingGuide';
import { uploadFileToDrive } from '../../../lib/upload';

interface FormState {
  title: string;
  description: string;
  image_url: string;
  image_file_id: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  title: '',
  description: '',
  image_url: '',
  image_file_id: '',
  is_active: true,
};

export default function BorrowingGuideAdminPage() {
  const [
    steps,
    setSteps,
  ] =
    useState<
      BorrowingGuideStep[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    uploading,
    setUploading,
  ] =
    useState(false);

  const [
    editingId,
    setEditingId,
  ] =
    useState<
      string | null
    >(null);

  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      emptyForm
    );

  const [
    selectedFile,
    setSelectedFile,
  ] =
    useState<
      File | null
    >(null);

  const loadSteps =
    useCallback(
      async () => {
        try {
          setLoading(
            true
          );

          setSteps(
            await fetchBorrowingGuide(
              true
            )
          );
        } catch (
          error
        ) {
          showToast(
            error instanceof
              Error
              ? error.message
              : 'Gagal memuat panduan',
            'error'
          );
        } finally {
          setLoading(
            false
          );
        }
      },
      []
    );

  useEffect(() => {
    void loadSteps();
  }, [loadSteps]);

  const orderedSteps =
    useMemo(
      () =>
        [...steps].sort(
          (
            a,
            b
          ) =>
            a.sort_order -
              b.sort_order ||
            String(
              a.created_at ??
                ''
            ).localeCompare(
              String(
                b.created_at ??
                  ''
              )
            )
        ),
      [steps]
    );

  const resetForm =
    () => {
      setEditingId(
        null
      );

      setForm(
        emptyForm
      );

      setSelectedFile(
        null
      );
    };

  const startEdit =
    (
      step: BorrowingGuideStep
    ) => {
      setEditingId(
        step.id
      );

      setForm({
        title:
          step.title ??
          '',
        description:
          step.description,
        image_url:
          step.image_url,
        image_file_id:
          step.image_file_id ??
          '',
        is_active:
          step.is_active !==
          false,
      });

      setSelectedFile(
        null
      );

      window.scrollTo({
        top: 0,
        behavior:
          'smooth',
      });
    };

  const uploadImage =
    async () => {
      if (
        !selectedFile
      ) {
        return {
          url:
            form.image_url,
          fileId:
            form.image_file_id,
        };
      }

      if (
        !selectedFile.type.startsWith(
          'image/'
        )
      ) {
        throw new Error(
          'File panduan harus berupa gambar'
        );
      }

      if (
        selectedFile.size >
        5 *
          1024 *
          1024
      ) {
        throw new Error(
          'Ukuran gambar maksimal 5 MB'
        );
      }

      setUploading(
        true
      );

      try {
        const uploaded =
          await uploadFileToDrive(
            selectedFile,
            `panduan-peminjaman-${Date.now()}-${selectedFile.name}`,
            'panduan_peminjaman'
          );

        if (
          !uploaded
        ) {
          throw new Error(
            'Upload gambar ke Google Drive gagal'
          );
        }

        return {
          url:
            uploaded.url,
          fileId:
            uploaded.fileId,
        };
      } finally {
        setUploading(
          false
        );
      }
    };

  const handleSubmit =
    async (
      event: React.FormEvent
    ) => {
      event.preventDefault();

      if (
        !form.description.trim()
      ) {
        showToast(
          'Teks panduan wajib diisi',
          'error'
        );

        return;
      }

      if (
        !selectedFile &&
        !form.image_url
      ) {
        showToast(
          'Gambar panduan wajib diisi',
          'error'
        );

        return;
      }

      try {
        setSaving(
          true
        );

        const uploaded =
          await uploadImage();

        const current =
          editingId
            ? steps.find(
                (
                  step
                ) =>
                  step.id ===
                  editingId
              )
            : null;

        await saveBorrowingGuideStep(
          {
            id:
              editingId ??
              '',
            title:
              form.title.trim() ||
              null,
            description:
              form.description.trim(),
            image_url:
              uploaded.url,
            image_file_id:
              uploaded.fileId ||
              null,
            sort_order:
              current?.sort_order ??
              orderedSteps.length,
            is_active:
              form.is_active,
          },
          editingId ??
            undefined
        );

        showToast(
          editingId
            ? 'Panduan berhasil diperbarui'
            : 'Langkah panduan berhasil ditambahkan',
          'success'
        );

        resetForm();

        await loadSteps();
      } catch (
        error
      ) {
        showToast(
          error instanceof
            Error
              ? error.message
              : 'Gagal menyimpan panduan',
          'error'
        );
      } finally {
        setSaving(
          false
        );
      }
    };

  const toggleActive =
    async (
      step: BorrowingGuideStep
    ) => {
      try {
        await saveBorrowingGuideStep(
          {
            ...step,
            is_active:
              !step.is_active,
          },
          step.id
        );

        await loadSteps();
      } catch (
        error
      ) {
        showToast(
          error instanceof
            Error
              ? error.message
              : 'Gagal mengubah status',
          'error'
        );
      }
    };

  const moveStep =
    async (
      index: number,
      direction:
        | -1
        | 1
    ) => {
      const targetIndex =
        index +
        direction;

      if (
        targetIndex <
          0 ||
        targetIndex >=
          orderedSteps.length
      ) {
        return;
      }

      const first =
        orderedSteps[
          index
        ];

      const second =
        orderedSteps[
          targetIndex
        ];

      try {
        await Promise.all([
          saveBorrowingGuideStep(
            {
              ...first,
              sort_order:
                second.sort_order,
            },
            first.id
          ),
          saveBorrowingGuideStep(
            {
              ...second,
              sort_order:
                first.sort_order,
            },
            second.id
          ),
        ]);

        await loadSteps();
      } catch (
        error
      ) {
        showToast(
          error instanceof
            Error
              ? error.message
              : 'Gagal mengubah urutan',
          'error'
        );
      }
    };

  const handleDelete =
    async (
      step: BorrowingGuideStep
    ) => {
      const confirmed =
        window.confirm(
          `Hapus panduan "${step.title || 'Tanpa judul'}"?`
        );

      if (!confirmed) {
        return;
      }

      try {
        await deleteBorrowingGuideStep(
          step.id
        );

        if (
          editingId ===
          step.id
        ) {
          resetForm();
        }

        showToast(
          'Langkah panduan berhasil dihapus',
          'success'
        );

        await loadSteps();
      } catch (
        error
      ) {
        showToast(
          error instanceof
            Error
              ? error.message
              : 'Gagal menghapus panduan',
          'error'
        );
      }
    };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
          <BookOpenCheck className="h-5 w-5 text-brand-600" />
          Panduan Peminjaman
        </h1>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Atur gambar dan teks panduan yang tampil pada menu Lainnya. Halaman ini hanya dapat diakses Super Admin.
        </p>
      </div>

      <form
        onSubmit={
          handleSubmit
        }
        className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
      >
        <div className="mb-5 flex items-center justify-between gap-3">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            {
              editingId
                ? 'Edit Langkah'
                : 'Tambah Langkah'
            }
          </h2>

          {editingId && (
            <button
              type="button"
              onClick={
                resetForm
              }
              className="inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-4 w-4" />
              Batal edit
            </button>
          )}
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Judul
              </label>

              <input
                value={
                  form.title
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      title:
                        event
                          .target
                          .value,
                    })
                  )
                }
                placeholder="Contoh: Isi Form Peminjaman"
                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Teks Panduan *
              </label>

              <textarea
                required
                rows={6}
                value={
                  form.description
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      description:
                        event
                          .target
                          .value,
                    })
                  )
                }
                placeholder="Jelaskan langkah yang harus dilakukan siswa..."
                className="w-full resize-y rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-6 text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <input
                type="checkbox"
                checked={
                  form.is_active
                }
                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      current
                    ) => ({
                      ...current,
                      is_active:
                        event
                          .target
                          .checked,
                    })
                  )
                }
                className="h-4 w-4"
              />

              <div>
                <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                  Tampilkan ke user
                </p>

                <p className="text-xs text-slate-500">
                  Matikan jika langkah masih disiapkan.
                </p>
              </div>
            </label>
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
              Gambar Panduan *
            </label>

            <label className="block cursor-pointer overflow-hidden rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-brand-400 dark:border-slate-700 dark:bg-slate-800/60">
              {selectedFile ? (
                <img
                  src={
                    URL.createObjectURL(
                      selectedFile
                    )
                  }
                  alt="Preview gambar baru"
                  className="aspect-[4/3] w-full object-contain"
                />
              ) : form.image_url ? (
                <img
                  src={
                    form.image_url
                  }
                  alt="Preview panduan"
                  className="aspect-[4/3] w-full object-contain"
                />
              ) : (
                <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 text-slate-400">
                  <ImagePlus className="h-9 w-9" />
                  <span className="text-xs">
                    Pilih gambar
                  </span>
                </div>
              )}

              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(
                  event
                ) =>
                  setSelectedFile(
                    event
                      .target
                      .files?.[0] ??
                      null
                  )
                }
              />
            </label>

            <p className="mt-2 text-xs text-slate-500">
              JPG/PNG/WebP, maksimal 5 MB. File disimpan melalui Google Drive backend.
            </p>
          </div>
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="submit"
            disabled={
              saving ||
              uploading
            }
            className="inline-flex items-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ||
            uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : editingId ? (
              <Save className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}

            {
              uploading
                ? 'Mengunggah...'
                : saving
                  ? 'Menyimpan...'
                  : editingId
                    ? 'Simpan Perubahan'
                    : 'Tambah Langkah'
            }
          </button>
        </div>
      </form>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="border-b border-slate-200 px-5 py-4 dark:border-slate-800">
          <h2 className="font-semibold text-slate-900 dark:text-white">
            Urutan Panduan
          </h2>

          <p className="mt-1 text-xs text-slate-500">
            Urutan di bawah sama dengan yang dilihat user.
          </p>
        </div>

        {loading ? (
          <div className="p-8 text-center text-sm text-slate-500">
            Memuat...
          </div>
        ) : orderedSteps.length ===
          0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Belum ada panduan. Tambahkan langkah pertama di atas.
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {orderedSteps.map(
              (
                step,
                index
              ) => (
                <div
                  key={
                    step.id
                  }
                  className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center"
                >
                  <img
                    src={
                      step.image_url
                    }
                    alt={
                      step.title ??
                      'Panduan'
                    }
                    className="h-24 w-full rounded-xl bg-slate-100 object-contain sm:w-36 dark:bg-slate-800"
                  />

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        Langkah {
                          index +
                          1
                        }
                      </span>

                      <span
                        className={
                          step.is_active
                            ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
                            : 'rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        }
                      >
                        {
                          step.is_active
                            ? 'Tampil'
                            : 'Disembunyikan'
                        }
                      </span>
                    </div>

                    <p className="mt-2 truncate font-medium text-slate-900 dark:text-white">
                      {
                        step.title ||
                        'Tanpa judul'
                      }
                    </p>

                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500 dark:text-slate-400">
                      {
                        step.description
                      }
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-1">
                    <button
                      type="button"
                      disabled={
                        index ===
                        0
                      }
                      onClick={() =>
                        void moveStep(
                          index,
                          -1
                        )
                      }
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                      title="Naikkan"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      disabled={
                        index ===
                        orderedSteps.length -
                          1
                      }
                      onClick={() =>
                        void moveStep(
                          index,
                          1
                        )
                      }
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-30 dark:hover:bg-slate-800"
                      title="Turunkan"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void toggleActive(
                          step
                        )
                      }
                      className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      title={
                        step.is_active
                          ? 'Sembunyikan'
                          : 'Tampilkan'
                      }
                    >
                      {
                        step.is_active
                          ? (
                            <Eye className="h-4 w-4" />
                          )
                          : (
                            <EyeOff className="h-4 w-4" />
                          )
                      }
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        startEdit(
                          step
                        )
                      }
                      className="rounded-lg p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-900/20"
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() =>
                        void handleDelete(
                          step
                        )
                      }
                      className="rounded-lg p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                      title="Hapus"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
