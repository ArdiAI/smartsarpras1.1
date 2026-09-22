import { useEffect, useState, useCallback } from 'react';
import { getSessionToken } from '../../../lib/appSession';
import { uploadFileToDrive } from '../../../lib/upload';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../context/AuthContext';
import { logActivity } from '../../../lib/auditLog';
import { cn } from '../../../utils/cn';
import {
  Settings, Loader2, Save, Image as ImageIcon, Plus, Pencil, Trash2,
  X, ArrowUp, ArrowDown, Download, Database, Palette, Megaphone,
  Building2, Info, ShieldCheck, Upload,
} from 'lucide-react';

/* ---------- types ---------- */

interface SettingsMap { [key: string]: Record<string, unknown> }
interface Banner {
  id: string;
  title: string;
  image_url: string;
  link_url: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
interface Announcement {
  id: string;
  title: string;
  description: string;
  priority: string;
  status: string;
  published_at: string | null;
  created_at: string;
}
interface AuditStats {
  app_version: string;
  last_deploy: string;
  db_version: string;
  user_count: number;
  inventory_count: number;
  facility_count: number;
  borrowing_count: number;
}

type TabId = 'identity' | 'landing' | 'announcements' | 'banners' | 'theme' | 'backup' | 'audit';

const TABS: { id: TabId; label: string; icon: typeof Settings }[] = [
  { id: 'identity', label: 'Identitas Aplikasi', icon: Building2 },
  { id: 'landing', label: 'Landing Page', icon: Info },
  { id: 'announcements', label: 'Pengumuman', icon: Megaphone },
  { id: 'banners', label: 'Carousel / Banner', icon: ImageIcon },
  { id: 'theme', label: 'Warna Aplikasi', icon: Palette },
  { id: 'backup', label: 'Backup Database', icon: Database },
  { id: 'audit', label: 'Audit', icon: ShieldCheck },
];

const BUCKET = 'facility-images';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}

async function getAccessToken() {
  const token =
    getSessionToken();

  if (!token) {
    throw new Error(
      'Sesi login tidak ditemukan. Silakan login kembali.'
    );
  }

  return token;
}

async function adminApi<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const token = await getAccessToken();
  const headers = new Headers(options.headers);

  headers.set('Authorization', `Bearer ${token}`);

  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers,
    }
  );

  const result =
    (await response.json().catch(() => null)) as
      | ApiResponse<T>
      | null;

  if (!response.ok || !result?.ok) {
    throw new Error(
      result?.message ??
        `HTTP ${response.status}`
    );
  }

  return result;
}

/* ---------- helpers ---------- */

async function uploadImage(file: File, prefix: string): Promise<string | null> {
  try {
    const uploaded = await uploadFileToDrive(
      file,
      `${prefix}-${Date.now()}-${file.name.replace(/[^\w.-]/g, '_')}`,
      'foto_pengumuman'
    );

    if (!uploaded?.url) {
      showToast('Gagal upload gambar ke Google Drive', 'error');
      return null;
    }

    return uploaded.url;
  } catch {
    showToast('Gagal upload gambar', 'error');
    return null;
  }
}

function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/* ---------- main component ---------- */

