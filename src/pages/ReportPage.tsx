import { useEffect, useState } from 'react';
import { ClipboardList, Upload, Loader2, AlertTriangle, FileText, X } from 'lucide-react';
import { uploadFileToDrive } from '../lib/upload';
import { showToast } from '../components/Toast';
import AnimatedBackground from '../components/AnimatedBackground';
import { authFetch } from '../lib/authFetch';
import EmptyState from '../components/EmptyState';

const API_BASE_URL = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));

interface DamageReport {
  id: string;
  reporter_name: string;
  description: string;
  location: string | null;
  severity: string;
  status: string;
  image_url: string | null;
  created_at: string;
}

interface FormState {
  reporter_name: string;
  reporter_email: string;
  reporter_unit: string;
  reporter_phone: string;
  description: string;
  location: string;
  severity: 'minor' | 'moderate' | 'severe';
}

interface ApiResponse<T> { ok: boolean; data?: T; message?: string; }

const empty: FormState = {
  reporter_name: '', reporter_email: '', reporter_unit: '', reporter_phone: '',
  description: '', location: '', severity: 'minor',
};

const severityOptions = [
  { value: 'minor', label: 'Ringan', desc: 'Kerusakan kecil, tidak mengganggu fungsi' },
  { value: 'moderate', label: 'Sedang', desc: 'Kerusakan cukup, perlu perbaikan' },
  { value: 'severe', label: 'Berat', desc: 'Kerusakan parah, tidak dapat digunakan' },
] as const;

const statusLabels: Record<string, string> = { pending: 'Menunggu', in_progress: 'Diproses', resolved: 'Selesai' };
const severityLabels: Record<string, string> = { minor: 'Ringan', moderate: 'Sedang', severe: 'Berat' };

