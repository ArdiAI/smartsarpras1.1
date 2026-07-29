import { createContext, useContext, useEffect, useState, useCallback, useMemo, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/auditLog';

export interface AdminProfile { id: string; user_id: string; email: string; name: string; role: string; is_active: boolean; }
interface AuthContextValue {
  session: Session | null; user: User | null; adminProfile: AdminProfile | null; permissions: Set<string>; loading: boolean;
  hasPermission: (module: string, action: string) => boolean;
  isSuperAdmin: boolean;
  userRoleNames: string[];
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshAdminProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [userRoleNames, setUserRoleNames] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserPermissions = useCallback(async (adminUserId: string) => {
    try {
      const { data: roleLinks } = await supabase.from('admin_user_roles').select('role_id').eq('admin_user_id', adminUserId);
      const roleIds = (roleLinks ?? []).map((r: any) => r.role_id);
      if (roleIds.length === 0) { setPermissions(new Set()); setUserRoleNames([]); return; }

      const { data: roles } = await supabase.from('roles').select('name').in('id', roleIds).eq('is_active', true);
      const roleNames = (roles ?? []).map((r: any) => r.name as string);
      setUserRoleNames(roleNames);

      const { data: permLinks } = await supabase.from('role_permissions').select('permissions(module, action)').in('role_id', roleIds);
      const perms = new Set<string>();
      (permLinks ?? []).forEach((p: any) => { if (p?.permissions) perms.add(`${p.permissions.module}:${p.permissions.action}`); });
      setPermissions(perms);
    } catch { setPermissions(new Set()); setUserRoleNames([]); }
  }, []);

  const refreshAdminProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from('admin_users').select('*').eq('user_id', user.id).maybeSingle();
      if (data) { const profile = data as unknown as AdminProfile; setAdminProfile(profile); await fetchUserPermissions(profile.id); }
    } catch { /* noop */ }
  }, [user, fetchUserPermissions]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => { if (!mounted) return; setSession(data.session); setUser(data.session?.user ?? null); setLoading(false); });
    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession); setUser(newSession?.user ?? null);
      if (!newSession) { setAdminProfile(null); setPermissions(new Set()); setUserRoleNames([]); }
    });
    return () => { mounted = false; sub.subscription.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!user) { setAdminProfile(null); setPermissions(new Set()); setUserRoleNames([]); return; }
    (async () => {
      try {
        const { data } = await supabase.from('admin_users').select('*').eq('user_id', user.id).maybeSingle();
        if (data) { const profile = data as unknown as AdminProfile; setAdminProfile(profile); await fetchUserPermissions(profile.id); }
      } catch { /* noop */ }
    })();
  }, [user, fetchUserPermissions]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error) {
      try {
        const { data } = await supabase.from('admin_users').select('id, name, email, role').eq('email', email).maybeSingle();
        const profile = data as unknown as { id: string; name: string; email: string; role: string } | null;
        if (profile) {
          await logActivity({
            adminUserId: profile.id,
            adminName: profile.name,
            adminEmail: profile.email,
            adminRole: profile.role,
            activityType: 'LOGIN',
            module: 'Auth',
            description: `${profile.name} berhasil login`,
          });
        }
      } catch { /* noop */ }
    }
    return { error: error?.message ?? null };
  };
  const signUp = async (email: string, password: string, name: string) => { const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } }); return { error: error?.message ?? null }; };
  const signOut = async () => {
    if (adminProfile) {
      await logActivity({
        adminUserId: adminProfile.id,
        adminName: adminProfile.name,
        adminEmail: adminProfile.email,
        adminRole: userRoleNames.join(', ') || adminProfile.role,
        activityType: 'LOGOUT',
        module: 'Auth',
        description: `${adminProfile.name} logout`,
      });
    }
    await supabase.auth.signOut();
    setAdminProfile(null); setPermissions(new Set()); setUserRoleNames([]);
  };
  const hasPermission = useCallback((module: string, action: string) => permissions.has(`${module}:${action}`), [permissions]);

  const isSuperAdmin = useMemo(() => userRoleNames.includes('Super Admin'), [userRoleNames]);

  return <AuthContext.Provider value={{ session, user, adminProfile, permissions, loading, hasPermission, isSuperAdmin, userRoleNames, signIn, signUp, signOut, refreshAdminProfile }}>{children}</AuthContext.Provider>;
}
export function useAuth() { const ctx = useContext(AuthContext); if (!ctx) throw new Error('useAuth must be used within AuthProvider'); return ctx; }
