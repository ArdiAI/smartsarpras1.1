import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auditLog';
import { cn } from '../../utils/cn';
import { School, Plus, Pencil, Trash2, X, Loader2 } from 'lucide-react';

interface MasterKelas {
  id: string;
  nama: string;
  is_active: boolean;
  created_at: string;
}

export default function MasterKelasPage() {
  const { hasPermission, isSuperAdmin, adminProfile, userRoleNames } = useAuth();
  const canManage = hasPermission('master_data', 'manage') || isSuperAdmin;

  const [items, setItems] = useState<MasterKelas[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [nama, setNama] = useState('');

  const fetch = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.from('master_kelas').select('*').order('nama', { ascending: true });
      if (error) throw error;
      setItems((data ?? []) as unknown as MasterKelas[]);
    } catch {
      showToast('Gagal memuat master kelas', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const openCreate = () => { setEditingId(null); setNama(''); setModalOpen(true); };
  const openEdit = (i: MasterKelas) => { setEditingId(i.id); setNama(i.nama); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nama.trim()) { showToast('Nama kelas wajib diisi', 'warning'); return; }
    setSubmitting(true);
    try {
      if (editingId) {
        const { error } = await supabase.from('master_kelas').update({ nama: nama.trim(), updated_at: new Date().toISOString() }).eq('id', editingId);
        if (error) throw error;
        showToast('Kelas berhasil diperbarui', 'success');
        await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'UPDATE', module: 'Master Data', description: `${adminProfile?.name ?? 'Admin'} memperbarui kelas ${nama}` });
      } else {
        const { error } = await supabase.from('master_kelas').insert({ nama: nama.trim() });
        if (error) throw error;
        showToast('Kelas berhasil ditambahkan', 'success');
        await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'CREATE', module: 'Master Data', description: `${adminProfile?.name ?? 'Admin'} menambah kelas ${nama}` });
      }
      setModalOpen(false);
      await fetch();
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal menyimpan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string, nama: string) => {
    if (!window.confirm(`Yakin ingin menghapus kelas "${nama}"?`)) return;
    try {
      const { error } = await supabase.from('master_kelas').delete().eq('id', id);
      if (error) throw error;
      showToast('Kelas berhasil dihapus', 'success');
      await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'DELETE', module: 'Master Data', description: `${adminProfile?.name ?? 'Admin'} menghapus kelas ${nama}` });
      await fetch();
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal menghapus', 'error');
    }
  };

  const toggleActive = async (i: MasterKelas) => {
    try {
      const { error } = await supabase.from('master_kelas').update({ is_active: !i.is_active, updated_at: new Date().toISOString() }).eq('id', i.id);
      if (error) throw error;
      await fetch();
    } catch {
      showToast('Gagal mengubah status', 'error');
    }
  };

  return (
    <div className="pb-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <School className="h-6 w-6" /> Master Kelas
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Daftar kelas untuk dropdown Input Kavling.</p>
        </div>
        {canManage && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Tambah
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-brand-600" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">Belum ada data kelas.</div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
              <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                <th className="px-4 py-3 font-semibold">Nama Kelas</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {items.map((i) => (
                <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{i.nama}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => canManage && toggleActive(i)} disabled={!canManage} className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', i.is_active ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400')}>
                      {i.is_active ? 'Aktif' : 'Nonaktif'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      {canManage && (
                        <button onClick={() => openEdit(i)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"><Pencil className="h-4 w-4" /></button>
                      )}
                      {canManage && (
                        <button onClick={() => handleDelete(i.id, i.nama)} className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"><Trash2 className="h-4 w-4" /></button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Kelas' : 'Tambah Kelas'}</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama Kelas *</label>
                <input value={nama} onChange={(e) => setNama(e.target.value)} autoFocus className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Contoh: X Mekatronika A" />
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300">Batal</button>
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
