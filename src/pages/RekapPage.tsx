import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Calendar,
  Search,
  Loader2,
  MapPin,
  User,
  Filter,
  Table,
} from 'lucide-react';

import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import EmptyState from '../components/EmptyState';
import { authFetch } from '../lib/authFetch';


const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';


interface RekapRow {
  id: string;
  tanggal: string;

  jenis:
    | 'Agenda'
    | 'Peminjaman';

  namaKegiatan: string;
  organisasi: string;
  penanggungJawab: string;
  status: string;
  lokasi: string;
}


interface ApiResponse {
  ok: boolean;

  data?:
    RekapRow[];

  message?: string;
}


const statusColors:
  Record<
    string,
    string
  > = {
    pending:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',

    approved:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',

    returned:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',

    rejected:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',

    completed:
      'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',

    cancelled:
      'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',

    draft:
      'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',

    terjadwal:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',

    berlangsung:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',

    selesai:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',

    dibatalkan:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };


const monthNames = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];


export default function RekapPage() {
  const [
    rows,
    setRows,
  ] =
    useState<
      RekapRow[]
    >([]);


  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );


  const [
    search,
    setSearch,
  ] =
    useState('');


  const [
    jenisFilter,
    setJenisFilter,
  ] =
    useState(
      'all'
    );


  const [
    bulanFilter,
    setBulanFilter,
  ] =
    useState(
      'all'
    );


  const [
    tahunFilter,
    setTahunFilter,
  ] =
    useState(
      'all'
    );


  const [
    tanggalFilter,
    setTanggalFilter,
  ] =
    useState('');


  // =====================================================
  // LOAD
  // =====================================================

  useEffect(() => {
    let mounted =
      true;


    void (async () => {
      setLoading(
        true
      );


      try {
        const response =
          await authFetch(
            `${API_BASE_URL}/api/rekap`
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
              'Gagal memuat rekap kegiatan'
          );
        }


        if (
          mounted
        ) {
          setRows(
            result.data ??
              []
          );
        }
      } catch (error) {
        console.error(
          '[RekapPage] load:',
          error
        );


        if (
          mounted
        ) {
          setRows(
            []
          );
        }
      } finally {
        if (
          mounted
        ) {
          setLoading(
            false
          );
        }
      }
    })();


    return () => {
      mounted =
        false;
    };
  }, []);


  // =====================================================
  // YEAR OPTIONS
  // =====================================================

  const years =
    useMemo(
      () => {
        const values =
          new Set(
            rows
              .filter(
                (
                  row
                ) =>
                  Boolean(
                    row.tanggal
                  )
              )
              .map(
                (
                  row
                ) =>
                  new Date(
                    row.tanggal
                  )
                    .getFullYear()
                    .toString()
              )
          );


        return Array
          .from(
            values
          )
          .sort(
            (
              first,
              second
            ) =>
              Number(
                second
              ) -
              Number(
                first
              )
          );
      },
      [
        rows,
      ]
    );


  // =====================================================
  // FILTER
  // =====================================================

  const filtered =
    useMemo(
      () => {
        return rows.filter(
          (
            row
          ) => {
            if (
              jenisFilter !==
                'all' &&
              row.jenis !==
                jenisFilter
            ) {
              return false;
            }


            if (
              tanggalFilter &&
              row.tanggal
                .slice(
                  0,
                  10
                ) !==
                tanggalFilter
            ) {
              return false;
            }


            const date =
              new Date(
                row.tanggal
              );


            if (
              bulanFilter !==
                'all' &&
              date.getMonth() +
                1 !==
                Number(
                  bulanFilter
                )
            ) {
              return false;
            }


            if (
              tahunFilter !==
                'all' &&
              date
                .getFullYear()
                .toString() !==
                tahunFilter
            ) {
              return false;
            }


            if (
              search
            ) {
              const query =
                search
                  .toLowerCase();


              return (
                row
                  .namaKegiatan
                  ?.toLowerCase()
                  .includes(
                    query
                  ) ||

                row
                  .organisasi
                  ?.toLowerCase()
                  .includes(
                    query
                  ) ||

                row
                  .penanggungJawab
                  ?.toLowerCase()
                  .includes(
                    query
                  ) ||

                row
                  .lokasi
                  ?.toLowerCase()
                  .includes(
                    query
                  )
              );
            }


            return true;
          }
        );
      },
      [
        rows,
        jenisFilter,
        bulanFilter,
        tahunFilter,
        tanggalFilter,
        search,
      ]
    );


  const clearFilters =
    () => {
      setJenisFilter(
        'all'
      );

      setBulanFilter(
        'all'
      );

      setTahunFilter(
        'all'
      );

      setTanggalFilter(
        ''
      );

      setSearch(
        ''
      );
    };


  return (
    <div className="flex min-h-screen flex-col bg-slate-50 dark:bg-slate-900">

      <Navbar />


      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">

        <div className="mb-8">

          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Rekap Kegiatan
          </h1>


          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Gabungan agenda dan peminjaman dalam satu tabel (read-only)
          </p>

        </div>


        {/* FILTER */}
        <div className="card mb-6 space-y-3 p-4">

          <div className="flex flex-col gap-3 sm:flex-row">

            <div className="relative flex-1">

              <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />


              <input
                type="text"

                placeholder="Cari kegiatan, organisasi, atau penanggung jawab..."

                value={
                  search
                }

                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }

                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-11 pr-4 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
              />

            </div>


            <select
              value={
                jenisFilter
              }

              onChange={(
                event
              ) =>
                setJenisFilter(
                  event.target.value
                )
              }

              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
            >

              <option value="all">
                Semua Jenis
              </option>

              <option value="Agenda">
                Agenda
              </option>

              <option value="Peminjaman">
                Peminjaman
              </option>

            </select>


            <input
              type="date"

              value={
                tanggalFilter
              }

              onChange={(
                event
              ) =>
                setTanggalFilter(
                  event.target.value
                )
              }

              className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
            />

          </div>


          <div className="flex flex-col gap-3 sm:flex-row">

            <select
              value={
                bulanFilter
              }

              onChange={(
                event
              ) =>
                setBulanFilter(
                  event.target.value
                )
              }

              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
            >

              <option value="all">
                Semua Bulan
              </option>


              {monthNames.map(
                (
                  month,
                  index
                ) => (
                  <option
                    key={
                      index
                    }

                    value={
                      index +
                      1
                    }
                  >
                    {
                      month
                    }
                  </option>
                )
              )}

            </select>


            <select
              value={
                tahunFilter
              }

              onChange={(
                event
              ) =>
                setTahunFilter(
                  event.target.value
                )
              }

              className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
            >

              <option value="all">
                Semua Tahun
              </option>


              {years.map(
                (
                  year
                ) => (
                  <option
                    key={
                      year
                    }

                    value={
                      year
                    }
                  >
                    {
                      year
                    }
                  </option>
                )
              )}

            </select>


            <button
              onClick={
                clearFilters
              }

              className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
            >

              <Filter className="h-4 w-4" />

              Reset

            </button>

          </div>

        </div>


        {/* TABLE */}
        {loading ? (
          <div className="flex items-center justify-center py-20">

            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />

          </div>
        ) : filtered.length ===
          0 ? (
          <EmptyState
            icon={
              Table
            }

            title="Tidak ada data rekap"

            description="Coba ubah filter pencarian."
          />
        ) : (
          <>

            <div className="mb-3 text-sm text-slate-500 dark:text-slate-400">
              Menampilkan{' '}
              {
                filtered.length
              }{' '}
              dari{' '}
              {
                rows.length
              }{' '}
              catatan
            </div>


            <div className="card overflow-hidden">

              <div className="overflow-x-auto">

                <table className="w-full text-sm">

                  <thead>

                    <tr className="bg-slate-50 text-left text-xs font-medium uppercase tracking-wider text-slate-500 dark:bg-slate-700/40 dark:text-slate-300">

                      <th className="px-4 py-3">
                        Tanggal
                      </th>

                      <th className="px-4 py-3">
                        Jenis
                      </th>

                      <th className="px-4 py-3">
                        Nama Kegiatan
                      </th>

                      <th className="px-4 py-3">
                        Organisasi
                      </th>

                      <th className="px-4 py-3">
                        Penanggung Jawab
                      </th>

                      <th className="px-4 py-3">
                        Status
                      </th>

                      <th className="px-4 py-3">
                        Lokasi
                      </th>

                    </tr>

                  </thead>


                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">

                    {filtered.map(
                      (
                        row
                      ) => (
                        <tr
                          key={`${row.jenis}-${row.id}`}

                          className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-700/30"
                        >

                          <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">

                            <div className="flex items-center gap-1.5">

                              <Calendar className="h-3.5 w-3.5 text-slate-400" />


                              {new Date(
                                row.tanggal
                              ).toLocaleDateString(
                                'id-ID',
                                {
                                  day:
                                    'numeric',

                                  month:
                                    'short',

                                  year:
                                    'numeric',
                                }
                              )}

                            </div>

                          </td>


                          <td className="px-4 py-3">

                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                row.jenis ===
                                'Agenda'
                                  ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                  : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                              }`}
                            >
                              {
                                row.jenis
                              }
                            </span>

                          </td>


                          <td className="max-w-xs px-4 py-3 font-medium text-slate-900 dark:text-white">
                            {
                              row.namaKegiatan
                            }
                          </td>


                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                            {
                              row.organisasi
                            }
                          </td>


                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">

                            <div className="flex items-center gap-1.5">

                              <User className="h-3.5 w-3.5 text-slate-400" />

                              {
                                row.penanggungJawab
                              }

                            </div>

                          </td>


                          <td className="px-4 py-3">

                            <span
                              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                                statusColors[
                                  row.status
                                ] ||
                                'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300'
                              }`}
                            >
                              {
                                row.status
                              }
                            </span>

                          </td>


                          <td className="px-4 py-3 text-slate-600 dark:text-slate-300">

                            {row.lokasi !==
                            '-' ? (
                              <div className="flex items-center gap-1.5">

                                <MapPin className="h-3.5 w-3.5 text-slate-400" />

                                {
                                  row.lokasi
                                }

                              </div>
                            ) : (
                              '-'
                            )}

                          </td>

                        </tr>
                      )
                    )}

                  </tbody>

                </table>

              </div>

            </div>

          </>
        )}

      </main>


      <Footer />

    </div>
  );
}