export default function SystemSettingsPage() {
  const { adminProfile, userRoleNames } = useAuth();
  const [activeTab, setActiveTab] = useState<TabId>('identity');
  const [settings, setSettings] = useState<SettingsMap>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setLoading(true);

    try {
      const result = await adminApi<
        { key: string; value: Record<string, unknown> }[]
      >('/api/admin/system-settings');

      const map: SettingsMap = {};

      (result.data ?? []).forEach((row) => {
        map[row.key] = row.value;
      });

      setSettings(map);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal memuat pengaturan',
        'error'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const auditLog = (type: 'UPDATE' | 'CREATE' | 'DELETE' | 'EXPORT', desc: string) =>
    logActivity({
      adminUserId: adminProfile?.id,
      adminName: adminProfile?.name,
      adminEmail: adminProfile?.email,
      adminRole: userRoleNames.join(', ') || adminProfile?.role,
      activityType: type,
      module: 'SystemSettings',
      description: desc,
    });

  const saveSection = async (key: string, value: Record<string, unknown>, label: string) => {
    setSavingKey(key);

    try {
      await adminApi(
        `/api/admin/system-settings/${encodeURIComponent(key)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({ value }),
        }
      );

      showToast(`${label} berhasil disimpan`);

      await auditLog(
        'UPDATE',
        `${adminProfile?.name ?? 'Admin'} memperbarui ${label}`
      );

      await fetchSettings();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan pengaturan',
        'error'
      );
    } finally {
      setSavingKey(null);
    }
  };

  const updateField = (key: string, field: string, value: unknown) =>
    setSettings((prev) => ({ ...prev, [key]: { ...(prev[key] ?? {}), [field]: value } }));

  const handleImageUpload = async (key: string, field: string, file: File, prefix: string) => {
    const url = await uploadImage(file, prefix);
    if (url) updateField(key, field, url);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
      </div>
    );
  }

  return (
    <div className="pb-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <Settings className="h-6 w-6" /> Pengaturan Sistem
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Kelola identitas, tampilan, pengumuman, banner, warna, backup, dan audit sistem.
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setActiveTab(t.id)}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition',
              activeTab === t.id
                ? 'bg-brand-600 text-white shadow-sm'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'
            )}
          >
            <t.icon className="h-4 w-4" /> {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {activeTab === 'identity' && (
          <IdentitySection
            data={settings['app_identity'] ?? {}}
            updateField={(f, v) => updateField('app_identity', f, v)}
            onUpload={(f, file) => handleImageUpload('app_identity', f, file, 'identity')}
            onSave={() => saveSection('app_identity', settings['app_identity'] ?? {}, 'Identitas Aplikasi')}
            saving={savingKey === 'app_identity'}
          />
        )}
        {activeTab === 'landing' && (
          <LandingSection
            data={settings['landing_page'] ?? {}}
            updateField={(f, v) => updateField('landing_page', f, v)}
            onUpload={(f, file) => handleImageUpload('landing_page', f, file, 'landing')}
            onSave={() => saveSection('landing_page', settings['landing_page'] ?? {}, 'Landing Page')}
            saving={savingKey === 'landing_page'}
          />
        )}
        {activeTab === 'announcements' && <AnnouncementsSection auditLog={auditLog} />}
        {activeTab === 'banners' && <BannersSection auditLog={auditLog} />}
        {activeTab === 'theme' && (
          <ThemeSection
            data={settings['theme'] ?? {}}
            updateField={(f, v) => updateField('theme', f, v)}
            onUpload={(f, file) => handleImageUpload('theme', f, file, 'theme')}
            onSave={() => saveSection('theme', settings['theme'] ?? {}, 'Warna Aplikasi')}
            saving={savingKey === 'theme'}
          />
        )}
        {activeTab === 'backup' && <BackupSection auditLog={auditLog} />}
        {activeTab === 'audit' && <AuditSection data={settings['audit'] ?? {}} />}
      </div>
    </div>
  );
}

/* ---------- shared field components ---------- */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {children}
    </div>
  );
}

const inputCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white';

function ImageUploadField({
  label, value, onUpload, onClear,
}: { label: string; value: string; onUpload: (f: File) => void; onClear: () => void }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      {value ? (
        <div className="flex items-center gap-3">
          <img src={value} alt={label} className="h-16 w-16 rounded-lg border border-slate-200 object-contain bg-slate-50 dark:border-slate-700 dark:bg-slate-800" />
          <button type="button" onClick={onClear} className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20">
            Hapus
          </button>
        </div>
      ) : (
        <label className="flex cursor-pointer items-center gap-2 rounded-xl border-2 border-dashed border-slate-300 px-4 py-2.5 text-sm text-slate-500 hover:border-brand-400 dark:border-slate-700 dark:text-slate-400">
          <Upload className="h-4 w-4" /> Upload gambar
          <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); }} />
        </label>
      )}
    </div>
  );
}

function SaveButton({ onClick, saving }: { onClick: () => void; saving: boolean }) {
  return (
    <div className="mt-6 flex justify-end">
      <button
        onClick={onClick}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        {saving ? 'Menyimpan…' : 'Simpan'}
      </button>
    </div>
  );
}

/* ---------- 1. Identity ---------- */

function IdentitySection({
  data, updateField, onUpload, onSave, saving,
}: {
  data: Record<string, unknown>;
  updateField: (f: string, v: unknown) => void;
  onUpload: (f: string, file: File) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const s = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : '');
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">Identitas Aplikasi</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Field label="Nama Aplikasi">
          <input className={inputCls} value={s('app_name')} onChange={(e) => updateField('app_name', e.target.value)} />
        </Field>
        <Field label="Nama Sekolah">
          <input className={inputCls} value={s('school_name')} onChange={(e) => updateField('school_name', e.target.value)} />
        </Field>
        <ImageUploadField label="Logo Aplikasi" value={s('app_logo')} onUpload={(f) => onUpload('app_logo', f)} onClear={() => updateField('app_logo', '')} />
        <ImageUploadField label="Favicon" value={s('favicon')} onUpload={(f) => onUpload('favicon', f)} onClear={() => updateField('favicon', '')} />
        <ImageUploadField label="Logo Sekolah" value={s('school_logo')} onUpload={(f) => onUpload('school_logo', f)} onClear={() => updateField('school_logo', '')} />
        <Field label="Alamat Sekolah">
          <textarea rows={2} className={inputCls} value={s('school_address')} onChange={(e) => updateField('school_address', e.target.value)} />
        </Field>
        <Field label="Nomor Telepon">
          <input className={inputCls} value={s('school_phone')} onChange={(e) => updateField('school_phone', e.target.value)} />
        </Field>
        <Field label="Email Sekolah">
          <input className={inputCls} value={s('school_email')} onChange={(e) => updateField('school_email', e.target.value)} />
        </Field>
        <Field label="Website Sekolah">
          <input className={inputCls} value={s('school_website')} onChange={(e) => updateField('school_website', e.target.value)} />
        </Field>
      </div>
      <SaveButton onClick={onSave} saving={saving} />
    </div>
  );
}

/* ---------- 2. Landing Page ---------- */

function LandingSection({
  data, updateField, onUpload, onSave, saving,
}: {
  data: Record<string, unknown>;
  updateField: (f: string, v: unknown) => void;
  onUpload: (f: string, file: File) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const s = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : '');
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">Landing Page</h2>
      <div className="grid grid-cols-1 gap-4">
        <Field label="Hero Title">
          <input className={inputCls} value={s('hero_title')} onChange={(e) => updateField('hero_title', e.target.value)} />
        </Field>
        <Field label="Hero Subtitle">
          <textarea rows={2} className={inputCls} value={s('hero_subtitle')} onChange={(e) => updateField('hero_subtitle', e.target.value)} />
        </Field>
        <ImageUploadField label="Hero Image" value={s('hero_image')} onUpload={(f) => onUpload('hero_image', f)} onClear={() => updateField('hero_image', '')} />
        <Field label="Tentang Smart Sarpras">
          <textarea rows={4} className={inputCls} value={s('about_text')} onChange={(e) => updateField('about_text', e.target.value)} />
        </Field>
        <Field label="Footer">
          <textarea rows={2} className={inputCls} value={s('footer_text')} onChange={(e) => updateField('footer_text', e.target.value)} />
        </Field>
        <Field label="Copyright">
          <input className={inputCls} value={s('copyright')} onChange={(e) => updateField('copyright', e.target.value)} />
        </Field>
      </div>
      <SaveButton onClick={onSave} saving={saving} />
    </div>
  );
}

/* ---------- 3. Announcements (full CRUD) ---------- */

function AnnouncementsSection({ auditLog }: { auditLog: (t: 'UPDATE' | 'CREATE' | 'DELETE' | 'EXPORT', d: string) => void }) {
  const [items, setItems] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'normal', status: 'draft' });

  const fetch = async () => {
    setLoading(true);

    try {
      const result = await adminApi<Announcement[]>(
        '/api/admin/system-settings/announcements/all'
      );

      setItems(result.data ?? []);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal memuat pengumuman',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const openCreate = () => { setEditingId(null); setForm({ title: '', description: '', priority: 'normal', status: 'draft' }); setModalOpen(true); };
  const openEdit = (a: Announcement) => { setEditingId(a.id); setForm({ title: a.title, description: a.description, priority: a.priority, status: a.status }); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { showToast('Judul wajib diisi', 'warning'); return; }
    setSubmitting(true);
    const payload = {
      title: form.title,
      description: form.description,
      priority: form.priority,
      status: form.status,
    };

    try {
      if (editingId) {
        await adminApi(
          `/api/admin/system-settings/announcements/${encodeURIComponent(editingId)}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );

        showToast('Pengumuman diperbarui');

        await auditLog(
          'UPDATE',
          `Memperbarui pengumuman "${form.title}"`
        );
      } else {
        await adminApi(
          '/api/admin/system-settings/announcements',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );

        showToast('Pengumuman ditambahkan');

        await auditLog(
          'CREATE',
          `Menambah pengumuman "${form.title}"`
        );
      }

      setModalOpen(false);
      await fetch();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan pengumuman',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const togglePublish = async (a: Announcement) => {
    const newStatus =
      a.status === 'published'
        ? 'draft'
        : 'published';

    try {
      await adminApi(
        `/api/admin/system-settings/announcements/${encodeURIComponent(a.id)}/status`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            status: newStatus,
          }),
        }
      );

      showToast(
        newStatus === 'published'
          ? 'Pengumuman dipublikasi'
          : 'Pengumuman di-unpublish'
      );

      await auditLog(
        'UPDATE',
        `${newStatus === 'published' ? 'Publish' : 'Unpublish'} pengumuman "${a.title}"`
      );

      await fetch();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal mengubah status',
        'error'
      );
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm('Yakin ingin menghapus pengumuman ini?')) return;

    try {
      await adminApi(
        `/api/admin/system-settings/announcements/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        }
      );

      showToast('Pengumuman dihapus');

      await auditLog(
        'DELETE',
        `Menghapus pengumuman "${title}"`
      );

      await fetch();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal menghapus',
        'error'
      );
    }
  };

  const priorityLabels: Record<string, string> = { low: 'Rendah', normal: 'Normal', high: 'Tinggi', urgent: 'Mendesak' };
  const statusLabels: Record<string, string> = { draft: 'Draf', published: 'Dipublikasi', archived: 'Diarsipkan' };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Pengumuman</h2>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Tambah
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada pengumuman.</p>
      ) : (
        <div className="space-y-3">
          {items.map((a) => (
            <div key={a.id} className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900 dark:text-white">{a.title}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-700 dark:text-slate-300">{priorityLabels[a.priority] ?? a.priority}</span>
                    <span className={cn('rounded-full px-2 py-0.5 text-xs', a.status === 'published' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' : 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300')}>
                      {statusLabels[a.status] ?? a.status}
                    </span>
                  </div>
                  {a.description && <p className="text-sm text-slate-600 dark:text-slate-400">{a.description}</p>}
                </div>
                <div className="flex gap-1.5">
                  <button onClick={() => togglePublish(a)} className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
                    {a.status === 'published' ? 'Unpublish' : 'Publish'}
                  </button>
                  <button onClick={() => openEdit(a)} className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"><Pencil className="h-3.5 w-3.5" /></button>
                  <button onClick={() => handleDelete(a.id, a.title)} className="rounded-lg border border-red-300 p-1.5 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Pengumuman' : 'Tambah Pengumuman'}</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Judul *"><input className={inputCls} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required /></Field>
              <Field label="Deskripsi"><textarea rows={4} className={inputCls} value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Prioritas">
                  <select className={inputCls} value={form.priority} onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value }))}>
                    <option value="low">Rendah</option><option value="normal">Normal</option><option value="high">Tinggi</option><option value="urgent">Mendesak</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select className={inputCls} value={form.status} onChange={(e) => setForm((p) => ({ ...p, status: e.target.value }))}>
                    <option value="draft">Draf</option><option value="published">Dipublikasi</option><option value="archived">Diarsipkan</option>
                  </select>
                </Field>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-300">Batal</button>
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {submitting ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 4. Banners ---------- */

function BannersSection({ auditLog }: { auditLog: (t: 'UPDATE' | 'CREATE' | 'DELETE' | 'EXPORT', d: string) => void }) {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({ title: '', image_url: '', link_url: '', sort_order: 0, is_active: true });

  const fetch = async () => {
    setLoading(true);

    try {
      const result = await adminApi<Banner[]>(
        '/api/admin/system-settings/banners/all'
      );

      setBanners(result.data ?? []);
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal memuat banner',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const openCreate = () => { setEditingId(null); setForm({ title: '', image_url: '', link_url: '', sort_order: banners.length + 1, is_active: true }); setModalOpen(true); };
  const openEdit = (b: Banner) => { setEditingId(b.id); setForm({ title: b.title, image_url: b.image_url, link_url: b.link_url, sort_order: b.sort_order, is_active: b.is_active }); setModalOpen(true); };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title) { showToast('Judul wajib diisi', 'warning'); return; }
    setSubmitting(true);
    const payload = { title: form.title, image_url: form.image_url, link_url: form.link_url, sort_order: form.sort_order, is_active: form.is_active };
    try {
      if (editingId) {
        await adminApi(
          `/api/admin/system-settings/banners/${encodeURIComponent(editingId)}`,
          {
            method: 'PATCH',
            body: JSON.stringify(payload),
          }
        );

        showToast('Banner diperbarui');

        await auditLog(
          'UPDATE',
          `Memperbarui banner "${form.title}"`
        );
      } else {
        await adminApi(
          '/api/admin/system-settings/banners',
          {
            method: 'POST',
            body: JSON.stringify(payload),
          }
        );

        showToast('Banner ditambahkan');

        await auditLog(
          'CREATE',
          `Menambah banner "${form.title}"`
        );
      }

      setModalOpen(false);
      await fetch();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal menyimpan banner',
        'error'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (b: Banner) => {
    try {
      await adminApi(
        `/api/admin/system-settings/banners/${encodeURIComponent(b.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: b.title,
            image_url: b.image_url,
            link_url: b.link_url,
            sort_order: b.sort_order,
            is_active: !b.is_active,
          }),
        }
      );

      showToast(
        b.is_active
          ? 'Banner dinonaktifkan'
          : 'Banner diaktifkan'
      );

      await auditLog(
        'UPDATE',
        `${b.is_active ? 'Nonaktifkan' : 'Aktifkan'} banner "${b.title}"`
      );

      await fetch();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal mengubah status',
        'error'
      );
    }
  };

  const moveOrder = async (b: Banner, dir: -1 | 1) => {
    const newOrder = b.sort_order + dir;

    try {
      await adminApi(
        `/api/admin/system-settings/banners/${encodeURIComponent(b.id)}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            title: b.title,
            image_url: b.image_url,
            link_url: b.link_url,
            sort_order: newOrder,
            is_active: b.is_active,
          }),
        }
      );

      await fetch();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal mengubah urutan',
        'error'
      );
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm('Yakin ingin menghapus banner ini?')) return;

    try {
      await adminApi(
        `/api/admin/system-settings/banners/${encodeURIComponent(id)}`,
        {
          method: 'DELETE',
        }
      );

      showToast('Banner dihapus');

      await auditLog(
        'DELETE',
        `Menghapus banner "${title}"`
      );

      await fetch();
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal menghapus',
        'error'
      );
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-slate-900 dark:text-white">Carousel / Banner</h2>
        <button onClick={openCreate} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700">
          <Plus className="h-4 w-4" /> Tambah Banner
        </button>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-brand-600" /></div>
      ) : banners.length === 0 ? (
        <p className="text-sm text-slate-400">Belum ada banner.</p>
      ) : (
        <div className="space-y-3">
          {banners.map((b) => (
            <div key={b.id} className="flex items-center gap-4 rounded-xl border border-slate-200 p-4 dark:border-slate-700">
              {b.image_url ? (
                <img src={b.image_url} alt={b.title} className="h-14 w-20 rounded-lg object-cover" />
              ) : (
                <div className="flex h-14 w-20 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800"><ImageIcon className="h-5 w-5 text-slate-400" /></div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold text-slate-900 dark:text-white">{b.title}</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">Urutan: {b.sort_order} · {b.is_active ? 'Aktif' : 'Nonaktif'}</p>
              </div>
              <div className="flex items-center gap-1.5">
                <button onClick={() => moveOrder(b, -1)} className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" title="Naik"><ArrowUp className="h-3.5 w-3.5" /></button>
                <button onClick={() => moveOrder(b, 1)} className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800" title="Turun"><ArrowDown className="h-3.5 w-3.5" /></button>
                <button onClick={() => toggleActive(b)} className={cn('rounded-lg border px-2.5 py-1.5 text-xs font-medium', b.is_active ? 'border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:text-amber-300' : 'border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300')}>
                  {b.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                </button>
                <button onClick={() => openEdit(b)} className="rounded-lg border border-slate-300 p-1.5 text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800"><Pencil className="h-3.5 w-3.5" /></button>
                <button onClick={() => handleDelete(b.id, b.title)} className="rounded-lg border border-red-300 p-1.5 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setModalOpen(false)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{editingId ? 'Edit Banner' : 'Tambah Banner'}</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Field label="Judul *"><input className={inputCls} value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} required /></Field>
              <ImageUploadField label="Gambar Banner" value={form.image_url} onUpload={async (f) => { const url = await uploadImage(f, 'banner'); if (url) setForm((p) => ({ ...p, image_url: url })); }} onClear={() => setForm((p) => ({ ...p, image_url: '' }))} />
              <Field label="Link URL (opsional)"><input className={inputCls} value={form.link_url} onChange={(e) => setForm((p) => ({ ...p, link_url: e.target.value }))} placeholder="https://…" /></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Urutan"><input type="number" className={inputCls} value={form.sort_order} onChange={(e) => setForm((p) => ({ ...p, sort_order: parseInt(e.target.value) || 0 }))} /></Field>
                <Field label="Status">
                  <select className={inputCls} value={form.is_active ? 'true' : 'false'} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.value === 'true' }))}>
                    <option value="true">Aktif</option><option value="false">Nonaktif</option>
                  </select>
                </Field>
              </div>
              <div className="flex justify-end gap-3">
                <button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-600 dark:text-slate-300">Batal</button>
                <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null} {submitting ? 'Menyimpan…' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- 5. Theme ---------- */

function ThemeSection({
  data, updateField, onUpload, onSave, saving,
}: {
  data: Record<string, unknown>;
  updateField: (f: string, v: unknown) => void;
  onUpload: (f: string, file: File) => void;
  onSave: () => void;
  saving: boolean;
}) {
  const s = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : '');
  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">Warna Aplikasi</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Field label="Primary Color">
          <div className="flex items-center gap-2">
            <input type="color" value={s('primary_color') || '#1e40af'} onChange={(e) => updateField('primary_color', e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700" />
            <input className={inputCls} value={s('primary_color')} onChange={(e) => updateField('primary_color', e.target.value)} />
          </div>
        </Field>
        <Field label="Secondary Color">
          <div className="flex items-center gap-2">
            <input type="color" value={s('secondary_color') || '#0e7490'} onChange={(e) => updateField('secondary_color', e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700" />
            <input className={inputCls} value={s('secondary_color')} onChange={(e) => updateField('secondary_color', e.target.value)} />
          </div>
        </Field>
        <Field label="Accent Color">
          <div className="flex items-center gap-2">
            <input type="color" value={s('accent_color') || '#f59e0b'} onChange={(e) => updateField('accent_color', e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-slate-300 dark:border-slate-700" />
            <input className={inputCls} value={s('accent_color')} onChange={(e) => updateField('accent_color', e.target.value)} />
          </div>
        </Field>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <ImageUploadField label="Logo Light" value={s('logo_light')} onUpload={(f) => onUpload('logo_light', f)} onClear={() => updateField('logo_light', '')} />
        <ImageUploadField label="Logo Dark" value={s('logo_dark')} onUpload={(f) => onUpload('logo_dark', f)} onClear={() => updateField('logo_dark', '')} />
      </div>
      <SaveButton onClick={onSave} saving={saving} />
    </div>
  );
}

/* ---------- 6. Backup ---------- */

function BackupSection({ auditLog }: { auditLog: (t: 'UPDATE' | 'CREATE' | 'DELETE' | 'EXPORT', d: string) => void }) {
  const [exporting, setExporting] = useState(false);
  const [tables] = useState(['inventory', 'facilities', 'borrowings', 'announcements', 'kavling']);

  const exportCSV = async (table: string) => {
    setExporting(true);

    try {
      const result = await adminApi<
        Record<string, unknown>[]
      >(
        `/api/admin/system-settings/export/${encodeURIComponent(table)}`
      );

      const data = result.data ?? [];

      if (data.length === 0) {
        showToast(
          `Tabel ${table} kosong`,
          'warning'
        );
        return;
      }

      const headers =
        Object.keys(data[0]);

      const rows = data.map((row) =>
        headers
          .map(
            (header) =>
              `"${String(row[header] ?? '').replace(/"/g, '""')}"`
          )
          .join(',')
      );

      const csv = [
        headers.join(','),
        ...rows,
      ].join('\n');

      downloadFile(
        `${table}-export-${Date.now()}.csv`,
        csv,
        'text/csv'
      );

      showToast(
        `CSV ${table} berhasil diunduh`
      );

      await auditLog(
        'EXPORT',
        `Export CSV tabel ${table}`
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal export CSV',
        'error'
      );
    } finally {
      setExporting(false);
    }
  };

  const exportAllExcel = async () => {
    setExporting(true);

    try {
      const result = await adminApi<
        Record<string, Record<string, unknown>[]>
      >('/api/admin/system-settings/backup');

      const dump = result.data ?? {};
      let combined = '';

      for (const table of tables) {
        const data = dump[table] ?? [];

        if (data.length === 0) {
          continue;
        }

        const headers =
          Object.keys(data[0]);

        combined += `\n=== ${table} ===\n`;
        combined +=
          headers.join(',') + '\n';

        combined +=
          data
            .map((row) =>
              headers
                .map(
                  (header) =>
                    `"${String(row[header] ?? '').replace(/"/g, '""')}"`
                )
                .join(',')
            )
            .join('\n') +
          '\n';
      }

      if (!combined) {
        showToast(
          'Tidak ada data untuk diexport',
          'warning'
        );
        return;
      }

      downloadFile(
        `backup-all-${Date.now()}.csv`,
        combined,
        'text/csv'
      );

      showToast(
        'Export semua tabel berhasil diunduh'
      );

      await auditLog(
        'EXPORT',
        'Export semua tabel (Excel/CSV)'
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal export',
        'error'
      );
    } finally {
      setExporting(false);
    }
  };

  const backupDatabase = async () => {
    setExporting(true);

    try {
      const result = await adminApi<
        Record<string, Record<string, unknown>[]>
      >('/api/admin/system-settings/backup');

      const dump = result.data ?? {};

      downloadFile(
        `backup-db-${Date.now()}.json`,
        JSON.stringify(
          dump,
          null,
          2
        ),
        'application/json'
      );

      showToast(
        'Backup database berhasil diunduh'
      );

      await auditLog(
        'EXPORT',
        'Backup database (JSON)'
      );
    } catch (error) {
      showToast(
        error instanceof Error
          ? error.message
          : 'Gagal backup',
        'error'
      );
    } finally {
      setExporting(false);
    }
  };

  const restoreDatabase = () => {
    showToast('Restore database: hubungi administrator sistem untuk mengunggah file backup', 'info');
  };

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">Backup Database</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-700">
          <div className="mb-2 flex items-center gap-2"><Database className="h-5 w-5 text-brand-600 dark:text-brand-400" /><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Backup Database</h3></div>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Unduh seluruh data tabel dalam format JSON.</p>
          <button onClick={backupDatabase} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
            {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Backup
          </button>
        </div>
        <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-700">
          <div className="mb-2 flex items-center gap-2"><Upload className="h-5 w-5 text-brand-600 dark:text-brand-400" /><h3 className="text-sm font-semibold text-slate-900 dark:text-white">Restore Database</h3></div>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Pulihkan data dari file backup JSON.</p>
          <button onClick={restoreDatabase} className="inline-flex items-center gap-2 rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
            <Upload className="h-4 w-4" /> Restore
          </button>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-700">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Export CSV per Tabel</h3>
        <div className="flex flex-wrap gap-2">
          {tables.map((t) => (
            <button key={t} onClick={() => exportCSV(t)} disabled={exporting} className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-800">
              <Download className="h-3.5 w-3.5" /> {t}.csv
            </button>
          ))}
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 p-5 dark:border-slate-700">
        <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Export Semua Tabel (Excel/CSV)</h3>
        <button onClick={exportAllExcel} disabled={exporting} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
          {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />} Export Semua
        </button>
      </div>
    </div>
  );
}

