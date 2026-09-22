import {
  useEffect,
  useState,
} from 'react';

import {
  MapPin,
  Upload,
  Loader2,
  FileText,
  X,
  CheckCircle2,
  Plus,
} from 'lucide-react';

import {
  showToast,
} from '../components/Toast';

import {
  useAuth,
} from '../context/AuthContext';

import type {
  KavlingKategori,
  MasterKelas,
  MasterEkstrakurikuler,
} from '../types';

import {
  KAVLING_KATEGORI_OPTIONS,
} from '../types';


const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));


const MAX_FILE_SIZE =
  10 * 1024 * 1024;


const ALLOWED_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'application/pdf',
];


interface FormState {
  nama_pj: string;
  kategori: KavlingKategori;
  nama_kategori: string;
  tanggal: string;
  lokasi: string;
  judul: string;
  deskripsi: string;
  hasil: string;
  catatan: string;
}


interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}


interface KavlingOptionsResponse {
  kelas: MasterKelas[];
  ekstrakurikuler:
    MasterEkstrakurikuler[];
}


interface UploadResponse {
  file_name: string;
  file_url: string;
  drive_file_id:
    | string
    | null;
  mime_type: string;
  size: number;
}


const emptyForm: FormState = {
  nama_pj: '',
  kategori: 'Kelas',
  nama_kategori: '',
  tanggal: '',
  lokasi: '',
  judul: '',
  deskripsi: '',
  hasil: '',
  catatan: '',
};


