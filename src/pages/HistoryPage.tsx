import { useEffect, useState, useCallback } from 'react';
import { History, Search, Trash2, CalendarDays, Package, Building2, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { showToast } from '../components/Toast';
import AnimatedBackground from '../components/AnimatedBackground';
import EmptyState from '../components/EmptyState';

interface BorrowingItem { id: string; item_type: string; item_name: string; quantity: number; status: string; current_status_label: string | null; }
interface Borrowing {
  id: string; borrower_name: string; borrower_class: string | null; borrow_date: string; return_date: string | null;
  status: string; purpose: string | null; notes: string | null; item_type: string | null; created_at: string;
  borrowing_items: BorrowingItem[];
}
interface Agenda { id: string; title: string; event_date: string; end_date: string | null; location: string | null; organisasi_jurusan: string | null; status: string; jenis_kegiatan: string | null; }

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  returned: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
  completed: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
};

export default function HistoryPage() {
  const { hasPermission } = useAuth();
  const canDelete = hasPermission('history', 'delete');
  const [borrowings, setBorrowings] = useState<Borrowing[]>([]);
  const [agendas, setAgendas] = useState<Agenda[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [bor, age] = await Promise.all([
        supabase.from('borrowings').select('id, borrower_name, borrower_class, borrow_date, return_date, status, purpose, notes, item_type, created_at, borrowing_items(*)').order('created_at', { ascending: false }),
        supabase.from('agendas').select('id, title, event_date, end_date, location, organisasi_jurusan, status, jenis_kegiatan').order('event_date', { ascending: false }),
      ]);
      if (bor.error) throw bor.error;
      setBorrowings((bor.data as unknown as Borrowing[]) ?? []);
      setAgendas((age.data as unknown as Agenda[]) ?? []);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const filteredBorrowings = borrowings.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = !search || b.borrower_name.toLowerCase().includes(q) || (b.purpose ?? '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || b.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredAgendas = agendas.filter((a) => {
    const q = search.toLowerCase();
    return !search || a.title.toLowerCase().includes(q) || (a.organisasi_jurusan ?? '').toLowerCase().includes(q);
  });

  const handleDeleteBorrowing = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus data peminjaman ini?')) return;
    setDeleting(id);
    try {
      const { error: itemsError } = await supabase.from('borrowing_items').delete().eq('borrowing_id', id);
      if (itemsError) throw itemsError;
      const { error } = await supabase.from('borrowings').delete().eq('id', id);
      if (error) throw error;
      showToast('Data peminjaman dihapus', 'success');
      await fetchData();
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal menghapus', 'error');
    } finally {
      setDeleting(null);
    }
  };

  const handleDeleteAgenda = async (id: string) => {
    if (!window.confirm('Yakin ingin menghapus agenda ini?')) return;
    setDeleting(id);
    try {
      const { error } = await supabase.from('agendas').delete().eq('id', id);
      if (error) throw error;
      showToast('Agenda dihapus', 'success');
      await fetchData();
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal menghapus', 'error');
    } finally {
      setDeleting(null);
    }
  };

  return (
    <div className="relative pb-12">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <AnimatedBackground />
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <History className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Riwayat</h1>
          <p className="mt-2 text-sm text-white/80">Riwayat peminjaman dan agenda kegiatan</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Filters */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama / tujuan / agenda…" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="">Semua Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="returned">Returned</option>
          </select>
        </div>

        {/* Borrowing history */}
        <div className="mb-8">
          <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">Riwayat Peminjaman</h2>
          {loading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div>
          ) : filteredBorrowings.length === 0 ? (
            <EmptyState title="Tidak ada riwayat" description="Belum ada data peminjaman yang cocok." icon={<History className="h-8 w-8 text-slate-400" />} />
          ) : (
            <div className="space-y-3">
              {filteredBorrowings.map((b) => (
                <div key={b.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{b.borrower_name}</h3>
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusStyles[b.status] ?? statusStyles.pending}`}>{b.status}</span>
                      </div>
                      {b.borrower_class && <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{b.borrower_class}</p>}
                      {b.purpose && <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{b.purpose}</p>}
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>Pinjam: {b.borrow_date}</span>
                        {b.return_date && <span>Kembali: {b.return_date}</span>}
                      </div>
                      {b.borrowing_items && b.borrowing_items.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {b.borrowing_items.map((it) => (
                            <span key={it.id} className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                              {it.item_type === 'fasilitas' ? <Building2 className="h-3 w-3" /> : <Package className="h-3 w-3" />}
                              {it.item_name} ({it.quantity})
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    {canDelete && (
                      <button onClick={() => handleDeleteBorrowing(b.id)} disabled={deleting === b.id} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30">
                        {deleting === b.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Hapus
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Agenda history */}
        <div>
          <h2 className="mb-3 text-lg font-bold text-slate-900 dark:text-white">Riwayat Agenda</h2>
          {loading ? (
            <div className="space-y-3">{[1, 2].map((i) => <div key={i} className="h-20 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />)}</div>
          ) : filteredAgendas.length === 0 ? (
            <EmptyState title="Tidak ada agenda" description="Belum ada agenda yang cocok." icon={<CalendarDays className="h-8 w-8 text-slate-400" />} />
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {filteredAgendas.map((a) => (
                <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-slate-900 dark:text-white">{a.title}</h3>
                        <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${statusStyles[a.status] ?? 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>{a.status}</span>
                      </div>
                      {a.jenis_kegiatan && <span className="mt-1 inline-block rounded-md bg-brand-50 px-2 py-0.5 text-xs text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{a.jenis_kegiatan}</span>}
                      <div className="mt-2 flex flex-wrap gap-3 text-xs text-slate-500 dark:text-slate-400">
                        <span>{a.event_date}{a.end_date ? ` - ${a.end_date}` : ''}</span>
                        {a.location && <span>· {a.location}</span>}
                        {a.organisasi_jurusan && <span>· {a.organisasi_jurusan}</span>}
                      </div>
                    </div>
                    {canDelete && (
                      <button onClick={() => handleDeleteAgenda(a.id)} disabled={deleting === a.id} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-100 disabled:opacity-50 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/30">
                        {deleting === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />} Hapus
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
