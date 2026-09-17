import {
  useState,
  type FormEvent,
} from 'react';

import {
  MessageSquare,
  Send,
  Loader2,
} from 'lucide-react';

import { showToast } from '../components/Toast';


const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';


const KATEGORI_OPTIONS = [
  'Kritik',
  'Saran',
  'Laporan',
  'Pertanyaan',
  'Lainnya',
] as const;


type Kategori =
  (typeof KATEGORI_OPTIONS)[number];


interface AspirasiForm {
  nama: string;
  kelas: string;
  kategori: Kategori;
  judul: string;
  isi: string;
  anonim: boolean;
}


interface ApiResponse {
  ok: boolean;
  message?: string;
}


const emptyForm:
  AspirasiForm = {
    nama: '',
    kelas: '',
    kategori:
      'Saran',
    judul: '',
    isi: '',
    anonim: false,
  };


export default function AspirasiPage() {
  const [
    loading,
    setLoading,
  ] =
    useState(false);


  const [
    form,
    setForm,
  ] =
    useState<AspirasiForm>({
      ...emptyForm,
    });


  // =====================================================
  // SUBMIT
  // =====================================================

  const handleSubmit =
    async (
      event:
        FormEvent
    ) => {
      event.preventDefault();


      const judul =
        form.judul.trim();


      const isi =
        form.isi.trim();


      if (!judul) {
        showToast(
          'Judul wajib diisi',
          'error'
        );

        return;
      }


      if (!isi) {
        showToast(
          'Isi aspirasi wajib diisi',
          'error'
        );

        return;
      }


      setLoading(
        true
      );


      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/aspirasi`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  nama:
                    form.nama.trim(),

                  kelas_unit:
                    form.kelas.trim(),

                  kategori:
                    form.kategori,

                  judul,

                  isi,

                  anonim:
                    form.anonim,
                }),
            }
          );


        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | ApiResponse
              | null;


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal mengirim aspirasi'
          );
        }


        showToast(
          'Aspirasi berhasil dikirim.',
          'success'
        );


        setForm({
          ...emptyForm,
        });
      } catch (error) {
        console.error(
          '[AspirasiPage] Gagal mengirim aspirasi:',
          error
        );


        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal mengirim aspirasi. Silakan coba lagi.',
          'error'
        );
      } finally {
        setLoading(
          false
        );
      }
    };


  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="min-h-screen bg-slate-50 transition-colors duration-200 dark:bg-slate-950">

      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-12">

        {/* HEADER */}
        <div className="mb-8 text-center">

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-700 text-white shadow-sm dark:bg-brand-600">

            <MessageSquare className="h-7 w-7" />

          </div>


          <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl dark:text-white">
            Kotak Aspirasi
          </h1>


          <p className="mx-auto mt-2 max-w-xl text-sm leading-relaxed text-slate-600 dark:text-slate-400">
            Sampaikan kritik, saran, maupun masukan untuk
            pengelolaan Sarana dan Prasarana SMK Negeri 1
            Cimahi.
          </p>

        </div>


        {/* FORM */}
        <form
          onSubmit={
            handleSubmit
          }

          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-colors sm:p-6 dark:border-slate-700 dark:bg-slate-900"
        >

          <div className="space-y-5">

            {/* NAMA + KELAS */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              <div>

                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Nama{' '}

                  <span className="font-normal text-slate-400 dark:text-slate-500">
                    (opsional)
                  </span>
                </label>


                <input
                  type="text"

                  value={
                    form.nama
                  }

                  disabled={
                    form.anonim
                  }

                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        previous
                      ) => ({
                        ...previous,

                        nama:
                          event
                            .target
                            .value,
                      })
                    )
                  }

                  placeholder="Nama lengkap"

                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-500"
                />

              </div>


              <div>

                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                  Kelas{' '}

                  <span className="font-normal text-slate-400 dark:text-slate-500">
                    (opsional)
                  </span>
                </label>


                <input
                  type="text"

                  value={
                    form.kelas
                  }

                  disabled={
                    form.anonim
                  }

                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        previous
                      ) => ({
                        ...previous,

                        kelas:
                          event
                            .target
                            .value,
                      })
                    )
                  }

                  placeholder="Contoh: X IOP A"

                  className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:opacity-70 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500 dark:disabled:bg-slate-800/50 dark:disabled:text-slate-500"
                />

              </div>

            </div>


            {/* KATEGORI */}
            <div>

              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Kategori
              </label>


              <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">

                {KATEGORI_OPTIONS.map(
                  (
                    kategori
                  ) => {
                    const active =
                      form.kategori ===
                      kategori;


                    return (
                      <button
                        type="button"

                        key={
                          kategori
                        }

                        onClick={() =>
                          setForm(
                            (
                              previous
                            ) => ({
                              ...previous,
                              kategori,
                            })
                          )
                        }

                        className={
                          active
                            ? 'rounded-xl border border-brand-500 bg-brand-50 px-3 py-2.5 text-sm font-semibold text-brand-700 transition dark:border-brand-500 dark:bg-brand-900/40 dark:text-brand-300'
                            : 'rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-medium text-slate-600 transition hover:border-brand-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-brand-500 dark:hover:bg-slate-800/80'
                        }
                      >
                        {
                          kategori
                        }
                      </button>
                    );
                  }
                )}

              </div>

            </div>


            {/* JUDUL */}
            <div>

              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Judul

                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>


              <input
                type="text"

                value={
                  form.judul
                }

                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      previous
                    ) => ({
                      ...previous,

                      judul:
                        event
                          .target
                          .value,
                    })
                  )
                }

                placeholder="Contoh: Perbaikan AC di Lab Komputer"

                className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
              />

            </div>


            {/* ISI */}
            <div>

              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-200">
                Isi Aspirasi

                <span className="ml-1 text-red-500">
                  *
                </span>
              </label>


              <textarea
                rows={
                  5
                }

                value={
                  form.isi
                }

                onChange={(
                  event
                ) =>
                  setForm(
                    (
                      previous
                    ) => ({
                      ...previous,

                      isi:
                        event
                          .target
                          .value,
                    })
                  )
                }

                placeholder="Jelaskan kritik, saran, atau masukan Anda..."

                className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm leading-relaxed text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder:text-slate-500"
              />

            </div>


            {/* ANONIM */}
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">

              <label className="flex cursor-pointer items-center gap-3">

                <input
                  type="checkbox"

                  checked={
                    form.anonim
                  }

                  onChange={(
                    event
                  ) =>
                    setForm(
                      (
                        previous
                      ) => ({
                        ...previous,

                        anonim:
                          event
                            .target
                            .checked,
                      })
                    )
                  }

                  className="h-4 w-4 rounded border-slate-300 bg-white text-brand-600 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-700"
                />


                <div>

                  <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                    Kirim sebagai anonim
                  </p>


                  <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                    Nama dan kelas tidak akan ditampilkan pada aspirasi.
                  </p>

                </div>

              </label>

            </div>


            {/* SUBMIT */}
            <button
              type="submit"

              disabled={
                loading
              }

              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-brand-600 dark:hover:bg-brand-700"
            >

              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}


              {loading
                ? 'Mengirim...'
                : 'Kirim Aspirasi'}

            </button>

          </div>

        </form>

      </div>

    </div>
  );
}