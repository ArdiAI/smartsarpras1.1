import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';
import { FileText, Loader2, Search, X, Save, AlertTriangle, Trash2 } from 'lucide-react';

interface DamageReport {
  id: string;
  inventory_id: string | null;
  reporter_name: string | null;
  description: string | null;
  image_url: string | null;
  severity: string | null;
  status: string | null;
  resolution_notes: string | null;
  created_at: string | null;
  resolved_at: string | null;
  reporter_unit: string | null;
  reporter_email: string | null;
  reporter_phone: string | null;
  location: string | null;
}

const severityStyles: Record<string, string> = {
  low: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  medium: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  high: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const severityLabels: Record<string, string> = { low: 'Rendah', medium: 'Sedang', high: 'Tinggi' };

const statusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
};

const statusLabels: Record<string, string> = { pending: 'Menunggu', in_progress: 'Diproses', resolved: 'Selesai' };

export default function ReportsAdminPage() {
  const { hasPermission, isSuperAdmin } = useAuth();
  const canManage = hasPermission('reports', 'manage');
  const [deleteTarget, setDeleteTarget] = useState<DamageReport | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [reports, setReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSeverity, setFilterSeverity] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingReport, setEditingReport] = useState<DamageReport | null>(null);
  const [statusUpdate, setStatusUpdate] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchReports = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('damage_reports')
        .select('id, inventory_id, reporter_name, description, image_url, severity, status, resolution_notes, created_at, resolved_at, reporter_unit, reporter_email, reporter_phone, location')
        .order('created_at', { ascending: false });
      if (error) {
        showToast('Gagal memuat laporan', 'error');
        return;
      }
      setReports((data ?? []) as unknown as DamageReport[]);
    } catch {
      showToast('Gagal memuat laporan', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const filtered = reports.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = (r.reporter_name ?? '').toLowerCase().includes(q) || (r.description ?? '').toLowerCase().includes(q) || (r.location ?? '').toLowerCase().includes(q);
    const matchStatus = filterStatus === 'all' || r.status === filterStatus;
    const matchSeverity = filterSeverity === 'all' || r.severity === filterSeverity;
    return matchSearch && matchStatus && matchSeverity;
  });

  const openModal = (r: DamageReport) => {
    setEditingReport(r);
    setStatusUpdate(r.status ?? 'pending');
    setResolutionNotes(r.resolution_notes ?? '');
    setModalOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      if (deleteTarget.image_url) {
        try {
          const url = new URL(deleteTarget.image_url);
          const pathParts = url.pathname.split('/');
          const filePath = pathParts.slice(pathParts.indexOf('damage-reports') + 1).join('/');
          if (filePath) {
            await supabase.storage.from('damage-reports').remove([filePath]);
          }
        } catch { /* not a storage URL — skip */ }
      }
      const { error } = await supabase.from('damage_reports').delete().eq('id', deleteTarget.id);
      if (error) {
        showToast('Gagal menghapus laporan: ' + error.message, 'error');
        return;
      }
      showToast('Laporan berhasil dihapus.');
      setDeleteTarget(null);
      await fetchReports();
    } catch {
      showToast('Gagal menghapus laporan', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReport) return;
    setSubmitting(true);
    const payload: Record<string, unknown> = {
      status: statusUpdate,
      resolution_notes: resolutionNotes || null,
    };
    if (statusUpdate === 'resolved') {
      payload.resolved_at = new Date().toISOString();
    }
    try {
      const { error } = await supabase.from('damage_reports').update(payload).eq('id', editingReport.id);
      if (error) {
        showToast('Gagal memperbarui laporan: ' + error.message, 'error');
        return;
      }
      showToast('Laporan berhasil diperbarui');
      setModalOpen(false);
      await fetchReports();
    } catch {
      showToast('Gagal memperbarui laporan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="pb-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <FileText className="h-6 w-6" /> Laporan Kerusakan
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Kelola laporan kerusakan inventaris.</p>
      </div>

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari pelapor, deskripsi, lokasi..."
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <option value="all">Semua Status</option>
          <option value="pending">Menunggu</option>
          <option value="in_progress">Diproses</option>
          <option value="resolved">Selesai</option>
        </select>
        <select value={filterSeverity} onChange={(e) => setFilterSeverity(e.target.value)} className="rounded-xl border border-slate-300 px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
          <option value="all">Semua Tingkat</option>
          <option value="low">Rendah</option>
          <option value="medium">Sedang</option>
          <option value="high">Tinggi</option>
        </select>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Tidak ada laporan.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                {r.image_url ? (
                  <img src={r.image_url} alt="Bukti" className="h-24 w-24 shrink-0 rounded-xl object-cover" />
                ) : (
                  <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                    <AlertTriangle className="h-8 w-8 text-slate-400" />
                  </div>
                )}
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{r.reporter_name ?? 'Anonim'}</h3>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', severityStyles[r.severity ?? 'low'] ?? severityStyles.low)}>
                      {severityLabels[r.severity ?? 'low'] ?? r.severity}
                    </span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusStyles[r.status ?? 'pending'] ?? statusStyles.pending)}>
                      {statusLabels[r.status ?? 'pending'] ?? r.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">{r.description ?? '-'}</p>
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
                    <span>Lokasi: {r.location ?? '-'}</span>
                    <span>Unit: {r.reporter_unit ?? '-'}</span>
                    {r.reporter_email && <span>Email: {r.reporter_email}</span>}
                    {r.reporter_phone && <span>Telp: {r.reporter_phone}</span>}
                    <span>Tanggal: {r.created_at ? new Date(r.created_at).toLocaleDateString('id-ID') : '-'}</span>
                  </div>
                  {r.resolution_notes && (
                    <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800/50">
                      <p className="font-medium text-slate-700 dark:text-slate-300">Catatan Resolusi:</p>
                      <p className="text-slate-600 dark:text-slate-400">{r.resolution_notes}</p>
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 flex-col gap-2">
                  {canManage && (
                    <button onClick={() => openModal(r)} className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700">
                      Kelola
                    </button>
                  )}
                  {isSuperAdmin && (
                    <button onClick={() => setDeleteTarget(r)} className="flex items-center justify-center gap-1.5 rounded-xl border border-red-200 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
                      <Trash2 className="h-4 w-4" /> Hapus
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {modalOpen && editingReport && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Kelola Laporan</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 rounded-lg bg-slate-50 p-3 dark:bg-slate-800/50">
              <p className="text-sm text-slate-600 dark:text-slate-400">{editingReport.description ?? ''}</p>
              <p className="mt-1 text-xs text-slate-500">Pelapor: {editingReport.reporter_name ?? '-'}</p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                <select value={statusUpdate} onChange={(e) => setStatusUpdate(e.target.value)} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="pending">Menunggu</option>
                  <option value="in_progress">Diproses</option>
                  <option value="resolved">Selesai</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Catatan Resolusi</label>
                <textarea value={resolutionNotes} onChange={(e) => setResolutionNotes(e.target.value)} rows={4} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300">Batal</button>
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600" />
              </div>
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Hapus Laporan</h2>
            </div>
            <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
              Apakah Anda yakin ingin menghapus laporan ini? Tindakan ini tidak dapat dibatalkan.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteTarget(null)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300">Batal</button>
              <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50">
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {deleting ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
