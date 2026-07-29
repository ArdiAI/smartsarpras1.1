import { Link } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { brand } from '../brand/config';

export default function Footer() {
  return (
    <footer className="border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-700 text-white"><Building2 className="h-3.5 w-3.5" /></div>
            <span className="text-sm font-semibold text-slate-900 dark:text-white">{brand.name}</span>
          </div>
          <div className="flex flex-wrap gap-5 text-sm text-slate-500 dark:text-slate-400">
            <Link to="/fasilitas" className="hover:text-brand-700">Fasilitas</Link>
            <Link to="/inventaris" className="hover:text-brand-700">Inventaris</Link>
            <Link to="/agenda" className="hover:text-brand-700">Agenda</Link>
            <Link to="/timeline" className="hover:text-brand-700">Timeline</Link>
            <Link to="/tentang" className="hover:text-brand-700">Tentang</Link>
          </div>
        </div>
        <p className="mt-4 text-center text-xs text-slate-400">© {new Date().getFullYear()} {brand.name} · {brand.school}</p>
      </div>
    </footer>
  );
}
