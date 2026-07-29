import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../components/Toast';
import {
  Loader2, Search, FileText, FileSpreadsheet, Calendar, Filter,
} from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

interface RekapRow {
  id: string;
  tanggal: string;
  jenis: 'Agenda' | 'Peminjaman';
  namaKegiatan: string;
  organisasi: string;
  penanggungJawab: string;
  status: string;
  lokasi: string;
}

const statusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  returned: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  completed: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  cancelled: 'bg-slate-100 text-slate-700 dark:bg-slate-700/30 dark:text-slate-300',
  draft: 'bg-slate-100 text-slate-600 dark:bg-slate-700/30 dark:text-slate-300',
  terjadwal: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  berlangsung: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300',
  selesai: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  dibatalkan: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
};

export default function RekapDataAdminPage() {
  const [rows, setRows] = useState<RekapRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [jenisFilter, setJenisFilter] = useState('all');
  const [bulanFilter, setBulanFilter] = useState('all');
  const [tahunFilter, setTahunFilter] = useState('all');
  const [tanggalFilter, setTanggalFilter] = useState('');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [borrowingsRes, agendasRes] = await Promise.all([
        supabase.from('borrowings').select('id, borrow_date, borrower_name, borrower_class, status, purpose, approver_position').order('borrow_date', { ascending: false }),
        supabase.from('agendas').select('id, event_date, title, organisasi_jurusan, penanggung_jawab, status, location, penyelenggara').order('event_date', { ascending: false }),
      ]);

      const combined: RekapRow[] = [];

      if (borrowingsRes.data) {
        for (const b of borrowingsRes.data as any[]) {
          combined.push({
            id: b.id,
            tanggal: b.borrow_date,
            jenis: 'Peminjaman',
            namaKegiatan: b.purpose || '-',
            organisasi: b.borrower_class || '-',
            penanggungJawab: b.approver_position || b.borrower_name || '-',
            status: b.status || 'pending',
            lokasi: '-',
          });
        }
      }

      if (agendasRes.data) {
        for (const a of agendasRes.data as any[]) {
          combined.push({
            id: a.id,
            tanggal: a.event_date,
            jenis: 'Agenda',
            namaKegiatan: a.title || '-',
            organisasi: a.organisasi_jurusan || a.penyelenggara || '-',
            penanggungJawab: a.penanggung_jawab || '-',
            status: a.status || 'draft',
            lokasi: a.location || '-',
          });
        }
      }

      combined.sort((a, b) => (a.tanggal < b.tanggal ? 1 : -1));
      setRows(combined);
      setLoading(false);
    })();
  }, []);

  const tahunOptions = useMemo(() => {
    const years = new Set<string>();
    rows.forEach(r => years.add(new Date(r.tanggal).getFullYear().toString()));
    return Array.from(years).sort((a, b) => Number(b) - Number(a));
  }, [rows]);

  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (jenisFilter !== 'all' && r.jenis !== jenisFilter) return false;
      if (tanggalFilter && r.tanggal !== tanggalFilter) return false;
      if (bulanFilter !== 'all' && (new Date(r.tanggal).getMonth() + 1).toString() !== bulanFilter) return false;
      if (tahunFilter !== 'all' && new Date(r.tanggal).getFullYear().toString() !== tahunFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          r.namaKegiatan?.toLowerCase().includes(q) ||
          r.organisasi?.toLowerCase().includes(q) ||
          r.penanggungJawab?.toLowerCase().includes(q) ||
          r.lokasi?.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [rows, jenisFilter, tanggalFilter, bulanFilter, tahunFilter, search]);

  const exportPDF = () => {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text('Rekap Data - SMART SARPRAS', 14, 15);
    doc.setFontSize(10);
    doc.text(`Tanggal cetak: ${new Date().toLocaleString('id-ID')}`, 14, 22);
    autoTable(doc, {
      startY: 28,
      head: [['Tanggal', 'Jenis', 'Nama Kegiatan', 'Organisasi', 'Penanggung Jawab', 'Status', 'Lokasi']],
      body: filtered.map(r => [
        r.tanggal,
        r.jenis,
        r.namaKegiatan,
        r.organisasi,
        r.penanggungJawab,
        r.status,
        r.lokasi,
      ]),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [37, 99, 235] },
    });
    doc.save(`rekap-data-${new Date().toISOString().slice(0, 10)}.pdf`);
    showToast('PDF berhasil diunduh', 'success');
  };

  const exportExcel = () => {
    const data = filtered.map(r => ({
      Tanggal: r.tanggal,
      Jenis: r.jenis,
      'Nama Kegiatan': r.namaKegiatan,
      Organisasi: r.organisasi,
      'Penanggung Jawab': r.penanggungJawab,
      Status: r.status,
      Lokasi: r.lokasi,
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap Data');
    XLSX.writeFile(wb, `rekap-data-${new Date().toISOString().slice(0, 10)}.xlsx`);
    showToast('Excel berhasil diunduh', 'success');
  };

  const bulanOptions = [
    { value: 'all', label: 'Semua Bulan' },
    { value: '1', label: 'Januari' }, { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' }, { value: '4', label: 'April' },
    { value: '5', label: 'Mei' }, { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' }, { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' }, { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' }, { value: '12', label: 'Desember' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Rekap Data</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Gabungan data Peminjaman dan Agenda
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={exportPDF}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500 text-white font-medium hover:bg-red-600 transition-colors"
          >
            <FileText className="w-4 h-4" /> Export PDF
          </button>
          <button
            onClick={exportExcel}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-medium hover:bg-emerald-600 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" /> Export Excel
          </button>
        </div>
      </div>

      <div className="card p-4 space-y-4">
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Cari nama kegiatan, organisasi, PJ, lokasi..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
          </div>
          <select
            value={jenisFilter}
            onChange={e => setJenisFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="all">Semua Jenis</option>
            <option value="Agenda">Agenda</option>
            <option value="Peminjaman">Peminjaman</option>
          </select>
          <select
            value={bulanFilter}
            onChange={e => setBulanFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            {bulanOptions.map(b => (
              <option key={b.value} value={b.value}>{b.label}</option>
            ))}
          </select>
          <select
            value={tahunFilter}
            onChange={e => setTahunFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          >
            <option value="all">Semua Tahun</option>
            {tahunOptions.map(t => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="date"
            value={tanggalFilter}
            onChange={e => setTanggalFilter(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          />
          {(jenisFilter !== 'all' || bulanFilter !== 'all' || tahunFilter !== 'all' || tanggalFilter || search) && (
            <button
              onClick={() => {
                setJenisFilter('all');
                setBulanFilter('all');
                setTahunFilter('all');
                setTanggalFilter('');
                setSearch('');
              }}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors text-sm"
            >
              <Filter className="w-4 h-4" /> Reset
            </button>
          )}
        </div>

        <div className="text-sm text-slate-500 dark:text-slate-400">
          Menampilkan {filtered.length} dari {rows.length} data
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-16 h-16 rounded-full bg-slate-100 dark:bg-slate-700/50 flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-500" />
            </div>
            <p className="text-slate-600 dark:text-slate-400 font-medium">Tidak ada data</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">Tanggal</th>
                  <th className="text-left py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">Jenis</th>
                  <th className="text-left py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">Nama Kegiatan</th>
                  <th className="text-left py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">Organisasi</th>
                  <th className="text-left py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">Penanggung Jawab</th>
                  <th className="text-left py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">Status</th>
                  <th className="text-left py-3 px-3 font-semibold text-slate-700 dark:text-slate-300">Lokasi</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(r => (
                  <tr key={`${r.jenis}-${r.id}`} className="border-b border-slate-100 dark:border-slate-700/50 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{r.tanggal}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${r.jenis === 'Agenda' ? 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-300' : 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'}`}>
                        {r.jenis}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-700 dark:text-slate-200">{r.namaKegiatan}</td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{r.organisasi}</td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{r.penanggungJawab}</td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[r.status] || statusColors.draft}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-slate-600 dark:text-slate-300">{r.lokasi}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
