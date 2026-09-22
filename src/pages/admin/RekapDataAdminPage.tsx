import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Loader2,
  Search,
  FileText,
  FileSpreadsheet,
  Calendar,
  Filter,
} from 'lucide-react';

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

import {
  showToast,
} from '../../components/Toast';

import {
  useAuth,
} from '../../context/AuthContext';


const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));


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
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',

    returned:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',

    rejected:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',

    completed:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',

    cancelled:
      'bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-300',

    draft:
      'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-300',

    terjadwal:
      'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',

    berlangsung:
      'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',

    selesai:
      'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',

    dibatalkan:
      'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  };


export default function RekapDataAdminPage() {
  const {
    session,
  } =
    useAuth();


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
    if (
      !session
        ?.access_token
    ) {
      setLoading(
        false
      );

      return;
    }


    let mounted =
      true;


    void (async () => {
      setLoading(
        true
      );


      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/admin/rekap-data`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
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
              'Gagal memuat rekap data'
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
          '[RekapDataAdminPage] load:',
          error
        );


        if (
          mounted
        ) {
          showToast(
            error instanceof
              Error
              ? error.message
              : 'Gagal memuat rekap data',
            'error'
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
  }, [
    session
      ?.access_token,
  ]);


  // =====================================================
  // YEAR OPTIONS
  // =====================================================

  const tahunOptions =
    useMemo(
      () => {
        const years =
          new Set<
            string
          >();


        rows.forEach(
          (
            row
          ) => {
            if (
              row.tanggal
            ) {
              years.add(
                new Date(
                  row.tanggal
                )
                  .getFullYear()
                  .toString()
              );
            }
          }
        );


        return Array
          .from(
            years
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
              row.tanggal !==
                tanggalFilter
            ) {
              return false;
            }


            if (
              bulanFilter !==
                'all' &&
              (
                new Date(
                  row.tanggal
                ).getMonth() +
                1
              ).toString() !==
                bulanFilter
            ) {
              return false;
            }


            if (
              tahunFilter !==
                'all' &&
              new Date(
                row.tanggal
              )
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
        tanggalFilter,
        bulanFilter,
        tahunFilter,
        search,
      ]
    );


  // =====================================================
  // EXPORT PDF
  // =====================================================

  const exportPDF =
    () => {
      const doc =
        new jsPDF({
          orientation:
            'landscape',
        });


      doc.setFontSize(
        14
      );


      doc.text(
        'Rekap Data - SMART SARPRAS',
        14,
        15
      );


      doc.setFontSize(
        10
      );


      doc.text(
        `Tanggal cetak: ${new Date().toLocaleString(
          'id-ID'
        )}`,
        14,
        22
      );


      autoTable(
        doc,
        {
          startY:
            28,

          head: [[
            'Tanggal',
            'Jenis',
            'Nama Kegiatan',
            'Organisasi',
            'Penanggung Jawab',
            'Status',
            'Lokasi',
          ]],

          body:
            filtered.map(
              (
                row
              ) => [
                row.tanggal,
                row.jenis,
                row.namaKegiatan,
                row.organisasi,
                row.penanggungJawab,
                row.status,
                row.lokasi,
              ]
            ),

          styles: {
            fontSize:
              8,
          },

          headStyles: {
            fillColor: [
              37,
              99,
              235,
            ],
          },
        }
      );


      doc.save(
        `rekap-data-${new Date()
          .toISOString()
          .slice(
            0,
            10
          )}.pdf`
      );


      showToast(
        'PDF berhasil diunduh',
        'success'
      );
    };


  // =====================================================
  // EXPORT EXCEL
  // =====================================================

  const exportExcel =
    () => {
      const data =
        filtered.map(
          (
            row
          ) => ({
            Tanggal:
              row.tanggal,

            Jenis:
              row.jenis,

            'Nama Kegiatan':
              row.namaKegiatan,

            Organisasi:
              row.organisasi,

            'Penanggung Jawab':
              row.penanggungJawab,

            Status:
              row.status,

            Lokasi:
              row.lokasi,
          })
        );


      const worksheet =
        XLSX.utils
          .json_to_sheet(
            data
          );


      const workbook =
        XLSX.utils
          .book_new();


      XLSX.utils
        .book_append_sheet(
          workbook,
          worksheet,
          'Rekap Data'
        );


      XLSX.writeFile(
        workbook,
        `rekap-data-${new Date()
          .toISOString()
          .slice(
            0,
            10
          )}.xlsx`
      );


      showToast(
        'Excel berhasil diunduh',
        'success'
      );
    };


  const bulanOptions = [
    {
      value:
        'all',
      label:
        'Semua Bulan',
    },

    {
      value:
        '1',
      label:
        'Januari',
    },

    {
      value:
        '2',
      label:
        'Februari',
    },

    {
      value:
        '3',
      label:
        'Maret',
    },

    {
      value:
        '4',
      label:
        'April',
    },

    {
      value:
        '5',
      label:
        'Mei',
    },

    {
      value:
        '6',
      label:
        'Juni',
    },

    {
      value:
        '7',
      label:
        'Juli',
    },

    {
      value:
        '8',
      label:
        'Agustus',
    },

    {
      value:
        '9',
      label:
        'September',
    },

    {
      value:
        '10',
      label:
        'Oktober',
    },

    {
      value:
        '11',
      label:
        'November',
    },

    {
      value:
        '12',
      label:
        'Desember',
    },
  ];


  return (
    <div className="space-y-6">

      <div className="flex flex-wrap items-center justify-between gap-3">

        <div>

          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Rekap Data
          </h1>


          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Gabungan data Peminjaman dan Agenda
          </p>

        </div>


        <div className="flex gap-2">

          <button
            onClick={
              exportPDF
            }

            className="flex items-center gap-2 rounded-xl bg-red-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-red-600"
          >

            <FileText className="h-4 w-4" />

            Export PDF

          </button>


          <button
            onClick={
              exportExcel
            }

            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2.5 font-medium text-white transition-colors hover:bg-emerald-600"
          >

            <FileSpreadsheet className="h-4 w-4" />

            Export Excel

          </button>

        </div>

      </div>


      <div className="card space-y-4 p-4">

        <div className="flex flex-col gap-3 lg:flex-row">

          <div className="relative flex-1">

            <Search className="absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />


            <input
              type="text"

              placeholder="Cari nama kegiatan, organisasi, PJ, lokasi..."

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

            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
          >

            {bulanOptions.map(
              (
                bulan
              ) => (
                <option
                  key={
                    bulan.value
                  }

                  value={
                    bulan.value
                  }
                >
                  {
                    bulan.label
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

            className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-800"
          >

            <option value="all">
              Semua Tahun
            </option>


            {tahunOptions.map(
              (
                tahun
              ) => (
                <option
                  key={
                    tahun
                  }

                  value={
                    tahun
                  }
                >
                  {
                    tahun
                  }
                </option>
              )
            )}

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


          {(jenisFilter !==
            'all' ||
            bulanFilter !==
              'all' ||
            tahunFilter !==
              'all' ||
            tanggalFilter ||
            search) && (
            <button
              onClick={() => {
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
              }}

              className="flex items-center gap-1.5 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >

              <Filter className="h-4 w-4" />

              Reset

            </button>
          )}

        </div>


        <div className="text-sm text-slate-500 dark:text-slate-400">
          Menampilkan{' '}
          {
            filtered.length
          }{' '}
          dari{' '}
          {
            rows.length
          }{' '}
          data
        </div>


        {loading ? (
          <div className="flex items-center justify-center py-16">

            <Loader2 className="h-8 w-8 animate-spin text-blue-500" />

          </div>
        ) : filtered.length ===
          0 ? (
          <div className="py-12 text-center">

            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 dark:bg-slate-700/50">

              <Calendar className="h-8 w-8 text-slate-300 dark:text-slate-500" />

            </div>


            <p className="font-medium text-slate-600 dark:text-slate-400">
              Tidak ada data
            </p>

          </div>
        ) : (
          <div className="overflow-x-auto">

            <table className="w-full text-sm">

              <thead>

                <tr className="border-b border-slate-200 dark:border-slate-700">

                  <th className="px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Tanggal
                  </th>

                  <th className="px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Jenis
                  </th>

                  <th className="px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Nama Kegiatan
                  </th>

                  <th className="px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Organisasi
                  </th>

                  <th className="px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Penanggung Jawab
                  </th>

                  <th className="px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Status
                  </th>

                  <th className="px-3 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">
                    Lokasi
                  </th>

                </tr>

              </thead>


              <tbody>

                {filtered.map(
                  (
                    row
                  ) => (
                    <tr
                      key={`${row.jenis}-${row.id}`}

                      className="border-b border-slate-100 hover:bg-slate-50 dark:border-slate-700/50 dark:hover:bg-slate-700/30"
                    >

                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {
                          row.tanggal
                        }
                      </td>


                      <td className="px-3 py-3">

                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            row.jenis ===
                            'Agenda'
                              ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'
                              : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                          }`}
                        >
                          {
                            row.jenis
                          }
                        </span>

                      </td>


                      <td className="px-3 py-3 text-slate-700 dark:text-slate-200">
                        {
                          row.namaKegiatan
                        }
                      </td>


                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {
                          row.organisasi
                        }
                      </td>


                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {
                          row.penanggungJawab
                        }
                      </td>


                      <td className="px-3 py-3">

                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            statusColors[
                              row.status
                            ] ||
                            statusColors.draft
                          }`}
                        >
                          {
                            row.status
                          }
                        </span>

                      </td>


                      <td className="px-3 py-3 text-slate-600 dark:text-slate-300">
                        {
                          row.lokasi
                        }
                      </td>

                    </tr>
                  )
                )}

              </tbody>

            </table>

          </div>
        )}

      </div>

    </div>
  );
}