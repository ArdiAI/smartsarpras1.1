import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';
import { MessageSquare, Loader2, Search, X, Send, Mail, Building2 } from 'lucide-react';

interface Aspirasi {
  id: string;
  nama: string | null;
  kelas_unit: string | null;
  email: string | null;
  kategori: string | null;
  judul: string | null;
  isi: string | null;
  status: string | null;
  tanggapan: string | null;
  created_at: string | null;
  updated_at: string | null;
}

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  in_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  responded: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const statusLabels: Record<string, string> = {
  pending: 'Menunggu',
  in_review: 'Ditinjau',
  responded: 'Direspons',
  resolved: 'Selesai',
};

const categoryLabels: Record<string, string> = {
  fasilitas: 'Fasilitas',
  inventaris: 'Inventaris',
  pelayanan: 'Pelayanan',
  lainnya: 'Lainnya',
};

export default function AspirasiAdminPage() {
  const { hasPermission } = useAuth();
  const canUpdate = hasPermission('aspirasi', 'update');

  const [aspirasi, setAspirasi] = useState<Aspirasi[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Aspirasi | null>(null);
  const [replyText, setReplyText] = useState('');
  const [statusUpdate, setStatusUpdate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAspirasi = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('aspirasi')
        .select('id, nama, kelas_unit, email, kategori, judul, isi, status, tanggapan, created_at, updated_at')
        .order('created_at', { ascending: false });
      if (error) {
        showToast('Gagal memuat aspirasi', 'error');
        return;
      }
      setAspirasi((data ?? []) as unknown as Aspirasi[]);
    } catch {
      showToast('Gagal memuat aspirasi', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAspirasi();
  }, []);

  const filtered = aspirasi.filter((a) => {
    const q = search.toLowerCase();
    const matchSearch = (a.nama ?? '').toLowerCase().includes(q) || (a.judul ?? '').toLowerCase().includes(q) || (a.isi ?? '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || a.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const openModal = (a: Aspirasi) => {
    setEditingItem(a);
    setReplyText(a.tanggapan ?? '');
    setStatusUpdate(a.status ?? 'pending');
    setModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('aspirasi')
        .update({
          tanggapan: replyText || null,
          status: statusUpdate,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingItem.id);
      if (error) {
        showToast('Gagal mengirim tanggapan: ' + error.message, 'error');
        return;
      }
      showToast('Tanggapan berhasil dikirim');
      setModalOpen(false);
      await fetchAspirasi();
    } catch {
      showToast('Gagal mengirim tanggapan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const quickStatusUpdate = async (a: Aspirasi, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('aspirasi')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', a.id);
      if (error) {
        showToast('Gagal mengubah status', 'error');
        return;
      }
      showToast('Status diperbarui');
      await fetchAspirasi();
    } catch {
      showToast('Gagal mengubah status', 'error');
    }
  };

  return (
    <div className="pb-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <MessageSquare className="h-6 w-6" /> Kelola Aspirasi
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Tinjau dan tanggapi aspirasi pengguna.</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, judul, isi..."
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <option value="all">Semua Status</option>
          <option value="pending">Menunggu</option>
          <option value="in_review">Ditinjau</option>
          <option value="responded">Direspons</option>
          <option value="resolved">Selesai</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Tidak ada aspirasi.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((a) => (
            <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{a.judul ?? 'Tanpa Judul'}</h3>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>Oleh: {a.nama ?? '-'}</span>
                    <span className="flex items-center gap-1"><Building2 className="h-3 w-3" /> {a.kelas_unit ?? '-'}</span>
                    {a.email && <span className="flex items-center gap-1"><Mail className="h-3 w-3" /> {a.email}</span>}
                    {a.kategori && <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{categoryLabels[a.kategori] ?? a.kategori}</span>}
                  </div>
                </div>
                <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusStyles[a.status ?? 'pending'] ?? statusStyles.pending)}>
                  {statusLabels[a.status ?? 'pending'] ?? a.status}
                </span>
              </div>
              <p className="mb-3 text-sm text-slate-600 dark:text-slate-400">{a.isi ?? '-'}</p>
              {a.tanggapan && (
                <div className="mb-3 rounded-lg bg-emerald-50 p-3 text-sm dark:bg-emerald-900/20">
                  <p className="font-medium text-emerald-700 dark:text-emerald-300">Tanggapan:</p>
                  <p className="text-emerald-600 dark:text-emerald-400">{a.tanggapan}</p>
                </div>
              )}
              <div className="flex flex-wrap items-center gap-2">
                {canUpdate && (
                  <>
                    <button onClick={() => openModal(a)} className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                      <Send className="h-4 w-4" /> Tanggapi
                    </button>
                    <select
                      value={a.status ?? 'pending'}
                      onChange={(e) => quickStatusUpdate(a, e.target.value)}
                      className="rounded-xl border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    >
                      <option value="pending">Menunggu</option>
                      <option value="in_review">Ditinjau</option>
                      <option value="responded">Direspons</option>
                      <option value="resolved">Selesai</option>
                    </select>
                  </>
                )}
                <span className="ml-auto text-xs text-slate-400">{a.created_at ? new Date(a.created_at).toLocaleDateString('id-ID') : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Reply Modal */}
      {modalOpen && editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tanggapi Aspirasi</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <p className="font-medium text-slate-900 dark:text-white">{editingItem.judul ?? ''}</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{editingItem.isi ?? ''}</p>
              <p className="mt-1 text-xs text-slate-500">Oleh: {editingItem.nama ?? '-'} ({editingItem.kelas_unit ?? '-'})</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                <select value={statusUpdate} onChange={(e) => setStatusUpdate(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="pending">Menunggu</option>
                  <option value="in_review">Ditinjau</option>
                  <option value="responded">Direspons</option>
                  <option value="resolved">Selesai</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tanggapan</label>
                <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)} rows={4} placeholder="Tulis tanggapan..." className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300">Batal</button>
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  {submitting ? 'Mengirim...' : 'Kirim'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
