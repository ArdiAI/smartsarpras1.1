import { useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/Toast';
import EmptyState from '../components/EmptyState';
import { useAuth } from '../context/AuthContext';
import { MapPin, Search, FileText, Download, X, ChevronLeft, ChevronRight, BarChart3, TrendingUp, Loader2, CheckCircle2, XCircle, Pencil, Trash2 } from 'lucide-react';
import type { Kavling, KavlingKategori, KavlingStatus } from '../types';
import { KAVLING_KATEGORI_OPTIONS, KAVLING_STATUS_COLORS, KAVLING_STATUS_LABELS } from '../types';

const PAGE_SIZE = 10;
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];

export default function DataKavlingPage() {
  const { hasPermission, isSuperAdmin } = useAuth();
  const [data, setData] = useState<Kavling[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterKategori, setFilterKategori] = useState('');
  const [filterNama, setFilterNama] = useState('');
  const [filterBulan, setFilterBulan] = useState('');
  const [filterTahun, setFilterTahun] = useState('');
  const [page, setPage] = useState(1);
  const [detail, setDetail] = useState<Kavling | null>(null);
  const [editing, setEditing] = useState<Kavling | null>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const canEdit = hasPermission('kavling', 'update') || isSuperAdmin;
  const canVerify = hasPermission('kavling', 'verify') || isSuperAdmin;
  const canDelete = hasPermission('kavling', 'delete') || isSuperAdmin;

  const loadData = async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase.from('kavling').select('*').order('tanggal', { ascending: false });
      if (error) throw error;
      setData((rows as unknown as Kavling[]) ?? []);
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal memuat data kavling', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, []);

  const tahunOptions = useMemo(() => {
    const years = new Set<string>();
    data.forEach((d) => { if (d.tanggal) years.add(d.tanggal.slice(0, 4)); });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [data]);

  const namaOptions = useMemo(() => {
    const names = new Set<string>();
    data.forEach((d) => { if (!filterKategori || d.kategori === filterKategori) names.add(d.nama_kategori); });
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [data, filterKategori]);

  const filtered = useMemo(() => {
    return data.filter((d) => {
      if (search) {
        const q = search.toLowerCase();
        const hit = d.nama_pj.toLowerCase().includes(q) || d.judul.toLowerCase().includes(q) || d.nama_kategori.toLowerCase().includes(q) || d.lokasi.toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (filterKategori && d.kategori !== filterKategori) return false;
      if (filterNama && d.nama_kategori !== filterNama) return false;
      if (filterBulan && d.tanggal && (parseInt(d.tanggal.slice(5, 7), 10) - 1) !== parseInt(filterBulan, 10)) return false;
      if (filterTahun && d.tanggal && d.tanggal.slice(0, 4) !== filterTahun) return false;
      return true;
    });
  }, [data, search, filterKategori, filterNama, filterBulan, filterTahun]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageData = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => { setPage(1); }, [search, filterKategori, filterNama, filterBulan, filterTahun]);
  useEffect(() => { setFilterNama(''); }, [filterKategori]);

  const stats = useMemo(() => ({
    total: data.length,
    kelas: data.filter((d) => d.kategori === 'Kelas').length,
    eskul: data.filter((d) => d.kategori === 'Ekstrakurikuler').length,
    unit: data.filter((d) => d.kategori === 'Unit').length,
  }), [data]);

  const distribusi = useMemo(() => {
    const map = new Map<string, { nama: string; kategori: KavlingKategori; count: number }>();
    data.forEach((d) => {
      const key = `${d.kategori}|${d.nama_kategori}`;
      const existing = map.get(key);
      if (existing) existing.count += 1;
      else map.set(key, { nama: d.nama_kategori, kategori: d.kategori, count: 1 });
    });
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [data]);

  const maxCount = Math.max(1, ...distribusi.map((d) => d.count));

  const statCards = [
    { label: 'Jumlah Total Kavling', value: stats.total, color: 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' },
    { label: 'Kavling Kelas', value: stats.kelas, color: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' },
    { label: 'Kavling Ekstrakurikuler', value: stats.eskul, color: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
    { label: 'Kavling Unit', value: stats.unit, color: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  ];

  const isImage = (url: string) => /\.(jpg|jpeg|png)$/i.test(url);

  const updateStatus = async (id: string, status: KavlingStatus) => {
    try {
      const { error } = await supabase.from('kavling').update({ status, updated_at: new Date().toISOString() }).eq('id', id);
      if (error) throw error;
      showToast(`Status kavling diubah menjadi "${KAVLING_STATUS_LABELS[status]}"`, 'success');
      await loadData();
      setDetail(null);
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal mengubah status', 'error');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Yakin ingin menghapus data kavling ini?')) return;
    setDeletingId(id);
    try {
      const { error } = await supabase.from('kavling').delete().eq('id', id);
      if (error) throw error;
      showToast('Data kavling berhasil dihapus', 'success');
      await loadData();
      setDetail(null);
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal menghapus data', 'error');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="relative pb-12">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <MapPin className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Data Kavling</h1>
          <p className="mt-2 text-sm text-white/80">Daftar seluruh data kavling yang telah diinput</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Statistik */}
        <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
          {statCards.map((s) => (
            <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className={`mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg ${s.color}`}>
                <BarChart3 className="h-4 w-4" />
              </div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{loading ? '…' : s.value}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Distribusi */}
        <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-brand-600 dark:text-brand-400" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Distribusi Kavling Terbanyak</h2>
          </div>
          {loading ? (
            <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />)}</div>
          ) : distribusi.length === 0 ? (
            <p className="text-sm text-slate-400">Belum ada data.</p>
          ) : (
            <div className="space-y-2.5">
              {distribusi.slice(0, 10).map((d, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="w-40 shrink-0 truncate text-sm text-slate-700 dark:text-slate-200">{d.nama}</span>
                  <div className="h-6 flex-1 overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-800">
                    <div className="flex h-full items-center rounded-lg bg-brand-500/80 px-2 text-xs font-semibold text-white" style={{ width: `${(d.count / maxCount) * 100}%`, minWidth: '2.5rem' }}>{d.count}</div>
                  </div>
                  <span className="w-20 shrink-0 text-right text-xs text-slate-400">{d.kategori}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Filter & Search */}
        <div className="mb-4 flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari nama PJ, judul, lokasi…" className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <select value={filterKategori} onChange={(e) => setFilterKategori(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="">Semua Kategori</option>
            {KAVLING_KATEGORI_OPTIONS.map((k) => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={filterNama} onChange={(e) => setFilterNama(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="">Semua {filterKategori || 'Nama'}</option>
            {namaOptions.map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
          <select value={filterBulan} onChange={(e) => setFilterBulan(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="">Semua Bulan</option>
            {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
          </select>
          <select value={filterTahun} onChange={(e) => setFilterTahun(e.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="">Semua Tahun</option>
            {tahunOptions.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        {/* Tabel */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          {loading ? (
            <div className="flex items-center justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-brand-500" /></div>
          ) : pageData.length === 0 ? (
            <EmptyState title="Tidak ada data kavling" description="Data yang sesuai filter akan muncul di sini." className="py-12" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50">
                  <tr className="text-xs uppercase tracking-wide text-slate-500 dark:text-slate-400">
                    <th className="px-4 py-3 font-semibold">Tanggal</th>
                    <th className="px-4 py-3 font-semibold">Nama PJ</th>
                    <th className="px-4 py-3 font-semibold">Kategori</th>
                    <th className="px-4 py-3 font-semibold">Nama</th>
                    <th className="px-4 py-3 font-semibold">Judul</th>
                    <th className="px-4 py-3 font-semibold">Lokasi</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Bukti</th>
                    <th className="px-4 py-3 font-semibold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {pageData.map((d) => (
                    <tr key={d.id} className="cursor-pointer transition hover:bg-slate-50 dark:hover:bg-slate-800/50" onClick={() => setDetail(d)}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">{new Date(d.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                      <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{d.nama_pj}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.kategori}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.nama_kategori}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.judul}</td>
                      <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{d.lokasi}</td>
                      <td className="px-4 py-3"><span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${KAVLING_STATUS_COLORS[d.status]}`}>{KAVLING_STATUS_LABELS[d.status]}</span></td>
                      <td className="px-4 py-3">
                        {isImage(d.file_url) ? (
                          <img src={d.file_url} alt={d.file_name} className="h-10 w-10 rounded-lg object-cover" />
                        ) : (
                          <a href={d.file_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-500 dark:bg-slate-800"><FileText className="h-4 w-4" /></a>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <button onClick={(e) => { e.stopPropagation(); setDetail(d); }} className="rounded-lg bg-brand-50 px-2.5 py-1 text-xs font-medium text-brand-700 hover:bg-brand-100 dark:bg-brand-900/30 dark:text-brand-300">Detail</button>
                          {canEdit && (
                            <button onClick={(e) => { e.stopPropagation(); setEditing(d); }} className="rounded-lg bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-300" title="Edit"><Pencil className="h-3.5 w-3.5" /></button>
                          )}
                          {canDelete && (
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(d.id); }} disabled={deletingId === d.id} className="rounded-lg bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-300" title="Hapus">{deletingId === d.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}</button>
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

        {/* Pagination */}
        {filtered.length > 0 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-xs text-slate-500 dark:text-slate-400">Menampilkan {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} dari {filtered.length}</p>
            <div className="flex items-center gap-1">
              <button disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"><ChevronLeft className="h-4 w-4" /></button>
              <span className="px-3 text-sm font-medium text-slate-700 dark:text-slate-200">{currentPage} / {totalPages}</span>
              <button disabled={currentPage >= totalPages} onClick={() => setPage((p) => p + 1)} className="rounded-lg border border-slate-200 p-2 text-slate-500 hover:bg-slate-50 disabled:opacity-40 dark:border-slate-700 dark:hover:bg-slate-800"><ChevronRight className="h-4 w-4" /></button>
            </div>
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setDetail(null)}>
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Detail Kavling</h3>
              <button onClick={() => setDetail(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs text-slate-400">Nama PJ</p><p className="font-medium text-slate-900 dark:text-white">{detail.nama_pj}</p></div>
                <div><p className="text-xs text-slate-400">Kategori</p><p className="font-medium text-slate-900 dark:text-white">{detail.kategori}</p></div>
                <div><p className="text-xs text-slate-400">Nama Kelas / Eskul / Unit</p><p className="font-medium text-slate-900 dark:text-white">{detail.nama_kategori}</p></div>
                <div><p className="text-xs text-slate-400">Tanggal</p><p className="font-medium text-slate-900 dark:text-white">{new Date(detail.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p></div>
                <div><p className="text-xs text-slate-400">Lokasi</p><p className="font-medium text-slate-900 dark:text-white">{detail.lokasi}</p></div>
              </div>
              <div><p className="text-xs text-slate-400">Judul Kegiatan</p><p className="font-medium text-slate-900 dark:text-white">{detail.judul}</p></div>
              <div><p className="text-xs text-slate-400">Deskripsi Kegiatan</p><p className="text-slate-700 dark:text-slate-300">{detail.deskripsi}</p></div>
              <div><p className="text-xs text-slate-400">Hasil Kavling</p><p className="text-slate-700 dark:text-slate-300">{detail.hasil}</p></div>
              {detail.catatan && <div><p className="text-xs text-slate-400">Catatan</p><p className="text-slate-700 dark:text-slate-300">{detail.catatan}</p></div>}
              <div><p className="text-xs text-slate-400">Status</p><span className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${KAVLING_STATUS_COLORS[detail.status]}`}>{KAVLING_STATUS_LABELS[detail.status]}</span></div>
              <div>
                <p className="mb-2 text-xs text-slate-400">Bukti Pendukung</p>
                {isImage(detail.file_url) ? (
                  <img src={detail.file_url} alt={detail.file_name} className="max-h-64 rounded-lg border border-slate-200 dark:border-slate-700" />
                ) : (
                  <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800">
                    <FileText className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                    <span className="flex-1 truncate text-sm text-slate-700 dark:text-slate-200">{detail.file_name}</span>
                  </div>
                )}
                <a href={detail.file_url} target="_blank" rel="noreferrer" download className="mt-2 inline-flex items-center gap-2 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">
                  <Download className="h-3.5 w-3.5" /> Download
                </a>
              </div>

              {/* Aksi Verifikasi (hanya PJ Sarpras / Super Admin) */}
              {canVerify && detail.status === 'Menunggu Verifikasi' && (
                <div className="flex gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <button onClick={() => updateStatus(detail.id, 'Diverifikasi')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Verifikasi
                  </button>
                  <button onClick={() => updateStatus(detail.id, 'Ditolak')} className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-700">
                    <XCircle className="h-3.5 w-3.5" /> Tolak
                  </button>
                </div>
              )}
              {canEdit && (
                <div className="flex gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
                  <button onClick={() => { setEditing(detail); setDetail(null); }} className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700">
                    <Pencil className="h-3.5 w-3.5" /> Edit Data
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editing && (
        <EditKavlingModal
          kavling={editing}
          onClose={() => setEditing(null)}
          onSaved={async () => { setEditing(null); await loadData(); }}
          saving={saving}
          setSaving={setSaving}
        />
      )}
    </div>
  );
}

function EditKavlingModal({ kavling, onClose, onSaved, saving, setSaving }: {
  kavling: Kavling;
  onClose: () => void;
  onSaved: () => void;
  saving: boolean;
  setSaving: (b: boolean) => void;
}) {
  const [form, setForm] = useState({
    nama_pj: kavling.nama_pj,
    nama_kategori: kavling.nama_kategori,
    tanggal: kavling.tanggal,
    lokasi: kavling.lokasi,
    judul: kavling.judul,
    deskripsi: kavling.deskripsi,
    hasil: kavling.hasil,
    catatan: kavling.catatan,
  });
  const set = (k: keyof typeof form, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const { error } = await supabase.from('kavling').update({
        nama_pj: form.nama_pj.trim(),
        nama_kategori: form.nama_kategori.trim(),
        tanggal: form.tanggal,
        lokasi: form.lokasi.trim(),
        judul: form.judul.trim(),
        deskripsi: form.deskripsi.trim(),
        hasil: form.hasil.trim(),
        catatan: form.catatan.trim(),
        updated_at: new Date().toISOString(),
      }).eq('id', kavling.id);
      if (error) throw error;
      showToast('Data kavling berhasil diperbarui', 'success');
      onSaved();
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal memperbarui data', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Data Kavling</h3>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="h-5 w-5" /></button>
        </div>
        <form onSubmit={handleSave} className="space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama PJ</label>
              <input value={form.nama_pj} onChange={(e) => set('nama_pj', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Nama Kelas / Eskul / Unit</label>
              <input value={form.nama_kategori} onChange={(e) => set('nama_kategori', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Tanggal</label>
              <input type="date" value={form.tanggal} onChange={(e) => set('tanggal', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Lokasi</label>
              <input value={form.lokasi} onChange={(e) => set('lokasi', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Judul Kegiatan</label>
            <input value={form.judul} onChange={(e) => set('judul', e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Deskripsi Kegiatan</label>
            <textarea rows={3} value={form.deskripsi} onChange={(e) => set('deskripsi', e.target.value)} className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Hasil Kavling</label>
            <textarea rows={3} value={form.hasil} onChange={(e) => set('hasil', e.target.value)} className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">Catatan</label>
            <textarea rows={2} value={form.catatan} onChange={(e) => set('catatan', e.target.value)} className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <div className="flex justify-end gap-2 border-t border-slate-200 pt-4 dark:border-slate-800">
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800">Batal</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />} Simpan
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
