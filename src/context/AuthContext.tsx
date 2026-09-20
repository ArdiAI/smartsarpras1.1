import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';

import type {
  Session,
  User,
} from '@supabase/supabase-js';

import { supabase } from '../lib/supabase';
import { logActivity } from '../lib/auditLog';

const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';

export interface AdminProfile {
  id: string;
  user_id: string;
  email: string;
  name: string;
  role: string;
  is_active: boolean;
}

interface ApiRole {
  id: string;
  name: string;
}

interface ApiPermission {
  module: string;
  action: string;
}

interface AuthContextResponse {
  ok: boolean;

  data?: {
    adminProfile: Omit<
      AdminProfile,
      'role'
    > & {
      role?: string | null;
    };

    roles: ApiRole[];

    permissions: ApiPermission[];

    isSuperAdmin: boolean;
  };

  message?: string;
}

interface AuthContextValue {
  session: Session | null;

  user: User | null;

  adminProfile:
    | AdminProfile
    | null;

  permissions: Set<string>;

  loading: boolean;

  hasPermission: (
    module: string,
    action: string
  ) => boolean;

  isSuperAdmin: boolean;

  userRoleNames: string[];

  signIn: (
    email: string,
    password: string
  ) => Promise<{
    error: string | null;
  }>;

  signUp: (
    email: string,
    password: string,
    name: string
  ) => Promise<{
    error: string | null;
  }>;

  signOut: () => Promise<void>;

  refreshAdminProfile:
    () => Promise<void>;
}

const AuthContext =
  createContext<
    AuthContextValue | undefined
  >(undefined);


