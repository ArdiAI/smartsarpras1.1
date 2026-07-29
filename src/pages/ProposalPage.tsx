import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Upload, Send, Check, X, AlertCircle, Clock, Search, Download, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import { Proposal, PROPOSAL_STATUS_LABELS, PROPOSAL_STATUS_COLORS } from '../types';
import { supabase } from '../lib/supabase';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { cn } from '../utils/cn';

export default function ProposalPage() {
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [activeTab, setActiveTab] = useState<'submit' | 'list'>('list');

  // Form state
  const [formData, setFormData] = useState({
    activity_name: '',
    organization: '',
    proposer_name: '',
    proposer_email: '',
    proposer_phone: '',
    event_date: '',
    event_location: '',
    description: '',
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState('');

  useEffect(() => {
    fetchProposals();
  }, []);

  const fetchProposals = async () => {
    const { data, error } = await supabase.from('proposals').select('*').order('created_at', { ascending: false });
    if (error) console.error('Fetch proposals error:', error);
    if (data) setProposals(data as Proposal[]);
    setLoading(false);
  };

  const uploadDocument = async (file: File): Promise<string | null> => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
    const filePath = `proposals/${fileName}`;
    const { error } = await supabase.storage.from('borrowing-documents').upload(filePath, file);
    if (error) return null;
    const { data } = supabase.storage.from('borrowing-documents').getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError('');
    setSubmitSuccess(false);

    let documentUrl = '';
    let documentName = '';
    if (selectedFile) {
      const url = await uploadDocument(selectedFile);
      if (url) {
        documentUrl = url;
        documentName = selectedFile.name;
      }
    }

    const { error } = await supabase.from('proposals').insert([{
      ...formData,
      document_url: documentUrl,
      document_name: documentName,
      status: 'pending',
    }]);

    if (error) {
      setSubmitError(`Gagal mengirim: ${error.message}`);
    } else {
      setSubmitSuccess(true);
      setFormData({
        activity_name: '',
        organization: '',
        proposer_name: '',
        proposer_email: '',
        proposer_phone: '',
        event_date: '',
        event_location: '',
        description: '',
      });
      setSelectedFile(null);
      fetchProposals();
      setTimeout(() => setSubmitSuccess(false), 5000);
    }
    setSubmitting(false);
  };

  const formatDate = (date: string) => new Date(date).toLocaleDateString('id-ID', { year: 'numeric', month: 'long', day: 'numeric' });

  const filtered = proposals.filter(p => {
    if (statusFilter && p.status !== statusFilter) return false;
    if (searchQuery && !p.activity_name.toLowerCase().includes(searchQuery.toLowerCase()) && !p.organization.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Navbar />

      <section className="pt-24 pb-8 bg-gradient-to-br from-orange-50 via-white to-blue-50 dark:from-slate-900 dark:via-slate-800 dark:to-slate-900">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <motion.h1 initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
            className="text-3xl lg:text-4xl font-bold text-slate-900 dark:text-white mb-2">Pengajuan Proposal</motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}
            className="text-slate-600 dark:text-slate-400">Ajukan proposal kegiatan untuk OSIS, MPK, atau Ekstrakurikuler</motion.p>
        </div>
      </section>

      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4">
          {/* Tabs */}
          <div className="flex gap-2 mb-6">
            {[
              { key: 'list' as const, label: 'Daftar Proposal' },
              { key: 'submit' as const, label: 'Ajukan Baru' },
            ].map(tab => (
              <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                className={cn('px-5 py-2.5 rounded-xl text-sm font-medium transition-all',
                  activeTab === tab.key
                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700'
                )}>{tab.label}</button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === 'submit' ? (
              <motion.div key="submit" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                <div className="max-w-2xl mx-auto bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-200/50 dark:border-slate-700/50 p-6">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-500" /> Form Pengajuan Proposal
                  </h2>

                  {submitSuccess && (
                    <div className="mb-6 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 flex items-center gap-3">
                      <Check className="w-5 h-5 text-emerald-500" />
                      <p className="text-sm text-emerald-700 dark:text-emerald-400">Proposal berhasil diajukan! Menunggu verifikasi.</p>
                    </div>
                  )}

                  {submitError && (
                    <div className="mb-6 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 flex items-center gap-3">
                      <AlertCircle className="w-5 h-5 text-red-500" />
                      <p className="text-sm text-red-700 dark:text-red-400">{submitError}</p>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Kegiatan <span className="text-red-500">*</span></label>
                      <input type="text" required value={formData.activity_name} onChange={e => setFormData({ ...formData, activity_name: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Organisasi <span className="text-red-500">*</span></label>
                      <select required value={formData.organization} onChange={e => setFormData({ ...formData, organization: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white">
                        <option value="">Pilih Organisasi</option>
                        <option value="OSIS">OSIS</option>
                        <option value="MPK">MPK</option>
                        <option value="Paskibra">Paskibra</option>
                        <option value="PMR">PMR</option>
                        <option value="Pramuka">Pramuka</option>
                        <option value="Rohis">Rohis</option>
                        <option value="Futsal">Futsal</option>
                        <option value="Basket">Basket</option>
                        <option value="Lainnya">Lainnya</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Nama Pemohon <span className="text-red-500">*</span></label>
                        <input type="text" required value={formData.proposer_name} onChange={e => setFormData({ ...formData, proposer_name: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Email <span className="text-red-500">*</span></label>
                        <input type="email" required value={formData.proposer_email} onChange={e => setFormData({ ...formData, proposer_email: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">No. HP</label>
                        <input type="tel" value={formData.proposer_phone} onChange={e => setFormData({ ...formData, proposer_phone: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Tanggal Kegiatan</label>
                        <input type="date" value={formData.event_date} onChange={e => setFormData({ ...formData, event_date: e.target.value })}
                          className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Lokasi Kegiatan</label>
                      <input type="text" value={formData.event_location} onChange={e => setFormData({ ...formData, event_location: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Deskripsi Kegiatan</label>
                      <textarea rows={3} value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })}
                        className="w-full px-4 py-2.5 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        <Upload className="w-4 h-4 inline mr-1" /> Upload Proposal (PDF, DOC)
                      </label>
                      <input type="file" accept=".pdf,.doc,.docx"
                        onChange={e => setSelectedFile(e.target.files?.[0] || null)}
                        className="w-full px-4 py-2.5 rounded-lg border border-dashed border-slate-300 dark:border-slate-600 bg-slate-50 dark:bg-slate-700 text-sm text-slate-600 dark:text-slate-400" />
                      {selectedFile && <p className="text-xs text-slate-500 mt-1">{selectedFile.name}</p>}
                    </div>
                    <button type="submit" disabled={submitting}
                      className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-cyan-500 text-white font-medium hover:shadow-lg disabled:opacity-50">
                      <Send className="w-5 h-5" /> {submitting ? 'Mengirim...' : 'Ajukan Proposal'}
                    </button>
                  </form>
                </div>
              </motion.div>
            ) : (
              <motion.div key="list" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
                {/* Filters */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <input type="text" placeholder="Cari proposal..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                      className="w-full pl-12 pr-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-white" />
                  </div>
                  <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
                    className="px-4 py-3 rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                    <option value="">Semua Status</option>
                    <option value="pending">Menunggu Verifikasi</option>
                    <option value="approved">Disetujui</option>
                    <option value="revision">Revisi</option>
                    <option value="rejected">Ditolak</option>
                  </select>
                </div>

                {loading ? (
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => <div key={i} className="h-24 bg-slate-200 dark:bg-slate-700 rounded-xl animate-pulse" />)}
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="bg-white dark:bg-slate-800 rounded-2xl p-12 text-center">
                    <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <p className="text-slate-500">Tidak ada proposal</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {filtered.map(p => (
                      <div key={p.id} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200/50 dark:border-slate-700/50 p-5">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="font-medium text-slate-900 dark:text-white">{p.activity_name}</div>
                            <div className="text-sm text-slate-500 mt-0.5">
                              {p.organization} - {p.proposer_name}
                            </div>
                            {p.event_date && (
                              <div className="text-xs text-slate-400 mt-1">{formatDate(p.event_date)} | {p.event_location || '-'}</div>
                            )}
                          </div>
                          <span className={cn('px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap', PROPOSAL_STATUS_COLORS[p.status])}>
                            {PROPOSAL_STATUS_LABELS[p.status]}
                          </span>
                        </div>
                        {p.document_url && (
                          <a href={p.document_url} target="_blank" rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-2">
                            <Download className="w-3 h-3" /> {p.document_name || 'Unduh Proposal'}
                          </a>
                        )}
                        {p.admin_notes && (
                          <div className="mt-3 p-2 rounded bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-600 dark:text-slate-400 flex items-start gap-2">
                            <MessageSquare className="w-4 h-4 mt-0.5 flex-shrink-0" />
                            <p>{p.admin_notes}</p>
                          </div>
                        )}
                        {p.reviewed_by && (
                          <div className="mt-2 text-xs text-slate-500">Ditinjau oleh: {p.reviewed_by}</div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </section>
      <Footer />
    </div>
  );
}
