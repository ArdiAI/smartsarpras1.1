import { useEffect, useState } from 'react';
import {
  Package,
  Building,
  ClipboardList,
  Users,
} from 'lucide-react';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

interface Stats {
  inventory: number;
  facilities: number;
  borrowings: number;
  active: number;
}

interface StatsResponse {
  ok: boolean;
  data?: Stats;
  message?: string;
}

export default function AnimatedStats() {
  const [stats, setStats] = useState<Stats>({
    inventory: 0,
    facilities: 0,
    borrowings: 0,
    active: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/stats`
        );

        const result =
          (await response.json()) as StatsResponse;

        if (!response.ok || !result.ok || !result.data) {
          throw new Error(
            result.message ?? 'Gagal mengambil statistik'
          );
        }

        setStats(result.data);
      } catch (error) {
        console.error(
          '[AnimatedStats] error:',
          error
        );
      }
    };

    void fetchStats();
  }, []);

  const items = [
    {
      label: 'Inventaris',
      value: stats.inventory,
      icon: Package,
      color: 'text-blue-500',
    },
    {
      label: 'Fasilitas',
      value: stats.facilities,
      icon: Building,
      color: 'text-cyan-500',
    },
    {
      label: 'Peminjaman',
      value: stats.borrowings,
      icon: ClipboardList,
      color: 'text-emerald-500',
    },
    {
      label: 'Aktif',
      value: stats.active,
      icon: Users,
      color: 'text-amber-500',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {items.map((item, i) => (
        <div
          key={i}
          className="bg-white dark:bg-slate-800 rounded-2xl p-5 border border-slate-200/50 dark:border-slate-700/50 animate-slide-up"
          style={{ animationDelay: `${i * 0.1}s` }}
        >
          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-700/50 flex items-center justify-center mb-3">
            <item.icon
              className={`w-5 h-5 ${item.color}`}
            />
          </div>

          <p className="text-2xl font-bold text-slate-900 dark:text-white">
            {item.value}
          </p>

          <p className="text-sm text-slate-500">
            {item.label}
          </p>
        </div>
      ))}
    </div>
  );
}