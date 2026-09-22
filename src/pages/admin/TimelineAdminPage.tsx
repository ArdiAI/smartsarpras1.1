import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  CalendarRange,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Loader2,
  MapPin,
  Trash2,
  User,
} from 'lucide-react';

import {
  fetchTimelineEvents,
  colorCategoryStyles,
  type TimelineEvent,
  type EventColorCategory,
} from '../../lib/timeline';
import { getSessionToken } from '../../lib/appSession';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';
import { fetchPublicFeatures } from '../../lib/publicFeatures';

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3001';

export default function TimelineAdminPage() {
  const today = new Date();
  const { isSuperAdmin } = useAuth();

  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterJenis, setFilterJenis] = useState<'all' | 'Agenda' | 'Peminjaman'>('all');
  const [filterColor, setFilterColor] = useState<EventColorCategory | 'all'>('all');
  const [showAgenda, setShowAgenda] = useState(true);
  const [showBorrowings, setShowBorrowings] = useState(false);
  const [savingBorrowingVisibility, setSavingBorrowingVisibility] = useState(false);

  const loadEvents = async () => {
    setLoading(true);
    try {
      // Peminjaman hanya dimuat jika Super Admin menampilkannya.
      const includeBorrowings =
        isSuperAdmin && showBorrowings;

      const data = await fetchTimelineEvents(
        year,
        month,
        includeBorrowings
      );
      setEvents(data);
    } catch (error) {
      console.error('[TimelineAdminPage] load error:', error);
      showToast('Gagal memuat timeline', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadEvents();
  }, [year, month, isSuperAdmin, showBorrowings]);

  useEffect(() => {
    if (!isSuperAdmin) {
      setShowBorrowings(false);
      return;
    }

    let mounted = true;

    void fetchPublicFeatures()
      .then((features) => {
        if (mounted) {
          setShowBorrowings(
            features.borrowingEnabled
          );
        }
      })
      .catch((error) => {
        console.error(
          '[TimelineAdminPage] gagal memuat visibilitas peminjaman:',
          error
        );

        if (mounted) {
          setShowBorrowings(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [isSuperAdmin]);

  useEffect(() => {
    if (
      filterJenis === 'Peminjaman' &&
      (!isSuperAdmin || !showBorrowings)
    ) {
      setFilterJenis('all');
    }
  }, [filterJenis, isSuperAdmin, showBorrowings]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (event.jenis === 'Agenda' && !showAgenda) return false;
      if (
        event.jenis === 'Peminjaman' &&
        (!isSuperAdmin || !showBorrowings)
      ) return false;
      if (filterJenis !== 'all' && event.jenis !== filterJenis) return false;
      if (filterColor !== 'all' && event.colorCategory !== filterColor) return false;
      return true;
    });
  }, [
    events,
    filterJenis,
    filterColor,
    showAgenda,
    showBorrowings,
    isSuperAdmin,
  ]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, TimelineEvent[]> = {};
    filteredEvents.forEach((event) => {
      (map[event.date] ??= []).push(event);
    });
    return map;
  }, [filteredEvents]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const cells: (string | null)[] = Array(firstDay.getDay()).fill(null);

    for (let day = 1; day <= lastDay.getDate(); day++) {
      cells.push(
        `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      );
    }

    return cells;
  }, [year, month]);

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];

  const prevMonth = () => {
    if (month === 0) {
      setMonth(11);
      setYear((value) => value - 1);
    } else {
      setMonth((value) => value - 1);
    }
    setSelectedDate(null);
  };

  const nextMonth = () => {
    if (month === 11) {
      setMonth(0);
      setYear((value) => value + 1);
    } else {
      setMonth((value) => value + 1);
    }
    setSelectedDate(null);
  };

  const exportExcel = () => {
    if (filteredEvents.length === 0) {
      showToast('Tidak ada data timeline untuk diunduh', 'error');
      return;
    }

    const rows = filteredEvents.map((event, index) => ({
      No: index + 1,
      Jenis: event.jenis,
      Judul: event.title,
      'Tanggal Mulai': event.startDate ?? event.date,
      'Tanggal Selesai': event.endDate ?? '',
      'Jam Mulai': event.startTime ?? '',
      'Jam Selesai': event.endTime ?? '',
      Lokasi: event.location ?? '',
      'Organisasi/Jurusan': event.organisasi ?? '',
      'Penanggung Jawab': event.penanggungJawab ?? '',
      Email: event.email ?? '',
      Kontak: event.contactPhone ?? '',
      Status: colorCategoryStyles[event.colorCategory]?.label ?? event.status,
      Deskripsi: event.description ?? '',
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
      { wch: 5 },
      { wch: 14 },
      { wch: 34 },
      { wch: 16 },
      { wch: 16 },
      { wch: 12 },
      { wch: 12 },
      { wch: 24 },
      { wch: 24 },
      { wch: 24 },
      { wch: 28 },
      { wch: 18 },
      { wch: 16 },
      { wch: 45 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Timeline');
    XLSX.writeFile(
      workbook,
      `Timeline-${year}-${String(month + 1).padStart(2, '0')}.xlsx`
    );
  };

  const handleToggleBorrowings = async () => {
    if (
      !isSuperAdmin ||
      savingBorrowingVisibility
    ) {
      return;
    }

    setSavingBorrowingVisibility(
      true
    );

    try {
      const token =
        getSessionToken();

      if (!token) {
        throw new Error(
          'Sesi login tidak ditemukan. Silakan login kembali.'
        );
      }

      const nextValue =
        !showBorrowings;

      const response =
        await fetch(
          `${API_BASE_URL}/api/admin/public-features/borrowing`,
          {
            method: 'PATCH',
            headers: {
              Authorization:
                `Bearer ${token}`,
              'Content-Type':
                'application/json',
            },
            body:
              JSON.stringify({
                enabled:
                  nextValue,
              }),
          }
        );

      const result =
        (await response
          .json()
          .catch(() => null)) as
          | {
              ok?: boolean;
              data?: {
                borrowingEnabled?: boolean;
              };
              message?: string;
            }
          | null;

      if (
        !response.ok ||
        !result?.ok
      ) {
        throw new Error(
          result?.message ??
            'Gagal mengubah visibilitas peminjaman'
        );
      }

      const enabled =
        result.data
          ?.borrowingEnabled ===
        true;

      setShowBorrowings(
        enabled
      );

      showToast(
        enabled
          ? 'Peminjaman ditampilkan di area publik'
          : 'Peminjaman disembunyikan dari area publik',
        'success'
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal mengubah visibilitas peminjaman',
        'error'
      );
    } finally {
      setSavingBorrowingVisibility(
        false
      );
    }
  };


  const handleDelete = async (event: TimelineEvent) => {
    if (!isSuperAdmin || deletingId) return;

    const confirmed = window.confirm(
      `Hapus ${event.jenis.toLowerCase()} "${event.title}" dari timeline? Data aslinya juga akan terhapus.`
    );
    if (!confirmed) return;

    setDeletingId(event.id);

    try {
      const token =
        getSessionToken();

      if (!token) {
        throw new Error(
          'Sesi login tidak ditemukan. Silakan login kembali.'
        );
      }

      const path =
        event.jenis === 'Agenda'
          ? `/api/admin/agendas/${encodeURIComponent(event.id)}`
          : `/api/admin/borrowings/${encodeURIComponent(event.id)}`;

      const response = await fetch(`${API_BASE_URL}${path}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const result = await response.json().catch(() => null) as
        | { ok?: boolean; message?: string }
        | null;

      if (!response.ok || !result?.ok) {
        throw new Error(result?.message ?? 'Gagal menghapus data timeline');
      }

      showToast(
        event.jenis === 'Agenda'
          ? 'Agenda berhasil dihapus dari timeline'
          : 'Peminjaman berhasil dihapus dari timeline',
        'success'
      );

      setEvents((previous) =>
        previous.filter(
          (item) => !(item.id === event.id && item.jenis === event.jenis)
        )
      );
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Gagal menghapus data timeline',
        'error'
      );
    } finally {
      setDeletingId(null);
    }
  };

  const todayStr =
    `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const legendItems: EventColorCategory[] = [
    'agenda',
    'approved',
    'pending',
    'rejected',
    'borrowed',
    'returned',
  ];

  return (
    <div className="pb-6">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <CalendarRange className="h-6 w-6" /> Timeline
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kalender agenda dan peminjaman sarana prasarana.
          </p>
        </div>

        <button
          type="button"
          onClick={exportExcel}
          disabled={filteredEvents.length === 0}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <FileSpreadsheet className="h-4 w-4" />
          Unduh Excel ({filteredEvents.length})
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        {isSuperAdmin && (
          <>
        <button
          type="button"
          onClick={() => setShowAgenda((value) => !value)}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition',
            showAgenda
              ? 'border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/30 dark:text-blue-300'
              : 'border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
          )}
        >
          {showAgenda ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          Agenda {showAgenda ? 'Ditampilkan' : 'Disembunyikan'}
        </button>

        <button
          type="button"
          onClick={() => void handleToggleBorrowings()}
          disabled={savingBorrowingVisibility}
          className={cn(
            'inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60',
            showBorrowings
              ? 'border-purple-300 bg-purple-50 text-purple-700 dark:border-purple-800 dark:bg-purple-950/30 dark:text-purple-300'
              : 'border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400'
          )}
        >
          {showBorrowings ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          Peminjaman {showBorrowings ? 'Ditampilkan' : 'Disembunyikan'}
        </button>


          </>
        )}

        <select
          value={filterJenis}
          onChange={(event) =>
            setFilterJenis(event.target.value as 'all' | 'Agenda' | 'Peminjaman')
          }
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">Semua Jenis</option>
          <option value="Agenda">Agenda</option>
          {isSuperAdmin && showBorrowings && (
            <option value="Peminjaman">Peminjaman</option>
          )}
        </select>

        <select
          value={filterColor}
          onChange={(event) =>
            setFilterColor(event.target.value as EventColorCategory | 'all')
          }
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">Semua Status</option>
          {legendItems.map((category) => (
            <option key={category} value={category}>
              {colorCategoryStyles[category].label}
            </option>
          ))}
        </select>

        <div className="flex flex-wrap items-center gap-3">
          {legendItems.map((category) => (
            <div key={category} className="flex items-center gap-1.5">
              <span
                className={cn(
                  'h-2.5 w-2.5 rounded-full',
                  colorCategoryStyles[category].dot
                )}
              />
              <span className="text-xs text-slate-600 dark:text-slate-400">
                {colorCategoryStyles[category].label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {MONTHS[month]} {year}
              </h2>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={prevMonth}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={nextMonth}
                  className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              </div>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
              </div>
            ) : (
              <>
                <div className="mb-2 grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((dateStr, index) => {
                    if (!dateStr) {
                      return <div key={index} className="min-h-[80px] rounded-lg" />;
                    }

                    const dayEvents = eventsByDate[dateStr] ?? [];
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === selectedDate;

                    return (
                      <button
                        type="button"
                        key={index}
                        onClick={() => setSelectedDate(dateStr)}
                        className={cn(
                          'min-h-[80px] rounded-lg border p-1.5 text-left transition',
                          isSelected
                            ? 'border-brand-500 ring-2 ring-brand-500/20'
                            : 'border-slate-100 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700',
                          isToday &&
                            !isSelected &&
                            'border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/20'
                        )}
                      >
                        <div
                          className={cn(
                            'mb-1 text-xs font-medium',
                            isToday
                              ? 'text-brand-600 dark:text-brand-400'
                              : 'text-slate-600 dark:text-slate-400'
                          )}
                        >
                          {parseInt(dateStr.slice(-2), 10)}
                        </div>

                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 2).map((event) => {
                            const style = colorCategoryStyles[event.colorCategory];
                            return (
                              <div
                                key={`${event.jenis}-${event.id}`}
                                className={cn(
                                  'truncate rounded px-1 py-0.5 text-[10px] font-medium',
                                  style.bg,
                                  style.text
                                )}
                              >
                                {event.title}
                              </div>
                            );
                          })}
                          {dayEvents.length > 2 && (
                            <div className="text-[10px] text-slate-400">
                              +{dayEvents.length - 2} lainnya
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>

        <div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              {selectedDate ? `Detail: ${selectedDate}` : 'Pilih Tanggal'}
            </h2>

            {!selectedDate ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Klik tanggal pada kalender untuk melihat detail acara.
              </p>
            ) : selectedEvents.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Tidak ada acara pada tanggal ini.
              </p>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map((event) => {
                  const style = colorCategoryStyles[event.colorCategory];

                  return (
                    <div
                      key={`${event.jenis}-${event.id}`}
                      className={cn('rounded-xl border p-4', style.bg)}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className={cn('h-2.5 w-2.5 rounded-full', style.dot)} />
                          <span className={cn('text-xs font-semibold uppercase', style.text)}>
                            {event.jenis}
                          </span>
                        </div>

                        {isSuperAdmin && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(event)}
                            disabled={deletingId === event.id}
                            className="inline-flex items-center gap-1 rounded-lg bg-red-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                          >
                            {deletingId === event.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Hapus
                          </button>
                        )}
                      </div>

                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {event.title}
                      </h3>

                      <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                        {event.startTime && (
                          <p className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" />
                            {event.startTime}
                            {event.endTime ? ` - ${event.endTime}` : ''}
                          </p>
                        )}

                        {event.location && (
                          <p className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {event.location}
                          </p>
                        )}

                        {event.penanggungJawab && (
                          <p className="flex items-center gap-1.5">
                            <User className="h-3.5 w-3.5" />
                            {event.penanggungJawab}
                          </p>
                        )}

                        {event.organisasi && (
                          <p className="text-slate-500">{event.organisasi}</p>
                        )}

                        {event.description && (
                          <p className="mt-1 text-slate-500 dark:text-slate-400">
                            {event.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
