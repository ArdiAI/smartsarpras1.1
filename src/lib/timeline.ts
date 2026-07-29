import { supabase } from './supabase';

export type EventColorCategory = 'agenda' | 'approved' | 'pending' | 'rejected' | 'borrowed' | 'returned';
export interface TimelineEvent { id: string; jenis: 'Agenda' | 'Peminjaman'; title: string; date: string; startDate: string | null; endDate: string | null; startTime: string | null; endTime: string | null; location: string | null; organisasi: string | null; penanggungJawab: string | null; status: string; colorCategory: EventColorCategory; description: string | null; }

export const colorCategoryStyles: Record<EventColorCategory, { bg: string; dot: string; text: string; label: string }> = {
  agenda: { bg: 'bg-blue-100 dark:bg-blue-900/40', dot: 'bg-blue-500', text: 'text-blue-700 dark:text-blue-300', label: 'Agenda' },
  approved: { bg: 'bg-emerald-100 dark:bg-emerald-900/40', dot: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-300', label: 'Disetujui' },
  pending: { bg: 'bg-amber-100 dark:bg-amber-900/40', dot: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-300', label: 'Menunggu' },
  rejected: { bg: 'bg-red-100 dark:bg-red-900/40', dot: 'bg-red-500', text: 'text-red-700 dark:text-red-300', label: 'Ditolak' },
  borrowed: { bg: 'bg-purple-100 dark:bg-purple-900/40', dot: 'bg-purple-500', text: 'text-purple-700 dark:text-purple-300', label: 'Dipinjam' },
  returned: { bg: 'bg-slate-100 dark:bg-slate-700/40', dot: 'bg-slate-500', text: 'text-slate-700 dark:text-slate-300', label: 'Dikembalikan' },
};

export function colorCategoryFor(jenis: string, status: string): EventColorCategory {
  if (jenis === 'Agenda' || jenis === 'agenda') return 'agenda';
  switch (status) { case 'approved': return 'approved'; case 'pending': return 'pending'; case 'rejected': return 'rejected'; case 'returned': case 'completed': return 'returned'; default: return 'borrowed'; }
}

function pad(n: number) { return n.toString().padStart(2, '0'); }

export async function fetchTimelineEvents(year: number, month: number): Promise<TimelineEvent[]> {
  const start = `${year}-${pad(month + 1)}-01`;
  const end = `${year}-${pad(month + 1)}-31`;
  const events: TimelineEvent[] = [];

  const { data: agendas } = await supabase.from('agendas')
    .select('id, title, category, event_date, end_date, start_time, end_time, location, organizer, description, status, penyelenggara, organisasi_jurusan, penanggung_jawab, jenis_kegiatan, email, jumlah_peserta')
    .gte('event_date', start).lte('event_date', end);

  (agendas ?? []).forEach((a: any) => {
    events.push({ id: a.id, jenis: 'Agenda', title: a.title ?? 'Agenda', date: a.event_date, startDate: a.event_date ?? null, endDate: a.end_date ?? null, startTime: a.start_time ?? null, endTime: a.end_time ?? null, location: a.location ?? null, organisasi: a.organisasi_jurusan ?? a.penyelenggara ?? a.organizer ?? null, penanggungJawab: a.penanggung_jawab ?? null, status: a.status ?? 'scheduled', colorCategory: 'agenda', description: a.description ?? null });
  });

  const { data: borrowings } = await supabase.from('borrowings')
    .select('id, borrower_name, borrow_date, return_date, start_time, end_time, purpose, status, item_type, notes')
    .or(`and(borrow_date.gte.${start},borrow_date.lte.${end}),and(return_date.gte.${start},return_date.lte.${end})`);

  (borrowings ?? []).forEach((b: any) => {
    const date = b.borrow_date ?? b.return_date;
    if (!date) return;
    events.push({ id: b.id, jenis: 'Peminjaman', title: b.purpose ?? b.borrower_name ?? 'Peminjaman', date, startDate: b.borrow_date ?? null, endDate: b.return_date ?? null, startTime: b.start_time ?? null, endTime: b.end_time ?? null, location: null, organisasi: null, penanggungJawab: b.borrower_name ?? null, status: b.status ?? 'pending', colorCategory: colorCategoryFor('Peminjaman', b.status ?? 'pending'), description: b.notes ?? null });
  });

  events.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return events;
}

export async function fetchTodayCounts(): Promise<{ agendaToday: number; borrowToday: number; weekTotal: number }> {
  const now = new Date();
  const y = now.getFullYear(); const m = now.getMonth() + 1; const d = pad(now.getDate());
  const today = `${y}-${pad(m)}-${d}`;
  const weekEnd = new Date(now.getTime() + 6 * 24 * 60 * 60 * 1000);
  const weekEndStr = `${weekEnd.getFullYear()}-${pad(weekEnd.getMonth() + 1)}-${pad(weekEnd.getDate())}`;

  const [agendas, borrowings] = await Promise.all([
    supabase.from('agendas').select('id', { count: 'exact', head: true }).eq('event_date', today),
    supabase.from('borrowings').select('id', { count: 'exact', head: true }).eq('borrow_date', today),
  ]);
  const weekAgendas = await supabase.from('agendas').select('id', { count: 'exact', head: true }).gte('event_date', today).lte('event_date', weekEndStr);
  const weekBorrow = await supabase.from('borrowings').select('id', { count: 'exact', head: true }).gte('borrow_date', today).lte('borrow_date', weekEndStr);

  return { agendaToday: agendas.count ?? 0, borrowToday: borrowings.count ?? 0, weekTotal: (weekAgendas.count ?? 0) + (weekBorrow.count ?? 0) };
}
