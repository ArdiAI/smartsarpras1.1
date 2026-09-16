import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AccessDenied({ message }: { message?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-4 text-center animate-fade-in">
      <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mb-6">
        <ShieldAlert className="w-10 h-10 text-red-500" />
      </div>
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Akses Ditolak</h1>
      <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">
        {message || 'Anda tidak memiliki izin untuk mengakses halaman ini. Hubungi Super Admin jika Anda merasa ini adalah kesalahan.'}
      </p>
      <Link to="/admin" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Kembali ke Dashboard
      </Link>
    </div>
  );
}
