import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, XCircle, Loader2, Mail } from 'lucide-react';
import { supabase } from '../lib/supabase';
import AnimatedBackground from '../components/AnimatedBackground';

type State = 'loading' | 'success' | 'error';

export default function ConfirmEmailPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>('loading');
  const [message, setMessage] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const hash = window.location.hash.replace(/^#/, '');
        const params = new URLSearchParams(hash);
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');
        if (!accessToken || !refreshToken) {
          setState('error');
          setMessage('Token tidak ditemukan di URL. Pastikan Anda membuka link konfirmasi dari email.');
          return;
        }
        const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
        if (error) {
          setState('error');
          setMessage(error.message ?? 'Gagal mengonfirmasi email. Token mungkin sudah kedaluwarsa.');
          return;
        }
        setState('success');
        setMessage('Email berhasil dikonfirmasi. Anda akan diarahkan ke beranda…');
        setTimeout(() => navigate('/'), 2500);
      } catch (err: any) {
        setState('error');
        setMessage(err?.message ?? 'Terjadi kesalahan saat mengonfirmasi email.');
      }
    })();
  }, [navigate]);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-cyan-600 px-4 py-12">
      <AnimatedBackground />
      <div className="relative w-full max-w-md">
        <div className="rounded-2xl border border-white/20 bg-white/95 p-8 text-center shadow-2xl backdrop-blur-md dark:bg-slate-900/95">
          {state === 'loading' && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900/30">
                <Loader2 className="h-8 w-8 animate-spin text-brand-600 dark:text-brand-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Mengonfirmasi Email…</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Mohon tunggu sebentar.</p>
            </>
          )}
          {state === 'success' && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Email Terkonfirmasi</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>
            </>
          )}
          {state === 'error' && (
            <>
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">Konfirmasi Gagal</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{message}</p>
              <button onClick={() => navigate('/auth')} className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700">
                <Mail className="h-4 w-4" /> Ke Halaman Masuk
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
