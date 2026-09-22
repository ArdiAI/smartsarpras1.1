import { useEffect, useMemo, useState } from 'react';
import { cn } from '../../../utils/cn';
import { showToast } from '../../../components/Toast';
import { useAuth } from '../../../context/AuthContext';
import { Settings, Loader2, Save } from 'lucide-react';

const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));

interface SystemConfig {
  id: string;
  key: string;
  value: unknown;
  label: string | null;
  description: string | null;
  config_group: string | null;
  updated_at: string | null;
}

type ValueType =
  | 'boolean'
  | 'number'
  | 'string'
  | 'json';

function detectType(
  value: unknown
): ValueType {
  if (
    typeof value ===
    'boolean'
  ) {
    return 'boolean';
  }

  if (
    typeof value ===
    'number'
  ) {
    return 'number';
  }

  if (
    typeof value ===
    'string'
  ) {
    return 'string';
  }

  return 'json';
}

export default function SystemConfigPage() {
  const {
    hasPermission,
    session,
  } = useAuth();

  const canManage =
    hasPermission(
      'system_config',
      'manage'
    );

  const [
    configs,
    setConfigs,
  ] =
    useState<
      SystemConfig[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    editing,
    setEditing,
  ] =
    useState<
      Record<
        string,
        unknown
      >
    >({});

  const [
    savingKey,
    setSavingKey,
  ] =
    useState<
      string | null
    >(null);

  const getAuthHeaders =
    () => {
      const token =
        session
          ?.access_token;

      if (!token) {
        throw new Error(
          'Session login tidak ditemukan'
        );
      }

      return {
        Authorization:
          `Bearer ${token}`,
      };
    };

  const fetchConfigs =
    async () => {
      setLoading(true);

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/admin/system-config`,
            {
              headers:
                getAuthHeaders(),
            }
          );

        const result =
          await response
            .json()
            .catch(
              () => null
            );

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              `HTTP ${response.status}`
          );
        }

        const cfgs =
          Array.isArray(
            result.data
          )
            ? (
                result.data as SystemConfig[]
              )
            : [];

        setConfigs(
          cfgs
        );

        const editMap:
          Record<
            string,
            unknown
          > = {};

        cfgs.forEach(
          (config) => {
            editMap[
              config.key
            ] =
              config.value;
          }
        );

        setEditing(
          editMap
        );
      } catch (
        error
      ) {
        console.error(
          '[SystemConfigPage] fetch error:',
          error
        );

        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal memuat konfigurasi',
          'error'
        );
      } finally {
        setLoading(false);
      }
    };

  useEffect(() => {
    if (
      session
        ?.access_token
    ) {
      void fetchConfigs();
    } else {
      setLoading(false);
    }
  }, [
    session
      ?.access_token,
  ]);

  const groups =
    useMemo(() => {
      const grouped:
        Record<
          string,
          SystemConfig[]
        > = {};

      configs.forEach(
        (config) => {
          const group =
            config
              .config_group ??
            'Umum';

          if (
            !grouped[
              group
            ]
          ) {
            grouped[
              group
            ] = [];
          }

          grouped[
            group
          ].push(
            config
          );
        }
      );

      return grouped;
    }, [configs]);

  const handleSave =
    async (
      config:
        SystemConfig
    ) => {
      if (
        !canManage
      ) {
        showToast(
          'Anda tidak memiliki izin mengubah konfigurasi',
          'error'
        );

        return;
      }

      const newValue =
        editing[
          config.key
        ];

      setSavingKey(
        config.key
      );

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/admin/system-config/${encodeURIComponent(
              config.id
            )}`,
            {
              method:
                'PATCH',

              headers: {
                ...getAuthHeaders(),

                'Content-Type':
                  'application/json',
              },

              body:
                JSON.stringify({
                  value:
                    newValue,
                }),
            }
          );

        const result =
          await response
            .json()
            .catch(
              () => null
            );

        if (
          !response.ok ||
          !result?.ok
        ) {
          throw new Error(
            result?.message ??
              `HTTP ${response.status}`
          );
        }

        showToast(
          `Konfigurasi "${config.label ?? config.key}" berhasil disimpan`
        );

        await fetchConfigs();
      } catch (
        error
      ) {
        console.error(
          '[SystemConfigPage] save error:',
          error
        );

        showToast(
          error instanceof
            Error
            ? error.message
            : 'Gagal menyimpan konfigurasi',
          'error'
        );
      } finally {
        setSavingKey(
          null
        );
      }
    };

  const renderEditor =
    (
      config:
        SystemConfig
    ) => {
      const type =
        detectType(
          config.value
        );

      const currentValue =
        editing[
          config.key
        ];

      if (
        type ===
        'boolean'
      ) {
        return (
          <label className="flex items-center gap-3">
            <button
              type="button"
              disabled={
                !canManage
              }
              onClick={() =>
                setEditing(
                  (
                    previous
                  ) => ({
                    ...previous,

                    [config.key]:
                      !Boolean(
                        previous[
                          config
                            .key
                        ]
                      ),
                  })
                )
              }
              className={cn(
                'relative inline-flex h-6 w-11 items-center rounded-full transition',

                currentValue
                  ? 'bg-brand-600'
                  : 'bg-slate-300 dark:bg-slate-700',

                !canManage &&
                  'cursor-not-allowed opacity-60'
              )}
            >
              <span
                className={cn(
                  'inline-block h-4 w-4 transform rounded-full bg-white transition',

                  currentValue
                    ? 'translate-x-6'
                    : 'translate-x-1'
                )}
              />
            </button>

            <span className="text-sm text-slate-600 dark:text-slate-300">
              {currentValue
                ? 'Aktif'
                : 'Nonaktif'}
            </span>
          </label>
        );
      }

      if (
        type ===
        'number'
      ) {
        return (
          <input
            type="number"
            disabled={
              !canManage
            }
            value={
              typeof currentValue ===
              'number'
                ? currentValue
                : 0
            }
            onChange={(
              event
            ) =>
              setEditing(
                (
                  previous
                ) => ({
                  ...previous,

                  [config.key]:
                    Number.isNaN(
                      Number(
                        event
                          .target
                          .value
                      )
                    )
                      ? 0
                      : Number(
                          event
                            .target
                            .value
                        ),
                })
              )
            }
            className="w-full max-w-xs rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        );
      }

      if (
        type ===
        'string'
      ) {
        return (
          <input
            type="text"
            disabled={
              !canManage
            }
            value={
              typeof currentValue ===
              'string'
                ? currentValue
                : ''
            }
            onChange={(
              event
            ) =>
              setEditing(
                (
                  previous
                ) => ({
                  ...previous,

                  [config.key]:
                    event
                      .target
                      .value,
                })
              )
            }
            className="w-full rounded-xl border border-slate-300 px-4 py-2.5 text-sm dark:border-slate-700 dark:bg-slate-800 dark:text-white"
          />
        );
      }

      return (
        <textarea
          disabled={
            !canManage
          }
          value={(() => {
            try {
              return JSON.stringify(
                currentValue,
                null,
                2
              );
            } catch {
              return String(
                currentValue ??
                  ''
              );
            }
          })()}
          onChange={(
            event
          ) => {
            const raw =
              event
                .target
                .value;

            try {
              const parsed =
                JSON.parse(
                  raw
                );

              setEditing(
                (
                  previous
                ) => ({
                  ...previous,

                  [config.key]:
                    parsed,
                })
              );
            } catch {
              setEditing(
                (
                  previous
                ) => ({
                  ...previous,

                  [config.key]:
                    raw,
                })
              );
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
          <Settings className="h-6 w-6" />

          Konfigurasi Sistem
        </h1>

        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Kelola pengaturan sistem. Nilai terdeteksi otomatis: boolean (toggle), number (input angka), string (teks), atau JSON.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-brand-600" />
        </div>
      ) : configs.length ===
        0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 py-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:text-slate-400">
          Belum ada konfigurasi sistem.
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(
            groups
          ).map(
            ([
              group,
              items,
            ]) => (
              <div
                key={
                  group
                }
              >
                <h2 className="mb-3 text-sm font-semibold uppercase text-slate-500 dark:text-slate-400">
                  {group}
                </h2>

                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  {items.map(
                    (
                      config
                    ) => {
                      const type =
                        detectType(
                          config.value
                        );

                      const isDirty =
                        JSON.stringify(
                          editing[
                            config
                              .key
                          ]
                        ) !==
                        JSON.stringify(
                          config.value
                        );

                      return (
                        <div
                          key={
                            config.id
                          }
                          className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                        >
                          <div className="mb-3">
                            <div className="flex items-center gap-2">
                              <h3 className="font-semibold text-slate-900 dark:text-white">
                                {config.label ??
                                  config.key}
                              </h3>

                              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                                {type}
                              </span>
                            </div>

                            {config.description && (
                              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                                {
                                  config.description
                                }
                              </p>
                            )}

                            <p className="mt-0.5 font-mono text-xs text-slate-400">
                              key:{' '}
                              {
                                config.key
                              }
                            </p>
                          </div>

                          <div className="mb-3">
                            {renderEditor(
                              config
                            )}
                          </div>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-slate-400">
                              Diperbarui:{' '}
                              {config.updated_at
                                ? new Date(
                                    config.updated_at
                                  ).toLocaleDateString(
                                    'id-ID'
                                  )
                                : '-'}
                            </span>

                            {canManage && (
                              <button
                                type="button"
                                onClick={() =>
                                  void handleSave(
                                    config
                                  )
                                }
                                disabled={
                                  !isDirty ||
                                  savingKey ===
                                    config.key
                                }
                                className={cn(
                                  'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition',

                                  isDirty
                                    ? 'bg-brand-600 text-white hover:bg-brand-700'
                                    : 'cursor-default bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500'
                                )}
                              >
                                {savingKey ===
                                config.key ? (
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
                    }
                  )}
                </div>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}
