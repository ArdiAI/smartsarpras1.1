import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/Toast';
import { MessageSquare, Send, Loader2 } from 'lucide-react';

const KATEGORI_OPTIONS = ['Kritik', 'Saran', 'Laporan', 'Pertanyaan', 'Lainnya'] as const;
type Kategori = (typeof KATEGORI_OPTIONS)[number];

export default function AspirasiPage() {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    nama: '',
    kelas: '',
    kategori: 'Saran' as Kategori,
    judul: '',
    isi: '',
    anonim: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.judul.trim()) { showToast('Judul wajib diisi', 'error'); return; }
    if (!form.isi.trim()) { showToast('Isi aspirasi wajib diisi', 'error'); return; }

    setLoading(true);
    try {
      const { error } = await supabase.from('aspirasi').insert([{
        nama: form.anonim ? 'Anonim' : (form.nama.trim() || 'Anonim'),
        kelas_unit: form.anonim ? '-' : (form.kelas.trim() || '-'),
        kategori: form.kategori,
        judul: form.judul.trim(),
        isi: form.isi.trim(),
        status: 'Menunggu',
      }]);

      if (error) throw error;

      showToast('Aspirasi berhasil dikirim.', 'success');
      setForm({ nama: '', kelas: '', kategori: 'Saran', judul: '', isi: '', anonim: false });
    } catch {
      showToast('Gagal mengirim aspirasi. Silakan coba lagi.', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-700 text-white">
          <MessageSquare className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Kotak Aspirasi</h1>
        <p className="mt-1.5 text-sm text-slate-500 dark:text-slate-400">
          Sampaikan kritik, saran, maupun masukan untuk pengelolaan Sarana dan Prasarana SMK Negeri 1 Cimahi.
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4">
          {/* Nama & Kelas */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama <span className="text-slate-400">(opsional)</span></label>
              <input
                type="text"
                value={form.nama}
                disabled={form.anonim}
                onChange={(e) => setForm({ ...form, nama: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Nama lengkap"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kelas <span className="text-slate-400">(opsional)</span></label>
              <input
                type="text"
                value={form.kelas}
                disabled={form.anonim}
                onChange={(e) => setForm({ ...form, kelas: e.target.value })}
                className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                placeholder="Contoh: X IOP A"
              />
            </div>
          </div>

          {/* Kategori */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Kategori</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {KATEGORI_OPTIONS.map((kat) => (
                <button
                  type="button"
                  key={kat}
                  onClick={() => setForm({ ...form, kategori: kat })}
                  className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                    form.kategori === kat
                      ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-300 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300'
                  }`}
                >
                  {kat}
                </button>
              ))}
            </div>
          </div>

          {/* Judul */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Judul</label>
            <input
              type="text"
              value={form.judul}
              onChange={(e) => setForm({ ...form, judul: e.target.value })}
              className="w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="Contoh: Perbaikan AC di Lab Komputer"
            />
          </div>

          {/* Isi */}
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">Isi Aspirasi</label>
            <textarea
              rows={5}
              value={form.isi}
              onChange={(e) => setForm({ ...form, isi: e.target.value })}
              className="w-full resize-none rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
              placeholder="Jelaskan kritik, saran, atau masukan Anda..."
            />
          </div>

          {/* Anonim */}
          <label className="flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-300">
            <input
              type="checkbox"
              checked={form.anonim}
              onChange={(e) => setForm({ ...form, anonim: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500/20 dark:border-slate-600 dark:bg-slate-800"
            />
            Kirim sebagai anonim
          </label>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:opacity-60"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {loading ? 'Mengirim…' : 'Kirim Aspirasi'}
          </button>
        </div>
      </form>
    </div>
  );
}
