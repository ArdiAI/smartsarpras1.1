import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auditLog';
import { cn } from '../../utils/cn';
import { Megaphone, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';

interface Announcement {
  id: string;
  title: string | null;
  description: string | null;
  priority: string | null;
  status: string | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  author: string | null;
}

const emptyForm = {
  title: '',
  description: '',
  priority: 'normal',
  status: 'draft',
  author: '',
};

const priorityStyles: Record<string, string> = {
  low: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
  normal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  high: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  urgent: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const priorityLabels: Record<string, string> = { low: 'Rendah', normal: 'Normal', high: 'Tinggi', urgent: 'Mendesak' };

const statusStyles: Record<string, string> = {
  draft: 'bg-slate-100 text-slate-700 dark:bg-slate-700/40 dark:text-slate-300',
  published: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  archived: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
};

const statusLabels: Record<string, string> = { draft: 'Draf', published: 'Dipublikasi', archived: 'Diarsipkan' };

export default function AnnouncementsAdminPage() {
  const { hasPermission, adminProfile, userRoleNames } = useAuth();
  const canCreate = hasPermission('announcements', 'create');
  const canUpdate = hasPermission('announcements', 'update');
  const canDelete = hasPermission('announcements', 'delete');

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('id, title, description, priority, status, published_at, created_at, updated_at, author')
        .order('created_at', { ascending: false });
      if (error) {
        showToast('Gagal memuat pengumuman', 'error');
        return;
      }
      setAnnouncements((data ?? []) as unknown as Announcement[]);
    } catch {
      showToast('Gagal memuat pengumuman', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setModalOpen(true);
  };

  const openEdit = (a: Announcement) => {
    setEditingId(a.id);
    setForm({
      title: a.title ?? '',
      description: a.description ?? '',
      priority: a.priority ?? 'normal',
      status: a.status ?? 'draft',
      author: a.author ?? '',
    });
    setModalOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) {
      showToast('Judul wajib diisi', 'warning');
      return;
    }
    setSubmitting(true);
    const payload = {
      title: form.title,
      description: form.description || null,
      priority: form.priority,
      status: form.status,
      author: form.author || null,
      published_at: form.status === 'published' ? new Date().toISOString() : null,
    };
    try {
      if (editingId) {
        const { error } = await supabase.from('announcements').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId);
        if (error) { showToast('Gagal memperbarui: ' + error.message, 'error'); return; }
        showToast('Pengumuman berhasil diperbarui');
        await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'UPDATE', module: 'Announcements', description: `${adminProfile?.name ?? 'Admin'} memperbarui pengumuman ${form.title}` });
      } else {
        const { error } = await supabase.from('announcements').insert(payload);
        if (error) { showToast('Gagal menambahkan: ' + error.message, 'error'); return; }
        showToast('Pengumuman berhasil ditambahkan');
        await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'CREATE', module: 'Announcements', description: `${adminProfile?.name ?? 'Admin'} menambah pengumuman ${form.title}` });
      }
      setModalOpen(false);
      await fetchAnnouncements();
    } catch {
      showToast('Gagal menyimpan pengumuman', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus pengumuman ini?')) return;
    try {
      const { error } = await supabase.from('announcements').delete().eq('id', id);
      if (error) { showToast('Gagal menghapus', 'error'); return; }
      showToast('Pengumuman berhasil dihapus');
      await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'DELETE', module: 'Announcements', description: `${adminProfile?.name ?? 'Admin'} menghapus pengumuman ${id}` });
      await fetchAnnouncements();
    } catch {
      showToast('Gagal menghapus', 'error');
    }
  };

  return (
    <div className="pb-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Megaphone className="h-6 w-6" /> Kelola Pengumuman
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">CRUD pengumuman sarana prasarana.</p>
        </div>
        {canCreate && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Tambah
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : announcements.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Belum ada pengumuman.
        </div>
      ) : (
        <div className="space-y-4">
          {announcements.map((a) => (
            <div key={a.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1">
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{a.title ?? 'Tanpa Judul'}</h3>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', priorityStyles[a.priority ?? 'normal'] ?? priorityStyles.normal)}>
                      {priorityLabels[a.priority ?? 'normal'] ?? a.priority}
                    </span>
                    <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', statusStyles[a.status ?? 'draft'] ?? statusStyles.draft)}>
                      {statusLabels[a.status ?? 'draft'] ?? a.status}
                    </span>
                  </div>
                  {a.description && <p className="text-sm text-slate-600 dark:text-slate-400">{a.description}</p>}
                  <div className="mt-2 flex flex-wrap gap-x-4 text-xs text-slate-500 dark:text-slate-400">
                    {a.author && <span>Oleh: {a.author}</span>}
                    {a.published_at && <span>Dipublikasi: {new Date(a.published_at).toLocaleDateString('id-ID')}</span>}
                    <span>Dibuat: {a.created_at ? new Date(a.created_at).toLocaleDateString('id-ID') : '-'}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  {canUpdate && (
                    <button onClick={() => openEdit(a)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                      <Pencil className="h-4 w-4" />
                    </button>
                  )}
                  {canDelete && (
                    <button onClick={() => handleDelete(a.id)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Pengumuman' : 'Tambah Pengumuman'}</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Judul *</label>
                <input name="title" value={form.title} onChange={handleChange} required className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Deskripsi</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={4} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Prioritas</label>
                  <select name="priority" value={form.priority} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                    <option value="low">Rendah</option>
                    <option value="normal">Normal</option>
                    <option value="high">Tinggi</option>
                    <option value="urgent">Mendesak</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Status</label>
                  <select name="status" value={form.status} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                    <option value="draft">Draf</option>
                    <option value="published">Dipublikasi</option>
                    <option value="archived">Diarsipkan</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Penulis</label>
                  <input name="author" value={form.author} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300">Batal</button>
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
