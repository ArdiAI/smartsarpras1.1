import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/Toast';
import { useAuth } from '../context/AuthContext';
import { MapPin, Upload, Loader2, FileText, X, CheckCircle2, Plus } from 'lucide-react';
import type { KavlingKategori, MasterKelas, MasterEkstrakurikuler } from '../types';
import { KAVLING_KATEGORI_OPTIONS } from '../types';

const BUCKET = 'kavling-files';
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];

interface FormState {
  nama_pj: string;
  kategori: KavlingKategori;
  nama_kategori: string;
  tanggal: string;
  lokasi: string;
  judul: string;
  deskripsi: string;
  hasil: string;
  catatan: string;
}

const emptyForm: FormState = {
  nama_pj: '',
  kategori: 'Kelas',
  nama_kategori: '',
  tanggal: '',
  lokasi: '',
  judul: '',
  deskripsi: '',
  hasil: '',
  catatan: '',
};

export default function InputKavlingPage() {
  const { user, adminProfile } = useAuth();
  const [form, setForm] = useState<FormState>(emptyForm);
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [kelasList, setKelasList] = useState<MasterKelas[]>([]);
  const [eskulList, setEskulList] = useState<MasterEkstrakurikuler[]>([]);

  useEffect(() => {
    (async () => {
      try {
        const [k, e] = await Promise.all([
          supabase.from('master_kelas').select('*').eq('is_active', true).order('nama'),
          supabase.from('master_ekstrakurikuler').select('*').eq('is_active', true).order('nama'),
        ]);
        setKelasList((k.data as unknown as MasterKelas[]) ?? []);
        setEskulList((e.data as unknown as MasterEkstrakurikuler[]) ?? []);
      } catch { /* noop */ }
    })();
  }, []);

  // Auto-fill nama PJ dari user login jika tersedia
  useEffect(() => {
    if (adminProfile?.name) setForm((p) => ({ ...p, nama_pj: adminProfile.name }));
  }, [adminProfile]);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleKategoriChange = (kat: KavlingKategori) => {
    setForm((p) => ({ ...p, kategori: kat, nama_kategori: '' }));
  };

  const handleFile = (f: File | null) => {
    if (!f) return;
    if (!ALLOWED_TYPES.includes(f.type)) {
      showToast('Format file tidak didukung.', 'error');
      return;
    }
    if (f.size > MAX_FILE_SIZE) {
      showToast('Ukuran file maksimal 10 MB.', 'error');
      return;
    }
    setFile(f);
  };

  const validate = () => {
    if (!form.nama_pj.trim()) return showToast('Nama penanggung jawab wajib diisi', 'error'), false;
    if (!form.kategori) return showToast('Kategori kavling wajib dipilih', 'error'), false;
    if (!form.nama_kategori.trim()) return showToast('Nama kelas / eskul / unit wajib diisi', 'error'), false;
    if (!form.tanggal) return showToast('Tanggal pelaksanaan wajib diisi', 'error'), false;
    if (!form.lokasi.trim()) return showToast('Lokasi kavling wajib diisi', 'error'), false;
    if (!form.judul.trim()) return showToast('Judul kegiatan wajib diisi', 'error'), false;
    if (!form.deskripsi.trim()) return showToast('Deskripsi kegiatan wajib diisi', 'error'), false;
    if (!form.hasil.trim()) return showToast('Hasil kavling wajib diisi', 'error'), false;
    if (!file) return showToast('Bukti pendukung wajib diupload', 'error'), false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const filePath = `kavling/${Date.now()}-${file!.name.replace(/[^\w.-]/g, '_')}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(filePath, file!, {
        contentType: file!.type,
        upsert: false,
      });
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      const fileUrl = urlData.publicUrl;

      const { error } = await supabase.from('kavling').insert({
        nama_pj: form.nama_pj.trim(),
        kelas_unit: form.kategori,
        kategori: form.kategori,
        nama_kategori: form.nama_kategori.trim(),
        tanggal: form.tanggal,
        lokasi: form.lokasi.trim(),
        judul: form.judul.trim(),
        deskripsi: form.deskripsi.trim(),
        hasil: form.hasil.trim(),
        catatan: form.catatan.trim() || '',
        file_url: fileUrl,
        file_name: file!.name,
        status: 'Menunggu Verifikasi',
        created_by: user?.id ?? null,
      });
      if (error) throw error;

      showToast('Data kavling berhasil disimpan.', 'success');
      setSuccess(true);
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal menyimpan data kavling', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => {
    setForm((p) => ({ ...emptyForm, nama_pj: adminProfile?.name ?? '' }));
    setFile(null);
    setSuccess(false);
  };

  if (success) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-white">Kavling Berhasil Disimpan</h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Data kavling Anda telah tersimpan dengan status Menunggu Verifikasi.</p>
          <button onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
            <Plus className="h-4 w-4" /> Buat Kavling Lain
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pb-12">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <MapPin className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Input Kavling</h1>
          <p className="mt-2 text-sm text-white/80">Isi data pembagian area atau tugas kegiatan</p>
        </div>
      </div>

      <div className="mx-auto max-w-3xl px-4 py-8">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <div className="space-y-5">
            {/* Informasi Pengaju */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Informasi Pengaju</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama Penanggung Jawab *</label>
                  <input value={form.nama_pj} onChange={(e) => set('nama_pj', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Nama lengkap" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Kategori *</label>
                  <select value={form.kategori} onChange={(e) => handleKategoriChange(e.target.value as KavlingKategori)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                    {KAVLING_KATEGORI_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Nama Kelas / Eskul / Unit — dinamis berdasarkan kategori */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Nama {form.kategori === 'Kelas' ? 'Kelas' : form.kategori === 'Ekstrakurikuler' ? 'Ekstrakurikuler' : 'Unit'} *</h3>
              {form.kategori === 'Kelas' ? (
                <select value={form.nama_kategori} onChange={(e) => set('nama_kategori', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="">Pilih kelas</option>
                  {kelasList.map((k) => <option key={k.id} value={k.nama}>{k.nama}</option>)}
                </select>
              ) : form.kategori === 'Ekstrakurikuler' ? (
                <select value={form.nama_kategori} onChange={(e) => set('nama_kategori', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
                  <option value="">Pilih ekstrakurikuler</option>
                  {eskulList.map((e) => <option key={e.id} value={e.nama}>{e.nama}</option>)}
                </select>
              ) : (
                <input value={form.nama_kategori} onChange={(e) => set('nama_kategori', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Contoh: Panitia MPLS, OSIS, MPK, Sarpras, Humas, Tim Dokumentasi…" />
              )}
              {form.kategori === 'Unit' && (
                <p className="mt-1.5 text-xs text-slate-400">Nama unit bebas diisi karena dapat berubah sesuai kebutuhan sekolah.</p>
              )}
            </div>

            {/* Detail Kavling */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Detail Kavling</h3>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal Pelaksanaan *</label>
                  <input type="date" value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
                <div>
                  <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Lokasi Kavling *</label>
                  <input value={form.lokasi} onChange={(e) => set('lokasi', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Contoh: Lapangan utama" />
                </div>
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Judul Kegiatan *</label>
                <input value={form.judul} onChange={(e) => set('judul', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Contoh: Piket kelas pagi" />
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Deskripsi Kegiatan *</label>
                <textarea rows={3} value={form.deskripsi} onChange={(e) => set('deskripsi', e.target.value)} className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Jelaskan kegiatan…" />
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Hasil Kavling *</label>
                <textarea rows={3} value={form.hasil} onChange={(e) => set('hasil', e.target.value)} className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Hasil yang dicapai…" />
              </div>
              <div className="mt-4">
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Catatan</label>
                <textarea rows={2} value={form.catatan} onChange={(e) => set('catatan', e.target.value)} className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" placeholder="Catatan tambahan (opsional)" />
              </div>
            </div>

            {/* Bukti Pendukung */}
            <div>
              <h3 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Bukti Pendukung *</h3>
              {file ? (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800">
                  <FileText className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                  <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{file.name}</span>
                  <span className="text-xs text-slate-400">{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                  <button type="button" onClick={() => setFile(null)} className="rounded-full bg-red-500 p-1 text-white"><X className="h-3.5 w-3.5" /></button>
                </div>
              ) : (
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center transition hover:border-brand-400 dark:border-slate-700 dark:hover:border-brand-600">
                  <Upload className="h-6 w-6 text-slate-400" />
                  <span className="mt-2 text-sm text-slate-500 dark:text-slate-400">Klik untuk upload bukti pendukung</span>
                  <span className="mt-1 text-xs text-slate-400">JPG, JPEG, PNG, PDF · Maks 10 MB</span>
                  <input type="file" accept=".jpg,.jpeg,.png,.pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0] ?? null)} />
                </label>
              )}
            </div>

            <button type="submit" disabled={submitting} className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />} {submitting ? 'Menyimpan…' : 'Kirim Data Kavling'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
