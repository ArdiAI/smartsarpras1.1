import {
  Navigate,
  Outlet,
  useLocation,
} from 'react-router-dom';

import { useAuth } from '../context/AuthContext';

export default function RequireAuth() {
  const {
    session,
    loading,
  } = useAuth();

  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 text-sm text-slate-500 dark:bg-slate-950 dark:text-slate-400">
        Memuat...
      </div>
    );
  }

  if (!session) {
    return (
      <Navigate
        to="/auth"
        state={{
          from: location,
        }}
        replace
      />
    );
  }

  return <Outlet />;
}
