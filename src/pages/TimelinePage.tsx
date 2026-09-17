import { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight } from 'lucide-react';
import { fetchTimelineEvents, colorCategoryStyles, type TimelineEvent } from '../lib/timeline';
import AnimatedBackground from '../components/AnimatedBackground';
import EmptyState from '../components/EmptyState';

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

function privateLabel(event: TimelineEvent) {
  if (event.jenis === 'Agenda') return 'Dibooking';
  switch ((event.status ?? '').toLowerCase()) {
    case 'pending': return 'Dalam Pengajuan';
    case 'approved':
    case 'borrowed':
    case 'processing': return 'Dibooking';
    case 'returned':
    case 'completed': return 'Selesai';
    default: return 'Terisi';
  }
}

export default function TimelinePage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchTimelineEvents(year, month);
        setEvents(data.filter((event) => (event.status ?? '').toLowerCase() !== 'rejected'));
      } catch (error) {
        console.error('[TimelinePage] Gagal memuat timeline:', error);
        setEvents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, TimelineEvent[]> = {};
    for (const event of events) (map[event.date] ??= []).push(event);
    return map;
  }, [events]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = (day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;
  const todayString = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
  const selectedEvents = selectedDate ? eventsByDate[selectedDate] ?? [] : [];

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((v) => v - 1); } else setMonth((v) => v - 1);
    setSelectedDate(null);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((v) => v + 1); } else setMonth((v) => v + 1);
    setSelectedDate(null);
  };

  return (
    <div className="relative pb-12">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <AnimatedBackground />
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <CalendarRange className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Timeline Kegiatan</h1>
          <p className="mt-2 text-sm text-white/80">Kalender ketersediaan agenda dan peminjaman</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-4 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Timeline publik hanya menampilkan status keterisian. Nama kegiatan, jurusan/organisasi, penanggung jawab, kontak, dan deskripsi disembunyikan.
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <button type="button" onClick={prevMonth} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><ChevronLeft className="h-5 w-5" /></button>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{monthNames[month]} {year}</h2>
                <button type="button" onClick={nextMonth} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><ChevronRight className="h-5 w-5" /></button>
              </div>

              <div className="grid grid-cols-7 gap-1">
                {dayNames.map((day) => <div key={day} className="py-2 text-center text-xs font-semibold text-slate-400">{day}</div>)}
                {cells.map((day, index) => {
                  if (day === null) return <div key={index} />;
                  const ds = dateStr(day);
                  const dayEvents = eventsByDate[ds] ?? [];
                  const isToday = ds === todayString;
                  const isSelected = ds === selectedDate;
                  return (
                    <button type="button" key={index} onClick={() => setSelectedDate(ds)} className={`min-h-[68px] rounded-lg border p-1.5 text-left transition ${isSelected ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-100 hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-700'} ${isToday ? 'ring-1 ring-brand-400' : ''}`}>
                      <span className={`text-xs font-medium ${isToday ? 'text-brand-600 dark:text-brand-400' : 'text-slate-600 dark:text-slate-300'}`}>{day}</span>
                      <div className="mt-1 space-y-0.5">
                        {dayEvents.slice(0, 3).map((event) => {
                          const style = colorCategoryStyles[event.colorCategory];
                          return (
                            <div key={`${event.jenis}-${event.id}`} className={`flex items-center gap-1 rounded px-1 py-0.5 ${style.bg}`}>
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${style.dot}`} />
                              <span className={`truncate text-[10px] ${style.text}`}>{privateLabel(event)}</span>
                            </div>
                          );
                        })}
                        {dayEvents.length > 3 && <p className="px-1 text-[10px] text-slate-400">+{dayEvents.length - 3} lainnya</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div>
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 font-bold text-slate-900 dark:text-white">
                {selectedDate ? `Status ${new Date(`${selectedDate}T00:00:00`).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Pilih Tanggal'}
              </h3>
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>
              ) : selectedEvents.length === 0 ? (
                <EmptyState title="Tidak ada booking" description={selectedDate ? 'Tanggal ini belum terisi.' : 'Klik tanggal untuk melihat status keterisian.'} className="py-6" />
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((event) => {
                    const style = colorCategoryStyles[event.colorCategory];
                    return (
                      <div key={`${event.jenis}-${event.id}`} className={`rounded-xl p-3 ${style.bg}`}>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${style.dot}`} />
                          <span className={`text-sm font-semibold ${style.text}`}>{privateLabel(event)}</span>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                          {event.startTime && <span>{event.startTime}{event.endTime ? ` - ${event.endTime}` : ''}</span>}
                          {event.location && <span>· {event.location}</span>}
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
    </div>
  );
}
