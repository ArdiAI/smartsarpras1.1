import { useEffect, useState, useMemo } from 'react';
import { fetchTimelineEvents, colorCategoryStyles, colorCategoryFor, type TimelineEvent, type EventColorCategory } from '../../lib/timeline';
import { showToast } from '../../components/Toast';
import { ChevronLeft, ChevronRight, Loader2, CalendarRange, MapPin, Clock, User } from 'lucide-react';
import { cn } from '../../utils/cn';

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function TimelineAdminPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [filterJenis, setFilterJenis] = useState<'all' | 'Agenda' | 'Peminjaman'>('all');
  const [filterColor, setFilterColor] = useState<EventColorCategory | 'all'>('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchTimelineEvents(year, month);
        setEvents(data);
      } catch {
        showToast('Gagal memuat timeline', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, [year, month]);

  const filteredEvents = useMemo(() => {
    return events.filter((e) => {
      if (filterJenis !== 'all' && e.jenis !== filterJenis) return false;
      if (filterColor !== 'all' && e.colorCategory !== filterColor) return false;
      return true;
    });
  }, [events, filterJenis, filterColor]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, TimelineEvent[]> = {};
    filteredEvents.forEach((e) => {
      const key = e.date;
      if (!map[key]) map[key] = [];
      map[key].push(e);
    });
    return map;
  }, [filteredEvents]);

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startOffset = firstDay.getDay();
    const totalDays = lastDay.getDate();
    const cells: (string | null)[] = [];
    for (let i = 0; i < startOffset; i++) cells.push(null);
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push(dateStr);
    }
    return cells;
  }, [year, month]);

  const selectedEvents = selectedDate ? (eventsByDate[selectedDate] ?? []) : [];

  const prevMonth = () => {
    if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1);
  };
  const nextMonth = () => {
    if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1);
  };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const legendItems: EventColorCategory[] = ['agenda', 'approved', 'pending', 'rejected', 'borrowed', 'returned'];

  return (
    <div className="pb-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <CalendarRange className="h-6 w-6" /> Timeline
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Kalender agenda dan peminjaman sarana prasarana.</p>
      </div>

      {/* Filters & Legend */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          value={filterJenis}
          onChange={(e) => setFilterJenis(e.target.value as 'all' | 'Agenda' | 'Peminjaman')}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">Semua Jenis</option>
          <option value="Agenda">Agenda</option>
          <option value="Peminjaman">Peminjaman</option>
        </select>
        <select
          value={filterColor}
          onChange={(e) => setFilterColor(e.target.value as EventColorCategory | 'all')}
          className="rounded-xl border border-slate-300 px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="all">Semua Status</option>
          {legendItems.map((c) => (
            <option key={c} value={c}>{colorCategoryStyles[c].label}</option>
          ))}
        </select>
        <div className="flex flex-wrap items-center gap-3">
          {legendItems.map((c) => (
            <div key={c} className="flex items-center gap-1.5">
              <span className={cn('h-2.5 w-2.5 rounded-full', colorCategoryStyles[c].dot)} />
              <span className="text-xs text-slate-600 dark:text-slate-400">{colorCategoryStyles[c].label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Calendar */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{MONTHS[month]} {year}</h2>
              <div className="flex gap-2">
                <button onClick={prevMonth} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={nextMonth} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800">
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
                  {WEEKDAYS.map((d) => (
                    <div key={d} className="py-2 text-center text-xs font-semibold text-slate-500 dark:text-slate-400">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {calendarDays.map((dateStr, i) => {
                    if (!dateStr) return <div key={i} className="min-h-[80px] rounded-lg" />;
                    const dayEvents = eventsByDate[dateStr] ?? [];
                    const isToday = dateStr === todayStr;
                    const isSelected = dateStr === selectedDate;
                    return (
                      <button
                        key={i}
                        onClick={() => setSelectedDate(dateStr)}
                        className={cn(
                          'min-h-[80px] rounded-lg border p-1.5 text-left transition',
                          isSelected ? 'border-brand-500 ring-2 ring-brand-500/20' : 'border-slate-100 hover:border-slate-300 dark:border-slate-800 dark:hover:border-slate-700',
                          isToday && !isSelected && 'border-brand-300 bg-brand-50 dark:border-brand-700 dark:bg-brand-900/20'
                        )}
                      >
                        <div className={cn('mb-1 text-xs font-medium', isToday ? 'text-brand-600 dark:text-brand-400' : 'text-slate-600 dark:text-slate-400')}>
                          {parseInt(dateStr.slice(-2), 10)}
                        </div>
                        <div className="space-y-0.5">
                          {dayEvents.slice(0, 2).map((ev, idx) => {
                            const style = colorCategoryStyles[ev.colorCategory];
                            return (
                              <div key={idx} className={cn('truncate rounded px-1 py-0.5 text-[10px] font-medium', style.bg, style.text)}>
                                {ev.title}
                              </div>
                            );
                          })}
                          {dayEvents.length > 2 && (
                            <div className="text-[10px] text-slate-400">+{dayEvents.length - 2} lainnya</div>
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

        {/* Right Panel */}
        <div>
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-lg font-semibold text-slate-900 dark:text-white">
              {selectedDate ? `Detail: ${selectedDate}` : 'Pilih Tanggal'}
            </h2>
            {!selectedDate ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Klik tanggal pada kalender untuk melihat detail acara.</p>
            ) : selectedEvents.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Tidak ada acara pada tanggal ini.</p>
            ) : (
              <div className="space-y-3">
                {selectedEvents.map((ev) => {
                  const style = colorCategoryStyles[ev.colorCategory];
                  return (
                    <div key={ev.id} className={cn('rounded-xl border p-4', style.bg)}>
                      <div className="mb-2 flex items-center gap-2">
                        <span className={cn('h-2.5 w-2.5 rounded-full', style.dot)} />
                        <span className={cn('text-xs font-semibold uppercase', style.text)}>{ev.jenis}</span>
                      </div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{ev.title}</h3>
                      <div className="mt-2 space-y-1 text-xs text-slate-600 dark:text-slate-400">
                        {ev.startTime && (
                          <p className="flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> {ev.startTime}{ev.endTime ? ` - ${ev.endTime}` : ''}</p>
                        )}
                        {ev.location && (
                          <p className="flex items-center gap-1.5"><MapPin className="h-3.5 w-3.5" /> {ev.location}</p>
                        )}
                        {ev.penanggungJawab && (
                          <p className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" /> {ev.penanggungJawab}</p>
                        )}
                        {ev.organisasi && <p className="text-slate-500">{ev.organisasi}</p>}
                        {ev.description && <p className="mt-1 text-slate-500 dark:text-slate-400">{ev.description}</p>}
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
