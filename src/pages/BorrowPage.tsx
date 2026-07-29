import { useEffect, useState } from 'react';
import { ClipboardList, Search, ShoppingCart, Plus, Minus, Trash2, Package, Building2, Loader2, CheckCircle2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getDefaultWorkflow, getWorkflowLainnya, getWorkflowSteps } from '../lib/workflow';
import { showToast } from '../components/Toast';
import AnimatedBackground from '../components/AnimatedBackground';
import EmptyState from '../components/EmptyState';

interface InventoryItem { id: string; code: string; name: string; quantity: number; available_quantity: number; condition: string; categories: { name: string } | null; }
interface Facility { id: string; name: string; capacity: number | null; location: string | null; }
interface CartItem { key: string; inventory_id: string | null; facility_id: string | null; item_type: 'barang' | 'fasilitas'; item_name: string; quantity: number; }

interface FormState { borrower_name: string; borrower_class: string; borrower_email: string; borrower_phone: string; borrow_date: string; return_date: string; start_time: string; end_time: string; purpose: string; notes: string; }
const emptyForm: FormState = { borrower_name: '', borrower_class: '', borrower_email: '', borrower_phone: '', borrow_date: '', return_date: '', start_time: '', end_time: '', purpose: '', notes: '' };

export default function BorrowPage() {
  const [tab, setTab] = useState<'barang' | 'fasilitas'>('barang');
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [lainnyaMode, setLainnyaMode] = useState(false);
  const [lainnyaName, setLainnyaName] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [inv, fac] = await Promise.all([
          supabase.from('inventory').select('id, code, name, quantity, available_quantity, condition, categories!category_id(name)').order('name'),
          supabase.from('facilities').select('id, name, capacity, location').order('name'),
        ]);
        if (inv.error) throw inv.error;
        setInventory((inv.data as unknown as InventoryItem[]) ?? []);
        setFacilities((fac.data as unknown as Facility[]) ?? []);
      } catch {
        /* noop */
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const set = (k: keyof FormState, v: string) => setForm((p) => ({ ...p, [k]: v }));

  const filteredInventory = inventory.filter((i) => !search || i.name.toLowerCase().includes(search.toLowerCase()) || i.code.toLowerCase().includes(search.toLowerCase()));
  const filteredFacilities = facilities.filter((f) => !search || f.name.toLowerCase().includes(search.toLowerCase()));

  const addToCart = (item: CartItem) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.key === item.key);
      if (existing) return prev.map((c) => c.key === item.key ? { ...c, quantity: c.quantity + 1 } : c);
      return [...prev, { ...item, quantity: 1 }];
    });
  };
  const removeFromCart = (key: string) => setCart((prev) => prev.filter((c) => c.key !== key));
  const changeQty = (key: string, delta: number) => setCart((prev) => prev.map((c) => c.key === key ? { ...c, quantity: Math.max(1, c.quantity + delta) } : c));

  const addLainnya = () => {
    if (!lainnyaName.trim()) { showToast('Masukkan nama item terlebih dahulu', 'error'); return; }
    const key = `lainnya-${tab}-${lainnyaName.trim()}`;
    addToCart({ key, inventory_id: null, facility_id: null, item_type: tab, item_name: lainnyaName.trim(), quantity: 1 });
    setLainnyaName(''); setLainnyaMode(false);
    showToast('Item "Lainnya" ditambahkan ke keranjang', 'success');
  };

  const validate = () => {
    if (cart.length === 0) return showToast('Keranjang masih kosong', 'error'), false;
    if (!form.borrower_name.trim()) return showToast('Nama peminjam wajib diisi', 'error'), false;
    if (!form.borrower_class.trim()) return showToast('Kelas/Unit peminjam wajib diisi', 'error'), false;
    if (!form.borrower_email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.borrower_email)) return showToast('Email valid wajib diisi', 'error'), false;
    if (!form.borrow_date) return showToast('Tanggal pinjam wajib diisi', 'error'), false;
    if (!form.return_date) return showToast('Tanggal kembali wajib diisi', 'error'), false;
    if (form.return_date < form.borrow_date) return showToast('Tanggal kembali tidak boleh sebelum tanggal pinjam', 'error'), false;
    if (!form.purpose.trim()) return showToast('Tujuan peminjaman wajib diisi', 'error'), false;
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);
    try {
      const hasLainnya = cart.some((c) => c.inventory_id === null && c.facility_id === null);
      const hasRegular = cart.some((c) => c.inventory_id !== null || c.facility_id !== null);
      let workflow = hasLainnya && !hasRegular ? await getWorkflowLainnya() : await getDefaultWorkflow();
      if (!workflow) workflow = await getDefaultWorkflow();

      const { data: borrowing, error } = await supabase.from('borrowings').insert({
        borrower_name: form.borrower_name.trim(),
        borrower_class: form.borrower_class.trim(),
        borrower_email: form.borrower_email.trim(),
        borrower_phone: form.borrower_phone.trim() || null,
        borrow_date: form.borrow_date,
        return_date: form.return_date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        purpose: form.purpose.trim(),
        notes: form.notes.trim() || null,
        item_type: cart[0]?.item_type ?? 'barang',
        inventory_id: cart.find((c) => c.inventory_id)?.inventory_id ?? null,
        facility_id: cart.find((c) => c.facility_id)?.facility_id ?? null,
        borrowed_units: cart.reduce((s, c) => s + c.quantity, 0),
        status: 'pending',
        workflow_template_id: workflow?.id ?? null,
        current_step: workflow ? 1 : null,
        current_status_label: 'Menunggu Persetujuan',
      }).select().single();
      if (error) throw error;
      const borrowingId = (borrowing as unknown as { id: string }).id;

      const itemsToInsert = cart.map((c) => ({
        borrowing_id: borrowingId,
        inventory_id: c.inventory_id,
        facility_id: c.facility_id,
        item_type: c.item_type,
        item_name: c.item_name,
        quantity: c.quantity,
        status: 'pending',
        workflow_template_id: workflow?.id ?? null,
        current_step: workflow ? 1 : null,
        current_status_label: 'Menunggu Persetujuan',
      }));
      const { error: itemsError } = await supabase.from('borrowing_items').insert(itemsToInsert);
      if (itemsError) throw itemsError;

      try {
        const steps = await getWorkflowSteps(workflow?.id ?? '');
        const firstStep = steps.find((s) => s.step_order === 1) ?? steps[0];
        let recipientEmail = '';
        if (firstStep?.role_id) {
          const { data: approver } = await supabase
            .from('role_approver_emails')
            .select('approver_email')
            .eq('role_id', firstStep.role_id)
            .eq('is_active', true)
            .maybeSingle();
          recipientEmail = (approver as unknown as { approver_email: string } | null)?.approver_email ?? '';
        }
        if (recipientEmail) {
          const itemList = cart.map((c) => `<tr><td style="padding:6px 12px;border:1px solid #e2e8f0;">${c.item_type === 'barang' ? 'Barang' : 'Fasilitas'}</td><td style="padding:6px 12px;border:1px solid #e2e8f0;">${c.item_name}</td><td style="padding:6px 12px;border:1px solid #e2e8f0;">${c.quantity}</td></tr>`).join('');
          const timeStr = [form.start_time, form.end_time].filter(Boolean).join(' - ') || '-';
          const message = `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
              <h2 style="color:#0f766e;">Pengajuan Peminjaman Baru</h2>
              <p>Ada pengajuan peminjaman baru yang memerlukan persetujuan Anda.</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <tr><td style="padding:6px 12px;font-weight:bold;">Nama Pemohon</td><td style="padding:6px 12px;">${form.borrower_name.trim()}</td></tr>
                <tr><td style="padding:6px 12px;font-weight:bold;">Kelas/Unit</td><td style="padding:6px 12px;">${form.borrower_class.trim()}</td></tr>
                <tr><td style="padding:6px 12px;font-weight:bold;">Tanggal</td><td style="padding:6px 12px;">${form.borrow_date} s/d ${form.return_date}</td></tr>
                <tr><td style="padding:6px 12px;font-weight:bold;">Waktu</td><td style="padding:6px 12px;">${timeStr}</td></tr>
                <tr><td style="padding:6px 12px;font-weight:bold;">Tujuan</td><td style="padding:6px 12px;">${form.purpose.trim()}</td></tr>
              </table>
              <h3 style="color:#334155;">Detail Peminjaman</h3>
              <table style="width:100%;border-collapse:collapse;margin:8px 0;">
                <tr style="background:#f1f5f9;"><th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left;">Jenis</th><th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left;">Nama</th><th style="padding:6px 12px;border:1px solid #e2e8f0;text-align:left;">Jumlah</th></tr>
                ${itemList}
              </table>
              <a href="${window.location.origin}/admin/borrowings" style="display:inline-block;margin-top:16px;background:#0f766e;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Lihat Pengajuan</a>
            </div>`;
          const { error: emailError } = await supabase.functions.invoke('send-borrowing-email', {
            body: { recipientEmail, subject: 'Pengajuan Peminjaman Baru - Smart Sarpras', message },
          });
          if (emailError) {
            console.warn('[BorrowPage] Gagal mengirim email ke approver pertama:', emailError);
          } else {
            console.log('[BorrowPage] Email berhasil dikirim ke approver pertama');
          }
        } else {
          console.warn('[BorrowPage] Email approver pertama tidak ditemukan, email tidak dikirim');
        }
      } catch (emailErr) {
        console.warn('[BorrowPage] Gagal mengirim email (non-blocking):', emailErr);
      }

      showToast('Pengajuan peminjaman berhasil dibuat', 'success');
      setSuccess(true);
    } catch (err: any) {
      showToast(err?.message ?? 'Gagal membuat pengajuan', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const reset = () => { setCart([]); setForm(emptyForm); setSuccess(false); };

  if (success) {
    return (
      <div className="relative min-h-[60vh] overflow-hidden py-12 pb-12">
        <AnimatedBackground />
        <div className="relative mx-auto max-w-lg px-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Pengajuan Berhasil Dibuat</h2>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Pengajuan peminjaman Anda telah tersimpan. Anda akan mendapat notifikasi via email.</p>
            <button onClick={reset} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
              <Plus className="h-4 w-4" /> Buat Pengajuan Lain
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative pb-12">
      <div className="relative overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 py-12">
        <AnimatedBackground />
        <div className="relative mx-auto max-w-7xl px-4 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-md">
            <ClipboardList className="h-7 w-7 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Pengajuan Peminjaman</h1>
          <p className="mt-2 text-sm text-white/80">Pilih barang/fasilitas, isi data, lalu kirim pengajuan</p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* LEFT: items */}
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
                  <button onClick={() => setTab('barang')} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'barang' ? 'bg-white text-brand-700 shadow dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    <Package className="mr-1.5 inline h-4 w-4" /> Barang
                  </button>
                  <button onClick={() => setTab('fasilitas')} className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === 'fasilitas' ? 'bg-white text-brand-700 shadow dark:bg-slate-700 dark:text-brand-300' : 'text-slate-500 dark:text-slate-400'}`}>
                    <Building2 className="mr-1.5 inline h-4 w-4" /> Fasilitas
                  </button>
                </div>
                <div className="relative sm:w-56">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cari…" className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
              </div>

              {loading ? (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100 dark:bg-slate-800" />)}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {/* Lainnya card */}
                  {lainnyaMode ? (
                    <div className="flex flex-col justify-center rounded-xl border-2 border-dashed border-brand-400 bg-brand-50 p-3 dark:border-brand-600 dark:bg-brand-900/20">
                      <input value={lainnyaName} onChange={(e) => setLainnyaName(e.target.value)} placeholder={`Nama ${tab} lain…`} autoFocus className="mb-2 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                      <div className="flex gap-1.5">
                        <button onClick={addLainnya} className="flex-1 rounded-lg bg-brand-600 py-1.5 text-xs font-semibold text-white hover:bg-brand-700">Tambah</button>
                        <button onClick={() => { setLainnyaMode(false); setLainnyaName(''); }} className="rounded-lg border border-slate-300 px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"><X className="h-3.5 w-3.5" /></button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setLainnyaMode(true)} className="flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 p-4 text-slate-500 transition hover:border-brand-400 hover:text-brand-600 dark:border-slate-700 dark:hover:border-brand-600 dark:hover:text-brand-400">
                      <Plus className="h-6 w-6" />
                      <span className="text-xs font-medium">Lainnya…</span>
                    </button>
                  )}

                  {tab === 'barang' ? filteredInventory.map((i) => (
                    <button key={i.id} onClick={() => addToCart({ key: `inv-${i.id}`, inventory_id: i.id, facility_id: null, item_type: 'barang', item_name: i.name, quantity: 1 })} disabled={i.available_quantity <= 0} className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-400 hover:shadow-md disabled:opacity-50 dark:border-slate-800 dark:bg-slate-800">
                      <div className="mb-2 flex h-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700"><Package className="h-5 w-5 text-slate-400" /></div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1">{i.name}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{i.code} · Tersedia: {i.available_quantity}</p>
                    </button>
                  )) : filteredFacilities.map((f) => (
                    <button key={f.id} onClick={() => addToCart({ key: `fac-${f.id}`, inventory_id: null, facility_id: f.id, item_type: 'fasilitas', item_name: f.name, quantity: 1 })} className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-brand-400 hover:shadow-md dark:border-slate-800 dark:bg-slate-800">
                      <div className="mb-2 flex h-10 items-center justify-center rounded-lg bg-slate-100 dark:bg-slate-700"><Building2 className="h-5 w-5 text-slate-400" /></div>
                      <p className="text-xs font-semibold text-slate-900 dark:text-white line-clamp-1">{f.name}</p>
                      <p className="mt-0.5 text-[10px] text-slate-400">{f.location ?? '-'} · {f.capacity ?? 0} orang</p>
                    </button>
                  ))}
                </div>
              )}
              {!loading && ((tab === 'barang' && filteredInventory.length === 0) || (tab === 'fasilitas' && filteredFacilities.length === 0)) && (
                <EmptyState title="Tidak ditemukan" description="Tidak ada item yang cocok dengan pencarian." className="py-6" />
              )}
            </div>
          </div>

          {/* RIGHT: cart + form */}
          <div className="lg:col-span-1">
            <form onSubmit={handleSubmit} className="sticky top-20 rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-brand-600 dark:text-brand-400" />
                <h3 className="font-bold text-slate-900 dark:text-white">Keranjang ({cart.length})</h3>
              </div>

              {cart.length === 0 ? (
                <p className="mb-4 rounded-xl bg-slate-50 p-4 text-center text-sm text-slate-400 dark:bg-slate-800">Keranjang kosong. Pilih item di sebelah kiri.</p>
              ) : (
                <div className="mb-4 space-y-2">
                  {cart.map((c) => (
                    <div key={c.key} className="flex items-center gap-2 rounded-xl border border-slate-100 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-800">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-semibold text-slate-900 dark:text-white">{c.item_name}</p>
                        <p className="text-[10px] text-slate-400 capitalize">{c.item_type}{c.inventory_id === null && c.facility_id === null ? ' · lainnya' : ''}</p>
                      </div>
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => changeQty(c.key, -1)} className="rounded-md bg-white p-1 text-slate-500 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600"><Minus className="h-3 w-3" /></button>
                        <span className="w-6 text-center text-xs font-semibold text-slate-900 dark:text-white">{c.quantity}</span>
                        <button type="button" onClick={() => changeQty(c.key, 1)} className="rounded-md bg-white p-1 text-slate-500 hover:bg-slate-100 dark:bg-slate-700 dark:hover:bg-slate-600"><Plus className="h-3 w-3" /></button>
                        <button type="button" onClick={() => removeFromCart(c.key)} className="rounded-md p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="h-3 w-3" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-2">
                  <input value={form.borrower_name} onChange={(e) => set('borrower_name', e.target.value)} placeholder="Nama *" className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                  <input value={form.borrower_class} onChange={(e) => set('borrower_class', e.target.value)} placeholder="Kelas/Unit *" className="rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
                <input type="email" value={form.borrower_email} onChange={(e) => set('borrower_email', e.target.value)} placeholder="Email *" className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                <input value={form.borrower_phone} onChange={(e) => set('borrower_phone', e.target.value)} placeholder="No. HP (opsional)" className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                <div className="grid grid-cols-2 gap-2">
                  <div><label className="mb-0.5 block text-[10px] text-slate-500">Tgl Pinjam *</label><input type="date" value={form.borrow_date} onChange={(e) => set('borrow_date', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div>
                  <div><label className="mb-0.5 block text-[10px] text-slate-500">Tgl Kembali *</label><input type="date" value={form.return_date} onChange={(e) => set('return_date', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" /></div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input type="time" value={form.start_time} onChange={(e) => set('start_time', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                  <input type="time" value={form.end_time} onChange={(e) => set('end_time', e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                </div>
                <input value={form.purpose} onChange={(e) => set('purpose', e.target.value)} placeholder="Tujuan *" className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
                <textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Catatan (opsional)" rows={2} className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs text-slate-900 outline-none focus:border-brand-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white" />
              </div>

              <button type="submit" disabled={submitting || cart.length === 0} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />} {submitting ? 'Mengirim…' : 'Kirim Pengajuan'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
