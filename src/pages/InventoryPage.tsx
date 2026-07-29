import { useEffect, useState } from 'react';
import { Package, Search, MapPin, Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AnimatedBackground from '../components/AnimatedBackground';
import EmptyState from '../components/EmptyState';

interface InventoryItem {
  id: string; code: string; name: string; quantity: number; condition: 'good' | 'fair' | 'poor'; location: string | null;
  image_url: string | null; description: string | null; categories: { name: string } | null;
}
interface Category { id: string; name: string; }

const conditionStyles: Record<string, { label: string; cls: string }> = {
  good: { label: 'Baik', cls: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  fair: { label: 'Cukup', cls: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
  poor: { label: 'Buruk', cls: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300' },
};

export default function InventoryPage() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [inv, cat] = await Promise.all([
          supabase.from('inventory').select('id, code, name, quantity, condition, location, image_url, description, categories!category_id(name)').order('created_at', { ascending: false }),
          supabase.from('categories').select('id, name').order('name'),
        ]);
        if (inv.error) throw inv.error;
        setItems((inv.data as unknown as InventoryItem[]) ?? []);
        setCategories((cat.data as unknown as Category[]) ?? []);
      } catch {
        /* noop */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = items.filter((i) => {
    const q = search.toLowerCase();
    const matchSearch = !search || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q);
    const matchCat = !categoryFilter || i.categories?.name === categoryFilter;
    return matchSearch && matchCat;
  });

  return (
    <div className="relative pb-12">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <AnimatedBackground />
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <Package className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Inventaris Sekolah</h1>
          <p className="mt-2 text-sm text-white/80">Daftar barang inventaris yang tersedia</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari barang / kode…" className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
          </div>
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)} className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white">
            <option value="">Semua Kategori</option>
            {categories.map((c) => <option key={c.id} value={c.name}>{c.name}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <div key={i} className="animate-pulse rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="h-24 rounded-xl bg-slate-200 dark:bg-slate-800" /><div className="mt-3 h-4 w-3/4 rounded bg-slate-200 dark:bg-slate-800" /><div className="mt-2 h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800" />
            </div>)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState title="Tidak ada inventaris" description="Belum ada barang yang tersedia atau cocok dengan filter." icon={<Package className="h-8 w-8 text-slate-400" />} />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((i) => {
              const cond = conditionStyles[i.condition] ?? conditionStyles.fair;
              return (
                <div key={i.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white transition-all duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900">
                  <div className="flex h-24 items-center justify-center bg-slate-100 dark:bg-slate-800">
                    {i.image_url ? <img src={i.image_url} alt={i.name} className="h-full w-full object-cover" /> : <Package className="h-8 w-8 text-slate-400" />}
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-semibold text-slate-900 dark:text-white">{i.name}</h3>
                      <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${cond.cls}`}>{cond.label}</span>
                    </div>
                    <p className="mt-1 text-xs text-slate-400">Kode: {i.code}</p>
                    {i.categories?.name && <span className="mt-2 inline-block rounded-md bg-brand-50 px-2 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/30 dark:text-brand-300">{i.categories.name}</span>}
                    <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                      <span className="font-medium">Jml: {i.quantity}</span>
                      {i.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" /> {i.location}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
