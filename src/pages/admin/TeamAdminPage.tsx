import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { cn } from '../../utils/cn';
import { Users, Plus, Pencil, Trash2, X, Loader2, ArrowUp, ArrowDown } from 'lucide-react';

interface TeamMember {
  id: string;
  name: string | null;
  position: string | null;
  role: string | null;
  photo_url: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  order: number | null;
  is_active: boolean | null;
}

const emptyForm = {
  name: '',
  position: '',
  role: '',
  photo_url: '',
  description: '',
  email: '',
  phone: '',
  order: '0',
  is_active: true,
};

export default function TeamAdminPage() {
  const { hasPermission } = useAuth();
  const canCreate = hasPermission('team', 'create');
  const canUpdate = hasPermission('team', 'update');
  const canDelete = hasPermission('team', 'delete');

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });

  const fetchMembers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('team_members')
        .select('id, name, position, role, photo_url, description, email, phone, order, is_active')
        .order('order', { ascending: true });
      if (error) {
        showToast('Gagal memuat tim', 'error');
        return;
      }
      setMembers((data ?? []) as unknown as TeamMember[]);
    } catch {
      showToast('Gagal memuat tim', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm, order: String(members.length) });
    setModalOpen(true);
  };

  const openEdit = (m: TeamMember) => {
    setEditingId(m.id);
    setForm({
      name: m.name ?? '',
      position: m.position ?? '',
      role: m.role ?? '',
      photo_url: m.photo_url ?? '',
      description: m.description ?? '',
      email: m.email ?? '',
      phone: m.phone ?? '',
      order: String(m.order ?? 0),
      is_active: m.is_active ?? true,
    });
    setModalOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      showToast('Nama wajib diisi', 'warning');
      return;
    }
    setSubmitting(true);
    const payload = {
      name: form.name,
      position: form.position || null,
      role: form.role || null,
      photo_url: form.photo_url || null,
      description: form.description || null,
      email: form.email || null,
      phone: form.phone || null,
      order: form.order ? parseInt(form.order, 10) : 0,
      is_active: form.is_active,
    };
    try {
      if (editingId) {
        const { error } = await supabase.from('team_members').update(payload).eq('id', editingId);
        if (error) { showToast('Gagal memperbarui: ' + error.message, 'error'); return; }
        showToast('Anggota tim berhasil diperbarui');
      } else {
        const { error } = await supabase.from('team_members').insert(payload);
        if (error) { showToast('Gagal menambahkan: ' + error.message, 'error'); return; }
        showToast('Anggota tim berhasil ditambahkan');
      }
      setModalOpen(false);
      await fetchMembers();
    } catch {
      showToast('Gagal menyimpan anggota tim', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus anggota tim ini?')) return;
    try {
      const { error } = await supabase.from('team_members').delete().eq('id', id);
      if (error) { showToast('Gagal menghapus', 'error'); return; }
      showToast('Anggota tim berhasil dihapus');
      await fetchMembers();
    } catch {
      showToast('Gagal menghapus', 'error');
    }
  };

  const toggleActive = async (m: TeamMember) => {
    try {
      const { error } = await supabase.from('team_members').update({ is_active: !m.is_active }).eq('id', m.id);
      if (error) { showToast('Gagal mengubah status', 'error'); return; }
      showToast('Status anggota tim diperbarui');
      await fetchMembers();
    } catch {
      showToast('Gagal mengubah status', 'error');
    }
  };

  return (
    <div className="pb-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Users className="h-6 w-6" /> Kelola Tim
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">CRUD anggota tim sarana prasarana.</p>
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
      ) : members.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Belum ada anggota tim.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map((m) => (
            <div key={m.id} className={cn('rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900', m.is_active ? 'border-slate-200 dark:border-slate-800' : 'border-slate-200 opacity-60 dark:border-slate-800')}>
              <div className="mb-3 flex items-start gap-3">
                {m.photo_url ? (
                  <img src={m.photo_url} alt={m.name ?? ''} className="h-16 w-16 rounded-full object-cover" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/40">
                    <span className="text-lg font-bold text-brand-600 dark:text-brand-400">{(m.name ?? '?').charAt(0).toUpperCase()}</span>
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-semibold text-slate-900 dark:text-white">{m.name ?? 'Tanpa Nama'}</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">{m.position ?? '-'}</p>
                  {m.role && <span className="mt-1 inline-block rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">{m.role}</span>}
                </div>
              </div>
              {m.description && <p className="mb-3 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{m.description}</p>}
              <div className="mb-3 space-y-0.5 text-xs text-slate-500 dark:text-slate-400">
                {m.email && <p>Email: {m.email}</p>}
                {m.phone && <p>Telp: {m.phone}</p>}
                <p>Urutan: {m.order ?? 0}</p>
              </div>
              <div className="flex items-center gap-2">
                {canUpdate && (
                  <>
                    <button onClick={() => openEdit(m)} className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">
                      <Pencil className="mr-1 inline h-4 w-4" /> Edit
                    </button>
                    <button onClick={() => toggleActive(m)} className={cn('rounded-lg border px-3 py-2 text-sm font-medium', m.is_active ? 'border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/20' : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20')}>
                      {m.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </>
                )}
                {canDelete && (
                  <button onClick={() => handleDelete(m.id)} className="rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
                    <Trash2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Anggota' : 'Tambah Anggota'}</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama *</label>
                <input name="name" value={form.name} onChange={handleChange} required className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Jabatan</label>
                <input name="position" value={form.position} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Peran</label>
                <input name="role" value={form.role} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">URL Foto</label>
                <input name="photo_url" value={form.photo_url} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
                <input name="email" type="email" value={form.email} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Telepon</label>
                <input name="phone" value={form.phone} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Urutan</label>
                <input name="order" type="number" value={form.order} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <input name="is_active" type="checkbox" checked={form.is_active} onChange={handleChange} className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500" />
                  Aktif
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Deskripsi</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={3} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div className="md:col-span-2 flex justify-end gap-3">
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