/* ---------- 7. Audit ---------- */

function AuditSection({ data }: { data: Record<string, unknown> }) {
  const [stats, setStats] = useState<AuditStats>({
    app_version: String(data.app_version ?? '1.0.0'),
    last_deploy: String(data.last_deploy ?? '-'),
    db_version: String(data.db_version ?? '1.0.0'),
    user_count: 0, inventory_count: 0, facility_count: 0, borrowing_count: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const result =
          await adminApi<{
            user_count: number;
            inventory_count: number;
            facility_count: number;
            borrowing_count: number;
          }>(
            '/api/admin/system-settings/audit-stats'
          );

        const data = result.data;

        if (data) {
          setStats((previous) => ({
            ...previous,
            user_count:
              data.user_count ?? 0,
            inventory_count:
              data.inventory_count ?? 0,
            facility_count:
              data.facility_count ?? 0,
            borrowing_count:
              data.borrowing_count ?? 0,
          }));
        }
      } catch {
        /* noop */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cards = [
    { label: 'Versi Aplikasi', value: stats.app_version, icon: Info },
    { label: 'Deploy Terakhir', value: stats.last_deploy || '-', icon: Database },
    { label: 'Versi Database', value: stats.db_version, icon: Database },
    { label: 'Jumlah User', value: loading ? '…' : stats.user_count, icon: ShieldCheck },
    { label: 'Jumlah Inventaris', value: loading ? '…' : stats.inventory_count, icon: ShieldCheck },
    { label: 'Jumlah Fasilitas', value: loading ? '…' : stats.facility_count, icon: ShieldCheck },
    { label: 'Jumlah Peminjaman', value: loading ? '…' : stats.borrowing_count, icon: ShieldCheck },
  ];

  return (
    <div className="space-y-5">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">Audit</h2>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-slate-200 p-5 dark:border-slate-700">
            <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
              <c.icon className="h-4 w-4" />
            </div>
            <p className="text-lg font-bold text-slate-900 dark:text-white">{c.value}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{c.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}