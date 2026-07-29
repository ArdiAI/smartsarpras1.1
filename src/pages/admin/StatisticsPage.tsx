import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { showToast } from '../../components/Toast';
import { cn } from '../../utils/cn';
import { BarChart3, Loader2, Package, Building2, ClipboardList, FileText, TrendingUp, Users, Megaphone } from 'lucide-react';

interface CategoryCount { name: string; count: number; }
interface MonthlyTrend { month: string; count: number; }
interface StatusCount { status: string; count: number; }

export default function StatisticsPage() {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    inventory: 0,
    facilities: 0,
    borrowings: 0,
    damageReports: 0,
    aspirasi: 0,
    announcements: 0,
    teamMembers: 0,
  });
  const [monthlyTrends, setMonthlyTrends] = useState<MonthlyTrend[]>([]);
  const [borrowingsByStatus, setBorrowingsByStatus] = useState<StatusCount[]>([]);
  const [inventoryByCategory, setInventoryByCategory] = useState<CategoryCount[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // Summary counts
        const [inv, fac, bor, dmg, asp, ann, team] = await Promise.all([
          supabase.from('inventory').select('id', { count: 'exact', head: true }),
          supabase.from('facilities').select('id', { count: 'exact', head: true }),
          supabase.from('borrowings').select('id', { count: 'exact', head: true }),
          supabase.from('damage_reports').select('id', { count: 'exact', head: true }),
          supabase.from('aspirasi').select('id', { count: 'exact', head: true }),
          supabase.from('announcements').select('id', { count: 'exact', head: true }),
          supabase.from('team_members').select('id', { count: 'exact', head: true }),
        ]);
        setSummary({
          inventory: inv.count ?? 0,
          facilities: fac.count ?? 0,
          borrowings: bor.count ?? 0,
          damageReports: dmg.count ?? 0,
          aspirasi: asp.count ?? 0,
          announcements: ann.count ?? 0,
          teamMembers: team.count ?? 0,
        });

        // Monthly trends (last 6 months of borrowings)
        const now = new Date();
        const trends: MonthlyTrend[] = [];
        for (let i = 5; i >= 0; i--) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
          const endDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
          const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`;
          const { count } = await supabase
            .from('borrowings')
            .select('id', { count: 'exact', head: true })
            .gte('borrow_date', start)
            .lte('borrow_date', end);
          const monthName = d.toLocaleDateString('id-ID', { month: 'short' });
          trends.push({ month: monthName, count: count ?? 0 });
        }
        setMonthlyTrends(trends);

        // Borrowings by status
        const { data: borData } = await supabase
          .from('borrowings')
          .select('status');
        const statusMap: Record<string, number> = {};
        (borData ?? []).forEach((b: unknown) => {
          const status = (b as Record<string, unknown>).status as string ?? 'unknown';
          statusMap[status] = (statusMap[status] ?? 0) + 1;
        });
        setBorrowingsByStatus(Object.entries(statusMap).map(([status, count]) => ({ status, count })));

        // Inventory by category
        const { data: invData } = await supabase
          .from('inventory')
          .select('category_id, categories!category_id(name)');
        const catMap: Record<string, number> = {};
        (invData ?? []).forEach((item: unknown) => {
          const i = item as Record<string, unknown>;
          const cat = i.categories as { name: string } | null;
          const catName = cat?.name ?? 'Tanpa Kategori';
          catMap[catName] = (catMap[catName] ?? 0) + 1;
        });
        setInventoryByCategory(Object.entries(catMap).map(([name, count]) => ({ name, count })));
      } catch {
        showToast('Gagal memuat statistik', 'error');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const summaryCards = [
    { label: 'Inventaris', value: summary.inventory, icon: Package, color: 'bg-blue-500' },
    { label: 'Fasilitas', value: summary.facilities, icon: Building2, color: 'bg-emerald-500' },
    { label: 'Peminjaman', value: summary.borrowings, icon: ClipboardList, color: 'bg-purple-500' },
    { label: 'Laporan', value: summary.damageReports, icon: FileText, color: 'bg-amber-500' },
    { label: 'Aspirasi', value: summary.aspirasi, icon: Users, color: 'bg-pink-500' },
    { label: 'Pengumuman', value: summary.announcements, icon: Megaphone, color: 'bg-indigo-500' },
  ];

  const statusColors: Record<string, string> = {
    pending: 'bg-amber-500',
    approved: 'bg-emerald-500',
    rejected: 'bg-red-500',
    returned: 'bg-slate-500',
    borrowed: 'bg-purple-500',
  };

  const statusLabels: Record<string, string> = {
    pending: 'Menunggu',
    approved: 'Disetujui',
    rejected: 'Ditolak',
    returned: 'Dikembalikan',
    borrowed: 'Dipinjam',
  };

  const maxTrend = Math.max(...monthlyTrends.map((t) => t.count), 1);
  const maxBorStatus = Math.max(...borrowingsByStatus.map((s) => s.count), 1);
  const maxInvCat = Math.max(...inventoryByCategory.map((c) => c.count), 1);

  return (
    <div className="pb-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <BarChart3 className="h-6 w-6" /> Statistik
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">Ringkasan data sarana prasarana.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-10 w-10 animate-spin text-brand-600" />
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="mb-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {summaryCards.map((s) => (
              <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <div className={cn('mb-3 flex h-10 w-10 items-center justify-center rounded-xl', s.color)}>
                  <s.icon className="h-5 w-5 text-white" />
                </div>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{s.label}</p>
              </div>
            ))}
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Monthly Trends */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <TrendingUp className="h-5 w-5" /> Tren Peminjaman (6 Bulan)
              </h2>
              {monthlyTrends.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Tidak ada data.</p>
              ) : (
                <div className="flex items-end justify-between gap-3" style={{ height: '200px' }}>
                  {monthlyTrends.map((t, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t.count}</span>
                      <div className="flex w-full items-end justify-center" style={{ height: '150px' }}>
                        <div
                          className="w-full max-w-[40px] rounded-t-lg bg-brand-500 transition-all"
                          style={{ height: `${(t.count / maxTrend) * 100}%`, minHeight: t.count > 0 ? '4px' : '0' }}
                        />
                      </div>
                      <span className="text-xs text-slate-500 dark:text-slate-400">{t.month}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Borrowings by Status */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <ClipboardList className="h-5 w-5" /> Peminjaman per Status
              </h2>
              {borrowingsByStatus.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Tidak ada data.</p>
              ) : (
                <div className="space-y-3">
                  {borrowingsByStatus.map((s) => (
                    <div key={s.status}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-300">{statusLabels[s.status] ?? s.status}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{s.count}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className={cn('h-full rounded-full transition-all', statusColors[s.status] ?? 'bg-slate-500')}
                          style={{ width: `${(s.count / maxBorStatus) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Inventory by Category */}
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:col-span-2">
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
                <Package className="h-5 w-5" /> Inventaris per Kategori
              </h2>
              {inventoryByCategory.length === 0 ? (
                <p className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">Tidak ada data.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {inventoryByCategory.map((c) => (
                    <div key={c.name}>
                      <div className="mb-1 flex items-center justify-between text-sm">
                        <span className="text-slate-700 dark:text-slate-300">{c.name}</span>
                        <span className="font-semibold text-slate-900 dark:text-white">{c.count}</span>
                      </div>
                      <div className="h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                        <div
                          className="h-full rounded-full bg-blue-500 transition-all"
                          style={{ width: `${(c.count / maxInvCat) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
