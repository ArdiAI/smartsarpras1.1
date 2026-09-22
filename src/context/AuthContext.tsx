import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import {
  clearSessionToken,
  getSessionToken,
  setSessionToken,
} from '../lib/appSession';

import { logActivity } from '../lib/auditLog';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));

export interface AppUser {
  id: string;
  username?: string | null;
  email: string;
  name: string;
  user_metadata?: {
    name?: string;
  };
}

export interface AppSession {
  access_token: string;
  expires_at?: string;
  user: AppUser;
}

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

interface SessionResponse {
  ok: boolean;
  data?: {
    user: AppUser;
  };
  message?: string;
}

interface LoginResponse {
  ok: boolean;
  data?: {
    token: string;
    expiresAt?: string;
    user: AppUser;
  };
  message?: string;
}

interface AuthContextValue {
  session: AppSession | null;
  user: AppUser | null;
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
    identifier: string,
    password: string
  ) => Promise<{
    error: string | null;
  }>;
  signUp: (
    username: string,
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

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [
    session,
    setSession,
  ] =
    useState<AppSession | null>(
      null
    );

  const [
    user,
    setUser,
  ] =
    useState<AppUser | null>(
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

  const clearAllState =
    useCallback(() => {
      clearSessionToken();
      setSession(null);
      setUser(null);
      clearAdminState();
    }, [clearAdminState]);

  const loadAdminContext =
    useCallback(
      async (
        token: string
      ) => {
        try {
          const response =
            await fetch(
              `${API_BASE_URL}/api/auth/context`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
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

          const profile:
            AdminProfile = {
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

  useEffect(() => {
    let mounted = true;

    const initialize =
      async () => {
        const token =
          getSessionToken();

        if (!token) {
          if (mounted) {
            setLoading(false);
          }
          return;
        }

        try {
          const response =
            await fetch(
              `${API_BASE_URL}/api/auth/session`,
              {
                headers: {
                  Authorization:
                    `Bearer ${token}`,
                },
              }
            );

          const result =
            (await response
              .json()
              .catch(
                () => null
              )) as
              | SessionResponse
              | null;

          if (
            !response.ok ||
            !result?.ok ||
            !result.data?.user
          ) {
            if (mounted) {
              clearAllState();
            }
            return;
          }

          if (!mounted) {
            return;
          }

          const currentUser =
            result.data.user;

          setUser(
            currentUser
          );
          setSession({
            access_token:
              token,
            user:
              currentUser,
          });

          await loadAdminContext(
            token
          );
        } catch (error) {
          console.error(
            '[AuthContext] init error:',
            error
          );

          if (mounted) {
            clearAllState();
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    void initialize();

    return () => {
      mounted = false;
    };
  }, [
    clearAllState,
    loadAdminContext,
  ]);

  const refreshAdminProfile =
    useCallback(
      async () => {
        const token =
          getSessionToken();

        if (!token) {
          clearAdminState();
          return;
        }

        await loadAdminContext(
          token
        );
      },
      [
        clearAdminState,
        loadAdminContext,
      ]
    );

  const signIn =
    async (
      identifier: string,
      password: string
    ) => {
      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/auth/login`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body:
                JSON.stringify({
                  identifier,
                  password,
                }),
            }
          );

        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
            | LoginResponse
            | null;

        if (
          !response.ok ||
          !result?.ok ||
          !result.data
        ) {
          return {
            error:
              result?.message ??
              'Login gagal',
          };
        }

        const {
          token,
          user:
            loggedInUser,
          expiresAt,
        } =
          result.data;

        setSessionToken(
          token
        );

        setUser(
          loggedInUser
        );

        setSession({
          access_token:
            token,
          expires_at:
            expiresAt,
          user:
            loggedInUser,
        });

        const adminContext =
          await loadAdminContext(
            token
          );

        if (
          adminContext?.profile
        ) {
          void logActivity({
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
                .join(', ') ||
              adminContext
                .profile.role,
            activityType:
              'LOGIN',
            module:
              'Auth',
            description:
              `${adminContext.profile.name} berhasil login`,
          });
        }

        return {
          error: null,
        };
      } catch (error) {
        console.error(
          '[AuthContext] login error:',
          error
        );

        return {
          error:
            'Layanan tidak dapat dihubungi',
        };
      }
    };

  const signUp =
    async (
      username: string,
      email: string,
      password: string,
      name: string
    ) => {
      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/auth/register`,
            {
              method: 'POST',
              headers: {
                'Content-Type':
                  'application/json',
              },
              body:
                JSON.stringify({
                  username,
                  email,
                  password,
                  name,
                }),
            }
          );

        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
            | {
                ok?: boolean;
                message?: string;
              }
            | null;

        return {
          error:
            response.ok &&
            result?.ok
              ? null
              : result?.message ??
                'Pendaftaran gagal',
        };
      } catch (error) {
        console.error(
          '[AuthContext] register error:',
          error
        );

        return {
          error:
            'Layanan tidak dapat dihubungi',
        };
      }
    };

  const signOut =
    async () => {
      const token =
        getSessionToken();

      if (
        adminProfile &&
        token
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

      if (token) {
        try {
          await fetch(
            `${API_BASE_URL}/api/auth/logout`,
            {
              method: 'POST',
              headers: {
                Authorization:
                  `Bearer ${token}`,
              },
            }
          );
        } catch (error) {
          console.error(
            '[AuthContext] logout backend error:',
            error
          );
        }
      }

      clearAllState();
    };

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

  const isSuperAdmin =
    useMemo(
      () =>
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
        ),
      [userRoleNames]
    );

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
