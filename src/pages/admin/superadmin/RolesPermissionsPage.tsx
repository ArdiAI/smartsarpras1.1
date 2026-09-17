import {
  useEffect,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';

import {
  ShieldCheck,
  Plus,
  Pencil,
  Trash2,
  X,
  Loader2,
  Lock,
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


const API_BASE_URL =
  import.meta.env.VITE_API_URL ??
  'http://localhost:3001';


interface Role {
  id: string;
  name: string;

  description:
    | string
    | null;

  level:
    | number
    | null;

  is_system:
    | boolean
    | null
    | undefined;

  is_active:
    | boolean
    | null;

  created_at:
    | string
    | null;
}


interface ApiResponse<T> {
  ok: boolean;
  data?: T;
  message?: string;
}


const emptyForm = {
  name: '',
  description: '',
  level: '0',
  is_active: true,
};


export default function RolesPermissionsPage() {
  const {
    hasPermission,
    session,
  } = useAuth();


  const canCreate =
    hasPermission(
      'roles',
      'create'
    );


  const canUpdate =
    hasPermission(
      'roles',
      'update'
    );


  const canDelete =
    hasPermission(
      'roles',
      'delete'
    );


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
    useState(
      true
    );


  const [
    modalOpen,
    setModalOpen,
  ] =
    useState(
      false
    );


  const [
    editingId,
    setEditingId,
  ] =
    useState<
      string | null
    >(null);


  const [
    submitting,
    setSubmitting,
  ] =
    useState(
      false
    );


  const [
    form,
    setForm,
  ] =
    useState({
      ...emptyForm,
    });


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
  // LOAD ROLES
  // =====================================================

  const fetchRoles =
    async () => {
      setLoading(
        true
      );


      try {
        const response =
          await authFetch(
            `${API_BASE_URL}/api/admin/roles`
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
              'Gagal memuat role'
          );
        }


        setRoles(
          result.data ??
            []
        );
      } catch (error) {
        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal memuat role',
          'error'
        );
      } finally {
        setLoading(
          false
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


    void fetchRoles();
  }, [
    session
      ?.access_token,
  ]);


  // =====================================================
  // MODAL
  // =====================================================

  const openCreate =
    () => {
      setEditingId(
        null
      );


      setForm({
        ...emptyForm,
      });


      setModalOpen(
        true
      );
    };


  const openEdit =
    (
      role:
        Role
    ) => {
      setEditingId(
        role.id
      );


      setForm({
        name:
          role.name ??
          '',

        description:
          role.description ??
          '',

        level:
          String(
            role.level ??
              0
          ),

        is_active:
          role.is_active ??
          true,
      });


      setModalOpen(
        true
      );
    };


  const handleChange =
    (
      event:
        ChangeEvent<
          HTMLInputElement |
          HTMLTextAreaElement
        >
    ) => {
      const {
        name,
        value,
        type,
      } =
        event.target;


      setForm(
        (
          previous
        ) => ({
          ...previous,

          [name]:
            type ===
            'checkbox'
              ? (
                  event.target as HTMLInputElement
                ).checked
              : value,
        })
      );
    };


  // =====================================================
  // CREATE / UPDATE
  // =====================================================

  const handleSubmit =
    async (
      event:
        FormEvent
    ) => {
      event.preventDefault();


      if (
        !form.name
          .trim()
      ) {
        showToast(
          'Nama role wajib diisi',
          'warning'
        );

        return;
      }


      setSubmitting(
        true
      );


      try {
        const payload = {
          name:
            form.name.trim(),

          description:
            form.description
              .trim() ||
            null,

          level:
            form.level
              ? parseInt(
                  form.level,
                  10
                )
              : 0,

          is_active:
            form.is_active,
        };


        const response =
          await authFetch(
            editingId
              ? `${API_BASE_URL}/api/admin/roles/${editingId}`
              : `${API_BASE_URL}/api/admin/roles`,
            {
              method:
                editingId
                  ? 'PATCH'
                  : 'POST',

              headers: {
                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify(
                  payload
                ),
            }
          );


        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | ApiResponse<Role>
              | null;


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal menyimpan role'
          );
        }


        showToast(
          editingId
            ? 'Role berhasil diperbarui'
            : 'Role berhasil ditambahkan',
          'success'
        );


        setModalOpen(
          false
        );


        await fetchRoles();
      } catch (error) {
        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal menyimpan role',
          'error'
        );
      } finally {
        setSubmitting(
          false
        );
      }
    };


  // =====================================================
  // DELETE
  // =====================================================

  const handleDelete =
    async (
      role:
        Role
    ) => {
      if (
        role.is_system
      ) {
        showToast(
          'Role sistem tidak dapat dihapus',
          'warning'
        );

        return;
      }


      if (
        !window.confirm(
          `Hapus role "${role.name}"? Tindakan ini tidak dapat dibatalkan.`
        )
      ) {
        return;
      }


      try {
        const response =
          await authFetch(
            `${API_BASE_URL}/api/admin/roles/${role.id}`,
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
                  name: string;
                }>
              | null;


        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              'Gagal menghapus role'
          );
        }


        showToast(
          'Role berhasil dihapus',
          'success'
        );


        await fetchRoles();
      } catch (error) {
        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal menghapus role',
          'error'
        );
      }
    };


  return (
    <div className="pb-6">

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

        <div>

          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">

            <ShieldCheck className="h-6 w-6" />

            Roles & Permissions

          </h1>


          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kelola role dan tingkat akses untuk admin sistem.
          </p>

        </div>


        {canCreate && (
          <button
            onClick={
              openCreate
            }

            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >

            <Plus className="h-4 w-4" />

            Tambah Role

          </button>
        )}

      </div>


      {loading ? (
        <div className="flex items-center justify-center py-12">

          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />

        </div>
      ) : roles.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Belum ada role.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">

          {roles.map(
            (
              role
            ) => (
              <div
                key={
                  role.id
                }

                className={cn(
                  'rounded-2xl border bg-white p-5 shadow-sm dark:bg-slate-900',

                  role.is_active
                    ? 'border-slate-200 dark:border-slate-800'
                    : 'border-slate-200 opacity-60 dark:border-slate-800'
                )}
              >

                <div className="mb-3 flex items-start justify-between">

                  <div className="flex items-center gap-2">

                    <div
                      className={cn(
                        'flex h-10 w-10 items-center justify-center rounded-xl',

                        role.is_system
                          ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
                          : 'bg-brand-100 text-brand-600 dark:bg-brand-900/40 dark:text-brand-400'
                      )}
                    >

                      {role.is_system ? (
                        <Lock className="h-5 w-5" />
                      ) : (
                        <ShieldCheck className="h-5 w-5" />
                      )}

                    </div>


                    <div>

                      <h3 className="font-semibold text-slate-900 dark:text-white">
                        {
                          role.name
                        }
                      </h3>


                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Level{' '}
                        {
                          role.level ??
                          0
                        }
                      </p>

                    </div>

                  </div>


                  <span
                    className={cn(
                      'rounded-full px-2.5 py-0.5 text-xs font-medium',

                      role.is_active
                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                    )}
                  >
                    {role.is_active
                      ? 'Aktif'
                      : 'Nonaktif'}
                  </span>

                </div>


                {role.description && (
                  <p className="mb-3 line-clamp-3 text-sm text-slate-500 dark:text-slate-400">
                    {
                      role.description
                    }
                  </p>
                )}


                <div className="flex items-center gap-2">

                  {canUpdate && (
                    <button
                      onClick={() =>
                        openEdit(
                          role
                        )
                      }

                      className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    >

                      <Pencil className="mr-1 inline h-4 w-4" />

                      Edit

                    </button>
                  )}


                  {canDelete && (
                    <button
                      onClick={() =>
                        void handleDelete(
                          role
                        )
                      }

                      disabled={
                        role.is_system ??
                        false
                      }

                      className={cn(
                        'rounded-lg border px-3 py-2 text-sm font-medium',

                        role.is_system
                          ? 'cursor-not-allowed border-slate-200 text-slate-300 dark:border-slate-700 dark:text-slate-600'
                          : 'border-red-300 text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20'
                      )}
                    >

                      <Trash2 className="h-4 w-4" />

                    </button>
                  )}

                </div>

              </div>
            )
          )}

        </div>
      )}


      {/* MODAL */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">

          <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">

            <div className="mb-4 flex items-center justify-between">

              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                {editingId
                  ? 'Edit Role'
                  : 'Tambah Role'}
              </h2>


              <button
                onClick={() =>
                  setModalOpen(
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
                handleSubmit
              }

              className="space-y-4"
            >

              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Nama Role *
                </label>


                <input
                  name="name"

                  value={
                    form.name
                  }

                  onChange={
                    handleChange
                  }

                  required

                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>


              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Deskripsi
                </label>


                <textarea
                  name="description"

                  value={
                    form.description
                  }

                  onChange={
                    handleChange
                  }

                  rows={
                    3
                  }

                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>


              <div>

                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Level
                </label>


                <input
                  name="level"

                  type="number"

                  value={
                    form.level
                  }

                  onChange={
                    handleChange
                  }

                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />

              </div>


              <div>

                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">

                  <input
                    name="is_active"

                    type="checkbox"

                    checked={
                      form.is_active
                    }

                    onChange={
                      handleChange
                    }

                    className="h-4 w-4 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                  />

                  Aktif

                </label>

              </div>


              <div className="flex justify-end gap-3 pt-2">

                <button
                  type="button"

                  onClick={() =>
                    setModalOpen(
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

    </div>
  );
}