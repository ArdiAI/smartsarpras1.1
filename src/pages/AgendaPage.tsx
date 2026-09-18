import { useState } from 'react';
import {
  CalendarDays,
  CheckCircle2,
  Plus,
  Loader2,
  Upload,
  FileText,
  X,
} from 'lucide-react';
import { showToast } from '../components/Toast';
import AnimatedBackground from '../components/AnimatedBackground';
import { getDefaultWorkflow, getWorkflowSteps } from '../lib/workflow';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

const jenisOptions = [
  'Akademik',
  'Olahraga',
  'Seni & Budaya',
  'Organisasi',
  'Kepanitiaan',
  'Lainnya',
];

interface FormState {
  title: string;
  jenis_kegiatan: string;
  organisasi_jurusan: string;
  penanggung_jawab: string;
  email: string;
  contact_phone: string;
  location: string;
  event_date: string;
  end_date: string;
  start_time: string;
  end_time: string;
  description: string;
}

const empty: FormState = {
  title: '',
  jenis_kegiatan: '',
  organisasi_jurusan: '',
  penanggung_jawab: '',
  email: '',
  contact_phone: '',
  location: '',
  event_date: '',
  end_date: '',
  start_time: '',
  end_time: '',
  description: '',
};

interface UploadResult {
  uploadedUrls: string[];
  failedFiles: string[];
}

