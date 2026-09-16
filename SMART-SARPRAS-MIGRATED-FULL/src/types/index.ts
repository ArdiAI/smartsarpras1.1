export type ItemCondition = 'good' | 'fair' | 'poor';
export type BorrowingStatus = 'pending' | 'approved' | 'rejected' | 'completed' | 'cancelled';
export type DamageSeverity = 'minor' | 'moderate' | 'severe';
export type DamageStatus = 'pending' | 'in_progress' | 'resolved';

export interface Category {
  id: string;
  name: string;
  description: string;
  created_at: string;
}

export interface Facility {
  id: string;
  name: string;
  description: string;
  location: string;
  capacity: number;
  image_url: string;
  created_at: string;
}

export interface Inventory {
  id: string;
  code: string;
  name: string;
  category_id: string;
  quantity: number;
  available_quantity: number;
  condition: ItemCondition;
  location: string;
  image_url: string;
  purchase_date: string;
  price: number;
  description: string;
  created_at: string;
  categories?: Category;
}

export interface Borrowing {
  id: string;
  inventory_id: string | null;
  facility_id: string | null;
  borrower_name: string;
  borrower_class: string;
  borrower_email: string;
  borrower_phone: string;
  borrowed_units: number;
  item_type: 'barang' | 'ruangan';
  borrow_date: string;
  return_date: string | null;
  start_time: string;
  end_time: string;
  actual_return_date: string | null;
  purpose: string;
  status: BorrowingStatus;
  notes: string;
  admin_notes: string;
  document_url: string;
  document_name: string;
  approved_by: string;
  approver_position: string;
  approved_at: string | null;
  created_at: string;
  inventory?: Inventory;
  facilities?: Facility;
}

export interface DamageReport {
  id: string;
  inventory_id: string;
  reporter_name: string;
  reporter_unit: string;
  reporter_email: string;
  reporter_phone: string;
  description: string;
  location: string;
  image_url: string;
  severity: DamageSeverity;
  status: DamageStatus;
  resolution_notes: string;
  created_at: string;
  resolved_at: string | null;
  inventory?: Inventory;
}

export interface Agenda {
  id: string;
  title: string;
  category: string;
  event_date: string;
  start_time: string;
  end_time: string;
  location: string;
  organizer: string;
  description: string;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  type: string;
  advisor: string;
  leader: string;
  description: string;
  schedule: string;
  contact: string;
  logo_url: string;
  order: number;
  created_at: string;
}

export interface Proposal {
  id: string;
  activity_name: string;
  organization: string;
  proposer_name: string;
  proposer_email: string;
  proposer_phone: string;
  event_date: string;
  event_location: string;
  description: string;
  document_url: string;
  document_name: string;
  status: 'pending' | 'approved' | 'revision' | 'rejected';
  admin_notes: string;
  reviewed_by: string;
  reviewed_at: string | null;
  created_at: string;
}

export interface Achievement {
  id: string;
  student_name: string;
  student_class: string;
  student_major: string;
  achievement_name: string;
  category: 'akademik' | 'non_akademik';
  level: 'sekolah' | 'kota' | 'provinsi' | 'nasional' | 'internasional';
  year: number;
  advisor: string;
  photo_url: string;
  description: string;
  created_at: string;
}

export const BORROWING_STATUS_LABELS: Record<BorrowingStatus, string> = {
  pending: 'Menunggu Persetujuan',
  approved: 'Disetujui',
  rejected: 'Ditolak',
  completed: 'Selesai',
  cancelled: 'Dibatalkan',
};

export const BORROWING_STATUS_COLORS: Record<BorrowingStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  completed: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  cancelled: 'bg-slate-100 text-slate-600 dark:bg-slate-700/50 dark:text-slate-400',
};

export const PROPOSAL_STATUS_LABELS: Record<Proposal['status'], string> = {
  pending: 'Menunggu Verifikasi',
  approved: 'Disetujui',
  revision: 'Revisi',
  rejected: 'Ditolak',
};

export const PROPOSAL_STATUS_COLORS: Record<Proposal['status'], string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  approved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  revision: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  rejected: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export interface Announcement {
  id: string;
  title: string;
  description: string;
  priority: 'tinggi' | 'sedang' | 'rendah';
  status: 'aktif' | 'nonaktif';
  published_at: string;
  created_at: string;
  updated_at: string;
}

export const ANNOUNCEMENT_PRIORITY_LABELS: Record<Announcement['priority'], string> = {
  tinggi: 'Tinggi',
  sedang: 'Sedang',
  rendah: 'Rendah',
};

