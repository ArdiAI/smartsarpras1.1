import { useEffect, useState, useMemo } from 'react';
import { Calendar, Search, Loader2, MapPin, User, Filter, Table } from 'lucide-react';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import EmptyState from '../components/EmptyState';

interface Agenda {
  id: string;
  title: string;
  category: string | null;
  event_date: string;
  location: string | null;
  organizer: string | null;
  penyelenggara: string | null;
  organisasi_jurusan: string | null;
  penanggung_jawab: string | null;
  status: string | null;
  created_at: string;
}

interface Borrowing {
  id: string;
  borrower_name: string | null;
  borrower_class: string | null;
  borrow_date: string | null;
  status: string | null;
  purpose: string | null;
  item_type: string | null;
  current_status_label: string | null;
  created_at: string;
  borrowing_items: { item_name: string | null; item_type: string | null }[] | null;
}

interface RekapRow {
  id: string;
  tanggal: string;
  jenis: 'Agenda' | 'Peminjaman';
  namaKegiatan: string;
  organisasi: string;
  penanggungJawab: string;
  status: string;
  lokasi: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  returned: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  completed: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300',
  terjadwal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  berlangsung: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  selesai: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  dibatalkan: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function RekapPage() {
  const [rows, setRows] = useState<RekapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [jenisFilter, setJenisFilter] = useState('all');
  const [bulanFilter, setBulanFilter] = useState('all');
  const [tahunFilter, setTahunFilter] = useState('all');
  const [tanggalFilter, setTanggalFilter] = useState('');

  useEffect(() => {
    (async () => {
      const [ag, bor] = await Promise.all([
        supabase.from('agendas').select('*').order('event_date', { ascending: false }),
        supabase.from('borrowings').select('*, borrowing_items(item_name, item_type)').order('borrow_date', { ascending: false }),
      ]);

      const agendaRows: RekapRow[] = ((ag.data as unknown as Agenda[]) || []).map(a => ({
        id: a.id,
        tanggal: a.event_date,
        jenis: 'Agenda',
        namaKegiatan: a.title,
        organisasi: a.organisasi_jurusan || a.organizer || a.penyelenggara || '-',
        penanggungJawab: a.penanggung_jawab || '-',
        status: a.status || 'draft',
        lokasi: a.location || '-',
      }));

      const borrowingRows: RekapRow[] = ((bor.data as unknown as Borrowing[]) || []).map(b => {
        const items = b.borrowing_items || [];
        const itemName = items.length > 0 ? items.map(i => i.item_name || 'Item').join(', ') : b.purpose || 'Peminjaman';
        return {
          id: b.id,
          tanggal: b.borrow_date || b.created_at,
          jenis: 'Peminjaman' as const,
          namaKegiatan: b.purpose || itemName,
          organisasi: b.borrower_class || '-',
          penanggungJawab: b.borrower_name || '-',
          status: b.current_status_label || b.status || 'pending',
          lokasi: '-',
        };
      });

      const combined = [...agendaRows, ...borrowingRows].sort((a, b) => new Date(b.tanggal).getTime() - new Date(a.tanggal).getTime());
      setRows(combined);
      setLoading(false);
    })();
  }, []);

  const years = useMemo(() => {
    const ys = new Set(rows.map(r => new Date(r.tanggal).getFullYear().toString()));
    return Array.from(ys).sort((a, b) => Number(b) - Number(a));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (jenisFilter !== 'all' && r.jenis !== jenisFilter) return false;
      if (tanggalFilter && r.tanggal.slice(0, 10) !== tanggalFilter) return false;
      const d = new Date(r.tanggal);
      if (bulanFilter !== 'all' && (d.getMonth() + 1) !== Number(bulanFilter)) return false;
      if (tahunFilter !== 'all' && d.getFullYear().toString() !== tahunFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.namaKegiatan?.toLowerCase().includes(q) ||
          r.organisasi?.toLowerCase().includes(q) ||
          r.penanggungJawab?.toLowerCase().includes(q) ||
          r.lokasi?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, jenisFilter, bulanFilter, tahunFilter, tanggalFilter, search]);

  const clearFilters = () => {
    setJenisFilter('all'); setBulanFilter('all'); setTahunFilter('all'); setTanggalFilter(''); setSearch('');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900">
      <Navbar />
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Rekap Kegiatan</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">Gabungan agenda dan peminjaman dalam satu tabel (read-only)</p>
        </div>

        {/* Filters */}
        <div className="card p-4 mb-6 space-y-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Cari kegiatan, organisasi, atau penanggung jawab..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
              />
            </div>
            <select value={jenisFilter} onChange={e => setJenisFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
              <option value="all">Semua Jenis</option>
              <option value="Agenda">Agenda</option>
              <option value="Peminjaman">Peminjaman</option>
            </select>
            <input type="date" value={tanggalFilter} onChange={e => setTanggalFilter(e.target.value)}
              className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" />
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <select value={bulanFilter} onChange={e => setBulanFilter(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
              <option value="all">Semua Bulan</option>
              {monthNames.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={tahunFilter} onChange={e => setTahunFilter(e.target.value)}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none">
              <option value="all">Semua Tahun</option>
              {years.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <button onClick={clearFilters} className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center justify-center gap-1.5">
              <Filter className="w-4 h-4" /> Reset
            </button>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 text-blue-500 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={Table} title="Tidak ada data rekap" description="Coba ubah filter pencarian." />
        ) : (
          <>
            <div className="mb-3 text-sm text-slate-500 dark:text-slate-400">Menampilkan {filtered.length} dari {rows.length} catatan</div>
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-slate-700/40 text-left text-xs font-medium text-slate-500 dark:text-slate-300 uppercase tracking-wider">
                      <th className="px-4 py-3">Tanggal</th>
                      <th className="px-4 py-3">Jenis</th>
                      <th className="px-4 py-3">Nama Kegiatan</th>
                      <th className="px-4 py-3">Organisasi</th>
                      <th className="px-4 py-3">Penanggung Jawab</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Lokasi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {filtered.map(r => (
                      <tr key={`${r.jenis}-${r.id}`} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {new Date(r.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.jenis === 'Agenda' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' : 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300'}`}>
                            {r.jenis}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-900 dark:text-white font-medium max-w-xs">{r.namaKegiatan}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{r.organisasi}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          <div className="flex items-center gap-1.5"><User className="w-3.5 h-3.5 text-slate-400" />{r.penanggungJawab}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status] || 'bg-slate-100 text-slate-600 dark:bg-slate-700/40 dark:text-slate-300'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                          {r.lokasi !== '-' ? <div className="flex items-center gap-1.5"><MapPin className="w-3.5 h-3.5 text-slate-400" />{r.lokasi}</div> : '-'}
                        </td>
                      </tr>
                    ))}
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
