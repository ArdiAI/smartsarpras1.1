import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Mail, Phone, Briefcase, Building2, Users, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AnimatedBackground from '../components/AnimatedBackground';
import { cn } from '../utils/cn';

interface TeamMember {
  id: string;
  name: string;
  position: string;
  role: string;
  photo_url: string | null;
  description: string | null;
  email: string | null;
  phone: string | null;
  order: number;
}

const roleColors: Record<string, { bg: string; text: string; border: string }> = {
  head: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-700 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-700' },
  coordinator: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-700 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-700' },
  staff: { bg: 'bg-slate-100 dark:bg-slate-700/50', text: 'text-slate-700 dark:text-slate-300', border: 'border-slate-300 dark:border-slate-600' },
  wakapras: { bg: 'bg-cyan-100 dark:bg-cyan-900/30', text: 'text-cyan-700 dark:text-cyan-400', border: 'border-cyan-300 dark:border-cyan-700' },
};

export default function TeamPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);

  useEffect(() => {
    const fetchMembers = async () => {
      const { data } = await supabase
        .from('team_members')
        .select('*')
        .eq('is_active', true)
        .order('order', { ascending: true });

      if (data && data.length > 0) {
        setMembers(data as TeamMember[]);
      }
      setLoading(false);
    };
    fetchMembers();
  }, []);

  const head = members.find(m => m.role === 'head');
  const coordinator = members.find(m => m.role === 'coordinator' || m.role === 'wakapras');
  const staffs = members.filter(m => m.role !== 'head' && m.role !== 'coordinator' && m.role !== 'wakapras');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 relative overflow-hidden">
      <AnimatedBackground />
      <Navbar />

      {/* Header */}
      <section className="relative pt-24 pb-12 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-8"
          >
            <motion.div
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              className="inline-flex items-center gap-3 mb-4"
            >
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-xl shadow-blue-500/30">
                <Users className="w-7 h-7 text-white" />
              </div>
            </motion.div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-3">
              Tim Pengelola Sarpras
            </h1>
            <p className="text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto">
              Struktur organisasi dan daftar pengelola sarana prasarana sekolah
            </p>
          </motion.div>

          {/* Breadcrumb */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center justify-center gap-2 text-sm mb-8"
          >
            <Link to="/about" className="text-slate-500 dark:text-slate-400 hover:text-blue-500 transition-colors">
              Tentang Sarpras
            </Link>
            <ChevronRight className="w-4 h-4 text-slate-400" />
            <span className="text-slate-900 dark:text-white font-medium">Tim Pengelola</span>
          </motion.div>
        </div>
      </section>

      {/* Organizational Structure */}
      <section className="relative pb-12 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl p-6 lg:p-8 border border-slate-200/50 dark:border-slate-700/50 mb-12"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Struktur Organisasi</h2>
            </div>

            {/* Org Chart */}
            <div className="flex flex-col items-center">
              {/* Head */}
              {head && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="mb-6"
                >
                  <div className={cn(
                    'px-6 py-4 rounded-xl bg-gradient-to-br from-yellow-400 to-amber-500 text-white shadow-xl shadow-yellow-500/20 text-center'
                  )}>
                    <p className="font-bold text-lg">{head.name}</p>
                    <p className="text-yellow-100 text-sm">{head.position}</p>
                  </div>
                </motion.div>
              )}

              {/* Connector Line */}
              {coordinator && (
                <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-600" />
              )}

              {/* Coordinator */}
              {coordinator && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.1 }}
                  className="mb-6"
                >
                  <div className="px-6 py-4 rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-xl shadow-blue-500/20 text-center">
                    <p className="font-bold text-lg">{coordinator.name}</p>
                    <p className="text-blue-100 text-sm">{coordinator.position}</p>
                  </div>
                </motion.div>
              )}

              {/* Connector Lines */}
              {staffs.length > 0 && (
                <>
                  <div className="w-0.5 h-8 bg-slate-300 dark:bg-slate-600" />
                  <div className="w-full max-w-3xl h-0.5 bg-slate-300 dark:bg-slate-600 mb-6" />
                </>
              )}

              {/* Staff Grid */}
              {staffs.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 w-full max-w-5xl">
                  {staffs.map((staff, i) => (
                    <motion.div
                      key={staff.id}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + i * 0.05 }}
                      className="flex flex-col items-center"
                    >
                      <div className="w-0.5 h-4 bg-slate-300 dark:bg-slate-600" />
                      <div className="px-4 py-3 rounded-xl bg-white dark:bg-slate-700 border-2 border-slate-200 dark:border-slate-600 text-center shadow-sm">
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">{staff.name}</p>
                        <p className="text-slate-500 dark:text-slate-400 text-xs">{staff.position}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>

          {/* Team Cards */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-cyan-100 dark:bg-cyan-900/30 flex items-center justify-center">
                <User className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">Profil Pengelola</h2>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-72 bg-slate-200 dark:bg-slate-700 animate-pulse rounded-2xl" />
              ))}
            </div>
          ) : members.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
              <p className="text-slate-600 dark:text-slate-400">Belum ada anggota tim</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {members.map((member, i) => (
                <motion.div
                  key={member.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  whileHover={{ y: -8 }}
                  onClick={() => setSelectedMember(member)}
                  className="group cursor-pointer"
                >
                  <div className="relative bg-white/70 dark:bg-slate-800/70 backdrop-blur-xl rounded-2xl overflow-hidden border border-slate-200/50 dark:border-slate-700/50 hover:shadow-2xl transition-all">
                    {/* Photo */}
                    <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 relative overflow-hidden">
                      {member.photo_url ? (
                        <img
                          src={member.photo_url}
                          alt={member.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-900/20 dark:to-cyan-900/20">
                          <div className="text-center">
                            <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-400 to-cyan-400 flex items-center justify-center shadow-lg mx-auto mb-2">
                              <User className="w-12 h-12 text-white" />
                            </div>
                            <p className="text-xs text-slate-500 dark:text-slate-400">Tidak ada foto</p>
                          </div>
                        </div>
                      )}
                      {/* Role Badge */}
                      <div className={cn(
                        'absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-medium border',
                        roleColors[member.role]?.bg || 'bg-slate-100',
                        roleColors[member.role]?.text || 'text-slate-700',
                        roleColors[member.role]?.border || 'border-slate-300'
                      )}>
                        {member.position}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="p-5">
                      <h3 className="font-bold text-slate-900 dark:text-white mb-2">{member.name}</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-400 line-clamp-2 mb-4">
                        {member.description || 'Pengelola sarana prasarana sekolah'}
                      </p>
                      {member.email && (
                        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                          <Mail className="w-4 h-4" />
                          <span className="truncate">{member.email}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Detail Modal */}
      {selectedMember && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => setSelectedMember(null)}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-2xl max-w-lg w-full overflow-hidden shadow-2xl"
          >
            {/* Photo */}
            <div className="aspect-[16/9] bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-600 relative">
              {selectedMember.photo_url ? (
                <img src={selectedMember.photo_url} alt={selectedMember.name} className="w-full h-full object-cover" />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-cyan-500 flex items-center justify-center shadow-2xl">
                    <User className="w-12 h-12 text-white" />
                  </div>
                </div>
              )}
              <button
                onClick={() => setSelectedMember(null)}
                className="absolute top-4 right-4 p-2 rounded-lg bg-white/90 dark:bg-slate-800/90 hover:bg-white dark:hover:bg-slate-700 shadow-lg"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Info */}
            <div className="p-6">
              <div className="flex items-center gap-3 mb-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">{selectedMember.name}</h2>
              </div>
              <div className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium mb-4',
                roleColors[selectedMember.role]?.bg || 'bg-slate-100',
                roleColors[selectedMember.role]?.text || 'text-slate-700'
              )}>
                <Briefcase className="w-3.5 h-3.5" />
                {selectedMember.position}
              </div>

              {selectedMember.description && (
                <p className="text-slate-600 dark:text-slate-400 mb-6 leading-relaxed">
                  {selectedMember.description}
                </p>
              )}

              <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-700">
                {selectedMember.email && (
                  <a href={`mailto:${selectedMember.email}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <Mail className="w-5 h-5 text-blue-500" />
                    <span className="text-slate-700 dark:text-slate-300">{selectedMember.email}</span>
                  </a>
                )}
                {selectedMember.phone && (
                  <a href={`tel:${selectedMember.phone}`} className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                    <Phone className="w-5 h-5 text-green-500" />
                    <span className="text-slate-700 dark:text-slate-300">{selectedMember.phone}</span>
                  </a>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}

      <Footer />
    </div>
  );
}