export const ANNOUNCEMENT_PRIORITY_COLORS: Record<Announcement['priority'], string> = {
  tinggi: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  sedang: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  rendah: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
};

export const DAMAGE_STATUS_LABELS: Record<DamageStatus, string> = {
  pending: 'Menunggu',
  in_progress: 'Diproses',
  resolved: 'Selesai',
};

export const DAMAGE_STATUS_COLORS: Record<DamageStatus, string> = {
  pending: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  in_progress: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  resolved: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export const DAMAGE_SEVERITY_LABELS: Record<DamageSeverity, string> = {
  minor: 'Ringan',
  moderate: 'Sedang',
  severe: 'Berat',
};

export const DAMAGE_SEVERITY_COLORS: Record<DamageSeverity, string> = {
  minor: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  moderate: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  severe: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

export const KELAS_UNIT_OPTIONS = [
  'X TKJ 1', 'X TKJ 2', 'X TKJ 3', 'X TKJ 4',
  'X RPL 1', 'X RPL 2', 'X RPL 3',
  'XI TKJ 1', 'XI TKJ 2', 'XI TKJ 3', 'XI TKJ 4',
  'XI RPL 1', 'XI RPL 2', 'XI RPL 3',
  'XII TKJ 1', 'XII TKJ 2', 'XII TKJ 3', 'XII TKJ 4',
  'XII RPL 1', 'XII RPL 2', 'XII RPL 3',
  'Guru', 'Staff', 'Lainnya'
] as const;

export const ACHIEVEMENT_LEVELS = ['sekolah', 'kota', 'provinsi', 'nasional', 'internasional'] as const;
export const ACHIEVEMENT_CATEGORIES = ['akademik', 'non_akademik'] as const;
export const AGENDA_CATEGORIES = ['sekolah', 'osis', 'mpk', 'ekstrakurikuler', 'sarpras'] as const;

// Aspirasi types
export type AspirasiStatus = 'Menunggu' | 'Dibaca' | 'Diproses' | 'Selesai';
export type AspirasiKategori = 'Sarana' | 'Prasarana' | 'Kebersihan' | 'Keamanan' | 'Lainnya';

export interface Aspirasi {
  id: string;
  nama: string;
  kelas_unit: string;
  email: string;
  kategori: AspirasiKategori;
  judul: string;
  isi: string;
  status: AspirasiStatus;
  tanggapan: string;
  created_at: string;
  updated_at: string;
}

export const ASPIRASI_STATUS_LABELS: Record<AspirasiStatus, string> = {
  Menunggu: 'Menunggu',
  Dibaca: 'Dibaca',
  Diproses: 'Diproses',
  Selesai: 'Selesai',
};

export const ASPIRASI_STATUS_COLORS: Record<AspirasiStatus, string> = {
  Menunggu: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  Dibaca: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  Diproses: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  Selesai: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
};

export const ASPIRASI_KATEGORI_OPTIONS: AspirasiKategori[] = ['Sarana', 'Prasarana', 'Kebersihan', 'Keamanan', 'Lainnya'];

// ===== Kavling =====
export type KavlingKategori = 'Kelas' | 'Ekstrakurikuler' | 'Unit';
export type KavlingStatus = 'Menunggu Verifikasi' | 'Diverifikasi' | 'Ditolak';

export interface Kavling {
  id: string;
  nama_pj: string;
  kelas_unit: string;
  kategori: KavlingKategori;
  nama_kategori: string;
  tanggal: string;
  lokasi: string;
  judul: string;
  deskripsi: string;
  hasil: string;
  catatan: string;
  file_url: string;
  file_name: string;
  status: KavlingStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export const KAVLING_KATEGORI_OPTIONS: KavlingKategori[] = ['Kelas', 'Ekstrakurikuler', 'Unit'];
export const KAVLING_STATUS_LABELS: Record<KavlingStatus, string> = {
  'Menunggu Verifikasi': 'Menunggu Verifikasi',
  'Diverifikasi': 'Diverifikasi',
  'Ditolak': 'Ditolak',
};
export const KAVLING_STATUS_COLORS: Record<KavlingStatus, string> = {
  'Menunggu Verifikasi': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'Diverifikasi': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  'Ditolak': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

// ===== Master Data (Kelas & Ekstrakurikuler) =====
export interface MasterKelas {
  id: string;
  nama: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface MasterEkstrakurikuler {
  id: string;
  nama: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