// =====================================================
// PROVIDER
// =====================================================

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    session,
    setSession,
  ] =
    useState<Session | null>(
      null
    );

  const [
    user,
    setUser,
  ] =
    useState<User | null>(
      null
    );

  const [
    adminProfile,
    setAdminProfile,
  ] =
    useState<AdminProfile | null>(
      null
    );

  const [
    permissions,
    setPermissions,
  ] =
    useState<Set<string>>(
      new Set()
    );

  const [
    userRoleNames,
    setUserRoleNames,
  ] =
    useState<string[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);


  // =====================================================
  // RESET ADMIN STATE
  // =====================================================

  const clearAdminState =
    useCallback(() => {
      setAdminProfile(null);
      setPermissions(
        new Set()
      );

      setUserRoleNames(
        []
      );
    }, []);


  // =====================================================
  // LOAD ADMIN CONTEXT
  // PostgreSQL melalui backend
  // =====================================================

  const loadAdminContext =
    useCallback(
      async (
        activeSession:
          | Session
          | null
      ) => {
        if (
          !activeSession
            ?.access_token
        ) {
          clearAdminState();

          return null;
        }

        try {
          const response =
            await fetch(
              `${API_BASE_URL}/api/auth/context`,
              {
                headers: {
                  Authorization:
                    `Bearer ${activeSession.access_token}`,
                },
              }
            );

          const result =
            (await response
              .json()
              .catch(
                () => null
              )) as
              | AuthContextResponse
              | null;

          if (
            !response.ok ||
            !result?.ok ||
            !result.data
          ) {
            // User boleh tetap login di Supabase,
            // tetapi kalau bukan admin aktif,
            // adminProfile harus kosong.
            clearAdminState();

            return null;
          }

          const roles =
            result.data.roles ??
            [];

          const roleNames =
            roles
              .map(
                (role) =>
                  role.name
              )
              .filter(Boolean);

          const permissionSet =
            new Set<string>();

          (
            result.data
              .permissions ??
            []
          ).forEach(
            (permission) => {
              if (
                permission.module &&
                permission.action
              ) {
                permissionSet.add(
                  `${permission.module}:${permission.action}`
                );
              }
            }
          );

          const rawProfile =
            result.data
              .adminProfile;

          // Backend requireAdmin saat ini mengambil
          // profile tanpa kolom role lama.
          // Jadi fallback ke nama role dari tabel roles.
          const profile: AdminProfile =
            {
              ...rawProfile,

              role:
                rawProfile.role ??
                roleNames.join(
                  ', '
                ) ??
                '',
            };

          setAdminProfile(
            profile
          );

          setUserRoleNames(
            roleNames
          );

          setPermissions(
            permissionSet
          );

          return {
            profile,
            roleNames,
            permissionSet,
            isSuperAdmin:
              result.data
                .isSuperAdmin,
          };
        } catch (error) {
          console.error(
            '[AuthContext] gagal memuat admin context:',
            error
          );

          clearAdminState();

          return null;
        }
      },
      [clearAdminState]
    );


  // =====================================================
  // INITIAL SESSION
  // =====================================================

  useEffect(() => {
    let mounted = true;

    const initialize =
      async () => {
        try {
          const {
            data,
          } =
            await supabase.auth.getSession();

          if (!mounted) {
            return;
          }

          const currentSession =
            data.session;

          setSession(
            currentSession
          );

          setUser(
            currentSession
              ?.user ??
              null
          );

          if (
            currentSession
          ) {
            await loadAdminContext(
              currentSession
            );
          } else {
            clearAdminState();
          }
        } catch (error) {
          console.error(
            '[AuthContext] init error:',
            error
          );

          if (mounted) {
            setSession(null);
            setUser(null);
            clearAdminState();
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    void initialize();

    const {
      data: subscription,
    } =
      supabase.auth.onAuthStateChange(
        (
          _event,
          newSession
        ) => {
          if (!mounted) {
            return;
          }

          setSession(
            newSession
          );

          setUser(
            newSession
              ?.user ??
              null
          );

          if (
            !newSession
          ) {
            clearAdminState();
            setLoading(false);

            return;
          }

          void loadAdminContext(
            newSession
          );
        }
      );

    return () => {
      mounted = false;

      subscription.subscription.unsubscribe();
    };
  }, [
    clearAdminState,
    loadAdminContext,
  ]);


  // =====================================================
  // REFRESH ADMIN PROFILE
  // =====================================================

  const refreshAdminProfile =
    useCallback(
      async () => {
        try {
          const {
            data,
          } =
            await supabase.auth.getSession();

          const currentSession =
            data.session;

          if (
            !currentSession
          ) {
            clearAdminState();
            return;
          }

          await loadAdminContext(
            currentSession
          );
        } catch (error) {
          console.error(
            '[AuthContext] refresh error:',
            error
          );
        }
      },
      [
        clearAdminState,
        loadAdminContext,
      ]
    );


  // =====================================================
  // SIGN IN
  // =====================================================

  const signIn =
    async (
      email: string,
      password: string
    ) => {
      const {
        data,
        error,
      } =
        await supabase.auth
          .signInWithPassword({
            email,
            password,
          });

      if (error) {
        return {
          error:
            error.message,
        };
      }

      const newSession =
        data.session;

      if (
        newSession
      ) {
        setSession(
          newSession
        );

        setUser(
          newSession.user
        );

        const adminContext =
          await loadAdminContext(
            newSession
          );

        if (
          adminContext
            ?.profile
        ) {
          try {
            await logActivity({
              adminUserId:
                adminContext
                  .profile.id,

              adminName:
                adminContext
                  .profile.name,

              adminEmail:
                adminContext
                  .profile.email,

              adminRole:
                adminContext
                  .roleNames
                  .join(
                    ', '
                  ) ||
                adminContext
                  .profile
                  .role,

              activityType:
                'LOGIN',

              module:
                'Auth',

              description:
                `${adminContext.profile.name} berhasil login`,
            });
          } catch (error) {
            console.error(
              '[AuthContext] login audit error:',
              error
            );
          }
        }
      }

      return {
        error: null,
      };
    };


  // =====================================================
  // SIGN UP
  // Supabase Auth tetap sementara
  // =====================================================

  const signUp =
    async (
      email: string,
      password: string,
      name: string
    ) => {
      const {
        error,
      } =
        await supabase.auth
          .signUp({
            email,
            password,

            options: {
              data: {
                name,
              },
            },
          });

      return {
        error:
          error?.message ??
          null,
      };
    };


  // =====================================================
  // SIGN OUT
  // =====================================================

  const signOut =
    async () => {
      if (
        adminProfile
      ) {
        try {
          await logActivity({
            adminUserId:
              adminProfile.id,

            adminName:
              adminProfile.name,

            adminEmail:
              adminProfile.email,

            adminRole:
              userRoleNames.join(
                ', '
              ) ||
              adminProfile.role,

            activityType:
              'LOGOUT',

            module:
              'Auth',

            description:
              `${adminProfile.name} logout`,
          });
        } catch (error) {
          console.error(
            '[AuthContext] logout audit error:',
            error
          );
        }
      }

      await supabase.auth
        .signOut();

      setSession(null);
      setUser(null);

      clearAdminState();
    };


  // =====================================================
  // PERMISSIONS
  // =====================================================

  const hasPermission =
    useCallback(
      (
        module: string,
        action: string
      ) => {
        const superAdmin =
          userRoleNames.some(
            (roleName) =>
              roleName
                .trim()
                .toLowerCase()
                .replace(
                  /[\s_-]+/g,
                  ''
                ) ===
              'superadmin'
          );

        return (
          superAdmin ||
          permissions.has(
            `${module}:${action}`
          )
        );
      },
      [
        permissions,
        userRoleNames,
      ]
    );


  // =====================================================
  // SUPER ADMIN
  // =====================================================

  const isSuperAdmin =
    useMemo(() => {
      return userRoleNames.some(
        (roleName) =>
          roleName
            .trim()
            .toLowerCase()
            .replace(
              /[\s_-]+/g,
              ''
            ) ===
          'superadmin'
      );
    }, [
      userRoleNames,
    ]);


  // =====================================================
  // PROVIDER VALUE
  // =====================================================

  return (
    <AuthContext.Provider
      value={{
        session,
        user,
        adminProfile,
        permissions,
        loading,
        hasPermission,
        isSuperAdmin,
        userRoleNames,
        signIn,
        signUp,
        signOut,
        refreshAdminProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}


// =====================================================
// HOOK
// =====================================================

export function useAuth() {
  const ctx =
    useContext(
      AuthContext
    );

  if (!ctx) {
    throw new Error(
      'useAuth must be used within AuthProvider'
    );
  }

  return ctx;
}