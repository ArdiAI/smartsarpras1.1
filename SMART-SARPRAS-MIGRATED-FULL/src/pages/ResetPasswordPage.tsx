import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';

import {
  useNavigate,
  useSearchParams,
} from 'react-router-dom';

import {
  Lock,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from 'lucide-react';

import { supabase } from '../lib/supabase';
import { showToast } from '../components/Toast';

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const checkedRef = useRef(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [checking, setChecking] = useState(true);
  const [validRecovery, setValidRecovery] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);

  // =========================================================
  // CEK LINK RECOVERY
  // =========================================================

  useEffect(() => {
    if (checkedRef.current) return;

    checkedRef.current = true;

    const checkRecovery = async () => {
      setChecking(true);

      try {
        const tokenHash = searchParams.get('token_hash');
        const type = searchParams.get('type');
        const code = searchParams.get('code');

        console.log('RESET PASSWORD URL:', {
          hasTokenHash: !!tokenHash,
          type,
          hasCode: !!code,
        });

        // =====================================================
        // FORMAT:
        // /reset-password?token_hash=xxxx&type=recovery
        // =====================================================

        if (
          tokenHash &&
          type === 'recovery'
        ) {
          const {
            data,
            error,
          } =
            await supabase.auth.verifyOtp({
              token_hash: tokenHash,
              type: 'recovery',
            });

          console.log(
            'VERIFY OTP DATA:',
            data
          );

          console.log(
            'VERIFY OTP ERROR:',
            error
          );

          if (!error) {
            setValidRecovery(true);
            return;
          }

          // Kalau token sudah diproses tapi session
          // recovery sudah terbentuk, tetap lanjut.
          const {
            data: sessionData,
          } =
            await supabase.auth.getSession();

          if (sessionData.session) {
            setValidRecovery(true);
            return;
          }

          setValidRecovery(false);

          showToast(
            'Link reset password tidak valid atau sudah kedaluwarsa.',
            'error'
          );

          return;
        }

        // =====================================================
        // FORMAT PKCE:
        // /reset-password?code=xxxx
        // =====================================================

        if (code) {
          const {
            data,
            error,
          } =
            await supabase.auth.exchangeCodeForSession(
              code
            );

          console.log(
            'EXCHANGE CODE DATA:',
            data
          );

          console.log(
            'EXCHANGE CODE ERROR:',
            error
          );

          if (
            !error &&
            data.session
          ) {
            setValidRecovery(true);
            return;
          }
        }

        // =====================================================
        // CEK SESSION YANG SUDAH ADA
        // =====================================================

        const {
          data: sessionData,
          error: sessionError,
        } =
          await supabase.auth.getSession();

        if (sessionError) {
          console.error(
            'SESSION ERROR:',
            sessionError
          );
        }

        if (sessionData.session) {
          setValidRecovery(true);
          return;
        }

        // =====================================================
        // FALLBACK HASH TOKEN
        // =====================================================

        const hashParams =
          new URLSearchParams(
            window.location.hash.substring(1)
          );

        const accessToken =
          hashParams.get('access_token');

        const refreshToken =
          hashParams.get('refresh_token');

        const hashType =
          hashParams.get('type');

        if (
          accessToken &&
          refreshToken &&
          hashType === 'recovery'
        ) {
          const {
            data,
            error,
          } =
            await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          console.log(
            'SET SESSION DATA:',
            data
          );

          console.log(
            'SET SESSION ERROR:',
            error
          );

          if (
            !error &&
            data.session
          ) {
            setValidRecovery(true);
            return;
          }
        }

        setValidRecovery(false);

        showToast(
          'Link reset password tidak valid atau sudah kedaluwarsa.',
          'error'
        );
      } catch (err) {
        console.error(
          'RESET PASSWORD CHECK ERROR:',
          err
        );

        setValidRecovery(false);

        showToast(
          'Terjadi kesalahan saat memeriksa link reset password.',
          'error'
        );
      } finally {
        setChecking(false);
      }
    };

    void checkRecovery();
  }, [searchParams]);

  // =========================================================
  // GANTI PASSWORD
  // =========================================================

  const handleSubmit = async (
    e: FormEvent<HTMLFormElement>
  ) => {
    e.preventDefault();

    // Mencegah tombol dipencet berkali-kali
    if (saving) return;

    if (!password) {
      showToast(
        'Password baru wajib diisi.',
        'error'
      );

      return;
    }

    if (password.length < 6) {
      showToast(
        'Password minimal 6 karakter.',
        'error'
      );

      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      showToast(
        'Konfirmasi password tidak sama.',
        'error'
      );

      return;
    }

    setSaving(true);

    try {
      // Pastikan session recovery masih aktif
      const {
        data: sessionData,
      } =
        await supabase.auth.getSession();

      if (!sessionData.session) {
        setValidRecovery(false);

        showToast(
          'Sesi reset password sudah tidak berlaku. Silakan minta link reset baru.',
          'error'
        );

        return;
      }

      const {
        data,
        error,
      } =
        await supabase.auth.updateUser({
          password,
        });

      console.log(
        'UPDATE PASSWORD DATA:',
        data
      );

      console.log(
        'UPDATE PASSWORD ERROR:',
        error
      );

      if (error) {
        const message =
          error.message.toLowerCase();

        if (
          message.includes(
            'different from the old password'
          )
        ) {
          showToast(
            'Password baru harus berbeda dari password lama.',
            'error'
          );
        } else {
          showToast(
            `Gagal mengganti password: ${error.message}`,
            'error'
          );
        }

        return;
      }

      setSuccess(true);

      showToast(
        'Password berhasil diganti.',
        'success'
      );

      // Logout recovery session setelah sukses
      setTimeout(async () => {
        try {
          await supabase.auth.signOut();
        } catch (err) {
          console.error(
            'SIGN OUT ERROR:',
            err
          );
        }

        navigate('/auth', {
          replace: true,
        });
      }, 1500);
    } catch (err) {
      console.error(
        'UPDATE PASSWORD EXCEPTION:',
        err
      );

      showToast(
        'Terjadi kesalahan saat mengganti password.',
        'error'
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
        <div className="text-center">
          <Loader2 className="mx-auto h-9 w-9 animate-spin text-brand-600" />

          <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
            Memeriksa link reset password...
          </p>
        </div>
      </div>
    );
  }

  // =========================================================
  // LINK TIDAK VALID
  // =========================================================

  if (!validRecovery) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <AlertCircle className="h-7 w-7 text-red-600 dark:text-red-400" />
          </div>

          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            Link Reset Tidak Valid
          </h1>

          <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">
            Link mungkin sudah digunakan atau sudah
            kedaluwarsa. Silakan meminta link reset
            password baru.
          </p>

          <button
            type="button"
            onClick={() =>
              navigate('/auth', {
                replace: true,
              })
            }
            className="mt-6 w-full rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Kembali ke Login
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // BERHASIL
  // =========================================================

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 dark:bg-slate-950">
        <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
            <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
          </div>

          <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">
            Password Berhasil Diganti
          </h1>

          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Password baru telah disimpan.
            Anda akan diarahkan kembali ke halaman login.
          </p>

          <div className="mt-5 flex items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-brand-600" />
          </div>
        </div>
      </div>
    );
  }

  // =========================================================
  // FORM GANTI PASSWORD
  // =========================================================

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white">
              <Lock className="h-7 w-7" />
            </div>

            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Ganti Password
            </h1>

            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
              Masukkan password baru untuk akun Anda.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="space-y-5"
          >
            {/* PASSWORD BARU */}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Password Baru
              </label>

              <div className="relative">
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
                  autoComplete="new-password"
                  placeholder="Minimal 6 karakter"
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  aria-label={
                    showPassword
                      ? 'Sembunyikan password'
                      : 'Lihat password'
                  }
                  title={
                    showPassword
                      ? 'Sembunyikan password'
                      : 'Lihat password'
                  }
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>

            {/* KONFIRMASI PASSWORD */}

            <div>
              <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
                Konfirmasi Password Baru
              </label>

              <div className="relative">
                <input
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }
                  value={
                    confirmPassword
                  }
                  onChange={(e) =>
                    setConfirmPassword(
                      e.target.value
                    )
                  }
                  autoComplete="new-password"
                  placeholder="Masukkan ulang password"
                  disabled={saving}
                  className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 pr-12 text-sm text-slate-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      !showConfirmPassword
                    )
                  }
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                  aria-label={
                    showConfirmPassword
                      ? 'Sembunyikan konfirmasi password'
                      : 'Lihat konfirmasi password'
                  }
                  title={
                    showConfirmPassword
                      ? 'Sembunyikan password'
                      : 'Lihat password'
                  }
                >
                  {showConfirmPassword ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>

              {/* INFO PASSWORD COCOK */}

              {confirmPassword &&
                password ===
                  confirmPassword && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-4 w-4" />

                    Password cocok
                  </div>
                )}

              {/* INFO PASSWORD BELUM COCOK */}

              {confirmPassword &&
                password !==
                  confirmPassword && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />

                    Password belum sama
                  </div>
                )}
            </div>

            {/* BUTTON */}

            <button
              type="submit"
              disabled={saving}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />

                  Menyimpan...
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />

                  Ganti Password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}