export default function InputKavlingPage() {
  const {
    session,
    adminProfile,
  } = useAuth();


  const [
    form,
    setForm,
  ] =
    useState<FormState>(
      emptyForm
    );


  const [
    file,
    setFile,
  ] =
    useState<File | null>(
      null
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
    kelasList,
    setKelasList,
  ] =
    useState<
      MasterKelas[]
    >([]);


  const [
    eskulList,
    setEskulList,
  ] =
    useState<
      MasterEkstrakurikuler[]
    >([]);


  // =====================================================
  // AUTH
  // =====================================================

  const getAuthHeaders =
    () => {
      const token =
        session
          ?.access_token;

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


  // =====================================================
  // LOAD MASTER DATA DARI POSTGRESQL
  // =====================================================

  useEffect(
    () => {
      if (
        !session
          ?.access_token
      ) {
        return;
      }


      const loadOptions =
        async () => {
          try {
            const response =
              await fetch(
                `${API_BASE_URL}/api/kavling/options`,
                {
                  headers:
                    getAuthHeaders(),
                }
              );


            const result =
              (await response
                .json()
                .catch(
                  () => null
                )) as
                | ApiResponse<
                    KavlingOptionsResponse
                  >
                | null;


            if (
              !response.ok ||
              !result?.ok ||
              !result.data
            ) {
              throw new Error(
                result
                  ?.message ??
                  'Gagal memuat pilihan kavling'
              );
            }


            setKelasList(
              Array.isArray(
                result
                  .data
                  .kelas
              )
                ? result
                    .data
                    .kelas
                : []
            );


            setEskulList(
              Array.isArray(
                result
                  .data
                  .ekstrakurikuler
              )
                ? result
                    .data
                    .ekstrakurikuler
                : []
            );
          } catch (
            error
          ) {
            console.error(
              '[InputKavlingPage] Load options error:',
              error
            );


            showToast(
              error instanceof
                  Error
                ? error.message
                : 'Gagal memuat pilihan kavling',
              'error'
            );
          }
        };


      void loadOptions();
    },
    [
      session
        ?.access_token,
    ]
  );


  // =====================================================
  // AUTO FILL NAMA PJ
  // =====================================================

  useEffect(
    () => {
      if (
        adminProfile
          ?.name
      ) {
        setForm(
          (
            previous
          ) => ({
            ...previous,

            nama_pj:
              adminProfile
                .name,
          })
        );
      }
    },
    [
      adminProfile
        ?.name,
    ]
  );


  // =====================================================
  // FORM
  // =====================================================

  const set =
    (
      key:
        keyof FormState,

      value:
        string
    ) => {
      setForm(
        (
          previous
        ) => ({
          ...previous,

          [key]:
            value,
        })
      );
    };


  const handleKategoriChange =
    (
      kategori:
        KavlingKategori
    ) => {
      setForm(
        (
          previous
        ) => ({
          ...previous,

          kategori,

          nama_kategori:
            '',
        })
      );
    };


  // =====================================================
  // FILE
  // =====================================================

  const handleFile =
    (
      selectedFile:
        File | null
    ) => {
      if (
        !selectedFile
      ) {
        return;
      }


      if (
        !ALLOWED_TYPES.includes(
          selectedFile
            .type
        )
      ) {
        showToast(
          'Format file tidak didukung.',
          'error'
        );

        return;
      }


      if (
        selectedFile
          .size >
        MAX_FILE_SIZE
      ) {
        showToast(
          'Ukuran file maksimal 10 MB.',
          'error'
        );

        return;
      }


      setFile(
        selectedFile
      );
    };


  // =====================================================
  // VALIDASI
  // =====================================================

  const validate =
    () => {
      if (
        !session
          ?.access_token
      ) {
        showToast(
          'Silakan login terlebih dahulu',
          'error'
        );

        return false;
      }


      if (
        !form
          .nama_pj
          .trim()
      ) {
        showToast(
          'Nama penanggung jawab wajib diisi',
          'error'
        );

        return false;
      }


      if (
        !form
          .kategori
      ) {
        showToast(
          'Kategori kavling wajib dipilih',
          'error'
        );

        return false;
      }


      if (
        !form
          .nama_kategori
          .trim()
      ) {
        showToast(
          'Nama kelas / ekstrakurikuler / organisasi wajib diisi',
          'error'
        );

        return false;
      }


      if (
        !form
          .tanggal
      ) {
        showToast(
          'Tanggal pelaksanaan wajib diisi',
          'error'
        );

        return false;
      }


      if (
        !form
          .lokasi
          .trim()
      ) {
        showToast(
          'Lokasi kavling wajib diisi',
          'error'
        );

        return false;
      }


      if (
        !form
          .judul
          .trim()
      ) {
        showToast(
          'Judul kegiatan wajib diisi',
          'error'
        );

        return false;
      }


      if (
        !form
          .deskripsi
          .trim()
      ) {
        showToast(
          'Deskripsi kegiatan wajib diisi',
          'error'
        );

        return false;
      }


      if (
        !form
          .hasil
          .trim()
      ) {
        showToast(
          'Hasil kavling wajib diisi',
          'error'
        );

        return false;
      }


      if (!file) {
        showToast(
          'Bukti pendukung wajib diupload',
          'error'
        );

        return false;
      }


      return true;
    };


  // =====================================================
  // UPLOAD FILE KE GOOGLE DRIVE VIA BACKEND
  // =====================================================

const uploadFile = async (): Promise<UploadResponse> => {
  if (!file) {
    throw new Error(
      'File tidak ditemukan'
    );
  }

  const formData =
    new FormData();

  formData.append(
    'file',
    file
  );

  formData.append(
    'category',
    'foto_kavling'
  );

  const response =
    await fetch(
      `${API_BASE_URL}/api/upload-drive`,
      {
        method: 'POST',

        headers:
          getAuthHeaders(),

        body:
          formData,
      }
    );

  const result =
    await response
      .json()
      .catch(() => null);

  if (
    !response.ok ||
    !result?.ok ||
    !result?.file?.url
  ) {
    throw new Error(
      result?.message ??
        'Gagal upload bukti ke Google Drive'
    );
  }

  return {
    file_name:
      result.file.originalName ??
      result.file.name ??
      file.name,

    file_url:
      result.file.url,

    drive_file_id:
      result.file.id ??
      null,

    mime_type:
      result.file.mimeType ??
      file.type ??
      '',

    size:
      Number(
        result.file.size ??
        file.size
      ),
  };
};


  // =====================================================
  // SIMPAN DATA KAVLING KE POSTGRESQL
  // =====================================================

  const saveKavling =
    async (
      uploadedFile:
        UploadResponse
    ) => {
      const response =
        await fetch(
          `${API_BASE_URL}/api/kavling`,
          {
            method:
              'POST',

            headers: {
              ...getAuthHeaders(),

              'Content-Type':
                'application/json',
            },

            body:
              JSON.stringify({
                nama_pj:
                  form
                    .nama_pj
                    .trim(),

                kategori:
                  form
                    .kategori,

                nama_kategori:
                  form
                    .nama_kategori
                    .trim(),

                tanggal:
                  form
                    .tanggal,

                lokasi:
                  form
                    .lokasi
                    .trim(),

                judul:
                  form
                    .judul
                    .trim(),

                deskripsi:
                  form
                    .deskripsi
                    .trim(),

                hasil:
                  form
                    .hasil
                    .trim(),

                catatan:
                  form
                    .catatan
                    .trim(),

                file_url:
                  uploadedFile
                    .file_url,

                file_name:
                  uploadedFile
                    .file_name,
              }),
          }
        );


      const result =
        (await response
          .json()
          .catch(
            () => null
          )) as
          | ApiResponse<unknown>
          | null;


      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result
            ?.message ??
            'Gagal menyimpan data kavling'
        );
      }
    };


  // =====================================================
  // SUBMIT
  // =====================================================

  const handleSubmit =
    async (
      event:
        React.FormEvent
    ) => {
      event.preventDefault();


      if (
        !validate()
      ) {
        return;
      }


      if (
        submitting
      ) {
        return;
      }


      setSubmitting(
        true
      );


      try {
        // 1. Upload bukti langsung ke Google Drive
        const uploadedFile =
          await uploadFile();


        // 2. Simpan metadata + URL Drive ke PostgreSQL
        await saveKavling(
          uploadedFile
        );


        showToast(
          'Data kavling berhasil disimpan.',
          'success'
        );


        setSuccess(
          true
        );
      } catch (
        error
      ) {
        console.error(
          '[InputKavlingPage] Submit error:',
          error
        );


        showToast(
          error instanceof
              Error
            ? error.message
            : 'Gagal menyimpan data kavling',
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
      setForm(
        {
          ...emptyForm,

          nama_pj:
            adminProfile
              ?.name ??
            '',
        }
      );


      setFile(
        null
      );


      setSuccess(
        false
      );
    };


  // =====================================================
  // SUCCESS
  // =====================================================

  if (
    success
  ) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">

          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>

          <h2 className="text-xl font-bold text-slate-900 dark:text-white">
            Kavling Berhasil Disimpan
          </h2>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Data kavling Anda telah tersimpan dengan status Menunggu Verifikasi.
          </p>

          <button
            type="button"
            onClick={
              reset
            }
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" />

            Buat Kavling Lain
          </button>

        </div>
      </div>
    );
  }


  // =====================================================
  // RENDER
  // =====================================================

  return (
    <div className="relative pb-12">

      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">

        <div className="relative mx-auto max-w-7xl px-4 text-center">

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <MapPin className="h-7 w-7 text-white" />
          </div>

          <h1 className="text-3xl font-bold text-white">
            Input Kavling
          </h1>

          <p className="mt-2 text-sm text-white/80">
            Isi data pembagian area atau tugas kegiatan
          </p>

        </div>
      </div>


      <div className="mx-auto max-w-3xl px-4 py-8">

        <form
          onSubmit={
            handleSubmit
          }
          className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
        >

          <div className="space-y-5">

            {/* INFORMASI PENGAJU */}

            <div>

              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                Informasi Pengaju
              </h3>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>

                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Nama Penanggung Jawab *
                  </label>

                  <input
                    value={
                      form
                        .nama_pj
                    }
                    onChange={
                      (
                        event
                      ) =>
                        set(
                          'nama_pj',
                          event
                            .target
                            .value
                        )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Nama lengkap"
                  />

                </div>


                <div>

                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Kategori *
                  </label>

                  <select
                    value={
                      form
                        .kategori
                    }
                    onChange={
                      (
                        event
                      ) =>
                        handleKategoriChange(
                          event
                            .target
                            .value as KavlingKategori
                        )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  >

                    {KAVLING_KATEGORI_OPTIONS.map(
                      (
                        option
                      ) => (
                        <option
                          key={
                            option
                          }
                          value={
                            option
                          }
                        >
                          {
                            option ===
                            'Unit'
                              ? 'Organisasi'
                              : option
                          }
                        </option>
                      )
                    )}

                  </select>

                </div>

              </div>

            </div>


            {/* NAMA KATEGORI */}

            <div>

              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                Nama {
                  form.kategori ===
                  'Kelas'
                    ? 'Kelas'
                    : form.kategori ===
                        'Ekstrakurikuler'
                      ? 'Ekstrakurikuler'
                      : 'Organisasi'
                } *
              </h3>


              {
                form.kategori ===
                'Kelas'
                  ? (
                    <select
                      value={
                        form
                          .nama_kategori
                      }
                      onChange={
                        (
                          event
                        ) =>
                          set(
                            'nama_kategori',
                            event
                              .target
                              .value
                          )
                      }
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >

                      <option value="">
                        Pilih kelas
                      </option>

                      {kelasList.map(
                        (
                          kelas
                        ) => (
                          <option
                            key={
                              kelas.id
                            }
                            value={
                              kelas.nama
                            }
                          >
                            {kelas.nama}
                          </option>
                        )
                      )}

                    </select>
                  )

                  : form.kategori ===
                      'Ekstrakurikuler'
                    ? (
                      <select
                        value={
                          form
                            .nama_kategori
                        }
                        onChange={
                          (
                            event
                          ) =>
                            set(
                              'nama_kategori',
                              event
                                .target
                                .value
                            )
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >

                        <option value="">
                          Pilih ekstrakurikuler
                        </option>

                        {eskulList.map(
                          (
                            eskul
                          ) => (
                            <option
                              key={
                                eskul.id
                              }
                              value={
                                eskul.nama
                              }
                            >
                              {eskul.nama}
                            </option>
                          )
                        )}

                      </select>
                    )

                    : (
                      <select
                        value={
                          form
                            .nama_kategori
                        }
                        onChange={
                          (
                            event
                          ) =>
                            set(
                              'nama_kategori',
                              event
                                .target
                                .value
                            )
                        }
                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                      >

                        <option value="">
                          Pilih organisasi
                        </option>

                        <option value="OSIS">
                          OSIS
                        </option>

                        <option value="MPK">
                          MPK
                        </option>

                      </select>
                    )
              }

            </div>


            {/* DETAIL KAVLING */}

            <div>

              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                Detail Kavling
              </h3>


              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <div>

                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Tanggal Pelaksanaan *
                  </label>

                  <input
                    type="date"
                    value={
                      form
                        .tanggal
                    }
                    onChange={
                      (
                        event
                      ) =>
                        set(
                          'tanggal',
                          event
                            .target
                            .value
                        )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />

                </div>


                <div>

                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Lokasi Kavling *
                  </label>

                  <input
                    value={
                      form
                        .lokasi
                    }
                    onChange={
                      (
                        event
                      ) =>
                        set(
                          'lokasi',
                          event
                            .target
                            .value
                        )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Contoh: Lapangan utama"
                  />

                </div>

              </div>


              <div className="mt-4">

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Judul Kegiatan *
                </label>

                <input
                  value={
                    form
                      .judul
                  }
                  onChange={
                    (
                      event
                    ) =>
                      set(
                        'judul',
                        event
                          .target
                          .value
                      )
                  }
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Contoh: Piket kelas pagi"
                />

              </div>


              <div className="mt-4">

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Deskripsi Kegiatan *
                </label>

                <textarea
                  rows={
                    3
                  }
                  value={
                    form
                      .deskripsi
                  }
                  onChange={
                    (
                      event
                    ) =>
                      set(
                        'deskripsi',
                        event
                          .target
                          .value
                      )
                  }
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Jelaskan kegiatan…"
                />

              </div>


              <div className="mt-4">

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Hasil Kavling *
                </label>

                <textarea
                  rows={
                    3
                  }
                  value={
                    form
                      .hasil
                  }
                  onChange={
                    (
                      event
                    ) =>
                      set(
                        'hasil',
                        event
                          .target
                          .value
                      )
                  }
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Hasil yang dicapai…"
                />

              </div>


              <div className="mt-4">

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Catatan
                </label>

                <textarea
                  rows={
                    2
                  }
                  value={
                    form
                      .catatan
                  }
                  onChange={
                    (
                      event
                    ) =>
                      set(
                        'catatan',
                        event
                          .target
                          .value
                      )
                  }
                  className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="Catatan tambahan (opsional)"
                />

              </div>

            </div>


            {/* BUKTI PENDUKUNG */}

            <div>

              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">
                Bukti Pendukung *
              </h3>


              {
                file
                  ? (
                    <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800">

                      <FileText className="h-5 w-5 text-brand-600 dark:text-brand-400" />

                      <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">
                        {file.name}
                      </span>

                      <span className="text-xs text-slate-400">
                        {
                          (
                            file.size /
                            1024 /
                            1024
                          ).toFixed(
                            2
                          )
                        } MB
                      </span>

                      <button
                        type="button"
                        onClick={
                          () =>
                            setFile(
                              null
                            )
                        }
                        className="rounded-full bg-red-500 p-1 text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>

                    </div>
                  )

                  : (
                    <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-brand-400 dark:border-slate-700 dark:hover:border-brand-600">

                      <Upload className="h-6 w-6 text-slate-400" />

                      <span className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                        Klik untuk upload bukti pendukung
                      </span>

                      <span className="mt-1 text-xs text-slate-400">
                        JPG, JPEG, PNG, PDF · Maks 10 MB
                      </span>

                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.pdf"
                        className="hidden"
                        onChange={
                          (
                            event
                          ) =>
                            handleFile(
                              event
                                .target
                                .files
                                ?.[0] ??
                              null
                            )
                        }
                      />

                    </label>
                  )
              }

            </div>


            <button
              type="submit"
              disabled={
                submitting
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
            >

              {
                submitting
                  ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )
                  : (
                    <MapPin className="h-4 w-4" />
                  )
              }

              {
                submitting
                  ? 'Menyimpan…'
                  : 'Kirim Data Kavling'
              }

            </button>

          </div>

        </form>

      </div>

    </div>
  );
}