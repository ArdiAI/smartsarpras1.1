import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { cn } from '../../../utils/cn';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../context/AuthContext';
import { Settings, Loader2, Save } from 'lucide-react';

interface SystemConfig {
  id: string;
  key: string;
  value: unknown;
  label: string | null;
  description: string | null;
  config_group: string | null;
  updated_at: string | null;
}

type ValueType = 'boolean' | 'number' | 'string' | 'json';

function detectType(value: unknown): ValueType {
  if (typeof value === 'boolean') return 'boolean';
  if (typeof value === 'number') return 'number';
  if (typeof value === 'string') return 'string';
  return 'json';
}

export default function SystemConfigPage() {
  const { hasPermission, adminProfile } = useAuth();
  const canManage = hasPermission('system_config', 'manage');

  const [configs, setConfigs] = useState<SystemConfig[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Record<string, unknown>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('system_config')
        .select('id, key, value, label, description, config_group, updated_at')
        .order('config_group', { ascending: true })
        .order('key', { ascending: true });
      if (error) {
        showToast('Gagal memuat konfigurasi', 'error');
        return;
      }
      const cfgs = (data ?? []) as unknown as SystemConfig[];
      setConfigs(cfgs);
      // Initialize editing state
      const editMap: Record<string, unknown> = {};
      cfgs.forEach((c) => {
        editMap[c.key] = c.value;
      });
      setEditing(editMap);
    } catch {
      showToast('Gagal memuat konfigurasi', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  // Group configs by config_group
  const groups: Record<string, SystemConfig[]> = {};
  configs.forEach((c) => {
    const g = c.config_group ?? 'Umum';
    if (!groups[g]) groups[g] = [];
    groups[g].push(c);
  });

  const handleSave = async (c: SystemConfig) => {
    const newValue = editing[c.key];
    setSavingKey(c.key);
    try {
      const { error } = await supabase
        .from('system_config')
        .update({
          value: newValue,
          updated_by: adminProfile?.id ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', c.id);
      if (error) {
        showToast('Gagal menyimpan: ' + error.message, 'error');
        return;
      }
      showToast(`Konfigurasi "${c.label ?? c.key}" berhasil disimpan`);
      await fetchConfigs();
    } catch {
      showToast('Gagal menyimpan konfigurasi', 'error');
    } finally {
      setSavingKey(null);
    }
  };

  const renderEditor = (c: SystemConfig) => {
    const type = detectType(c.value);
    const currentVal = editing[c.key];

    if (type === 'boolean') {
      return (
        <label className="flex items-center gap-3">
          <button
            type="button"
            disabled={!canManage}
            onClick={() => setEditing((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
            className={cn(
              'relative inline-flex h-6 w-11 items-center rounded-full transition',
              currentVal ? 'bg-brand-600' : 'bg-slate-300 dark:bg-slate-700',
              !canManage && 'cursor-not-allowed opacity-60'
            )}
          >
            <span
              className={cn(
                'inline-block h-4 w-4 transform rounded-full bg-white transition',
                currentVal ? 'translate-x-6' : 'translate-x-1'
              )}
            />
          </button>
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {currentVal ? 'Aktif' : 'Nonaktif'}
          </span>
        </label>
      );
    }

    if (type === 'number') {
      return (
        <input
          type="number"
          disabled={!canManage}
          value={typeof currentVal === 'number' ? currentVal : 0}
          onChange={(e) =>
            setEditing((prev) => ({ ...prev, [c.key]: parseFloat(e.target.value) || 0 }))
          }
          className="w-full max-w-xs rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      );
    }

    if (type === 'string') {
      return (
        <input
          type="text"
          disabled={!canManage}
          value={typeof currentVal === 'string' ? currentVal : ''}
          onChange={(e) => setEditing((prev) => ({ ...prev, [c.key]: e.target.value }))}
          className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
      );
    }

    // JSON type
    return (
      <textarea
        disabled={!canManage}
        value={(() => {
          try {
            return JSON.stringify(currentVal, null, 2);
          } catch {
            return String(currentVal ?? '');
          }
        })()}
        onChange={(e) => {
          try {
            const parsed = JSON.parse(e.target.value);
            setEditing((prev) => ({ ...prev, [c.key]: parsed }));
          } catch {
            // Keep raw string if not valid JSON yet
            setEditing((prev) => ({ ...prev, [c.key]: e.target.value }));
          }
        }}
        rows={4}
        className="w-full rounded-xl border border-slate-300 px-4 py-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-white"
      />
    );
  };

  return (
    <div className="pb-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <Settings className="h-6 w-6" /> Konfigurasi Sistem
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Kelola pengaturan sistem. Nilai terdeteksi otomatis: boolean (toggle), number (input
          angka), string (teks), atau JSON.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : configs.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Belum ada konfigurasi sistem.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groups).map(([group, items]) => (
            <div key={group}>
              <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">
                {group}
              </h2>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {items.map((c) => {
                  const type = detectType(c.value);
                  const isDirty = JSON.stringify(editing[c.key]) !== JSON.stringify(c.value);
                  return (
                    <div
                      key={c.id}
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                    >
                      <div className="mb-3">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold text-slate-900 dark:text-white">
                            {c.label ?? c.key}
                          </h3>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                            {type}
                          </span>
                        </div>
                        {c.description && (
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {c.description}
                          </p>
                        )}
                        <p className="mt-0.5 font-mono text-xs text-slate-400">key: {c.key}</p>
                      </div>
                      <div className="mb-3">{renderEditor(c)}</div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-400">
                          Diperbarui: {c.updated_at ? new Date(c.updated_at).toLocaleDateString('id-ID') : '-'}
                        </span>
                        {canManage && (
                          <button
                            onClick={() => handleSave(c)}
                            disabled={!isDirty || savingKey === c.key}
                            className={cn(
                              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',
                              isDirty
                                ? 'bg-brand-600 text-white hover:bg-brand-700'
                                : 'cursor-default bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                            )}
                          >
                            {savingKey === c.key ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Save className="h-4 w-4" />
                            )}
                            Simpan
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
