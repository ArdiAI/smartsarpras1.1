import {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Search,
  RotateCcw,
  FileSpreadsheet,
  Mail,
  Phone,
} from 'lucide-react';

import * as XLSX from 'xlsx';

import {
  fetchTimelineEvents,
  colorCategoryStyles,
  type TimelineEvent,
} from '../lib/timeline';

import AnimatedBackground from '../components/AnimatedBackground';
import EmptyState from '../components/EmptyState';

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

const dayNames = [
  'Min',
  'Sen',
  'Sel',
  'Rab',
  'Kam',
  'Jum',
  'Sab',
];

export default function TimelinePage() {
  const today = new Date();

  const [year, setYear] = useState(
    today.getFullYear()
  );

  const [month, setMonth] = useState(
    today.getMonth()
  );

  const [events, setEvents] = useState<
    TimelineEvent[]
  >([]);

  const [loading, setLoading] =
    useState(true);

  const [
    selectedDate,
    setSelectedDate,
  ] = useState<string | null>(null);

  const [search, setSearch] =
    useState('');

  const [
    orgFilter,
    setOrgFilter,
  ] = useState('');

  // =========================================================
  // LOAD TIMELINE
  // =========================================================

  useEffect(() => {
    const loadTimeline = async () => {
      setLoading(true);

      try {
        const data =
          await fetchTimelineEvents(
            year,
            month
          );

        // Timeline sementara hanya menampilkan agenda
        const agendaOnly =
          data.filter(
            (event) =>
              event.jenis ===
              'Agenda'
          );

        setEvents(
          agendaOnly
        );
      } catch (error) {
        console.error(
          '[TimelinePage] Gagal mengambil timeline:',
          error
        );

        setEvents([]);
      } finally {
        setLoading(false);
      }
    };

    void loadTimeline();
  }, [year, month]);

  // =========================================================
  // FILTER
  // =========================================================

  const filteredEvents =
    useMemo(
      () =>
        events.filter(
          (event) => {
            const q =
              search
                .trim()
                .toLowerCase();

            const org =
              orgFilter
                .trim()
                .toLowerCase();

            const matchSearch =
              !q ||
              event.title
                .toLowerCase()
                .includes(q) ||
              (
                event.description ??
                ''
              )
                .toLowerCase()
                .includes(q) ||
              (
                event.penanggungJawab ??
                ''
              )
                .toLowerCase()
                .includes(q) ||
              (
                event.email ??
                ''
              )
                .toLowerCase()
                .includes(q) ||
              (
                event.contactPhone ??
                ''
              )
                .toLowerCase()
                .includes(q);

            const matchOrg =
              !org ||
              (
                event.organisasi ??
                ''
              )
                .toLowerCase()
                .includes(org);

            return (
              matchSearch &&
              matchOrg
            );
          }
        ),
      [
        events,
        search,
        orgFilter,
      ]
    );

  // =========================================================
  // GROUP BY DATE
  // =========================================================

  const eventsByDate =
    useMemo(() => {
      const map: Record<
        string,
        TimelineEvent[]
      > = {};

      filteredEvents.forEach(
        (event) => {
          if (
            !map[event.date]
          ) {
            map[event.date] =
              [];
          }

          map[event.date].push(
            event
          );
        }
      );

      return map;
    }, [filteredEvents]);

  // =========================================================
  // CALENDAR DATA
  // =========================================================

  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();

  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  const cells: (
    | number
    | null
  )[] = [
    ...Array(
      firstDay
    ).fill(null),

    ...Array.from(
      {
        length:
          daysInMonth,
      },
      (_, i) =>
        i + 1
    ),
  ];

  while (
    cells.length % 7 !==
    0
  ) {
    cells.push(null);
  }

  // =========================================================
  // MONTH NAVIGATION
  // =========================================================

  const prevMonth = () => {
    if (
      month ===
      0
    ) {
      setMonth(11);

      setYear(
        (current) =>
          current - 1
      );
    } else {
      setMonth(
        (current) =>
          current - 1
      );
    }

    setSelectedDate(
      null
    );
  };

  const nextMonth = () => {
    if (
      month ===
      11
    ) {
      setMonth(0);

      setYear(
        (current) =>
          current + 1
      );
    } else {
      setMonth(
        (current) =>
          current + 1
      );
    }

    setSelectedDate(
      null
    );
  };

  // =========================================================
  // RESET FILTER
  // =========================================================

  const resetFilters = () => {
    setSearch('');
    setOrgFilter('');
  };

  // =========================================================
  // EXPORT EXCEL
  // =========================================================

  const exportExcel = () => {
    if (
      filteredEvents.length ===
      0
    ) {
      return;
    }

    const rows =
      filteredEvents.map(
        (event) => ({
          Tanggal:
            event.date,

          Judul:
            event.title,

          'Waktu Mulai':
            event.startTime ??
            '',

          'Waktu Selesai':
            event.endTime ??
            '',

          Lokasi:
            event.location ??
            '',

          Organisasi:
            event.organisasi ??
            '',

          'Penanggung Jawab':
            event.penanggungJawab ??
            '',

          Email:
            event.email ??
            '',

          'No. HP':
            event.contactPhone ??
            '',

          Deskripsi:
            event.description ??
            '',
        })
      );

    const worksheet =
      XLSX.utils.json_to_sheet(
        rows
      );

    worksheet['!cols'] = [
      { wch: 12 },
      { wch: 32 },
      { wch: 12 },
      { wch: 12 },
      { wch: 22 },
      { wch: 24 },
      { wch: 24 },
      { wch: 30 },
      { wch: 18 },
      { wch: 40 },
    ];

    const workbook =
      XLSX.utils.book_new();

    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      'Agenda'
    );

    XLSX.writeFile(
      workbook,
      `Timeline-Agenda-${monthNames[month]}-${year}.xlsx`
    );
  };

  // =========================================================
  // DATE HELPER
  // =========================================================

  const pad = (
    n: number
  ) =>
    n
      .toString()
      .padStart(
        2,
        '0'
      );

  const dateStr = (
    day: number
  ) =>
    `${year}-${pad(
      month + 1
    )}-${pad(day)}`;

  const todayString =
    `${today.getFullYear()}-${pad(
      today.getMonth() +
        1
    )}-${pad(
      today.getDate()
    )}`;

  const selectedEvents =
    selectedDate
      ? eventsByDate[
          selectedDate
        ] ?? []
      : [];

  // =========================================================
  // RENDER
  // =========================================================

  return (
    <div className="relative pb-12">

      {/* HERO */}

      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">

        <AnimatedBackground />

        <div className="relative mx-auto max-w-7xl px-4 text-center">

          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">

            <CalendarRange className="h-7 w-7 text-white" />

          </div>

          <h1 className="text-3xl font-bold text-white">
            Timeline Kegiatan
          </h1>

          <p className="mt-2 text-sm text-white/80">
            Kalender agenda kegiatan sekolah
          </p>

        </div>

      </div>

      {/* CONTENT */}

      <div className="mx-auto max-w-7xl px-4 py-8">

        {/* FILTER */}

        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">

          <div className="flex flex-col gap-3 lg:flex-row">

            <div className="relative flex-1">

              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

              <input
                value={search}
                onChange={(e) =>
                  setSearch(
                    e.target.value
                  )
                }
                placeholder="Cari agenda, PJ, email, atau nomor HP..."
                className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

            </div>

            <div className="flex-1">

              <input
                value={
                  orgFilter
                }
                onChange={(e) =>
                  setOrgFilter(
                    e.target.value
                  )
                }
                placeholder="Cari organisasi..."
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              />

            </div>

            <button
              type="button"
              onClick={
                resetFilters
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >

              <RotateCcw className="h-4 w-4" />

              Reset

            </button>

            <button
              type="button"
              onClick={
                exportExcel
              }
              disabled={
                filteredEvents.length ===
                0
              }
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >

              <FileSpreadsheet className="h-4 w-4" />

              Unduh Excel

            </button>

          </div>

        </div>

        {/* CALENDAR + DETAIL */}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">

          {/* CALENDAR */}

          <div className="lg:col-span-2">

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">

              <div className="mb-4 flex items-center justify-between">

                <button
                  type="button"
                  onClick={
                    prevMonth
                  }
                  className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >

                  <ChevronLeft className="h-5 w-5" />

                </button>

                <h2 className="text-lg font-bold text-slate-900 dark:text-white">

                  {
                    monthNames[
                      month
                    ]
                  }{' '}

                  {year}

                </h2>

                <button
                  type="button"
                  onClick={
                    nextMonth
                  }
                  className="rounded-lg p-2 text-slate-600 transition hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >

                  <ChevronRight className="h-5 w-5" />

                </button>

              </div>

              <div className="grid grid-cols-7 gap-1">

                {dayNames.map(
                  (day) => (

                    <div
                      key={day}
                      className="py-2 text-center text-xs font-semibold text-slate-400"
                    >
                      {day}
                    </div>

                  )
                )}

                {cells.map(
                  (
                    day,
                    index
                  ) => {
                    if (
                      day ===
                      null
                    ) {
                      return (
                        <div
                          key={
                            index
                          }
                        />
                      );
                    }

                    const ds =
                      dateStr(day);

                    const dayEvents =
                      eventsByDate[
                        ds
                      ] ?? [];

                    const isToday =
                      ds ===
                      todayString;

                    const isSelected =
                      ds ===
                      selectedDate;

                    return (

                      <button
                        type="button"
                        key={
                          index
                        }
                        onClick={() =>
                          setSelectedDate(
                            ds
                          )
                        }
                        className={`min-h-[68px] rounded-lg border p-1.5 text-left transition ${
                          isSelected
                            ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30'
                            : 'border-slate-100 hover:border-brand-300 hover:bg-slate-50 dark:border-slate-800 dark:hover:border-brand-700 dark:hover:bg-slate-800/50'
                        } ${
                          isToday
                            ? 'ring-1 ring-brand-400'
                            : ''
                        }`}
                      >

                        <span
                          className={`text-xs font-medium ${
                            isToday
                              ? 'text-brand-600 dark:text-brand-400'
                              : 'text-slate-600 dark:text-slate-300'
                          }`}
                        >
                          {day}
                        </span>

                        <div className="mt-1 space-y-0.5">

                          {dayEvents
                            .slice(
                              0,
                              3
                            )
                            .map(
                              (event) => {
                                const style =
                                  colorCategoryStyles[
                                    event
                                      .colorCategory
                                  ];

                                return (

                                  <div
                                    key={
                                      event.id
                                    }
                                    className={`flex items-center gap-1 rounded px-1 py-0.5 ${style.bg}`}
                                  >

                                    <span
                                      className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`}
                                    />

                                    <span
                                      className={`truncate text-[10px] ${style.text}`}
                                    >
                                      {
                                        event.title
                                      }
                                    </span>

                                  </div>

                                );
                              }
                            )}

                          {dayEvents.length >
                            3 && (

                            <p className="px-1 text-[10px] text-slate-400">

                              +
                              {
                                dayEvents.length -
                                3
                              }{' '}
                              lainnya

                            </p>

                          )}

                        </div>

                      </button>

                    );
                  }
                )}

              </div>

            </div>

          </div>

          {/* DETAIL */}

          <div className="lg:col-span-1">

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">

              <h3 className="mb-3 font-bold text-slate-900 dark:text-white">

                {selectedDate
                  ? `Agenda ${new Date(
                      `${selectedDate}T00:00:00`
                    ).toLocaleDateString(
                      'id-ID',
                      {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric',
                      }
                    )}`
                  : 'Pilih Tanggal'}

              </h3>

              {loading ? (

                <div className="space-y-2">

                  {[1, 2, 3].map(
                    (i) => (

                      <div
                        key={i}
                        className="h-20 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800"
                      />

                    )
                  )}

                </div>

              ) : selectedEvents.length ===
                0 ? (

                <EmptyState
                  title="Tidak ada agenda"
                  description={
                    selectedDate
                      ? 'Tidak ada agenda pada tanggal ini.'
                      : 'Klik tanggal pada kalender untuk melihat agenda.'
                  }
                  className="py-6"
                />

              ) : (

                <div className="space-y-3">

                  {selectedEvents.map(
                    (event) => {
                      const style =
                        colorCategoryStyles[
                          event.colorCategory
                        ];

                      return (

                        <div
                          key={
                            event.id
                          }
                          className={`rounded-xl border border-transparent p-4 ${style.bg}`}
                        >

                          {/* BADGE */}

                          <div className="flex items-center gap-2">

                            <span
                              className={`h-2 w-2 rounded-full ${style.dot}`}
                            />

                            <span
                              className={`text-xs font-semibold ${style.text}`}
                            >
                              Agenda
                            </span>

                          </div>

                          {/* TITLE */}

                          <p className="mt-1.5 text-sm font-semibold text-slate-900 dark:text-white">

                            {
                              event.title
                            }

                          </p>

                          {/* INFORMATION */}

                          <div className="mt-3 space-y-1.5 text-xs text-slate-600 dark:text-slate-300">

                            {event.startTime && (

                              <p>
                                <span className="font-semibold">
                                  Waktu:
                                </span>{' '}

                                {
                                  event.startTime
                                }

                                {event.endTime
                                  ? ` - ${event.endTime}`
                                  : ''}
                              </p>

                            )}

                            {event.location && (

                              <p>
                                <span className="font-semibold">
                                  Lokasi:
                                </span>{' '}

                                {
                                  event.location
                                }
                              </p>

                            )}

                            {event.organisasi && (

                              <p>
                                <span className="font-semibold">
                                  Organisasi:
                                </span>{' '}

                                {
                                  event.organisasi
                                }
                              </p>

                            )}

                            {event.penanggungJawab && (

                              <p>
                                <span className="font-semibold">
                                  PJ:
                                </span>{' '}

                                {
                                  event.penanggungJawab
                                }
                              </p>

                            )}

                          </div>

                          {/* KONTAK */}

                          {(event.email ||
                            event.contactPhone) && (

                            <div className="mt-3 border-t border-slate-900/10 pt-3 dark:border-white/10">

                              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
                                Kontak
                              </p>

                              <div className="space-y-2">

                                {event.email && (

                                  <div className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">

                                    <Mail className="mt-0.5 h-3.5 w-3.5 shrink-0" />

                                    <span className="break-all">
                                      {
                                        event.email
                                      }
                                    </span>

                                  </div>

                                )}

                                {event.contactPhone && (

                                  <div className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">

                                    <Phone className="h-3.5 w-3.5 shrink-0" />

                                    <span>
                                      {
                                        event.contactPhone
                                      }
                                    </span>

                                  </div>

                                )}

                              </div>

                            </div>

                          )}

                          {/* DESCRIPTION */}

                          {event.description && (

                            <p className="mt-3 border-t border-slate-900/10 pt-3 text-xs leading-relaxed text-slate-600 dark:border-white/10 dark:text-slate-300">

                              {
                                event.description
                              }

                            </p>

                          )}

                        </div>

                      );
                    }
                  )}

                </div>

              )}

            </div>

          </div>

        </div>

      </div>

    </div>
  );
}