export default function AgendaPage() {
  const [form, setForm] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [suratFiles, setSuratFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  const set = (k: keyof FormState, v: string) =>
    setForm((p) => ({
      ...p,
      [k]: v,
    }));

  const validate = () => {
    if (!form.title.trim()) {
      showToast('Judul kegiatan wajib diisi', 'error');
      return false;
    }

    if (!form.jenis_kegiatan) {
      showToast('Jenis kegiatan wajib dipilih', 'error');
      return false;
    }

    if (!form.organisasi_jurusan.trim()) {
      showToast('Organisasi/Jurusan wajib diisi', 'error');
      return false;
    }

    if (!form.penanggung_jawab.trim()) {
      showToast('Penanggung jawab wajib diisi', 'error');
      return false;
    }

    if (
      !form.email.trim() ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)
    ) {
      showToast('Email valid wajib diisi', 'error');
      return false;
    }

    if (!form.contact_phone.trim()) {
      showToast('Nomor HP aktif wajib diisi', 'error');
      return false;
    }

    if (!/^[0-9+\-\s]{8,15}$/.test(form.contact_phone.trim())) {
      showToast('Nomor HP tidak valid', 'error');
      return false;
    }

    if (!form.location.trim()) {
      showToast('Lokasi wajib diisi', 'error');
      return false;
    }

    if (!form.event_date) {
      showToast('Tanggal mulai wajib diisi', 'error');
      return false;
    }

    if (!form.end_date) {
      showToast('Tanggal selesai wajib diisi', 'error');
      return false;
    }

    if (!form.start_time) {
      showToast('Waktu mulai wajib diisi', 'error');
      return false;
    }

    if (
      form.end_date < form.event_date
    ) {
      showToast(
        'Tanggal selesai tidak boleh sebelum tanggal mulai',
        'error'
      );
      return false;
    }

    return true;
  };

  // =========================================
  // TAMBAH FILE LAMPIRAN
  // =========================================
  const addSuratFiles = (files: FileList | null) => {
    if (!files) return;

    const selectedFiles = Array.from(files);

    setSuratFiles((prev) => {
      const newFiles = selectedFiles.filter(
        (newFile) =>
          !prev.some(
            (oldFile) =>
              oldFile.name === newFile.name &&
              oldFile.size === newFile.size &&
              oldFile.lastModified === newFile.lastModified
          )
      );

      return [...prev, ...newFiles];
    });
  };

  // =========================================
  // HAPUS FILE SEBELUM SUBMIT
  // =========================================
  const removeSuratFile = (index: number) => {
    setSuratFiles((prev) =>
      prev.filter((_, i) => i !== index)
    );
  };

// =========================================
// UPLOAD LAMPIRAN KE GOOGLE DRIVE
// =========================================
const uploadSuratFiles = async (
  agendaId: string
): Promise<UploadResult> => {
  if (suratFiles.length === 0) {
    return {
      uploadedUrls: [],
      failedFiles: [],
    };
  }

  setUploading(true);

  const uploadedUrls: string[] = [];
  const failedFiles: string[] = [];

  try {
    for (const file of suratFiles) {
      try {
        // =========================================
        // 1. SIAPKAN FILE UNTUK BACKEND
        // =========================================

        const formData = new FormData();

        formData.append('file', file);

        formData.append(
          'category',
          'surat_peminjaman'
        );


        // =========================================
        // 2. UPLOAD KE GOOGLE DRIVE
        // =========================================

        const uploadResponse =
          await fetch(
            `${API_BASE_URL}/api/upload-drive`,
            {
              method: 'POST',
              body: formData,
            }
          );


        const uploadResult =
          await uploadResponse
            .json()
            .catch(() => null);


        if (
          !uploadResponse.ok ||
          !uploadResult?.ok
        ) {
          throw new Error(
            uploadResult?.message ??
              'Gagal upload file ke Google Drive'
          );
        }


        // =========================================
        // 3. AMBIL DATA FILE GOOGLE DRIVE
        // =========================================

        const driveFile =
          uploadResult.file;


        if (
          !driveFile?.id ||
          !driveFile?.url
        ) {
          throw new Error(
            'Data file Google Drive tidak lengkap'
          );
        }


        // =========================================
        // 4. SIMPAN METADATA KE POSTGRESQL
        // =========================================

        const attachmentResponse =
          await fetch(
            `${API_BASE_URL}/api/agendas/${encodeURIComponent(
              agendaId
            )}/attachments`,
            {
              method: 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body: JSON.stringify({
                // Nama asli yang dipilih siswa
                file_name:
                  file.name,

                // Sekarang file_path kita isi
                // dengan ID Google Drive
                file_path:
                  driveFile.id,

                // Link Google Drive
                file_url:
                  driveFile.url,

                // Gunakan data Drive kalau ada,
                // fallback ke File browser
                file_size:
                  driveFile.size ??
                  file.size,

                file_type:
                  driveFile.mimeType ??
                  file.type ??
                  null,
              }),
            }
          );


        const attachmentResult =
          await attachmentResponse
            .json()
            .catch(() => null);


        if (
          !attachmentResponse.ok ||
          !attachmentResult?.ok
        ) {
          /*
           * File sudah masuk Google Drive,
           * tetapi metadata PostgreSQL gagal.
           *
           * Untuk sekarang kita tandai gagal.
           * Nanti bisa kita buat endpoint delete
           * Drive supaya file yatim otomatis
           * dihapus juga.
           */
          throw new Error(
            attachmentResult?.message ??
              'Gagal menyimpan metadata lampiran'
          );
        }


        // =========================================
        // 5. MASUKKAN URL KE DAFTAR BERHASIL
        // =========================================

        uploadedUrls.push(
          driveFile.url
        );


        console.log(
          '[AgendaPage] Upload Google Drive berhasil:',
          {
            agendaId,
            originalName:
              file.name,
            driveId:
              driveFile.id,
            driveUrl:
              driveFile.url,
          }
        );

      } catch (fileError) {
        console.error(
          `[AgendaPage] Gagal upload ${file.name}:`,
          fileError
        );

        failedFiles.push(
          file.name
        );
      }
    }


    return {
      uploadedUrls,
      failedFiles,
    };

  } finally {
    setUploading(false);
  }
};

  // =========================================
  // EMAIL NOTIFIKASI
  // BACKEND YANG CARI EMAIL ADMIN
  // =========================================
  const sendAgendaNotification = async (
    agendaId: string,
    uploadedFileCount: number
  ) => {
    try {
      const workflow =
        await getDefaultWorkflow();

      if (!workflow) {
        console.warn(
          '[AgendaPage] Default workflow tidak ditemukan'
        );
        return;
      }

      const steps =
        await getWorkflowSteps(
          workflow.id
        );

      const firstStep =
        steps.find(
          (step) =>
            step.step_order === 1
        ) ?? steps[0];

      if (!firstStep?.role_id) {
        console.warn(
          '[AgendaPage] Role step pertama tidak ditemukan'
        );
        return;
      }

      const response =
        await fetch(
          `${API_BASE_URL}/api/agendas/${encodeURIComponent(
            agendaId
          )}/notify`,
          {
            method: 'POST',
            headers: {
              'Content-Type':
                'application/json',
            },
            body: JSON.stringify({
              role_id:
                firstStep.role_id,
              uploaded_file_count:
                uploadedFileCount,
            }),
          }
        );

      if (!response.ok) {
        const result =
          await response
            .json()
            .catch(() => null);

        console.warn(
          '[AgendaPage] Notifikasi agenda gagal:',
          result?.message ??
            `HTTP ${response.status}`
        );
      }
    } catch (emailError) {
      /*
       * Email gagal tidak membuat
       * proses membuat agenda gagal.
       */
      console.warn(
        '[AgendaPage] Gagal mengirim email notifikasi:',
        emailError
      );
    }
  };

  // =========================================
  // SUBMIT AGENDA
  // =========================================
  const handleSubmit = async (
    e: React.FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    if (!validate()) return;

    // Hindari double click
    if (submitting) return;

    setSubmitting(true);

    try {
      // 1. SIMPAN AGENDA KE POSTGRESQL
      const createResponse = await fetch(
        `${API_BASE_URL}/api/agendas`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            title: form.title.trim(),
            jenis_kegiatan: form.jenis_kegiatan,
            organisasi_jurusan:
              form.organisasi_jurusan.trim(),
            penanggung_jawab:
              form.penanggung_jawab.trim(),
            email: form.email.trim(),
            contact_phone:
              form.contact_phone.trim(),
            location: form.location.trim(),
            event_date: form.event_date,
            end_date:
              form.end_date,
            start_time: form.start_time,
            end_time:
              form.end_time || null,
            description:
              form.description.trim(),
          }),
        }
      );

      const createResult =
        await createResponse.json();

      if (
        !createResponse.ok ||
        !createResult.ok
      ) {
        throw new Error(
          createResult.message ??
            'Gagal membuat agenda'
        );
      }

      const agendaData =
        createResult.data;

      if (!agendaData?.id) {
        throw new Error(
          'Agenda berhasil dibuat tetapi ID agenda tidak ditemukan'
        );
      }

      // 2. UPLOAD LAMPIRAN
      const {
        uploadedUrls,
        failedFiles,
      } = await uploadSuratFiles(
        agendaData.id
      );

      // 3. SIMPAN FILE PERTAMA KE surat_url POSTGRESQL
      if (uploadedUrls.length > 0) {
        const updateResponse = await fetch(
          `${API_BASE_URL}/api/agendas/${encodeURIComponent(
            agendaData.id
          )}/surat-url`,
          {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              surat_url: uploadedUrls[0],
            }),
          }
        );

        if (!updateResponse.ok) {
          const updateResult =
            await updateResponse
              .json()
              .catch(() => null);

          console.warn(
            '[AgendaPage] Gagal memperbarui surat_url:',
            updateResult?.message ??
              `HTTP ${updateResponse.status}`
          );
        }
      }

      // 4. TAMPILKAN HASIL KE USER
      if (failedFiles.length > 0) {
        showToast(
          `Agenda berhasil dibuat, tetapi ${failedFiles.length} file gagal diunggah: ${failedFiles.join(', ')}`,
          'error'
        );
      } else if (suratFiles.length > 1) {
        showToast(
          `${suratFiles.length} lampiran berhasil diunggah dan agenda berhasil dibuat`,
          'success'
        );
      } else {
        showToast(
          'Agenda berhasil dibuat',
          'success'
        );
      }

      /*
       * PENTING:
       * User langsung masuk halaman sukses.
       * Kita TIDAK menunggu email.
       */
      setSuccess(true);

      /*
       * Email jalan background.
       * Jangan pakai await.
       */
      void sendAgendaNotification(
        agendaData.id,
        uploadedUrls.length
      );
    } catch (err: any) {
      console.error(
        '[AgendaPage] Submit error:',
        err
      );

      showToast(
        err?.message ??
          'Gagal membuat agenda',
        'error'
      );
    } finally {
      /*
       * Loading pasti berhenti
       * walaupun proses gagal.
       */
      setSubmitting(false);
    }
  };

  // =========================================
  // RESET FORM
  // =========================================
  const reset = () => {
    setForm(empty);
    setSuccess(false);
    setSuratFiles([]);
    setUploading(false);
  };

  // =========================================
  // SUCCESS PAGE
  // =========================================
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
              Agenda Berhasil Dibuat
            </h2>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Agenda "{form.title}" telah tersimpan.
            </p>

            <button
              type="button"
              onClick={reset}
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
            >
              <Plus className="h-4 w-4" />
              Buat Agenda Lain
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================
  // FORM
  // =========================================
  return (
    <div className="relative pb-12">
      {/* HERO */}
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <AnimatedBackground />

        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <CalendarDays className="h-7 w-7 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-white">
            Buat Agenda Kegiatan
          </h1>

          <p className="mt-2 text-sm text-white/80">
            Isi formulir untuk menambahkan agenda kegiatan baru
          </p>
        </div>
      </div>

      {/* FORM */}
      <div className="mx-auto max-w-3xl px-4 py-8">
        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {/* JUDUL */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Judul Kegiatan *
              </label>

              <input
                value={form.title}
                onChange={(e) =>
                  set(
                    'title',
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Mis. Lomba Kebersihan Kelas"
              />
            </div>

            {/* JENIS */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Jenis Kegiatan *
              </label>

              <select
                value={
                  form.jenis_kegiatan
                }
                onChange={(e) =>
                  set(
                    'jenis_kegiatan',
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              >
                <option value="">
                  Pilih jenis…
                </option>

                {jenisOptions.map(
                  (j) => (
                    <option
                      key={j}
                      value={j}
                    >
                      {j}
                    </option>
                  )
                )}
              </select>
            </div>

            {/* ORGANISASI */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Organisasi / Jurusan *
              </label>

              <input
                value={
                  form.organisasi_jurusan
                }
                onChange={(e) =>
                  set(
                    'organisasi_jurusan',
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Mis. OSIS / MEKA"
              />
            </div>

            {/* PJ */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Penanggung Jawab *
              </label>

              <input
                value={
                  form.penanggung_jawab
                }
                onChange={(e) =>
                  set(
                    'penanggung_jawab',
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Nama penanggung jawab"
              />
            </div>

            {/* EMAIL */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email *
              </label>

              <input
                type="email"
                value={form.email}
                onChange={(e) =>
                  set(
                    'email',
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="email@sekolah.sch.id"
              />
            </div>

            {/* NOMOR HP */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Nomor HP Aktif *
              </label>

              <input
                type="tel"
                value={
                  form.contact_phone
                }
                onChange={(e) =>
                  set(
                    'contact_phone',
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="08xxxxxxxxxx"
              />
            </div>

            {/* LOKASI */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Lokasi *
              </label>

              <input
                value={form.location}
                onChange={(e) =>
                  set(
                    'location',
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Mis. Aula / Lapangan"
              />
            </div>

            {/* TANGGAL MULAI */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tanggal Mulai *
              </label>

              <input
                type="date"
                value={
                  form.event_date
                }
                required
                onChange={(e) =>
                  set(
                    'event_date',
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* TANGGAL SELESAI */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Tanggal Selesai *
              </label>

              <input
                type="date"
                value={form.end_date}
                min={form.event_date || undefined}
                required
                onChange={(e) =>
                  set(
                    'end_date',
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* WAKTU MULAI */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Waktu Mulai *
              </label>

              <input
                type="time"
                value={
                  form.start_time
                }
                onChange={(e) =>
                  set(
                    'start_time',
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* WAKTU SELESAI */}
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Waktu Selesai (opsional)
              </label>

              <input
                type="time"
                value={form.end_time}
                onChange={(e) =>
                  set(
                    'end_time',
                    e.target.value
                  )
                }
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />
            </div>

            {/* LAMPIRAN */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Surat Peminjaman / Lampiran (Opsional)
              </label>

              <div className="space-y-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                  <Upload className="h-4 w-4" />

                  Pilih File

                  <input
                    type="file"
                    multiple
                    accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                    onChange={(e) => {
                      addSuratFiles(
                        e.target.files
                      );

                      e.currentTarget.value =
                        '';
                    }}
                    className="hidden"
                  />
                </label>

                {suratFiles.length >
                  0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {
                        suratFiles.length
                      }{' '}
                      file dipilih
                    </p>

                    {suratFiles.map(
                      (
                        file,
                        index
                      ) => (
                        <div
                          key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                          className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 px-3 py-2 dark:border-slate-700"
                        >
                          <div className="flex min-w-0 items-center gap-2">
                            <FileText className="h-4 w-4 shrink-0 text-slate-400" />

                            <div className="min-w-0">
                              <p className="truncate text-sm text-slate-600 dark:text-slate-300">
                                {
                                  file.name
                                }
                              </p>

                              <p className="text-xs text-slate-400">
                                {(
                                  file.size /
                                  1024 /
                                  1024
                                ).toFixed(
                                  2
                                )}{' '}
                                MB
                              </p>
                            </div>
                          </div>

                          <button
                            type="button"
                            onClick={() =>
                              removeSuratFile(
                                index
                              )
                            }
                            disabled={
                              submitting
                            }
                            className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-500 disabled:opacity-50 dark:hover:bg-red-950/30"
                            aria-label={`Hapus ${file.name}`}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      )
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* DESKRIPSI */}
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Deskripsi
              </label>

              <textarea
                value={
                  form.description
                }
                onChange={(e) =>
                  set(
                    'description',
                    e.target.value
                  )
                }
                rows={4}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Deskripsi singkat kegiatan…"
              />
            </div>
          </div>

          {/* SUBMIT */}
          <div className="mt-6 flex justify-end">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex min-w-[150px] items-center justify-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <CalendarDays className="h-4 w-4" />
              )}

              {uploading
                ? 'Mengunggah lampiran…'
                : submitting
                  ? 'Menyimpan…'
                  : 'Buat Agenda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}