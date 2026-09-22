import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { LayoutDashboard, Package, Building2, ClipboardList, CalendarDays, CalendarRange, FileText, Users, Megaphone, MessageSquare, BarChart3, UserCog, ShieldCheck, Workflow, Settings, Mail, LogOut, Menu, X, Moon, Sun, ScrollText, MapPin, FolderOpen, School, Trophy, ChevronDown, BookOpenCheck, FlaskConical } from 'lucide-react';
import { brand } from '../brand/config';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { cn } from '../utils/cn';

interface NavItem { to: string; label: string; icon: typeof LayoutDashboard; permission: string; }

const mainNav: NavItem[] = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, permission: 'dashboard:read' },
  { to: '/admin/borrowings', label: 'Peminjaman', icon: ClipboardList, permission: 'borrowings:read' },
  { to: '/admin/agenda', label: 'Agenda', icon: CalendarDays, permission: 'agenda:read' },
  { to: '/admin/timeline', label: 'Timeline', icon: CalendarRange, permission: 'timeline:read' },
  { to: '/admin/inventory', label: 'Inventaris', icon: Package, permission: 'inventory:read' },
  { to: '/admin/facilities', label: 'Fasilitas', icon: Building2, permission: 'facilities:read' },
  { to: '/admin/reports', label: 'Laporan', icon: FileText, permission: 'reports:read' },
  { to: '/admin/team', label: 'Tim', icon: Users, permission: 'team:read' },
  { to: '/admin/announcements', label: 'Pengumuman', icon: Megaphone, permission: 'announcements:read' },
  { to: '/admin/aspirasi', label: 'Aspirasi', icon: MessageSquare, permission: 'aspirasi:read' },
  { to: '/admin/statistics', label: 'Statistik', icon: BarChart3, permission: 'statistics:read' },
  { to: '/admin/system-testing', label: 'System Testing', icon: FlaskConical, permission: 'dashboard:read' },
];
const lainnyaNav: NavItem[] = [
  { to: '/admin/lainnya/input-kavling', label: 'Input Kavling', icon: MapPin, permission: 'kavling:create' },
  { to: '/admin/lainnya/data-kavling', label: 'Data Kavling', icon: FolderOpen, permission: 'kavling:read' },
  { to: '/admin/lainnya/master-kelas', label: 'Master Kelas', icon: School, permission: 'master_data:read' },
  { to: '/admin/lainnya/master-ekstrakurikuler', label: 'Master Ekstrakurikuler', icon: Trophy, permission: 'master_data:read' },
];
const superNav: NavItem[] = [
  { to: '/admin/users', label: 'Manajemen User', icon: UserCog, permission: 'users:read' },
  { to: '/admin/roles', label: 'Roles & Permissions', icon: ShieldCheck, permission: 'roles:read' },
  { to: '/admin/facility-managers', label: 'PJ Fasilitas', icon: Building2, permission: 'facility_managers:read' },
  { to: '/admin/workflows', label: 'Workflow', icon: Workflow, permission: 'workflows:read' },
  { to: '/admin/system-config', label: 'Konfigurasi Sistem', icon: Settings, permission: 'system_config:read' },
  { to: '/admin/approver-emails', label: 'Email Approver', icon: Mail, permission: 'approver_emails:read' },
  { to: '/admin/system-settings', label: 'Pengaturan Sistem', icon: Settings, permission: 'system_config:read' },
  { to: '/admin/borrowing-guide', label: 'Panduan Peminjaman', icon: BookOpenCheck, permission: 'system_config:read' },
  { to: '/admin/activity-logs', label: 'Activity Logs', icon: ScrollText, permission: 'system_config:read' },
];

export default function AdminLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { adminProfile, signOut, hasPermission, isSuperAdmin } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [lainnyaOpen, setLainnyaOpen] = useState(() => location.pathname.startsWith('/admin/lainnya'));

  const visibleMain = mainNav.filter((n) => hasPermission(n.permission.split(':')[0], n.permission.split(':')[1]));
  const visibleLainnya = lainnyaNav.filter((n) => hasPermission(n.permission.split(':')[0], n.permission.split(':')[1]));
  const visibleSuper = superNav.filter((n) => {
    if (
      n.to === '/admin/activity-logs' ||
      n.to === '/admin/borrowing-guide'
    ) {
      return isSuperAdmin;
    }

    return hasPermission(n.permission.split(':')[0], n.permission.split(':')[1]);
  });
  const handleSignOut = async () => { await signOut(); navigate('/'); };

  const renderNav = (items: NavItem[]) => items.map((item) => {
    const active = location.pathname === item.to || location.pathname.startsWith(item.to + '/');
    return (
      <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className={cn('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition', active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
        <item.icon className="h-4 w-4 shrink-0" /> {item.label}
      </Link>
    );
  });

  const lainnyaActive = location.pathname.startsWith('/admin/lainnya');

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-slate-950">
      <aside className={cn('fixed inset-y-0 left-0 z-50 w-60 transform border-r border-slate-200 bg-white transition-transform dark:border-slate-800 dark:bg-slate-900 lg:translate-x-0', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-14 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800">
          <Link to="/admin/dashboard" className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-white"><Building2 className="h-3.5 w-3.5" /></div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{brand.name}</span>
          </Link>
          <button onClick={() => setOpen(false)} className="lg:hidden"><X className="h-5 w-5 text-slate-500" /></button>
        </div>
        <div className="flex h-[calc(100vh-3.5rem)] flex-col overflow-y-auto px-3 py-4">
          <div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Menu Utama</div>
          <div className="mb-4 flex flex-col gap-0.5">{renderNav(visibleMain)}</div>

          {visibleLainnya.length > 0 && (
            <div className="mb-4">
              <button onClick={() => setLainnyaOpen((v) => !v)} className={cn('flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold uppercase tracking-wide transition', lainnyaActive ? 'text-brand-700 dark:text-brand-300' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300')}>
                Lainnya
                <ChevronDown className={cn('ml-auto h-4 w-4 transition-transform', lainnyaOpen ? 'rotate-180' : '')} />
              </button>
              {lainnyaOpen && <div className="mt-1 flex flex-col gap-0.5">{renderNav(visibleLainnya)}</div>}
            </div>
          )}

          {visibleSuper.length > 0 && (<><div className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-slate-400">Superadmin</div><div className="mb-4 flex flex-col gap-0.5">{renderNav(visibleSuper)}</div></>)}
          <div className="mt-auto border-t border-slate-200 pt-3 dark:border-slate-800">
            <div className="mb-3 px-3"><p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{adminProfile?.name ?? 'Admin'}</p><p className="truncate text-xs text-slate-500 dark:text-slate-400">{adminProfile?.email ?? ''}</p></div>
            <button onClick={handleSignOut} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><LogOut className="h-4 w-4" /> Keluar</button>
          </div>
        </div>
      </aside>
      <div className="flex min-h-screen flex-1 flex-col lg:pl-60">
        <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
          <button onClick={() => setOpen(true)} className="lg:hidden"><Menu className="h-5 w-5 text-slate-600 dark:text-slate-300" /></button>
          <h1 className="text-sm font-semibold text-slate-900 dark:text-white">Panel Admin</h1>
          <button onClick={toggleTheme} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800">{theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}</button>
        </header>
        <main className="flex-1 p-4 lg:p-6"><Outlet /></main>
      </div>
    </div>
  );
}
