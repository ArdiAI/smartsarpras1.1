import { useEffect, useState } from 'react';
import { ClipboardList, Upload, Loader2, CheckCircle2, AlertTriangle, FileText, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { uploadFileToDrive } from '../lib/upload';
import { showToast } from '../components/Toast';
import AnimatedBackground from '../components/AnimatedBackground';
import EmptyState from '../components/EmptyState';

interface DamageReport {
  id: string; reporter_name: string; description: string; location: string | null; severity: string; status: string; image_url: string | null; created_at: string;
}

interface FormState {
  reporter_name: string; reporter_email: string; reporter_unit: string; reporter_phone: string; description: string; location: string; severity: 'minor' | 'moderate' | 'severe';
}
const empty: FormState = { reporter_name: '', reporter_email: '', reporter_unit: '', reporter_phone: '', description: '', location: '', severity: 'minor' };

const severityOptions = [
  { value: 'minor', label: 'Ringan', desc: 'Kerusakan kecil, tidak mengganggu fungsi', color: 'text-emerald-600 dark:text-emerald-400' },
  { value: 'moderate', label: 'Sedang', desc: 'Kerusakan cukup, perlu perbaikan', color: 'text-amber-600 dark:text-amber-400' },
  { value: 'severe', label: 'Berat', desc: 'Kerusakan parah, tidak dapat digunakan', color: 'text-red-600 dark:text-red-400' },
] as const;

const severityStyles: Record<string, string> = {
  minor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  severe: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};
const reportStatusStyles: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  in_progress: 'bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
};

export default function ReportPage() {
  const [form, setForm] = useState<FormState>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<DamageReport[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(true);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) { showToast('Ukuran file maksimal 5MB', 'error'); return; }
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const removeFile = () => { setFile(null); if (preview) URL.revokeObjectURL(preview); setPreview(null); };

  const fetchRecent = async (email: string) => {
    if (!email) { setLoadingRecent(false); return; }
    try {
      const { data } = await supabase.from('damage_reports').select('id, reporter_name, description, location, severity, status, image_url, created_at').eq('reporter_email', email).order('created_at', { ascending: false }).limit(5);
      setRecent((data as unknown as DamageReport[]) ?? []);
    } catch { /* noop */ } finally { setLoadingRecent(false); }
  };

  useEffect(() => { setLoadingRecent(false); }, []);

  const validate = () => {
    if (!form.reporter_name.trim()) return showToast('Nama pelapor wajib diisi', 'error'), false;
    if (!form.reporter_email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.reporter_email)) return showToast('Email valid wajib diisi', 'error'), false;
    if (!form.reporter_unit.trim()) return showToast('Unit/Kelas pelapor wajib diisi', 'error'), false;
    if (!form.description.trim()) return showToast('Deskripsi kerusakan wajib diisi', 'error'), false;
    if (!form.location.trim()) return showToast('Lokasi wajib diisi', 'error'), false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      let image_url: string | null = null;
      if (file) {
        const result = await uploadFileToDrive(file, `laporan-${Date.now()}-${file.name}`);
        if (result) image_url = result.url;
      }
      const { error } = await supabase.from('damage_reports').insert({
        reporter_name: form.reporter_name.trim(),
        reporter_email: form.reporter_email.trim(),
        reporter_unit: form.reporter_unit.trim(),
        reporter_phone: form.reporter_phone.trim() || null,
        description: form.description.trim(),
        location: form.location.trim(),
        severity: form.severity,
        image_url,
        status: 'pending',
      });
      if (error) throw error;
      showToast('Laporan kerusakan berhasil dikirim', 'success');
      await fetchRecent(form.reporter_email.trim());
      setForm(empty); removeFile();
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal mengirim laporan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative pb-12">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <AnimatedBackground />
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <ClipboardList className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Lapor Kerusakan</h1>
          <p className="mt-2 text-sm text-white/80">Laporkan kerusakan sarana dan prasarana</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {/* Form */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama Pelapor *</label>
                  <input value={form.reporter_name} onChange={(e) => set('reporter_name', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Nama lengkap" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email *</label>
                  <input type="email" value={form.reporter_email} onChange={(e) => set('reporter_email', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="email@gmail.com" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Unit / Kelas *</label>
                  <input value={form.reporter_unit} onChange={(e) => set('reporter_unit', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Mis. XII RPL 1" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">No. HP (opsional)</label>
                  <input value={form.reporter_phone} onChange={(e) => set('reporter_phone', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="08xxxxxxxxxx" />
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Lokasi *</label>
                <input value={form.location} onChange={(e) => set('location', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Lokasi barang/fasilitas" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Deskripsi Kerusakan *</label>
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={3} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Jelaskan kerusakan…" />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Tingkat Kerusakan *</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {severityOptions.map((s) => (
                    <label key={s.value} className={`flex cursor-pointer flex-col rounded-xl border p-3 transition ${form.severity === s.value ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-200 hover:border-brand-300 dark:border-slate-700'}`}>
                      <div className="flex items-center gap-2">
                        <input type="radio" name="severity" value={s.value} checked={form.severity === s.value} onChange={(e) => set('severity', e.target.value)} className="h-4 w-4 accent-brand-600" />
                        <span className={`text-sm font-semibold ${s.color}`}>{s.label}</span>
                      </div>
                      <span className="mt-1 text-xs text-slate-500 dark:text-slate-400">{s.desc}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Foto (opsional)</label>
                {preview ? (
                  <div className="relative inline-block">
                    <img src={preview} alt="Preview" className="h-32 w-auto rounded-xl border border-slate-200 dark:border-slate-700" />
                    <button type="button" onClick={removeFile} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white shadow-lg"><X className="h-3.5 w-3.5" /></button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-brand-400 dark:border-slate-700 dark:hover:border-brand-600">
                    <Upload className="h-6 w-6 text-slate-400" />
                    <span className="mt-2 text-sm text-slate-500 dark:text-slate-400">Klik untuk upload foto (max 5MB)</span>
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
                  </label>
                )}
              </div>
              <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />} {submitting ? 'Mengirim…' : 'Kirim Laporan'}
              </button>
            </form>
          </div>

          {/* Recent reports */}
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900 dark:text-white">
              <FileText className="h-5 w-5 text-brand-600 dark:text-brand-400" /> Laporan Terbaru Anda
            </h3>
            <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Isi email pada form, lalu kirim laporan untuk melihat riwayat di sini.</p>
            {loadingRecent ? (
              <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>
            ) : recent.length === 0 ? (
              <EmptyState title="Belum ada laporan" description="Laporan yang Anda kirim akan muncul di sini." icon={<AlertTriangle className="h-8 w-8 text-slate-400" />} className="py-6" />
            ) : (
              <div className="space-y-2">
                {recent.map((r) => (
                  <div key={r.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{r.description}</p>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${reportStatusStyles[r.status] ?? reportStatusStyles.pending}`}>{r.status}</span>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                      <span className={`rounded-md px-1.5 py-0.5 ${severityStyles[r.severity] ?? severityStyles.minor}`}>{r.severity}</span>
                      {r.location && <span>· {r.location}</span>}
                      <span>· {new Date(r.created_at).toLocaleDateString('id-ID')}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
