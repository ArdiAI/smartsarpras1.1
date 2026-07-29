import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../components/Toast';
import { useAuth } from '../../context/AuthContext';
import { logActivity } from '../../lib/auditLog';
import { cn } from '../../utils/cn';
import { Package, Plus, Pencil, Trash2, X, Loader2, Search, Upload, Image as ImageIcon, FileText } from 'lucide-react';

const IMG_BUCKET = 'facility-images';
const MAX_IMG_SIZE = 10 * 1024 * 1024;
const ALLOWED_IMG_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const ALLOWED_IMG_EXTS = ['.jpg', '.jpeg', '.png', '.webp'];

interface InventoryItem {
  id: string;
  code: string | null;
  name: string | null;
  category_id: string | null;
  quantity: number | null;
  condition: string | null;
  location: string | null;
  image_url: string | null;
  purchase_date: string | null;
  price: number | null;
  description: string | null;
  available_quantity: number | null;
  manager_name: string | null;
  manager_role: string | null;
  manager_id: string | null;
  categories: { name: string } | null;
}

interface Category {
  id: string;
  name: string;
}

interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
}

const emptyForm = {
  code: '',
  name: '',
  category_id: '',
  quantity: '',
  condition: 'good',
  location: '',
  purchase_date: '',
  price: '',
  description: '',
  manager_id: '',
  image_url: '',
};

const conditionStyles: Record<string, string> = {
  good: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
  fair: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  poor: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
};

const conditionLabels: Record<string, string> = { good: 'Baik', fair: 'Cukup', poor: 'Rusak' };

