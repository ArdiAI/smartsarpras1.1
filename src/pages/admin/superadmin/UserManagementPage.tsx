import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../context/AuthContext';
import { logActivity } from '../../../lib/auditLog';
import { UserCog, Plus, Trash2, X, Loader2, Search, ShieldCheck, Power, Copy } from 'lucide-react';

interface AdminUser {
  id: string;
  user_id: string | null;
  email: string;
  name: string | null;
  role: string | null;
  is_active: boolean | null;
  created_at: string | null;
  role_name?: string | null;
}

interface Role {
  id: string;
  name: string;
  level: number | null;
  is_active: boolean | null;
}

export default function UserManagementPage() {
  const { hasPermission, refreshAdminProfile, adminProfile, userRoleNames } = useAuth();
  const canCreate = hasPermission('users', 'create');
  const canUpdate = hasPermission('users', 'update');
  const canDelete = hasPermission('users', 'delete');

  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  const [addOpen, setAddOpen] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addName, setAddName] = useState('');
  const [addRoleId, setAddRoleId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [roleModalOpen, setRoleModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<AdminUser | null>(null);
  const [selectedRoleId, setSelectedRoleId] = useState('');
  const [savingRole, setSavingRole] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('admin_users')
        .select('id, user_id, email, name, role, is_active, created_at')
        .order('created_at', { ascending: false });
      if (error) {
        showToast('Gagal memuat data pengguna', 'error');
        return;
      }
      const baseUsers = (data ?? []) as unknown as AdminUser[];

      // Fetch role names from admin_user_roles join
      const { data: roleLinks } = await supabase
        .from('admin_user_roles')
        .select('admin_user_id, role_id, roles(name)');
      const linkMap = new Map<string, string>();
      (roleLinks ?? []).forEach((l: any) => {
        const roleName = l?.roles?.name;
        if (roleName && l?.admin_user_id) {
          linkMap.set(l.admin_user_id as string, roleName as string);
        }
      });

      const enriched = baseUsers.map((u) => ({
        ...u,
        role_name: linkMap.get(u.id) ?? null,
      }));
      setUsers(enriched);
    } catch {
      showToast('Gagal memuat data pengguna', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('id, name, level, is_active')
        .eq('is_active', true)
        .order('level', { ascending: false });
      if (error) return;
      setRoles((data ?? []) as unknown as Role[]);
    } catch {
      /* noop */
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, []);

  const filtered = users.filter((u) => {
    const q = search.toLowerCase().trim();
    if (!q) return true;
    return (
      (u.email ?? '').toLowerCase().includes(q) ||
      (u.name ?? '').toLowerCase().includes(q) ||
      (u.role ?? '').toLowerCase().includes(q) ||
      (u.role_name ?? '').toLowerCase().includes(q) ||
      (u.id ?? '').toLowerCase().includes(q)
    );
  });

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addEmail.trim()) {
      showToast('Email wajib diisi', 'warning');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('admin_users').insert({
        email: addEmail.trim(),
        name: addName.trim() || null,
        role: roles.find((r) => r.id === addRoleId)?.name ?? null,
        is_active: true,
      });
      if (error) {
        showToast('Gagal menambahkan pengguna: ' + error.message, 'error');
        return;
      }

      // If a role was selected, assign it via admin_user_roles
      if (addRoleId) {
        // Fetch the newly inserted user by email
        const { data: newUser } = await supabase
          .from('admin_users')
          .select('id')
          .eq('email', addEmail.trim())
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (newUser) {
          const newId = (newUser as any).id as string;
          await supabase.from('admin_user_roles').delete().eq('admin_user_id', newId);
          await supabase.from('admin_user_roles').insert({ admin_user_id: newId, role_id: addRoleId });
        }
      }

      showToast('Pengguna berhasil ditambahkan');
      await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'CREATE', module: 'Users', description: `${adminProfile?.name ?? 'Admin'} menambah pengguna ${addEmail.trim()}` });
      setAddOpen(false);
      setAddEmail('');
      setAddName('');
      setAddRoleId('');
      await fetchUsers();
    } catch {
      showToast('Gagal menambahkan pengguna', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const openRoleModal = (u: AdminUser) => {
    setEditingUser(u);
    // Pre-select the role: match by role_name first, then by role text column
    const matchRole = roles.find((r) => r.name === u.role_name) ?? roles.find((r) => r.name === u.role);
    setSelectedRoleId(matchRole?.id ?? '');
    setRoleModalOpen(true);
  };

  const handleSaveRole = async () => {
    if (!editingUser || !selectedRoleId) {
      showToast('Pilih role terlebih dahulu', 'warning');
      return;
    }
    setSavingRole(true);
    try {
      const adminUserId = editingUser.id;
      const role = roles.find((r) => r.id === selectedRoleId);
      const roleName = role?.name ?? '';

      // 1. Update admin_users.role text column
      const { error: updErr } = await supabase
        .from('admin_users')
        .update({ role: roleName })
        .eq('id', adminUserId);
      if (updErr) {
        showToast('Gagal memperbarui role: ' + updErr.message, 'error');
        return;
      }

      // 2. Delete existing role assignments
      await supabase.from('admin_user_roles').delete().eq('admin_user_id', adminUserId);

      // 3. Insert new role assignment
      const { error: insErr } = await supabase
        .from('admin_user_roles')
        .insert({ admin_user_id: adminUserId, role_id: selectedRoleId });
      if (insErr) {
        showToast('Gagal menetapkan role: ' + insErr.message, 'error');
        return;
      }

      // 4. Call refreshAdminProfile()
      await refreshAdminProfile();

      showToast('Role pengguna berhasil diperbarui');
      await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'UPDATE', module: 'Users', description: `${adminProfile?.name ?? 'Admin'} memperbarui role pengguna ${editingUser?.email ?? ''} menjadi ${roleName}` });
      setRoleModalOpen(false);
      setEditingUser(null);
      setSelectedRoleId('');
      await fetchUsers();
    } catch {
      showToast('Gagal memperbarui role', 'error');
    } finally {
      setSavingRole(false);
    }
  };

  const toggleActive = async (u: AdminUser) => {
    try {
      const { error } = await supabase
        .from('admin_users')
        .update({ is_active: !u.is_active })
        .eq('id', u.id);
      if (error) {
        showToast('Gagal mengubah status', 'error');
        return;
      }
      showToast('Status pengguna diperbarui');
      await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'UPDATE', module: 'Users', description: `${adminProfile?.name ?? 'Admin'} ${u.is_active ? 'menonaktifkan' : 'mengaktifkan'} pengguna ${u.email}` });
      await fetchUsers();
    } catch {
      showToast('Gagal mengubah status', 'error');
    }
  };

  const handleRemove = async (u: AdminUser) => {
    if (!window.confirm(`Hapus pengguna "${u.email}"? Tindakan ini tidak dapat dibatalkan.`)) return;
    try {
      await supabase.from('admin_user_roles').delete().eq('admin_user_id', u.id);
      const { error } = await supabase.from('admin_users').delete().eq('id', u.id);
      if (error) {
        showToast('Gagal menghapus pengguna: ' + error.message, 'error');
        return;
      }
      showToast('Pengguna berhasil dihapus');
      await logActivity({ adminUserId: adminProfile?.id, adminName: adminProfile?.name, adminEmail: adminProfile?.email, adminRole: userRoleNames.join(', ') || adminProfile?.role, activityType: 'DELETE', module: 'Users', description: `${adminProfile?.name ?? 'Admin'} menghapus pengguna ${u.email}` });
      await fetchUsers();
    } catch {
      showToast('Gagal menghapus pengguna', 'error');
    }
  };

  const truncateId = (id: string) => {
    if (!id) return '-';
    return id.length > 8 ? id.substring(0, 8) + '...' : id;
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id).then(() => showToast('UUID disalin ke clipboard')).catch(() => showToast('Gagal menyalin', 'error'));
  };

  return (
    <div className="pb-6">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
            <UserCog className="h-6 w-6" /> Manajemen Pengguna
          </h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Kelola admin, tetapkan role, dan aktifkan/nonaktifkan pengguna.
          </p>
        </div>
        {canCreate && (
          <button
            onClick={() => setAddOpen(true)}
            className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700"
          >
            <Plus className="h-4 w-4" /> Tambah Pengguna
          </button>
        )}
      </div>

      {/* Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama, email, role, atau ID..."
            className="w-full rounded-xl border border-slate-300 py-2.5 pl-10 pr-4 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Tidak ada pengguna ditemukan.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase text-slate-500 dark:border-slate-800 dark:bg-slate-800/50 dark:text-slate-400">
              <tr>
                <th className="px-4 py-3 font-semibold">ID Pengguna</th>
                <th className="px-4 py-3 font-semibold">Nama</th>
                <th className="px-4 py-3 font-semibold">Email</th>
                <th className="px-4 py-3 font-semibold">Role</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="font-mono text-xs text-slate-600 dark:text-slate-300"
                        title={u.id}
                      >
                        {truncateId(u.id)}
                      </span>
                      <button
                        onClick={() => copyId(u.id)}
                        className="text-slate-400 hover:text-brand-600 dark:hover:text-brand-400"
                        title="Salin UUID"
                      >
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                    {u.name ?? '-'}
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{u.email}</td>
                  <td className="px-4 py-3">
                    {u.role_name || u.role ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-300">
                        <ShieldCheck className="h-3 w-3" />
                        {u.role_name ?? u.role}
                      </span>
                    ) : (
                      <span className="text-xs text-slate-400">Belum ada role</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-block rounded-full px-2.5 py-0.5 text-xs font-medium',
                        u.is_active
                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300'
                          : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'
                      )}
                    >
                      {u.is_active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      {canUpdate && (
                        <>
                          <button
                            onClick={() => openRoleModal(u)}
                            className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                          >
                            Ubah Role
                          </button>
                          <button
                            onClick={() => toggleActive(u)}
                            className={cn(
                              'rounded-lg border px-3 py-1.5 text-xs font-medium',
                              u.is_active
                                ? 'border-amber-300 text-amber-600 hover:bg-amber-50 dark:border-amber-800 dark:hover:bg-amber-900/20'
                                : 'border-emerald-300 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800 dark:hover:bg-emerald-900/20'
                            )}
                            title={u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleRemove(u)}
                          className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:hover:bg-red-900/20"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add User Modal */}
      {addOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Tambah Pengguna</h2>
              <button
                onClick={() => setAddOpen(false)}
                className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleAdd} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Email *
                </label>
                <input
                  type="email"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
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
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Role
                </label>
                <select
                  value={addRoleId}
                  onChange={(e) => setAddRoleId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">— Pilih Role —</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setAddOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Role Assignment Modal */}
      {roleModalOpen && editingUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Ubah Role</h2>
                <p className="mt-0.5 text-sm text-slate-500 dark:text-slate-400">
                  Pengguna: <span className="font-medium">{editingUser.email}</span>
                </p>
              </div>
              <button
                onClick={() => setRoleModalOpen(false)}
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
                    value={editingUser.id}
                    readOnly
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 font-mono text-xs text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
                  />
                  <button
                    type="button"
                    onClick={() => copyId(editingUser.id)}
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
                  value={selectedRoleId}
                  onChange={(e) => setSelectedRoleId(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                >
                  <option value="">— Pilih Role —</option>
                  {roles.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setRoleModalOpen(false)}
                  className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-300"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleSaveRole}
                  disabled={savingRole}
                  className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  {savingRole ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {savingRole ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
