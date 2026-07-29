import { useEffect, useState, useMemo } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Search, RotateCcw } from 'lucide-react';
import { fetchTimelineEvents, colorCategoryStyles, type TimelineEvent, type EventColorCategory } from '../lib/timeline';
import AnimatedBackground from '../components/AnimatedBackground';
import EmptyState from '../components/EmptyState';

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
const dayNames = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];

export default function TimelinePage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [jenisFilter, setJenisFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [orgFilter, setOrgFilter] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const data = await fetchTimelineEvents(year, month);
        setEvents(data);
      } catch {
        setEvents([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [year, month]);

  const filteredEvents = useMemo(() => events.filter((e) => {
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    if (jenisFilter && e.jenis !== jenisFilter) return false;
    if (statusFilter && e.status !== statusFilter) return false;
    if (orgFilter && !(e.organisasi ?? '').toLowerCase().includes(orgFilter.toLowerCase())) return false;
    return true;
  }), [events, search, jenisFilter, statusFilter, orgFilter]);

  const eventsByDate = useMemo(() => {
    const map: Record<string, TimelineEvent[]> = {};
    filteredEvents.forEach((e) => { (map[e.date] ??= []).push(e); });
    return map;
  }, [filteredEvents]);

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);

  const prevMonth = () => { if (month === 0) { setMonth(11); setYear((y) => y - 1); } else setMonth((m) => m - 1); };
  const nextMonth = () => { if (month === 11) { setMonth(0); setYear((y) => y + 1); } else setMonth((m) => m + 1); };
  const resetFilters = () => { setSearch(''); setJenisFilter(''); setStatusFilter(''); setOrgFilter(''); };

  const pad = (n: number) => n.toString().padStart(2, '0');
  const dateStr = (d: number) => `${year}-${pad(month + 1)}-${pad(d)}`;
  const selectedEvents = selectedDate ? eventsByDate[selectedDate] ?? [] : [];

  const legendCategories: EventColorCategory[] = ['agenda', 'approved', 'pending', 'rejected', 'borrowed', 'returned'];

  return (
    <div className="relative pb-12">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <AnimatedBackground />
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <CalendarRange className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Timeline Kegiatan</h1>
          <p className="mt-2 text-sm text-white/80">Kalender agenda dan peminjaman</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Filters */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari judul…" className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <select value={jenisFilter} onChange={(e) => setJenisFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Semua Jenis</option>
              <option value="Agenda">Agenda</option>
              <option value="Peminjaman">Peminjaman</option>
            </select>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
              <option value="">Semua Status</option>
              <option value="scheduled">Scheduled</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
              <option value="returned">Returned</option>
            </select>
            <input value={orgFilter} onChange={(e) => setOrgFilter(e.target.value)} placeholder="Organisasi…" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            <button onClick={resetFilters} className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
              <RotateCcw className="h-4 w-4" /> Reset
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Calendar */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <button onClick={prevMonth} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><ChevronLeft className="h-5 w-5" /></button>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">{monthNames[month]} {year}</h2>
                <button onClick={nextMonth} className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"><ChevronRight className="h-5 w-5" /></button>
              </div>
              <div className="grid grid-cols-7 gap-1">
                {dayNames.map((d) => <div key={d} className="py-2 text-center text-xs font-semibold text-slate-400">{d}</div>)}
                {cells.map((day, i) => {
                  if (day === null) return <div key={i} />;
                  const ds = dateStr(day);
                  const dayEvents = eventsByDate[ds] ?? [];
                  const isToday = ds === `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;
                  const isSelected = ds === selectedDate;
                  return (
                    <button key={i} onClick={() => setSelectedDate(ds)} className={`min-h-[64px] rounded-lg border p-1.5 text-left transition ${isSelected ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-100 hover:border-brand-300 dark:border-slate-800 dark:hover:border-brand-700'} ${isToday ? 'ring-1 ring-brand-400' : ''}`}>
                      <span className={`text-xs font-medium ${isToday ? 'text-brand-600 dark:text-brand-400' : 'text-slate-600 dark:text-slate-300'}`}>{day}</span>
                      <div className="mt-1 space-y-0.5">
                        {dayEvents.slice(0, 3).map((e) => {
                          const s = colorCategoryStyles[e.colorCategory];
                          return <div key={e.id} className={`flex items-center gap-1 rounded px-1 py-0.5 ${s.bg}`}><span className={`h-1.5 w-1.5 shrink-0 rounded-full ${s.dot}`} /><span className={`truncate text-[10px] ${s.text}`}>{e.title}</span></div>;
                        })}
                        {dayEvents.length > 3 && <p className="px-1 text-[10px] text-slate-400">+{dayEvents.length - 3} lainnya</p>}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Right panel: selected date events + legend */}
          <div className="lg:col-span-1">
            <div className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h3 className="mb-3 font-bold text-slate-900 dark:text-white">{selectedDate ? `Kegiatan ${new Date(selectedDate).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}` : 'Pilih Tanggal'}</h3>
              {loading ? (
                <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>
              ) : selectedEvents.length === 0 ? (
                <EmptyState title="Tidak ada kegiatan" description={selectedDate ? 'Tidak ada kegiatan pada tanggal ini.' : 'Klik tanggal pada kalender untuk melihat kegiatan.'} className="py-6" />
              ) : (
                <div className="space-y-2">
                  {selectedEvents.map((e) => {
                    const s = colorCategoryStyles[e.colorCategory];
                    return (
                      <div key={`${e.jenis}-${e.id}`} className={`rounded-xl border p-3 ${s.bg} border-transparent`}>
                        <div className="flex items-center gap-2">
                          <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                          <span className={`text-xs font-semibold ${s.text}`}>{s.label}</span>
                        </div>
                        <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{e.title}</p>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                          {e.startTime && <span>{e.startTime}{e.endTime ? ` - ${e.endTime}` : ''}</span>}
                          {e.location && <span>· {e.location}</span>}
                        </div>
                        {e.organisasi && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{e.organisasi}</p>}
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="mb-2 text-xs font-semibold text-slate-500 dark:text-slate-400">Legenda</p>
                <div className="flex flex-wrap gap-2">
                  {legendCategories.map((c) => {
                    const s = colorCategoryStyles[c];
                    return <span key={c} className={`inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${s.bg} ${s.text}`}><span className={`h-2 w-2 rounded-full ${s.dot}`} /> {s.label}</span>;
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
