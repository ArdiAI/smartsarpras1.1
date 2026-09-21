import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';

import {
  UserCog,
  Plus,
  Trash2,
  X,
  Loader2,
  Search,
  ShieldCheck,
  Power,
  Copy,
  Eye,
  EyeOff,
} from 'lucide-react';

import {
  cn,
} from '../../../utils/cn';

import {
  showToast,
} from '../../../components/Toast';

import {
  useAuth,
} from '../../../context/AuthContext';

import {
  logActivity,
} from '../../../lib/auditLog';


const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';


interface AdminUser {
  id: string;

  user_id:
    | string
    | null;

  email: string;

  name:
    | string
    | null;

  role:
    | string
    | null;

  is_active:
    | boolean
    | null;

  created_at:
    | string
    | null;

  role_name?:
    | string
    | null;
}


interface Role {
  id: string;
  name: string;

  level:
    | number
    | null;

  is_active:
    | boolean
    | null;
}


interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}


export default function UserManagementPage() {
  const {
    hasPermission,
    refreshAdminProfile,
    adminProfile,
    userRoleNames,
    session,
  } =
    useAuth();


  const canCreate =
    hasPermission(
      'users',
      'create'
    );


  const canUpdate =
    hasPermission(
      'users',
      'update'
    );


  const canDelete =
    hasPermission(
      'users',
      'delete'
    );


  const [
    users,
    setUsers,
  ] =
    useState<
      AdminUser[]
    >([]);


  const [
    roles,
    setRoles,
  ] =
    useState<
      Role[]
    >([]);


  const [
    loading,
    setLoading,
  ] =
    useState(true);


  const [
    search,
    setSearch,
  ] =
    useState('');


  const [
    addOpen,
    setAddOpen,
  ] =
    useState(false);


  const [
    addEmail,
    setAddEmail,
  ] =
    useState('');


  const [
    addName,
    setAddName,
  ] =
    useState('');


  const [
    addPassword,
    setAddPassword,
  ] =
    useState('');


  const [
    showAddPassword,
    setShowAddPassword,
  ] =
    useState(false);


  const [
    addRoleId,
    setAddRoleId,
  ] =
    useState('');


  const [
    submitting,
    setSubmitting,
  ] =
    useState(false);


  const [
    roleModalOpen,
    setRoleModalOpen,
  ] =
    useState(false);


  const [
    editingUser,
    setEditingUser,
  ] =
    useState<
      AdminUser | null
    >(null);


  const [
    selectedRoleId,
    setSelectedRoleId,
  ] =
    useState('');


  const [
    savingRole,
    setSavingRole,
  ] =
    useState(false);


  // =====================================================
  // AUTH FETCH
  // =====================================================

  const authFetch =
    async (
      input:
        RequestInfo | URL,

      init:
        RequestInit = {}
    ) => {
      if (
        !session
          ?.access_token
      ) {
        throw new Error(
          'Session login tidak ditemukan'
        );
      }


      return fetch(
        input,
        {
          ...init,

          headers: {
            ...init.headers,

            Authorization:
              `Bearer ${session.access_token}`,
          },
        }
      );
    };


  // =====================================================
  // LOAD USERS
  // =====================================================

  const fetchUsers =
    async () => {
      setLoading(
        true
      );


      try {
        const response =
          await authFetch(
            `${API_BASE_URL}/api/admin/users`
          );


        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | ApiResponse<AdminUser[]>
              | null;


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal memuat data pengguna'
          );
        }


        setUsers(
          result.data ??
            []
        );
      } catch (error) {
        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal memuat data pengguna',
          'error'
        );
      } finally {
        setLoading(
          false
        );
      }
    };


  // =====================================================
  // LOAD ROLES
  // =====================================================

  const fetchRoles =
    async () => {
      try {
        const response =
          await authFetch(
            `${API_BASE_URL}/api/admin/users/roles`
          );


        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | ApiResponse<Role[]>
              | null;


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal memuat daftar role'
          );
        }


        setRoles(
          result.data ??
            []
        );
      } catch (error) {
        console.error(
          '[UserManagementPage] roles:',
          error
        );
      }
    };


  useEffect(() => {
    if (
      !session
        ?.access_token
    ) {
      return;
    }


    void Promise.all([
      fetchUsers(),
      fetchRoles(),
    ]);
  }, [
    session
      ?.access_token,
  ]);


  // =====================================================
  // FILTER
  // =====================================================

  const filtered =
    users.filter(
      (
        user
      ) => {
        const query =
          search
            .toLowerCase()
            .trim();


        if (!query) {
          return true;
        }


        return (
          (
            user.email ??
            ''
          )
            .toLowerCase()
            .includes(
              query
            ) ||

          (
            user.name ??
            ''
          )
            .toLowerCase()
            .includes(
              query
            ) ||

          (
            user.role ??
            ''
          )
            .toLowerCase()
            .includes(
              query
            ) ||

          (
            user.role_name ??
            ''
          )
            .toLowerCase()
            .includes(
              query
            ) ||

          (
            user.id ??
            ''
          )
            .toLowerCase()
            .includes(
              query
            )
        );
      }
    );


  // =====================================================
  // ADD
  // =====================================================

  const handleAdd =
    async (
      event:
        FormEvent
    ) => {
      event.preventDefault();


      const email =
        addEmail
          .trim();


      if (!email) {
        showToast(
          'Email wajib diisi',
          'warning'
        );

        return;
      }


      if (
        addPassword.length <
        10
      ) {
        showToast(
          'Password awal minimal 10 karakter',
          'warning'
        );

        return;
      }


      setSubmitting(
        true
      );


      try {
        const response =
          await authFetch(
            `${API_BASE_URL}/api/admin/users`,
            {
              method:
                'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  email,

                  name:
                    addName.trim(),

                  password:
                    addPassword,

                  role_id:
                    addRoleId ||
                    null,
                }),
            }
          );


        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | ApiResponse<AdminUser>
              | null;


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal menambahkan pengguna'
          );
        }


        showToast(
          'Pengguna berhasil ditambahkan',
          'success'
        );


        await logActivity({
          adminUserId:
            adminProfile?.id,

          adminName:
            adminProfile?.name,

          adminEmail:
            adminProfile?.email,

          adminRole:
            userRoleNames.join(
              ', '
            ) ||
            adminProfile?.role,

          activityType:
            'CREATE',

          module:
            'Users',

          description:
            `${adminProfile?.name ?? 'Admin'} menambah pengguna ${email}`,
        });


        setAddOpen(
          false
        );

        setAddEmail(
          ''
        );

        setAddName(
          ''
        );

        setAddPassword(
          ''
        );

        setShowAddPassword(
          false
        );

        setAddRoleId(
          ''
        );


        await fetchUsers();
      } catch (error) {
        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal menambahkan pengguna',
          'error'
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };


  // =====================================================
  // OPEN ROLE
  // =====================================================

  const openRoleModal =
    (
      user:
        AdminUser
    ) => {
      setEditingUser(
        user
      );


      const matchRole =
        roles.find(
          (
            role
          ) =>
            role.name ===
            user.role_name
        ) ??
        roles.find(
          (
            role
          ) =>
            role.name ===
            user.role
        );


      setSelectedRoleId(
        matchRole?.id ??
          ''
      );


      setRoleModalOpen(
        true
      );
    };


  // =====================================================
  // SAVE ROLE
  // =====================================================

  const handleSaveRole =
    async () => {
      if (
        !editingUser ||
        !selectedRoleId
      ) {
        showToast(
          'Pilih role terlebih dahulu',
          'warning'
        );

        return;
      }


      setSavingRole(
        true
      );


      try {
        const role =
          roles.find(
            (
              item
            ) =>
              item.id ===
              selectedRoleId
          );


        const response =
          await authFetch(
            `${API_BASE_URL}/api/admin/users/${editingUser.id}/role`,
            {
              method:
                'PATCH',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  role_id:
                    selectedRoleId,
                }),
            }
          );


        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | ApiResponse<{
                  id: string;
                  role_id: string;
                  role_name: string;
                }>
              | null;


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal memperbarui role'
          );
        }


        await refreshAdminProfile();


        showToast(
          'Role pengguna berhasil diperbarui',
          'success'
        );


        await logActivity({
          adminUserId:
            adminProfile?.id,

          adminName:
            adminProfile?.name,

          adminEmail:
            adminProfile?.email,

          adminRole:
            userRoleNames.join(
              ', '
            ) ||
            adminProfile?.role,

          activityType:
            'UPDATE',

          module:
            'Users',

          description:
            `${adminProfile?.name ?? 'Admin'} memperbarui role pengguna ${editingUser.email} menjadi ${role?.name ?? ''}`,
        });


        setRoleModalOpen(
          false
        );

        setEditingUser(
          null
        );

        setSelectedRoleId(
          ''
        );


        await fetchUsers();
      } catch (error) {
        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal memperbarui role',
          'error'
        );
      } finally {
        setSavingRole(
          false
        );
      }
    };


  // =====================================================
  // ACTIVE
  // =====================================================

  const toggleActive =
    async (
      user:
        AdminUser
    ) => {
      try {
        const newStatus =
          !Boolean(
            user.is_active
          );


        const response =
          await authFetch(
            `${API_BASE_URL}/api/admin/users/${user.id}/status`,
            {
              method:
                'PATCH',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  is_active:
                    newStatus,
                }),
            }
          );


        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | ApiResponse<AdminUser>
              | null;


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal mengubah status'
          );
        }


        showToast(
          'Status pengguna diperbarui',
          'success'
        );


        await logActivity({
          adminUserId:
            adminProfile?.id,

          adminName:
            adminProfile?.name,

          adminEmail:
            adminProfile?.email,

          adminRole:
            userRoleNames.join(
              ', '
            ) ||
            adminProfile?.role,

          activityType:
            'UPDATE',

          module:
            'Users',

          description:
            `${adminProfile?.name ?? 'Admin'} ${user.is_active ? 'menonaktifkan' : 'mengaktifkan'} pengguna ${user.email}`,
        });


        await fetchUsers();
      } catch (error) {
        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal mengubah status',
          'error'
        );
      }
    };


  // =====================================================
  // REMOVE
  // =====================================================

  const handleRemove =
    async (
      user:
        AdminUser
    ) => {
      if (
        !window.confirm(
          `Hapus pengguna "${user.email}"? Tindakan ini tidak dapat dibatalkan.`
        )
      ) {
        return;
      }


      try {
        const response =
          await authFetch(
            `${API_BASE_URL}/api/admin/users/${user.id}`,
            {
              method:
                'DELETE',
            }
          );


        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | ApiResponse<{
                  id: string;
                  email: string;
                }>
              | null;


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal menghapus pengguna'
          );
        }


        showToast(
          'Pengguna berhasil dihapus',
          'success'
        );


        await logActivity({
          adminUserId:
            adminProfile?.id,

          adminName:
            adminProfile?.name,

          adminEmail:
            adminProfile?.email,

          adminRole:
            userRoleNames.join(
              ', '
            ) ||
            adminProfile?.role,

          activityType:
            'DELETE',

          module:
            'Users',

          description:
            `${adminProfile?.name ?? 'Admin'} menghapus pengguna ${user.email}`,
        });


        await fetchUsers();
      } catch (error) {
        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal menghapus pengguna',
          'error'
        );
      }
    };


  const truncateId =
    (
      id:
        string
    ) => {
      if (!id) {
        return '-';
      }


      return id.length >
        8
        ? `${id.substring(
            0,
            8
          )}...`
        : id;
    };


  const copyId =
    (
      id:
        string
    ) => {
      navigator.clipboard
        .writeText(
          id
        )
        .then(
          () =>
            showToast(
              'UUID disalin ke clipboard'
            )
        )
        .catch(
          () =>
            showToast(
              'Gagal menyalin',
              'error'
            )
        );
    };


  return (
    <div className="pb-6">

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">

            <UserCog className="h-6 w-6" />

            Manajemen Pengguna

          </h1>


          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kelola admin, tetapkan role, dan aktifkan/nonaktifkan pengguna.
          </p>

        </div>


        {canCreate && (
          <button
            onClick={() =>
              setAddOpen(
                true
              )
            }

            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >

            <Plus className="h-4 w-4" />

            Tambah Pengguna

          </button>
        )}

      </div>


      <div className="mb-4">

        <div className="relative max-w-md">

          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />


          <input
            type="text"

            value={
              search
            }

            onChange={(
              event
            ) =>
              setSearch(
                event.target.value
              )
            }

            placeholder="Cari nama, email, role, atau ID..."

            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />

        </div>

      </div>


      {loading ? (
        <div className="flex items-center justify-center py-12">

          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />

        </div>
      ) : filtered.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Tidak ada pengguna ditemukan.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">

          <table className="w-full text-left text-sm">

            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">

              <tr>
                <th className="px-4 py-3 font-semibold">
                  ID Pengguna
                </th>

                <th className="px-4 py-3 font-semibold">
                  Nama
                </th>

                <th className="px-4 py-3 font-semibold">
                  Email
                </th>

                <th className="px-4 py-3 font-semibold">
                  Role
                </th>

                <th className="px-4 py-3 font-semibold">
                  Status
                </th>

                <th className="px-4 py-3 text-right font-semibold">
                  Aksi
                </th>
              </tr>

            </thead>


            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">

              {filtered.map(
                (
                  user
                ) => (
                  <tr
                    key={
                      user.id
                    }

                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50"
                  >

                    <td className="px-4 py-3">

                      <div className="flex items-center gap-1.5">

                        <span
                          className="font-mono text-xs text-slate-600 dark:text-slate-300"

                          title={
                            user.id
                          }
                        >
                          {
                            truncateId(
                              user.id
                            )
                          }
                        </span>


                        <button
                          onClick={() =>
                            copyId(
                              user.id
                            )
                          }

                          className="text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"

                          title="Salin UUID"
                        >

                          <Copy className="h-3 w-3" />

                        </button>

                      </div>

                    </td>


                    <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                      {
                        user.name ??
                        '-'
                      }
                    </td>


                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                      {
                        user.email
                      }
                    </td>


                    <td className="px-4 py-3">

                      {user.role_name ||
                      user.role ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">

                          <ShieldCheck className="h-3 w-3" />

                          {
                            user.role_name ??
                            user.role
                          }

                        </span>
                      ) : (
                        <span className="text-xs text-slate-400">
                          Belum ada role
                        </span>
                      )}

                    </td>


                    <td className="px-4 py-3">

                      <span
                        className={cn(
                          'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',

                          user.is_active
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                            : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                        )}
                      >
                        {user.is_active
                          ? 'Aktif'
                          : 'Nonaktif'}
                      </span>

                    </td>


                    <td className="px-4 py-3">

                      <div className="flex items-center justify-end gap-2">

                        {canUpdate && (
                          <>

                            <button
                              onClick={() =>
                                openRoleModal(
                                  user
                                )
                              }

                              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                            >
                              Ubah Role
                            </button>


                            <button
                              onClick={() =>
                                void toggleActive(
                                  user
                                )
                              }

                              className={cn(
                                'rounded-lg border px-3 py-1.5 text-xs font-medium',

                                user.is_active
                                  ? 'border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/20'
                                  : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20'
                              )}

                              title={
                                user.is_active
                                  ? 'Nonaktifkan'
                                  : 'Aktifkan'
                              }
                            >

                              <Power className="h-3.5 w-3.5" />

                            </button>

                          </>
                        )}


                        {canDelete && (
                          <button
                            onClick={() =>
                              void handleRemove(
                                user
                              )
                            }

                            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                          >

                            <Trash2 className="h-3.5 w-3.5" />

                          </button>
                        )}

                      </div>

                    </td>

                  </tr>
                )
              )}

            </tbody>

          </table>

        </div>
      )}


      {/* ADD USER */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">

            <div className="mb-4 flex items-center justify-between">

              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                Tambah Pengguna
              </h2>


              <button
                onClick={() =>
                  setAddOpen(
                    false
                  )
                }

                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >

                <X className="h-5 w-5" />

              </button>

            </div>


            <form
              onSubmit={
                handleAdd
              }

              className="space-y-4"
            >

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email *
                </label>


                <input
                  type="email"

                  value={
                    addEmail
                  }

                  onChange={(
                    event
                  ) =>
                    setAddEmail(
                      event.target.value
                    )
                  }

                  required

                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>


              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama
                </label>


                <input
                  type="text"

                  value={
                    addName
                  }

                  onChange={(
                    event
                  ) =>
                    setAddName(
                      event.target.value
                    )
                  }

                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>


              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Password Awal *
                </label>

                <div className="relative">
                  <input
                    type={
                      showAddPassword
                        ? 'text'
                        : 'password'
                    }
                    value={
                      addPassword
                    }
                    onChange={(
                      event
                    ) =>
                      setAddPassword(
                        event.target.value
                      )
                    }
                    minLength={10}
                    required
                    autoComplete="new-password"
                    placeholder="Minimal 10 karakter"
                    className="w-full rounded-xl border border-slate-300 px-4 py-2.5 pr-11 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowAddPassword(
                        !showAddPassword
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                    aria-label={
                      showAddPassword
                        ? 'Sembunyikan password'
                        : 'Lihat password'
                    }
                  >
                    {showAddPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>

                <p className="mt-1 text-xs text-slate-400">
                  Password ini dipakai pengguna untuk login pertama kali.
                </p>

              </div>


              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Role
                </label>


                <select
                  value={
                    addRoleId
                  }

                  onChange={(
                    event
                  ) =>
                    setAddRoleId(
                      event.target.value
                    )
                  }

                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >

                  <option value="">
                    — Pilih Role —
                  </option>


                  {roles.map(
                    (
                      role
                    ) => (
                      <option
                        key={
                          role.id
                        }

                        value={
                          role.id
                        }
                      >
                        {
                          role.name
                        }
                      </option>
                    )
                  )}

                </select>

              </div>


              <div className="flex justify-end gap-3 pt-2">

                <button
                  type="button"

                  onClick={() =>
                    setAddOpen(
                      false
                    )
                  }

                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>


                <button
                  type="submit"

                  disabled={
                    submitting
                  }

                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >

                  {submitting && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}


                  {submitting
                    ? 'Menyimpan...'
                    : 'Simpan'}

                </button>

              </div>

            </form>

          </div>

        </div>
      )}


      {/* ROLE MODAL */}
      {roleModalOpen &&
        editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">

            <div className="mb-4 flex items-center justify-between">

              <div>

                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Ubah Role
                </h2>


                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Pengguna:{' '}

                  <span className="font-medium">
                    {
                      editingUser.email
                    }
                  </span>
                </p>

              </div>


              <button
                onClick={() =>
                  setRoleModalOpen(
                    false
                  )
                }

                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >

                <X className="h-5 w-5" />

              </button>

            </div>


            <div className="space-y-4">

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  ID Pengguna
                </label>


                <div className="flex items-center gap-2">

                  <input
                    type="text"

                    value={
                      editingUser.id
                    }

                    readOnly

                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  />


                  <button
                    type="button"

                    onClick={() =>
                      copyId(
                        editingUser.id
                      )
                    }

                    className="shrink-0 rounded-lg border border-slate-300 p-2 text-slate-500 hover:bg-slate-50 hover:text-brand-600 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800"

                    title="Salin UUID"
                  >

                    <Copy className="h-4 w-4" />

                  </button>

                </div>

              </div>


              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Role
                </label>


                <select
                  value={
                    selectedRoleId
                  }

                  onChange={(
                    event
                  ) =>
                    setSelectedRoleId(
                      event.target.value
                    )
                  }

                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >

                  <option value="">
                    — Pilih Role —
                  </option>


                  {roles.map(
                    (
                      role
                    ) => (
                      <option
                        key={
                          role.id
                        }

                        value={
                          role.id
                        }
                      >
                        {
                          role.name
                        }
                      </option>
                    )
                  )}

                </select>

              </div>


              <div className="flex justify-end gap-3 pt-2">

                <button
                  type="button"

                  onClick={() =>
                    setRoleModalOpen(
                      false
                    )
                  }

                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>


                <button
                  type="button"

                  onClick={() =>
                    void handleSaveRole()
                  }

                  disabled={
                    savingRole
                  }

                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >

                  {savingRole && (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  )}


                  {savingRole
                    ? 'Menyimpan...'
                    : 'Simpan'}

                </button>

              </div>

            </div>

          </div>

        </div>
      )}

    </div>
  );
}