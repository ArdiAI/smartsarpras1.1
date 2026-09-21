import {
  useEffect,
  useState,
} from 'react';

import {
  BookOpenCheck,
  ImageOff,
} from 'lucide-react';

import EmptyState from '../components/EmptyState';
import {
  fetchBorrowingGuide,
  type BorrowingGuideStep,
} from '../lib/borrowingGuide';

export default function BorrowingGuidePage() {
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
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState('');

  useEffect(() => {
    let mounted =
      true;

    void fetchBorrowingGuide()
      .then(
        (data) => {
          if (mounted) {
            setSteps(
              data
            );
          }
        }
      )
      .catch(
        (err) => {
          console.error(
            '[BorrowingGuidePage]',
            err
          );

          if (mounted) {
            setError(
              err instanceof
                Error
                ? err.message
                : 'Gagal memuat panduan peminjaman'
            );
          }
        }
      )
      .finally(
        () => {
          if (mounted) {
            setLoading(
              false
            );
          }
        }
      );

    return () => {
      mounted =
        false;
    };
  }, []);

  return (
    <div className="min-h-[70vh] bg-slate-50 py-10 dark:bg-slate-950">
      <div className="mx-auto max-w-5xl px-4">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
            <BookOpenCheck className="h-6 w-6" />
          </div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Panduan Peminjaman
          </h1>

          <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            Ikuti langkah berikut sebelum mengajukan peminjaman barang atau fasilitas.
          </p>
        </div>

        {loading ? (
          <div className="space-y-6">
            {[
              1,
              2,
              3,
            ].map(
              (item) => (
                <div
                  key={
                    item
                  }
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="aspect-[16/7] animate-pulse bg-slate-200 dark:bg-slate-800" />

                  <div className="space-y-3 p-5">
                    <div className="h-5 w-1/3 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-4 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                    <div className="h-4 w-4/5 animate-pulse rounded bg-slate-200 dark:bg-slate-800" />
                  </div>
                </div>
              )
            )}
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-300">
            {error}
          </div>
        ) : steps.length ===
          0 ? (
          <EmptyState
            icon={
              BookOpenCheck
            }
            title="Panduan belum tersedia"
            description="Super Admin belum menambahkan panduan peminjaman."
          />
        ) : (
          <div className="space-y-7">
            {steps.map(
              (
                step,
                index
              ) => (
                <article
                  key={
                    step.id
                  }
                  className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="relative bg-slate-100 dark:bg-slate-800">
                    {step.image_url ? (
                      <img
                        src={
                          step.image_url
                        }
                        alt={
                          step.title ??
                          `Langkah ${index + 1} panduan peminjaman`
                        }
                        className="max-h-[620px] w-full object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="flex aspect-[16/7] items-center justify-center text-slate-400">
                        <ImageOff className="h-10 w-10" />
                      </div>
                    )}

                    <span className="absolute left-4 top-4 rounded-full bg-slate-950/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                      Langkah {index + 1}
                    </span>
                  </div>

                  <div className="p-5 sm:p-6">
                    {step.title && (
                      <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">
                        {
                          step.title
                        }
                      </h2>
                    )}

                    <p className="whitespace-pre-line text-sm leading-7 text-slate-600 dark:text-slate-300">
                      {
                        step.description
                      }
                    </p>
                  </div>
                </article>
              )
            )}
          </div>
        )}
      </div>
    </div>
  );
}
