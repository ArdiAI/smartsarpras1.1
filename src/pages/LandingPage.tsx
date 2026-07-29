import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Building2, Package, ClipboardList, CalendarDays, CalendarRange, History, Info, ArrowRight, Megaphone } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { brand } from '../brand/config';
import EmptyState from '../components/EmptyState';

interface Announcement { id: string; title: string; description: string; priority: string; created_at: string; }

const quickLinks = [
  { to: '/fasilitas', label: 'Fasilitas', desc: 'Daftar fasilitas tersedia', icon: Building2 },
  { to: '/inventaris', label: 'Inventaris', desc: 'Daftar barang inventaris', icon: Package },
  { to: '/pinjam', label: 'Pengajuan', desc: 'Ajukan peminjaman', icon: ClipboardList },
  { to: '/agenda', label: 'Agenda', desc: 'Buat agenda kegiatan', icon: CalendarDays },
  { to: '/timeline', label: 'Timeline', desc: 'Kalender kegiatan', icon: CalendarRange },
  { to: '/history', label: 'Riwayat', desc: 'Riwayat peminjaman', icon: History },
  { to: '/laporan', label: 'Laporan', desc: 'Laporkan kerusakan', icon: ClipboardList },
  { to: '/tentang', label: 'Tentang', desc: 'Tentang sistem', icon: Info },
];

export default function LandingPage() {
  const [stats, setStats] = useState({ inventory: 0, facilities: 0, borrowings: 0 });
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [inv, fac, bor, ann] = await Promise.all([
          supabase.from('inventory').select('id', { count: 'exact', head: true }),
          supabase.from('facilities').select('id', { count: 'exact', head: true }),
          supabase.from('borrowings').select('id', { count: 'exact', head: true }),
          supabase.from('announcements').select('id, title, description, priority, created_at').eq('status', 'aktif').order('created_at', { ascending: false }).limit(5),
        ]);
        setStats({ inventory: inv.count ?? 0, facilities: fac.count ?? 0, borrowings: bor.count ?? 0 });
        setAnnouncements((ann.data as unknown as Announcement[]) ?? []);
      } catch {
        /* noop */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const statItems = [
    { label: 'Inventaris', value: stats.inventory, icon: Package },
    { label: 'Fasilitas', value: stats.facilities, icon: Building2 },
    { label: 'Peminjaman', value: stats.borrowings, icon: ClipboardList },
  ];

  return (
    <div className="mx-auto max-w-7xl px-4 pb-10">
      {/* Hero — centered */}
      <section className="flex flex-col items-center py-12 text-center sm:py-16">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-700 text-white">
          <Building2 className="h-6 w-6" />
        </div>
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{brand.name}</h1>
        <p className="mt-1.5 text-sm font-medium text-slate-500 dark:text-slate-400">{brand.school}</p>
        <p className="mt-3 max-w-md text-sm text-slate-600 dark:text-slate-300">{brand.description}</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link to="/pinjam" className="inline-flex items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800">
            <ClipboardList className="h-4 w-4" /> Ajukan Peminjaman
          </Link>
          <Link to="/agenda" className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700">
            <CalendarDays className="h-4 w-4" /> Buat Agenda
          </Link>
        </div>
      </section>

      {/* Stats — centered, compact */}
      <section className="mx-auto max-w-3xl">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {statItems.map((s) => (
            <div key={s.label} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-800">
                  <s.icon className="h-4 w-4 text-brand-700 dark:text-brand-300" />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{loading ? '…' : s.value}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Quick Access */}
      <section className="mt-8">
        <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Akses Cepat</h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {quickLinks.map((q) => (
            <Link key={q.to} to={q.to} className="rounded-lg border border-slate-200 bg-white p-4 transition hover:border-brand-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-700">
              <div className="mb-2 inline-flex h-9 w-9 items-center justify-center rounded-lg bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">
                <q.icon className="h-4 w-4" />
              </div>
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{q.label}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{q.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Announcements */}
      <section className="mt-8">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-brand-700 dark:text-brand-300" />
            <h2 className="text-base font-semibold text-slate-900 dark:text-white">Pengumuman Terbaru</h2>
          </div>
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-slate-100 dark:bg-slate-800" />)}
            </div>
          ) : announcements.length === 0 ? (
            <EmptyState title="Tidak ada pengumuman" description="Pengumuman akan muncul di sini saat dipublikasikan." />
          ) : (
            <div className="space-y-2">
              {announcements.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50 p-3.5 dark:border-slate-800 dark:bg-slate-800/50">
                  <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${a.priority === 'tinggi' ? 'bg-red-500' : a.priority === 'sedang' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">{a.title}</p>
                    <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{a.description}</p>
                    <p className="mt-1 text-xs text-slate-400">{new Date(a.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
