import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import {
  Home,
  Package,
  Building2,
  FileText,
  CalendarDays,
  CalendarRange,
  Info,
  LogIn,
  LogOut,
  LayoutDashboard,
  Menu,
  X,
  Moon,
  Sun,
  ChevronDown,
  MessageSquare,
  MapPin,
  ClipboardList,
} from 'lucide-react';
import { brand } from '../brand/config';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { cn } from '../utils/cn';
import { fetchPublicFeatures } from '../lib/publicFeatures';

const mainNav = [
  { to: '/', label: 'Beranda', icon: Home },
  { to: '/fasilitas', label: 'Fasilitas', icon: Building2 },
  { to: '/inventaris', label: 'Inventaris', icon: Package },
  { to: '/pinjam', label: 'Peminjaman', icon: ClipboardList },
  { to: '/laporan', label: 'Laporan', icon: FileText },
  { to: '/agenda', label: 'Agenda', icon: CalendarDays },
  { to: '/aspirasi', label: 'Aspirasi', icon: MessageSquare },
];

const kavlingNav = [
  { to: '/kavling/input', label: 'Input Kavling', icon: MapPin },
  { to: '/kavling/data', label: 'Data Kavling', icon: MapPin },
];

const otherNav = [
  { to: '/timeline', label: 'Timeline', icon: CalendarRange },
  { to: '/tentang', label: 'Tentang', icon: Info },
];

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const {
    user,
    adminProfile,
    permissions,
    isSuperAdmin,
    signOut,
  } = useAuth();
  const [open, setOpen] = useState(false);
  const [otherOpen, setOtherOpen] = useState(false);
  const [borrowingEnabled, setBorrowingEnabled] = useState(false);
  const otherRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (otherRef.current && !otherRef.current.contains(event.target as Node)) setOtherOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    let mounted = true;

    void fetchPublicFeatures()
      .then((features) => {
        if (mounted) {
          setBorrowingEnabled(
            features.borrowingEnabled
          );
        }
      })
      .catch((error) => {
        console.error(
          '[Navbar] gagal memuat public features:',
          error
        );

        if (mounted) {
          setBorrowingEnabled(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const isActive = (to: string) => to === '/' ? location.pathname === '/' : location.pathname.startsWith(to);

  const handleLogout = async () => {
    await signOut();
    navigate('/auth');
  };

  const renderAuthButtons = (mobile = false) => {
    if (!user) {
      return (
        <button
          onClick={() => { setOpen(false); navigate('/auth'); }}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700',
            mobile && 'w-full justify-center'
          )}
        >
          <LogIn className="h-4 w-4" /> Masuk
        </button>
      );
    }

    return (
      <div className={cn('flex items-center gap-2', mobile && 'w-full flex-col')}>
        {(adminProfile || isSuperAdmin || permissions.size > 0) && (
          <button
            onClick={() => { setOpen(false); navigate('/admin/dashboard'); }}
            className={cn('inline-flex items-center gap-2 rounded-lg bg-brand-700 px-3.5 py-2 text-sm font-medium text-white hover:bg-brand-800', mobile && 'w-full justify-center')}
          >
            <LayoutDashboard className="h-4 w-4" /> Admin
          </button>
        )}
        <button
          onClick={handleLogout}
          className={cn('inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700', mobile && 'w-full justify-center')}
        >
          <LogOut className="h-4 w-4" /> Keluar
        </button>
      </div>
    );
  };

  const visibleMainNav =
    mainNav.filter(
      (item) =>
        item.to !== '/pinjam' ||
        borrowingEnabled
    );

  const otherActive = [...kavlingNav, ...otherNav].some((item) => isActive(item.to));

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-700 text-white"><Building2 className="h-4 w-4" /></div>
          <span className="text-base font-semibold text-slate-900 dark:text-white">{brand.name}</span>
        </Link>

        <div className="hidden items-center gap-1 lg:flex">
          {visibleMainNav.map((item) => {
            const active = isActive(item.to);
            return (
              <Link key={item.to} to={item.to} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition', active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
                <item.icon className="h-4 w-4" /> {item.label}
              </Link>
            );
          })}

          <div className="relative" ref={otherRef}>
            <button onClick={() => setOtherOpen((value) => !value)} className={cn('inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition', otherActive ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
              Lainnya <ChevronDown className={cn('h-3.5 w-3.5 transition', otherOpen && 'rotate-180')} />
            </button>

            {otherOpen && (
              <div className="absolute right-0 mt-1 w-48 rounded-lg border border-slate-200 bg-white py-1 shadow-sm dark:border-slate-700 dark:bg-slate-900">
                <p className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Kavling</p>
                {kavlingNav.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <Link key={item.to} to={item.to} onClick={() => setOtherOpen(false)} className={cn('flex items-center gap-2 px-3 py-2 text-sm font-medium transition', active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
                      <item.icon className="h-4 w-4" /> {item.label}
                    </Link>
                  );
                })}
                <div className="my-1 border-t border-slate-100 dark:border-slate-800" />
                {otherNav.map((item) => {
                  const active = isActive(item.to);
                  return (
                    <Link key={item.to} to={item.to} onClick={() => setOtherOpen(false)} className={cn('flex items-center gap-2 px-3 py-2 text-sm font-medium transition', active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
                      <item.icon className="h-4 w-4" /> {item.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={toggleTheme} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800" aria-label="Toggle theme">
            {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
          <div className="hidden sm:flex sm:items-center sm:gap-2">{renderAuthButtons()}</div>
          <button onClick={() => setOpen((value) => !value)} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 lg:hidden">
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {open && (
        <div className="border-t border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-950 lg:hidden">
          <div className="flex flex-col gap-1">
            {visibleMainNav.map((item) => {
              const active = isActive(item.to);
              return (
                <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className={cn('flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium', active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
                  <item.icon className="h-4 w-4" /> {item.label}
                </Link>
              );
            })}
            <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
            <p className="px-3 py-1 text-xs font-medium uppercase tracking-wide text-slate-400">Lainnya</p>
            {[...kavlingNav, ...otherNav].map((item) => {
              const active = isActive(item.to);
              return (
                <Link key={item.to} to={item.to} onClick={() => setOpen(false)} className={cn('flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium', active ? 'bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')}>
                  <item.icon className="h-4 w-4" /> {item.label}
                </Link>
              );
            })}
            <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
            {renderAuthButtons(true)}
          </div>
        </div>
      )}
    </header>
  );
}
