import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LogIn,
  UserPlus,
  Loader2,
  Building2,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowLeft,
  CheckCircle2,
} from 'lucide-react';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { brand } from '../brand/config';
import { showToast } from '../components/Toast';

export default function AuthPage() {
  const navigate = useNavigate();
  const { signIn, signUp } = useAuth();

  const [mode, setMode] =
    useState<'login' | 'register'>('login');

  const [forgotPassword, setForgotPassword] =
    useState(false);

  const [resetSent, setResetSent] =
    useState(false);

  const [name, setName] =
    useState('');

  const [email, setEmail] =
    useState('');

  const [password, setPassword] =
    useState('');

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  // =========================================================
  // LOGIN / REGISTER
  // =========================================================

  const handleSubmit = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail || !password.trim()) {
      showToast(
        'Email dan password wajib diisi',
        'error'
      );

      return;
    }

    if (
      mode === 'register' &&
      !name.trim()
    ) {
      showToast(
        'Nama wajib diisi',
        'error'
      );

      return;
    }

    setLoading(true);

    try {
      // =====================================================
      // LOGIN
      // =====================================================

      if (mode === 'login') {
        const { error } =
          await signIn(
            cleanEmail,
            password
          );

        if (error) {
          showToast(
            error,
            'error'
          );

          return;
        }

        showToast(
          'Berhasil masuk',
          'success'
        );

        // Dashboard utama
        navigate('/', {
          replace: true,
        });

        return;
      }

      // =====================================================
      // REGISTER
      // =====================================================

      const { error } =
        await signUp(
          cleanEmail,
          password,
          name.trim()
        );

      if (error) {
        showToast(
          error,
          'error'
        );

        return;
      }

      showToast(
        'Pendaftaran berhasil. Silakan cek email untuk verifikasi. Jika tidak ada di Kotak Masuk, silakan cek folder Spam.',
        'success'
      );

      setMode('login');
      setPassword('');
    } catch (err) {
      console.error(
        'AUTH ERROR:',
        err
      );

      showToast(
        'Terjadi kesalahan',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // LUPA PASSWORD
  // =========================================================

  const handleForgotPassword = async (
    e: React.FormEvent
  ) => {
    e.preventDefault();

    const cleanEmail =
      email.trim().toLowerCase();

    if (!cleanEmail) {
      showToast(
        'Masukkan email terlebih dahulu',
        'error'
      );

      return;
    }

    const emailRegex =
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (
      !emailRegex.test(cleanEmail)
    ) {
      showToast(
        'Format email tidak valid',
        'error'
      );

      return;
    }

    setLoading(true);

    try {
      // =====================================================
      // DOMAIN OTOMATIS
      //
      // Testing di Bolt:
      // https://xxx.bolt.host/reset-password
      //
      // Nanti di website sekolah:
      // https://domain-sekolah.sch.id/reset-password
      //
      // Tidak perlu ubah source code.
      // =====================================================

      const redirectUrl =
        `${window.location.origin}/reset-password`;

      console.log(
        'RESET PASSWORD EMAIL:',
        cleanEmail
      );

      console.log(
        'RESET PASSWORD REDIRECT:',
        redirectUrl
      );

      const {
        data,
        error,
      } =
        await supabase.auth
          .resetPasswordForEmail(
            cleanEmail,
            {
              redirectTo:
                redirectUrl,
            }
          );

      console.log(
        'RESET PASSWORD DATA:',
        data
      );

      console.log(
        'RESET PASSWORD ERROR:',
        error
      );

      if (error) {
        showToast(
          `Gagal mengirim link reset password: ${error.message}`,
          'error'
        );

        return;
      }

      setResetSent(true);

      showToast(
        'Link reset password berhasil dikirim. Silakan cek Kotak Masuk. Jika tidak ada, cek folder Spam.',
        'success'
      );
    } catch (err) {
      console.error(
        'RESET PASSWORD ERROR:',
        err
      );

      showToast(
        'Gagal mengirim link reset password',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // RESET PASSWORD SUDAH DIKIRIM
  // =========================================================

  if (
    forgotPassword &&
    resetSent
  ) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-950">
        <div className="w-full max-w-md">
          <div className="rounded-xl border border-slate-200 bg-white p-7 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <CheckCircle2 className="h-7 w-7 text-emerald-600 dark:text-emerald-400" />
            </div>

            <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
              Email Berhasil Dikirim
            </h1>

            <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
              Link reset password telah
              dikirim ke:
            </p>

            <p className="mt-2 break-all text-sm font-semibold text-slate-900 dark:text-white">
              {email}
            </p>

            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-left dark:border-amber-900 dark:bg-amber-900/20">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                Tidak menemukan email?
              </p>

              <p className="mt-1 text-sm leading-relaxed text-amber-700 dark:text-amber-400">
                Silakan cek folder Spam
                atau Junk pada email Anda.
              </p>
            </div>

            <button
              type="button"
              onClick={() => {
                setForgotPassword(false);
                setResetSent(false);
              }}
              className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800"
            >
              <ArrowLeft className="h-4 w-4" />

              Kembali ke Login
            </button>

            <button
              type="button"
              onClick={() =>
                setResetSent(false)
              }
              className="mt-3 text-sm font-medium text-brand-700 hover:underline dark:text-brand-300"
            >
              Kirim Ulang Email
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // HALAMAN LUPA PASSWORD
  // =========================================================

  if (forgotPassword) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-950">
        <div className="w-full max-w-md">
          <div className="mb-6 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-700 text-white">
              <Building2 className="h-6 w-6" />
            </div>

            <h1 className="text-xl font-bold text-slate-900 dark:text-white">
              Lupa Password
            </h1>

            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Masukkan email akun kamu
              untuk menerima link reset
              password.
            </p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <form
              onSubmit={
                handleForgotPassword
              }
              className="space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email
                </label>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="email"
                    value={email}
                    onChange={(e) =>
                      setEmail(
                        e.target.value
                      )
                    }
                    disabled={loading}
                    autoComplete="email"
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="email@sekolah.sch.id"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />

                    Mengirim...
                  </>
                ) : (
                  <>
                    <Mail className="h-4 w-4" />

                    Kirim Link Reset Password
                  </>
                )}
              </button>

              <button
                type="button"
                disabled={loading}
                onClick={() => {
                  setForgotPassword(
                    false
                  );

                  setResetSent(
                    false
                  );
                }}
                className="flex w-full items-center justify-center gap-2 text-sm font-medium text-slate-500 transition hover:text-brand-700 disabled:opacity-50 dark:text-slate-400"
              >
                <ArrowLeft className="h-4 w-4" />

                Kembali ke halaman masuk
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // LOGIN / REGISTER PAGE
  // =========================================================

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md">

        {/* BRAND */}

        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-700 text-white">
            <Building2 className="h-6 w-6" />
          </div>

          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {brand.name}
          </h1>

          <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
            {brand.school}
          </p>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">

          {/* LOGIN / REGISTER TAB */}

          <div className="mb-5 flex rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() => {
                setMode('login');
                setPassword('');
              }}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                mode === 'login'
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Masuk
            </button>

            <button
              type="button"
              onClick={() => {
                setMode(
                  'register'
                );

                setPassword('');
              }}
              className={`flex-1 rounded-md py-2 text-sm font-semibold transition ${
                mode === 'register'
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Daftar
            </button>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-4"
          >

            {/* NAME */}

            {mode ===
              'register' && (
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama
                </label>

                <div className="relative">
                  <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    value={name}
                    onChange={(e) =>
                      setName(
                        e.target.value
                      )
                    }
                    disabled={loading}
                    className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Nama lengkap"
                  />
                </div>
              </div>
            )}

            {/* EMAIL */}

            <div>
              <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Email
              </label>

              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type="email"
                  value={email}
                  onChange={(e) =>
                    setEmail(
                      e.target.value
                    )
                  }
                  disabled={loading}
                  autoComplete="email"
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="email@sekolah.sch.id"
                />
              </div>
            </div>

            {/* PASSWORD */}

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>

                {mode ===
                  'login' && (
                  <button
                    type="button"
                    onClick={() => {
                      setForgotPassword(
                        true
                      );

                      setResetSent(
                        false
                      );

                      setPassword('');
                    }}
                    className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                  >
                    Lupa Password?
                  </button>
                )}
              </div>

              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  onChange={(e) =>
                    setPassword(
                      e.target.value
                    )
                  }
                  disabled={loading}
                  autoComplete={
                    mode ===
                    'login'
                      ? 'current-password'
                      : 'new-password'
                  }
                  className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 shadow-sm outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  placeholder="••••••••"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 transition hover:text-slate-600 dark:hover:text-slate-200"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            {/* SUBMIT */}

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode ===
                'login' ? (
                <LogIn className="h-4 w-4" />
              ) : (
                <UserPlus className="h-4 w-4" />
              )}

              {loading
                ? 'Memproses…'
                : mode ===
                    'login'
                  ? 'Masuk'
                  : 'Daftar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}