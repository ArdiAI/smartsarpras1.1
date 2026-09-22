import {
  useState,
  type FormEvent,
} from 'react';

import {
  useNavigate,
} from 'react-router-dom';

import {
  Building2,
  Eye,
  EyeOff,
  Loader2,
  Lock,
  LogIn,
  Mail,
  UserPlus,
  UserRound,
} from 'lucide-react';

import {
  useAuth,
} from '../context/AuthContext';

import {
  brand,
} from '../brand/config';

import {
  showToast,
} from '../components/Toast';

export default function AuthPage() {
  const navigate = useNavigate();

  const {
    signIn,
    signUp,
  } = useAuth();

  const [
    mode,
    setMode,
  ] = useState<'login' | 'register'>('login');

  const [
    username,
    setUsername,
  ] = useState('');

  const [
    name,
    setName,
  ] = useState('');

  const [
    email,
    setEmail,
  ] = useState('');

  const [
    identifier,
    setIdentifier,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    showPassword,
    setShowPassword,
  ] = useState(false);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const resetPasswordFields = () => {
    setPassword('');
    setConfirmPassword('');
    setShowPassword(false);
  };

  const switchMode = (
    nextMode: 'login' | 'register'
  ) => {
    setMode(nextMode);
    resetPasswordFields();
  };

  const handleLogin = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    const cleanIdentifier =
      identifier
        .trim()
        .toLowerCase();

    if (
      !cleanIdentifier ||
      !password
    ) {
      showToast(
        'Username/email dan password wajib diisi',
        'error'
      );
      return;
    }

    setLoading(true);

    try {
      const {
        error,
      } = await signIn(
        cleanIdentifier,
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

      navigate(
        '/',
        {
          replace: true,
        }
      );
    } catch (error) {
      console.error(
        'LOGIN ERROR:',
        error
      );

      showToast(
        'Terjadi kesalahan saat masuk',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (
    event: FormEvent
  ) => {
    event.preventDefault();

    const cleanUsername =
      username
        .trim()
        .toLowerCase();

    const cleanName =
      name.trim();

    const cleanEmail =
      email
        .trim()
        .toLowerCase();

    if (
      !cleanUsername ||
      !cleanName ||
      !cleanEmail ||
      !password
    ) {
      showToast(
        'Username, nama, email, dan password wajib diisi',
        'error'
      );
      return;
    }

    if (
      !/^[a-z0-9._-]{3,30}$/.test(
        cleanUsername
      )
    ) {
      showToast(
        'Username 3-30 karakter. Gunakan huruf kecil, angka, titik, _ atau -.',
        'error'
      );
      return;
    }

    if (
      password.length < 10
    ) {
      showToast(
        'Password minimal 10 karakter',
        'error'
      );
      return;
    }

    if (
      password !==
      confirmPassword
    ) {
      showToast(
        'Konfirmasi password tidak sama',
        'error'
      );
      return;
    }

    setLoading(true);

    try {
      const registerResult =
        await signUp(
          cleanUsername,
          cleanEmail,
          password,
          cleanName
        );

      if (
        registerResult.error
      ) {
        showToast(
          registerResult.error,
          'error'
        );
        return;
      }

      const loginResult =
        await signIn(
          cleanUsername,
          password
        );

      if (
        loginResult.error
      ) {
        showToast(
          'Akun berhasil dibuat. Silakan masuk.',
          'success'
        );

        setIdentifier(
          cleanUsername
        );
        switchMode(
          'login'
        );
        return;
      }

      showToast(
        'Pendaftaran berhasil',
        'success'
      );

      navigate(
        '/',
        {
          replace: true,
        }
      );
    } catch (error) {
      console.error(
        'REGISTER ERROR:',
        error
      );

      showToast(
        'Terjadi kesalahan saat mendaftar',
        'error'
      );
    } finally {
      setLoading(false);
    }
  };

  const isRegister =
    mode === 'register';

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-12 dark:bg-slate-950">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-lg bg-brand-700 text-white">
            <Building2 className="h-6 w-6" />
          </div>

          <h1 className="text-xl font-bold text-slate-900 dark:text-white">
            {brand.name}
          </h1>

          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {brand.school}
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-5 grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-slate-800">
            <button
              type="button"
              onClick={() =>
                switchMode(
                  'login'
                )
              }
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                !isRegister
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Masuk
            </button>

            <button
              type="button"
              onClick={() =>
                switchMode(
                  'register'
                )
              }
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                isRegister
                  ? 'bg-white text-brand-700 shadow-sm dark:bg-slate-700 dark:text-brand-300'
                  : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              Daftar
            </button>
          </div>

          {isRegister ? (
            <form
              onSubmit={
                handleRegister
              }
              className="space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Username
                </label>

                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="text"
                    value={
                      username
                    }
                    onChange={(
                      event
                    ) =>
                      setUsername(
                        event.target.value
                      )
                    }
                    disabled={
                      loading
                    }
                    autoComplete="username"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="contoh: ardi.meka"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama Lengkap
                </label>

                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="text"
                    value={
                      name
                    }
                    onChange={(
                      event
                    ) =>
                      setName(
                        event.target.value
                      )
                    }
                    disabled={
                      loading
                    }
                    autoComplete="name"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Nama lengkap"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email
                </label>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="email"
                    value={
                      email
                    }
                    onChange={(
                      event
                    ) =>
                      setEmail(
                        event.target.value
                      )
                    }
                    disabled={
                      loading
                    }
                    autoComplete="email"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="nama@email.com"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password
                </label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={
                      password
                    }
                    onChange={(
                      event
                    ) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    disabled={
                      loading
                    }
                    minLength={10}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Minimal 10 karakter"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
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
                  Konfirmasi Password
                </label>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={
                      confirmPassword
                    }
                    onChange={(
                      event
                    ) =>
                      setConfirmPassword(
                        event.target.value
                      )
                    }
                    disabled={
                      loading
                    }
                    minLength={10}
                    autoComplete="new-password"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Ulangi password"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={
                  loading
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <UserPlus className="h-4 w-4" />
                )}

                {loading
                  ? 'Mendaftarkan...'
                  : 'Daftar'}
              </button>
            </form>
          ) : (
            <form
              onSubmit={
                handleLogin
              }
              className="space-y-4"
            >
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Username atau Email
                </label>

                <div className="relative">
                  <UserRound className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type="text"
                    value={
                      identifier
                    }
                    onChange={(
                      event
                    ) =>
                      setIdentifier(
                        event.target.value
                      )
                    }
                    disabled={
                      loading
                    }
                    autoComplete="username"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="username atau email"
                  />
                </div>
              </div>

              <div>
                <div className="mb-1.5 flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Password
                  </label>

                  <button
                    type="button"
                    onClick={() =>
                      navigate(
                        '/reset-password'
                      )
                    }
                    className="text-xs font-semibold text-brand-700 hover:underline dark:text-brand-300"
                  >
                    Lupa Password?
                  </button>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />

                  <input
                    type={
                      showPassword
                        ? 'text'
                        : 'password'
                    }
                    value={
                      password
                    }
                    onChange={(
                      event
                    ) =>
                      setPassword(
                        event.target.value
                      )
                    }
                    disabled={
                      loading
                    }
                    autoComplete="current-password"
                    className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                    placeholder="Password"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        !showPassword
                      )
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

              <button
                type="submit"
                disabled={
                  loading
                }
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-brand-700 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LogIn className="h-4 w-4" />
                )}

                {loading
                  ? 'Memproses...'
                  : 'Masuk'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