export default function InventoryAdminPage() {
  const { hasPermission, adminProfile, userRoleNames } = useAuth();
  const canCreate = hasPermission('inventory', 'create');
  const canUpdate = hasPermission('inventory', 'update');
  const canDelete = hasPermission('inventory', 'delete');

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [imgFile, setImgFile] = useState<File | null>(null);
  const [imgPreview, setImgPreview] = useState<string>('');
  const [previewImg, setPreviewImg] = useState<string | null>(null);

  const fetchItems = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('inventory')
        .select('*, categories!category_id(name)')
        .order('created_at', { ascending: false });
      if (error) {
        showToast('Gagal memuat inventaris', 'error');
        return;
      }
      setItems((data ?? []) as unknown as InventoryItem[]);
    } catch {
      showToast('Gagal memuat inventaris', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase.from('categories').select('id, name').order('name');
      if (error) return;
      setCategories((data ?? []) as unknown as Category[]);
    } catch { /* noop */ }
  };

  const fetchAdminUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, name, email, role')
        .eq('is_active', true)
        .order('name');
      if (error) return;
      setAdminUsers((data ?? []) as unknown as AdminUser[]);
    } catch { /* noop */ }
  };

  useEffect(() => {
    fetchItems();
    fetchCategories();
    fetchAdminUsers();
  }, []);

  const filtered = items.filter((it) => {
    const q = search.toLowerCase();
    return (
      (it.name ?? '').toLowerCase().includes(q) ||
      (it.code ?? '').toLowerCase().includes(q) ||
      (it.location ?? '').toLowerCase().includes(q)
    );
  });

  const openCreate = () => {
    setEditingId(null);
    setForm({ ...emptyForm });
    setImgFile(null);
    setImgPreview('');
    setModalOpen(true);
  };

  const openEdit = (item: InventoryItem) => {
    setEditingId(item.id);
    setForm({
      code: item.code ?? '',
      name: item.name ?? '',
      category_id: item.category_id ?? '',
      quantity: String(item.quantity ?? ''),
      condition: item.condition ?? 'good',
      location: item.location ?? '',
      purchase_date: item.purchase_date ?? '',
      price: String(item.price ?? ''),
      description: item.description ?? '',
      manager_id: item.manager_id ?? '',
      image_url: item.image_url ?? '',
    });
    setImgFile(null);
    setImgPreview(item.image_url ?? '');
    setModalOpen(true);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleImgFile = (f: File | null) => {
    if (!f) return;
    const ext = '.' + (f.name.split('.').pop() ?? '').toLowerCase();
    if (!ALLOWED_IMG_EXTS.includes(ext) || !ALLOWED_IMG_TYPES.includes(f.type)) {
      showToast('Format foto harus JPG, JPEG, PNG, atau WEBP', 'error');
      return;
    }
    if (f.size > MAX_IMG_SIZE) {
      showToast('Ukuran foto maksimal 10 MB', 'error');
      return;
    }
    setImgFile(f);
    setImgPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      showToast('Nama barang wajib diisi', 'warning');
      return;
    }
    if (!imgFile && !form.image_url.trim()) {
      showToast('Wajib upload foto atau isi URL gambar', 'warning');
      return;
    }
    setSubmitting(true);
    let imageUrl = form.image_url.trim() || null;
    try {
      if (imgFile) {
        const ext = '.' + (imgFile.name.split('.').pop() ?? '').toLowerCase();
        const filePath = `inventory/${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;
        const { error: upErr } = await supabase.storage.from(IMG_BUCKET).upload(filePath, imgFile, { contentType: imgFile.type, upsert: false });
        if (upErr) { showToast('Gagal upload foto: ' + upErr.message, 'error'); setSubmitting(false); return; }
        const { data: urlData } = supabase.storage.from(IMG_BUCKET).getPublicUrl(filePath);
        imageUrl = urlData.publicUrl;
        showToast('Foto berhasil diupload', 'success');
      }
      const selectedManager = adminUsers.find((u) => u.id === form.manager_id);
      const payload = {
        code: form.code || null,
        name: form.name,
        category_id: form.category_id || null,
        quantity: form.quantity ? parseInt(form.quantity, 10) : 0,
        available_quantity: form.quantity ? parseInt(form.quantity, 10) : 0,
        condition: form.condition,
        location: form.location || null,
        purchase_date: form.purchase_date || null,
        price: form.price ? parseFloat(form.price) : null,
        description: form.description || null,
        manager_id: form.manager_id || null,
        manager_name: selectedManager?.name ?? null,
        manager_role: selectedManager?.role ?? null,
        image_url: imageUrl,
      };
      if (editingId) {
        const { error } = await supabase.from('inventory').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', editingId);
        if (error) { showToast('Gagal memperbarui: ' + error.message, 'error'); return; }
        showToast('Inventaris berhasil diperbarui');
        await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'UPDATE', module: 'Inventory', description: `${adminProfile?.name ?? 'Admin'} memperbarui inventaris ${form.name}` });
      } else {
        const { error } = await supabase.from('inventory').insert(payload);
        if (error) { showToast('Gagal menambahkan: ' + error.message, 'error'); return; }
        showToast('Inventaris berhasil ditambahkan');
        await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'CREATE', module: 'Inventory', description: `${adminProfile?.name ?? 'Admin'} menambah inventaris ${form.name}` });
      }
      setModalOpen(false);
      setImgFile(null);
      setImgPreview('');
      await fetchItems();
    } catch {
      showToast('Gagal menyimpan inventaris', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Apakah Anda yakin ingin menghapus barang ini?')) return;
    try {
      const { error } = await supabase.from('inventory').delete().eq('id', id);
      if (error) { showToast('Gagal menghapus', 'error'); return; }
      showToast('Barang berhasil dihapus');
      await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'DELETE', module: 'Inventory', description: `${adminProfile?.name ?? 'Admin'} menghapus inventaris ${id}` });
      await fetchItems();
    } catch {
      showToast('Gagal menghapus', 'error');
    }
  };

  return (
    <div className="pb-6">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <Package className="h-6 w-6" /> Kelola Inventaris
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">CRUD barang sarana prasarana.</p>
        </div>
        {canCreate && (
          <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Tambah
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4 relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Cari nama, kode, atau lokasi..."
          className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm text-slate-900 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">Tidak ada data.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Foto</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Kode</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Nama</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Kategori</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Jumlah</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Kondisi</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">Lokasi</th>
                  <th className="px-4 py-3 text-left font-semibold text-slate-700 dark:text-slate-300">PJ Barang</th>
                  <th className="px-4 py-3 text-right font-semibold text-slate-700 dark:text-slate-300">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filtered.map((it) => (
                  <tr key={it.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="px-4 py-3">
                      {it.image_url ? (
                        <button onClick={() => setPreviewImg(it.image_url!)} className="block">
                          <img src={it.image_url} alt={it.name ?? ''} className="h-10 w-10 rounded-lg object-contain bg-slate-100 p-0.5 dark:bg-slate-800" />
                        </button>
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800"><ImageIcon className="h-4 w-4 text-slate-400" /></div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{it.code ?? '-'}</td>
                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{it.name ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{it.categories?.name ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{it.quantity ?? 0}</td>
                    <td className="px-4 py-3">
                      <span className={cn('rounded-full px-2.5 py-0.5 text-xs font-medium', conditionStyles[it.condition ?? 'good'] ?? conditionStyles.good)}>
                        {conditionLabels[it.condition ?? 'good'] ?? it.condition}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{it.location ?? '-'}</td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{it.manager_name ?? '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {canUpdate && (
                          <button onClick={() => openEdit(it)} className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                        )}
                        {canDelete && (
                          <button onClick={() => handleDelete(it.id)} className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20" title="Hapus">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Barang' : 'Tambah Barang'}</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Kode</label>
                <input name="code" value={form.code} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama *</label>
                <input name="name" value={form.name} onChange={handleChange} required className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Kategori</label>
                <select name="category_id" value={form.category_id} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="">Pilih kategori</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Jumlah</label>
                <input name="quantity" type="number" value={form.quantity} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Kondisi</label>
                <select name="condition" value={form.condition} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="good">Baik</option>
                  <option value="fair">Cukup</option>
                  <option value="poor">Rusak</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Lokasi</label>
                <input name="location" value={form.location} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal Beli</label>
                <input name="purchase_date" type="date" value={form.purchase_date} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Harga</label>
                <input name="price" type="number" value={form.price} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Penanggung Jawab Barang</label>
                <select name="manager_id" value={form.manager_id} onChange={handleChange} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="">Pilih PJ Barang</option>
                  {adminUsers.map((u) => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Deskripsi</label>
                <textarea name="description" value={form.description} onChange={handleChange} rows={3} className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>
              <div className="md:col-span-2">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Foto Barang *</label>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="flex-1">
                    {imgPreview ? (
                      <div className="relative inline-block">
                        <img src={imgPreview} alt="preview" className="h-28 w-28 rounded-xl border border-slate-200 object-cover dark:border-slate-700" />
                        <button type="button" onClick={() => { setImgFile(null); setImgPreview(form.image_url || ''); }} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    ) : (
                      <label className="flex h-28 w-28 cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 text-center transition hover:border-brand-400 dark:border-slate-700">
                        <Upload className="h-6 w-6 text-slate-400" />
                        <span className="mt-1 text-xs text-slate-400">Upload</span>
                        <input type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => handleImgFile(e.target.files?.[0] ?? null)} />
                      </label>
                    )}
                    <p className="mt-1 text-xs text-slate-400">JPG, JPEG, PNG, WEBP · Maks 10 MB</p>
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-slate-500 dark:text-slate-400">Atau isi URL gambar</label>
                    <input name="image_url" value={form.image_url} onChange={(e) => { handleChange(e); if (!imgFile) setImgPreview(e.target.value); }} placeholder="https://..." className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                    <p className="mt-1 text-xs text-slate-400">Jika URL diisi, upload file tidak wajib.</p>
                  </div>
                </div>
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

      {previewImg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setPreviewImg(null)}>
          <button className="absolute right-4 top-4 rounded-full bg-white/20 p-2 text-white"><X className="h-6 w-6" /></button>
          <img src={previewImg} alt="preview" className="max-h-[85vh] max-w-[90vw] rounded-xl object-contain" />
        </div>
      )}
    </div>
  );
}