export default function ReportPage() {
  const [form, setForm] = useState<FormState>(empty);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [recent, setRecent] = useState<DamageReport[]>([]);
  const [loadingRecent, setLoadingRecent] = useState(false);

  const set = (key: keyof FormState, value: string) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleFile = (selectedFile: File | null) => {
    if (!selectedFile) return;
    if (!selectedFile.type.startsWith('image/')) {
      showToast('Bukti wajib berupa foto/gambar', 'error');
      return;
    }
    if (selectedFile.size > 5 * 1024 * 1024) {
      showToast('Ukuran foto maksimal 5MB', 'error');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
  };

  const removeFile = () => {
    setFile(null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(null);
  };

  const fetchRecent = async (email: string) => {
    const cleanEmail = email.trim();
    if (!cleanEmail) return;
    setLoadingRecent(true);
    try {
      const response = await authFetch(`${API_BASE_URL}/api/reports/recent?email=${encodeURIComponent(cleanEmail)}`);
      const result = await response.json().catch(() => null) as ApiResponse<DamageReport[]> | null;
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? 'Gagal mengambil riwayat laporan');
      setRecent(result.data ?? []);
    } catch (error) {
      console.error('[ReportPage] recent error:', error);
      setRecent([]);
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const validate = () => {
    if (!form.reporter_name.trim()) return showToast('Nama pelapor wajib diisi', 'error'), false;
    if (!form.reporter_email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.reporter_email)) return showToast('Email valid wajib diisi', 'error'), false;
    if (!form.reporter_unit.trim()) return showToast('Unit/Kelas pelapor wajib diisi', 'error'), false;
    if (!form.location.trim()) return showToast('Lokasi wajib diisi', 'error'), false;
    if (!form.description.trim()) return showToast('Deskripsi kerusakan wajib diisi', 'error'), false;
    if (!file) return showToast('Foto bukti kerusakan wajib diunggah', 'error'), false;
    return true;
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validate() || submitting || !file) return;
    setSubmitting(true);
    try {
      const upload = await uploadFileToDrive(file, `laporan-${Date.now()}-${file.name}`);
      if (!upload?.url) throw new Error('Foto gagal diunggah. Coba lagi.');

      const email = form.reporter_email.trim();
      const response = await authFetch(`${API_BASE_URL}/api/reports`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reporter_name: form.reporter_name.trim(),
          reporter_email: email,
          reporter_unit: form.reporter_unit.trim(),
          reporter_phone: form.reporter_phone.trim() || null,
          description: form.description.trim(),
          location: form.location.trim(),
          severity: form.severity,
          image_url: upload.url,
        }),
      });
      const result = await response.json().catch(() => null) as ApiResponse<{ id: string }> | null;
      if (!response.ok || !result?.ok) throw new Error(result?.message ?? 'Gagal mengirim laporan');

      showToast('Laporan kerusakan berhasil dikirim', 'success');
      await fetchRecent(email);
      setForm(empty);
      removeFile();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Gagal mengirim laporan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative pb-12">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <AnimatedBackground />
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md"><ClipboardList className="h-7 w-7 text-white" /></div>
          <h1 className="text-3xl font-bold text-white">Lapor Kerusakan</h1>
          <p className="mt-2 text-sm text-white/80">Laporkan kerusakan sarana dan prasarana dengan foto bukti</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Nama Pelapor *" value={form.reporter_name} onChange={(v) => set('reporter_name', v)} placeholder="Nama lengkap" />
                <Field label="Email *" type="email" value={form.reporter_email} onChange={(v) => set('reporter_email', v)} placeholder="email@gmail.com" />
                <Field label="Unit / Kelas *" value={form.reporter_unit} onChange={(v) => set('reporter_unit', v)} placeholder="Mis. XII MEKA A" />
                <Field label="No. HP (opsional)" value={form.reporter_phone} onChange={(v) => set('reporter_phone', v)} placeholder="08xxxxxxxxxx" />
              </div>
              <Field label="Lokasi *" value={form.location} onChange={(v) => set('location', v)} placeholder="Lokasi barang/fasilitas" />

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Deskripsi Kerusakan *</label>
                <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Jelaskan kerusakan..." />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Tingkat Kerusakan *</label>
                <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                  {severityOptions.map((option) => (
                    <label key={option.value} className={`cursor-pointer rounded-xl border p-3 ${form.severity === option.value ? 'border-brand-500 bg-brand-50 dark:bg-brand-900/30' : 'border-slate-200 dark:border-slate-700'}`}>
                      <div className="flex items-center gap-2"><input type="radio" name="severity" checked={form.severity === option.value} onChange={() => set('severity', option.value)} /><span className="text-sm font-semibold">{option.label}</span></div>
                      <p className="mt-1 text-xs text-slate-500">{option.desc}</p>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Foto Bukti *</label>
                <p className="mb-2 text-xs text-slate-500">Wajib. Format gambar, maksimal 5MB.</p>
                {preview ? (
                  <div className="relative inline-block">
                    <img src={preview} alt="Preview bukti" className="h-36 w-auto rounded-xl border border-slate-200 object-cover dark:border-slate-700" />
                    <button type="button" onClick={removeFile} className="absolute -right-2 -top-2 rounded-full bg-red-500 p-1 text-white"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center hover:border-brand-400 dark:border-slate-700">
                    <Upload className="h-6 w-6 text-slate-400" />
                    <span className="mt-2 text-sm text-slate-500">Klik untuk pilih foto bukti</span>
                    <input type="file" accept="image/*" required className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
                  </label>
                )}
              </div>

              <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                {submitting ? 'Mengirim...' : 'Kirim Laporan'}
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h3 className="mb-4 flex items-center gap-2 font-bold text-slate-900 dark:text-white"><FileText className="h-5 w-5 text-brand-600" /> Laporan Terbaru Anda</h3>
            <p className="mb-3 text-xs text-slate-500">Riwayat muncul setelah laporan berhasil dikirim.</p>
            {loadingRecent ? (
              <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}</div>
            ) : recent.length === 0 ? (
              <EmptyState title="Belum ada laporan" description="Laporan yang Anda kirim akan muncul di sini." icon={<AlertTriangle className="h-8 w-8 text-slate-400" />} className="py-6" />
            ) : (
              <div className="space-y-3">
                {recent.map((report) => (
                  <div key={report.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/50">
                    <div className="flex gap-3">
                      {report.image_url && <img src={report.image_url} alt="Bukti" className="h-16 w-16 rounded-lg object-cover" />}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">{report.description}</p>
                        <p className="mt-1 text-xs text-slate-500">{report.location ?? '-'} · {severityLabels[report.severity] ?? report.severity} · {statusLabels[report.status] ?? report.status}</p>
                        <p className="mt-1 text-xs text-slate-400">{new Date(report.created_at).toLocaleDateString('id-ID')}</p>
                      </div>
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

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder={placeholder} />
    </div>
  );
}
