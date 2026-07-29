import { useState } from 'react';
import { CalendarDays, CheckCircle2, Plus, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/Toast';
import AnimatedBackground from '../components/AnimatedBackground';

const jenisOptions = ['Akademik', 'Olahraga', 'Seni & Budaya', 'Organisasi', 'Kepanitiaan', 'Lainnya'];

interface FormState {
  title: string; jenis_kegiatan: string; organisasi_jurusan: string; penanggung_jawab: string;
  email: string; location: string; event_date: string; end_date: string; start_time: string; end_time: string; description: string;
}
const empty: FormState = { title: '', jenis_kegiatan: '', organisasi_jurusan: '', penanggung_jawab: '', email: '', location: '', event_date: '', end_date: '', start_time: '', end_time: '', description: '' };

export default function AgendaPage() {
  const [form, setForm] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const validate = () => {
    if (!form.title.trim()) return showToast('Judul kegiatan wajib diisi', 'error'), false;
    if (!form.jenis_kegiatan) return showToast('Jenis kegiatan wajib dipilih', 'error'), false;
    if (!form.organisasi_jurusan.trim()) return showToast('Organisasi/Jurusan wajib diisi', 'error'), false;
    if (!form.penanggung_jawab.trim()) return showToast('Penanggung jawab wajib diisi', 'error'), false;
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return showToast('Email valid wajib diisi', 'error'), false;
    if (!form.location.trim()) return showToast('Lokasi wajib diisi', 'error'), false;
    if (!form.event_date) return showToast('Tanggal mulai wajib diisi', 'error'), false;
    if (!form.start_time) return showToast('Waktu mulai wajib diisi', 'error'), false;
    if (form.end_date && form.end_date < form.event_date) return showToast('Tanggal selesai tidak boleh sebelum tanggal mulai', 'error'), false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.from('agendas').insert({
        title: form.title.trim(),
        jenis_kegiatan: form.jenis_kegiatan,
        organisasi_jurusan: form.organisasi_jurusan.trim(),
        penanggung_jawab: form.penanggung_jawab.trim(),
        email: form.email.trim(),
        location: form.location.trim(),
        event_date: form.event_date,
        end_date: form.end_date || null,
        start_time: form.start_time,
        end_time: form.end_time || null,
        description: form.description.trim(),
        status: 'scheduled',
        penyelenggara: form.organisasi_jurusan.trim(),
        jumlah_peserta: 0,
        category: form.jenis_kegiatan,
      });
      if (error) throw error;
      showToast('Agenda berhasil dibuat', 'success');
      setSuccess(true);
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal membuat agenda', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => { setForm(empty); setSuccess(false); };

  if (success) {
    return (
      <div className="relative min-h-[60vh] overflow-hidden py-12 pb-12">
        <AnimatedBackground />
        <div className="relative mx-auto max-w-lg px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Agenda Berhasil Dibuat</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Agenda "{form.title}" telah tersimpan dan berstatus scheduled.</p>
            <button onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              <Plus className="h-4 w-4" /> Buat Agenda Lain
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pb-12">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <AnimatedBackground />
        <div className="relative mx-auto max-w-3xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <CalendarDays className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Buat Agenda Kegiatan</h1>
          <p className="mt-2 text-sm text-white/80">Isi formulir untuk menambahkan agenda kegiatan baru</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Judul Kegiatan *</label>
              <input value={form.title} onChange={(e) => set('title', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Mis. Lomba Kebersihan Kelas" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Jenis Kegiatan *</label>
              <select value={form.jenis_kegiatan} onChange={(e) => set('jenis_kegiatan', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                <option value="">Pilih jenis…</option>
                {jenisOptions.map((j) => <option key={j} value={j}>{j}</option>)}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Organisasi / Jurusan *</label>
              <input value={form.organisasi_jurusan} onChange={(e) => set('organisasi_jurusan', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Mis. OSIS / TKJ" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Penanggung Jawab *</label>
              <input value={form.penanggung_jawab} onChange={(e) => set('penanggung_jawab', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Nama penanggung jawab" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Email *</label>
              <input type="email" value={form.email} onChange={(e) => set('email', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="email@sekolah.sch.id" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Lokasi *</label>
              <input value={form.location} onChange={(e) => set('location', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Mis. Aula / Lapangan" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal Mulai *</label>
              <input type="date" value={form.event_date} onChange={(e) => set('event_date', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal Selesai (opsional)</label>
              <input type="date" value={form.end_date} onChange={(e) => set('end_date', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Waktu Mulai *</label>
              <input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Waktu Selesai (opsional)</label>
              <input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Deskripsi</label>
              <textarea value={form.description} onChange={(e) => set('description', e.target.value)} rows={4} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Deskripsi singkat kegiatan…" />
            </div>
          </div>
          <div className="mt-6 flex justify-end">
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarDays className="h-4 w-4" />} {submitting ? 'Menyimpan…' : 'Buat Agenda'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
