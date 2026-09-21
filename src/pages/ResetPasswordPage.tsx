import {
  useMemo,
  useState,
  type FormEvent,
} from 'react';

import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import {
  ArrowLeft,
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  Mail,
  Send,
} from 'lucide-react';

import { brand } from '../brand/config';
import { showToast } from '../components/Toast';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const token = useMemo(
    () => searchParams.get('token')?.trim() || '',
    [searchParams]
  );

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const requestReset = async (event: FormEvent) => {
    event.preventDefault();

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      showToast('Email wajib diisi', 'error');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/forgot-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: cleanEmail,
          }),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok || !result?.ok) {
        showToast(
          result?.message ||
            'Gagal memproses reset password',
          'error'
        );
        return;
      }

      showToast(
        result.message ||
          'Jika email terdaftar, tautan reset akan dikirim.',
        'success'
      );
    } catch (error) {
      console.error(
        '[ResetPasswordPage] request error:',
        error
      );

      showToast(
        'Layanan tidak dapat dihubungi',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const submitNewPassword = async (event: FormEvent) => {
    event.preventDefault();

    if (password.length < 10) {
      showToast(
        'Password minimal 10 karakter',
        'error'
      );
      return;
    }

    if (password !== confirmPassword) {
      showToast(
        'Konfirmasi password tidak sama',
        'error'
      );
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/auth/reset-password`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token,
            password,
          }),
        }
      );

      const result = await response
        .json()
        .catch(() => null);

      if (!response.ok || !result?.ok) {
        showToast(
          result?.message ||
            'Gagal memperbarui password',
          'error'
        );
        return;
      }

      showToast(
        'Password berhasil diperbarui',
        'success'
      );

      navigate('/admin/login', {
        replace: true,
      });
    } catch (error) {
      console.error(
        '[ResetPasswordPage] reset error:',
        error
      );

      showToast(
        'Layanan tidak dapat dihubungi',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-700 text-white">
            <Building2 className="h-6 w-6" />
          </div>

          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            Reset Password {brand.name}
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {brand.school}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {token ? (
            <form
              onSubmit={submitNewPassword}
              className="space-y-4"
            >
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Buat password baru untuk akun admin.
              </p>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password baru
                </label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    minLength={10}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Minimal 10 karakter"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                    aria-label={
                      showPassword
                        ? 'Sembunyikan password'
                        : 'Lihat password'
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Ulangi password
                </label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(event) =>
                      setConfirmPassword(event.target.value)
                    }
                    minLength={10}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Ulangi password baru"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Lock className="h-4 w-4" />
                )}
                Simpan password baru
              </button>
            </form>
          ) : (
            <form
              onSubmit={requestReset}
              className="space-y-4"
            >
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Masukkan email admin. Jika email terdaftar, sistem akan mengirim tautan reset yang berlaku 30 menit.
              </p>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email admin
                </label>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="email"
                    value={email}
                    onChange={(event) =>
                      setEmail(event.target.value)
                    }
                    autoComplete="email"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="email admin"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-800 disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Kirim tautan reset
              </button>
            </form>
          )}

          <button
            type="button"
            onClick={() =>
              navigate('/admin/login')
            }
            className="mt-4 flex w-full items-center justify-center gap-2 text-xs font-medium text-slate-400 transition hover:text-brand-700"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Kembali ke login admin
          </button>
        </div>
      </div>
    </div>
  );
}
