import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Users, User, Phone, Clock, Search, GraduationCap, Briefcase, Heart } from 'lucide-react';
import { Organization } from '../types';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { cn } from '../utils/cn';

const TYPE_ICONS: Record<string, any> = {
  organisasi: GraduationCap,
  ekstrakurikuler: Heart,
};
const TYPE_COLORS: Record<string, string> = {
  organisasi: 'from-blue-500 to-cyan-500',
  ekstrakurikuler: 'from-emerald-500 to-teal-500',
};

export default function OrganizationsPage() {
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState<'all' | 'organisasi' | 'ekstrakurikuler'>('all');
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    supabase.from('organizations').select('*').order('order', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error('Fetch organizations error:', error);
        if (data) setOrganizations(data as Organization[]);
        setLoading(false);
      });
  }, []);

  const filtered = organizations.filter(o => {
    if (filterType !== 'all' && o.type !== filterType) return false;
    if (searchQuery && !o.name.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const grouped = {
    organisasi: filtered.filter(o => o.type === 'organisasi'),
    ekstrakurikuler: filtered.filter(o => o.type === 'ekstrakurikuler'),
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />

      <section className="pt-24 pb-8 bg-gradient-to-br from-purple-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-2">Organisasi & Ekstrakurikuler</motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="text-slate-600 dark:text-slate-400">Daftar organisasi dan kegiatan ekstrakurikuler SMKN 1 Cimahi</motion.p>
        </div>
      </section>

      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className="relative flex-1 max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input type="text" placeholder="Cari organisasi..." value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
            </div>
            <div className="flex gap-2">
              {[
                { key: 'all' as const, label: 'Semua' },
                { key: 'organisasi' as const, label: 'Organisasi' },
                { key: 'ekstrakurikuler' as const, label: 'Ekstrakurikuler' },
              ].map(f => (
                <button key={f.key} onClick={() => setFilterType(f.key)}
                  className={cn('px-4 py-2.5 rounded-lg text-sm font-medium transition-all',
                    filterType === f.key ? 'bg-blue-500 text-white' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                  )}>{f.label}</button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => <div key={i} className="h-64 bg-slate-200 dark:bg-slate-700 rounded-2xl animate-pulse" />)}
            </div>
          ) : (
            <div className="space-y-12">
              {/* Organisasi */}
              {(filterType === 'all' || filterType === 'organisasi') && grouped.organisasi.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <GraduationCap className="w-6 h-6 text-blue-500" /> Organisasi
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {grouped.organisasi.map((org, i) => <OrgCard key={org.id} org={org} index={i} />)}
                  </div>
                </div>
              )}

              {/* Ekstrakurikuler */}
              {(filterType === 'all' || filterType === 'ekstrakurikuler') && grouped.ekstrakurikuler.length > 0 && (
                <div>
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                    <Heart className="w-6 h-6 text-emerald-500" /> Ekstrakurikuler
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {grouped.ekstrakurikuler.map((org, i) => <OrgCard key={org.id} org={org} index={i} />)}
                  </div>
                </div>
              )}

              {filtered.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <p className="text-slate-500">Tidak ada organisasi ditemukan</p>
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      <Footer />
    </div>
  );
}

function OrgCard({ org, index }: { org: Organization; index: number }) {
  const gradient = TYPE_COLORS[org.type] || 'from-slate-500 to-slate-600';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 overflow-hidden group hover:shadow-xl transition-all"
    >
      {/* Header */}
      <div className={cn('h-20 bg-gradient-to-r flex items-center justify-center relative overflow-hidden', gradient)}>
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        {org.logo_url ? (
          <img src={org.logo_url} alt={org.name} className="w-14 h-14 rounded-xl object-cover shadow-lg" />
        ) : (
          <div className="w-14 h-14 rounded-xl bg-white/20 flex items-center justify-center text-white text-2xl font-bold">
            {org.name.charAt(0).toUpperCase()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        <h3 className="font-bold text-lg text-slate-900 dark:text-white mb-2">{org.name}</h3>

        {org.description && (
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4 line-clamp-2">{org.description}</p>
        )}

        <div className="space-y-2">
          {org.leader && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <User className="w-4 h-4" />
              <span>Ketua: <strong className="text-slate-900 dark:text-white">{org.leader}</strong></span>
            </div>
          )}
          {org.advisor && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Briefcase className="w-4 h-4" />
              <span>Pembina: <strong className="text-slate-900 dark:text-white">{org.advisor}</strong></span>
            </div>
          )}
          {org.schedule && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Clock className="w-4 h-4" />
              <span>{org.schedule}</span>
            </div>
          )}
          {org.contact && (
            <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
              <Phone className="w-4 h-4" />
              <span>{org.contact}</span>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
