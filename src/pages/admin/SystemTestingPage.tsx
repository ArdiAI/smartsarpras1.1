import {
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';


import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Toast';
import { cn } from '../../utils/cn';

import {
  ShieldCheck,
  Database,
  Lock,
  Users,
  ClipboardList,
  Workflow,
  CalendarDays,
  CalendarRange,
  Megaphone,
  Package,
  Mail,
  HardDrive,
  FileLock,
  AlertTriangle,
  CheckCircle2,
  Play,
  Loader2,
  FlaskConical,
  XCircle,
  Activity,
} from 'lucide-react';


const API_BASE_URL =
  (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:3001' : ''));


// =====================================================
// TYPES
// =====================================================

type TestStatus =
  | 'idle'
  | 'running'
  | 'pass'
  | 'fail'
  | 'warning';


interface TestCheck {
  label: string;
  ok: boolean;
}


interface TestResult {
  status:
    TestStatus;

  details:
    string;

  checks?:
    TestCheck[];
}


type TestKey =
  | 'auth'
  | 'database'
  | 'permissions'
  | 'userManagement'
  | 'borrowing'
  | 'workflow'
  | 'agenda'
  | 'timeline'
  | 'announcement'
  | 'inventory'
  | 'emailFunction'
  | 'storage'
  | 'rlsPolicies'
  | 'consoleErrors'
  | 'buildHealth';


interface TestDef {
  key:
    TestKey;

  label:
    string;

  icon:
    typeof ShieldCheck;

  description:
    string;

  run:
    () =>
      Promise<TestResult>;
}


interface ApiResponse {
  ok:
    boolean;

  data?:
    TestResult;

  message?:
    string;
}


// =====================================================
// STATUS UI
// =====================================================

const statusConfig:
  Record<
    TestStatus,
    {
      label: string;
      color: string;
      bg: string;
      icon: ReactNode;
    }
  > = {
    idle: {
      label:
        'Belum diuji',

      color:
        'text-slate-500',

      bg:
        'bg-slate-100 dark:bg-slate-800',

      icon:
        <Activity className="h-4 w-4" />,
    },


    running: {
      label:
        'Menguji...',

      color:
        'text-blue-600 dark:text-blue-400',

      bg:
        'bg-blue-100 dark:bg-blue-900/30',

      icon:
        <Loader2 className="h-4 w-4 animate-spin" />,
    },


    pass: {
      label:
        'PASS',

      color:
        'text-emerald-600 dark:text-emerald-400',

      bg:
        'bg-emerald-100 dark:bg-emerald-900/30',

      icon:
        <CheckCircle2 className="h-4 w-4" />,
    },


    fail: {
      label:
        'FAIL',

      color:
        'text-red-600 dark:text-red-400',

      bg:
        'bg-red-100 dark:bg-red-900/30',

      icon:
        <XCircle className="h-4 w-4" />,
    },


    warning: {
      label:
        'WARNING',

      color:
        'text-amber-600 dark:text-amber-400',

      bg:
        'bg-amber-100 dark:bg-amber-900/30',

      icon:
        <AlertTriangle className="h-4 w-4" />,
    },
  };


// =====================================================
// COMPONENT
// =====================================================

export default function SystemTestingPage() {
  const {
    session,
    user,
    adminProfile,
    isSuperAdmin,
    permissions,
    userRoleNames,
    hasPermission,
  } = useAuth();


  const [
    results,
    setResults,
  ] =
    useState<
      Record<
        TestKey,
        TestResult
      >
    >(
      {} as Record<
        TestKey,
        TestResult
      >
    );


  const [
    runningAll,
    setRunningAll,
  ] =
    useState(false);


  const [
    consoleErrors,
    setConsoleErrors,
  ] =
    useState<
      string[]
    >([]);


  // =====================================================
  // CONSOLE ERROR WATCH
  // =====================================================

  useEffect(() => {
    const handler =
      (
        event:
          ErrorEvent
      ) => {
        setConsoleErrors(
          (
            previous
          ) => [
            ...previous,

            `${event.message} (${event.filename}:${event.lineno})`,
          ]
        );
      };


    window.addEventListener(
      'error',
      handler
    );


    return () => {
      window.removeEventListener(
        'error',
        handler
      );
    };
  }, []);


  // =====================================================
  // GENERIC TEST RUNNER
  // =====================================================

  const runTest =
    useCallback(
      async (
        key:
          TestKey,

        fn:
          () =>
            Promise<TestResult>
      ) => {
        setResults(
          (
            previous
          ) => ({
            ...previous,

            [key]: {
              status:
                'running',

              details:
                'Sedang menguji...',
            },
          })
        );


        try {
          const result =
            await fn();


          setResults(
            (
              previous
            ) => ({
              ...previous,

              [key]:
                result,
            })
          );


          return result;
        } catch (
          error
        ) {
          const message =
            error instanceof
              Error
              ? error.message
              : String(
                  error
                );


          const result:
            TestResult = {
              status:
                'fail',

              details:
                `Error: ${message}`,
            };


          setResults(
            (
              previous
            ) => ({
              ...previous,

              [key]:
                result,
            })
          );


          return result;
        }
      },
      []
    );


  // =====================================================
  // BACKEND POSTGRES TEST
  // =====================================================

  const runBackendTest =
    useCallback(
      async (
        test:
          string
      ): Promise<TestResult> => {
        if (
          !session
            ?.access_token
        ) {
          return {
            status:
              'fail',

            details:
              'Session login tidak ditemukan.',
          };
        }


        const response =
          await fetch(
            `${API_BASE_URL}/api/admin/system-testing/${encodeURIComponent(
              test
            )}`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
            }
          );


        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | ApiResponse
              | null;


        if (
          !response.ok ||
          !result?.ok ||
          !result.data
        ) {
          return {
            status:
              'fail',

            details:
              result?.message ??
              'Backend test gagal.',
          };
        }


        return result.data;
      },
      [
        session
          ?.access_token,
      ]
    );


  // =====================================================
  // AUTH
  // =====================================================

  const testAuth =
    async (): Promise<TestResult> => {
      const checks:
        TestCheck[] = [];


      checks.push({
        label:
          'Session aktif',

        ok:
          !!session,
      });


      checks.push({
        label:
          'Auth user terbaca',

        ok:
          !!user,
      });


      checks.push({
        label:
          'Role terbaca',

        ok:
          userRoleNames.length >
          0,
      });


      checks.push({
        label:
          'Admin profile terbaca',

        ok:
          !!adminProfile,
      });


      const allOk =
        checks.every(
          (
            check
          ) =>
            check.ok
        );


      return {
        status:
          allOk
            ? 'pass'
            : 'fail',

        details:
          allOk
            ? 'Autentikasi berfungsi dengan baik.'
            : 'Beberapa komponen auth gagal.',

        checks,
      };
    };


  // =====================================================
  // DATABASE
  // =====================================================

  const testDatabase =
    async () =>
      runBackendTest(
        'database'
      );


  // =====================================================
  // PERMISSIONS
  // =====================================================

  const testPermissions =
    async (): Promise<TestResult> => {
      const checks:
        TestCheck[] = [
          {
            label:
              'Permission berhasil dimuat',

            ok:
              permissions.size >
              0,
          },

          {
            label:
              'Role aktif memiliki permission',

            ok:
              userRoleNames.length >
                0 &&
              permissions.size >
                0,
          },
        ];


      const allOk =
        checks.every(
          (
            check
          ) =>
            check.ok
        );


      return {
        status:
          allOk
            ? 'pass'
            : 'warning',

        details:
          allOk
            ? `${permissions.size} permission dimuat untuk ${userRoleNames.length} role.`
            : 'Permission tidak berhasil dimuat atau role tidak memiliki permission.',

        checks,
      };
    };


  // =====================================================
  // USER MANAGEMENT
  // =====================================================

  const testUserManagement =
    async (): Promise<TestResult> => {
      const backend =
        await runBackendTest(
          'userManagement'
        );


      const checks = [
        ...(
          backend.checks ??
          []
        ),

        {
          label:
            'Update role tersedia',

          ok:
            hasPermission(
              'users',
              'update'
            ),
        },
      ];


      const allOk =
        checks.every(
          (
            check
          ) =>
            check.ok
        );


      return {
        status:
          allOk
            ? 'pass'
            : 'warning',

        details:
          allOk
            ? 'User management siap digunakan.'
            : 'Beberapa fitur user management belum tersedia.',

        checks,
      };
    };


  // =====================================================
  // BORROWING
  // =====================================================

  const testBorrowing =
    async () =>
      runBackendTest(
        'borrowing'
      );


  // =====================================================
  // WORKFLOW
  // =====================================================

  const testWorkflow =
    async () =>
      runBackendTest(
        'workflow'
      );


  // =====================================================
  // AGENDA
  // =====================================================

  const testAgenda =
    async (): Promise<TestResult> => {
      const backend =
        await runBackendTest(
          'agenda'
        );


      const checks = [
        ...(
          backend.checks ??
          []
        ),

        {
          label:
            'Permission insert',

          ok:
            hasPermission(
              'agenda',
              'create'
            ),
        },

        {
          label:
            'Permission read',

          ok:
            hasPermission(
              'agenda',
              'read'
            ),
        },

        {
          label:
            'Permission delete (Super Admin)',

          ok:
            isSuperAdmin,
        },
      ];


      const allOk =
        checks.every(
          (
            check
          ) =>
            check.ok
        );


      return {
        status:
          allOk
            ? 'pass'
            : 'warning',

        details:
          allOk
            ? 'Modul agenda siap.'
            : 'Database agenda dapat diuji, tetapi beberapa permission tidak tersedia.',

        checks,
      };
    };


  // =====================================================
  // TIMELINE
  // =====================================================

  const testTimeline =
    async () =>
      runBackendTest(
        'timeline'
      );


  // =====================================================
  // ANNOUNCEMENT
  // =====================================================

  const testAnnouncement =
    async () =>
      runBackendTest(
        'announcement'
      );


  // =====================================================
  // INVENTORY
  // =====================================================

  const testInventory =
    async () =>
      runBackendTest(
        'inventory'
      );


  // =====================================================
  // EMAIL FUNCTION
  // Edge Function tidak lagi dipanggil langsung dari browser.
  // Pengecekan dilakukan lewat backend Express.
  // =====================================================

  const testEmailFunction =
    async (): Promise<TestResult> => {
      if (
        !session
          ?.access_token
      ) {
        return {
          status:
            'fail',

          details:
            'Session login tidak ditemukan.',
        };
      }

      try {
        const response =
          await fetch(
            `${API_BASE_URL}/api/admin/system-testing/email-function/status`,
            {
              headers: {
                Authorization:
                  `Bearer ${session.access_token}`,
              },
            }
          );

        const result =
          (await response
            .json()
            .catch(
              () => null
            )) as
              | ApiResponse
              | null;

        if (
          !response.ok ||
          !result?.ok ||
          !result.data
        ) {
          return {
            status:
              'fail',

            details:
              result?.message ??
              'Backend email test gagal.',
          };
        }

        return result.data;
      } catch (
        error
      ) {
        const message =
          error instanceof
            Error
            ? error.message
            : String(
                error
              );

        return {
          status:
            'fail',

          details:
            `Gagal menghubungi backend email test: ${message}`,
        };
      }
    };


  // =====================================================
  // STORAGE GOOGLE DRIVE
  // =====================================================

  const testStorage =
    async (): Promise<TestResult> => {
      const checks: TestCheck[] = [];

      try {
        const response = await fetch(
          `${API_BASE_URL}/api/storage-status`
        );

        const result = await response.json();
        const configured =
          response.ok &&
          result?.ok === true &&
          result?.configured === true;

        checks.push({
          label: 'Google Drive Apps Script',
          ok: configured,
        });

        return {
          status: configured ? 'pass' : 'warning',
          details: configured
            ? 'Google Drive upload backend sudah dikonfigurasi.'
            : 'Konfigurasi Google Drive belum lengkap.',
          checks,
        };
      } catch (error) {
        checks.push({
          label: 'Koneksi backend storage',
          ok: false,
        });

        return {
          status: 'fail',
          details:
            error instanceof Error
              ? error.message
              : 'Gagal memeriksa Google Drive.',
          checks,
        };
      }
    };

  // =====================================================
  // POSTGRES ACCESS
  // Key lama tetap "rlsPolicies" supaya state/UI stabil.
  // =====================================================

  const testRLSPolicies =
    async () =>
      runBackendTest(
        'postgresAccess'
      );


  // =====================================================
  // CONSOLE ERRORS
  // =====================================================

  const testConsoleErrors =
    async (): Promise<TestResult> => {
      if (
        consoleErrors.length >
        0
      ) {
        return {
          status:
            'warning',

          details:
            `${consoleErrors.length} error terdeteksi:\n${consoleErrors.join(
              '\n'
            )}`,

          checks:
            consoleErrors.map(
              (
                message
              ) => ({
                label:
                  message,

                ok:
                  false,
              })
            ),
        };
      }


      return {
        status:
          'pass',

        details:
          'Tidak ada runtime error terdeteksi pada halaman ini.',
      };
    };


  // =====================================================
  // BUILD HEALTH
  // =====================================================

  const testBuildHealth =
    async (): Promise<TestResult> => {
      const checks:
        TestCheck[] = [];


      const modules = [
        {
          label:
            'AuthContext',

          mod:
            () =>
              import(
                '../../context/AuthContext'
              ),
        },

        {
          label:
            'App session helper',

          mod:
            () =>
              import(
                '../../lib/appSession'
              ),
        },

        {
          label:
            'Google Drive upload helper',

          mod:
            () =>
              import(
                '../../lib/upload'
              ),
        },

        {
          label:
            'Workflow lib',

          mod:
            () =>
              import(
                '../../lib/workflow'
              ),
        },

        {
          label:
            'Timeline lib',

          mod:
            () =>
              import(
                '../../lib/timeline'
              ),
        },

        {
          label:
            'Permissions lib',

          mod:
            () =>
              import(
                '../../lib/permissions'
              ),
        },
      ];


      let allOk =
        true;


      for (
        const module of
        modules
      ) {
        try {
          await module.mod();


          checks.push({
            label:
              module.label,

            ok:
              true,
          });
        } catch {
          checks.push({
            label:
              module.label,

            ok:
              false,
          });


          allOk =
            false;
        }
      }


      return {
        status:
          allOk
            ? 'pass'
            : 'fail',

        details:
          allOk
            ? 'Semua modul berhasil di-import.'
            : 'Beberapa modul gagal dimuat.',

        checks,
      };
    };


  // =====================================================
  // TEST DEFINITIONS
  // =====================================================

  const testDefs:
    TestDef[] = [
      {
        key:
          'auth',

        label:
          'Authentication',

        icon:
          ShieldCheck,

        description:
          'Session, auth user, dan role',

        run:
          testAuth,
      },


      {
        key:
          'database',

        label:
          'Database',

        icon:
          Database,

        description:
          'Koneksi PostgreSQL & query sederhana',

        run:
          testDatabase,
      },


      {
        key:
          'permissions',

        label:
          'Permissions',

        icon:
          Lock,

        description:
          'Permission & role aktif',

        run:
          testPermissions,
      },


      {
        key:
          'userManagement',

        label:
          'User Management',

        icon:
          Users,

        description:
          'Admin user, role, permission',

        run:
          testUserManagement,
      },


      {
        key:
          'borrowing',

        label:
          'Borrowing Module',

        icon:
          ClipboardList,

        description:
          'Borrowings, items & workflow',

        run:
          testBorrowing,
      },


      {
        key:
          'workflow',

        label:
          'Workflow Engine',

        icon:
          Workflow,

        description:
          'Workflow PostgreSQL',

        run:
          testWorkflow,
      },


      {
        key:
          'agenda',

        label:
          'Agenda',

        icon:
          CalendarDays,

        description:
          'Database agenda & permission',

        run:
          testAgenda,
      },


      {
        key:
          'timeline',

        label:
          'Timeline',

        icon:
          CalendarRange,

        description:
          'Agenda & peminjaman bulan ini',

        run:
          testTimeline,
      },


      {
        key:
          'announcement',

        label:
          'Announcement',

        icon:
          Megaphone,

        description:
          'Data pengumuman PostgreSQL',

        run:
          testAnnouncement,
      },


      {
        key:
          'inventory',

        label:
          'Inventory',

        icon:
          Package,

        description:
          'Inventaris, kategori, kondisi',

        run:
          testInventory,
      },


      {
        key:
          'emailFunction',

        label:
          'Email Function',

        icon:
          Mail,

        description:
          'Email service melalui backend',

        run:
          testEmailFunction,
      },


      {
        key:
          'storage',

        label:
          'Storage',

        icon:
          HardDrive,

        description:
          'Google Drive via Apps Script',

        run:
          testStorage,
      },


      {
        key:
          'rlsPolicies',

        label:
          'PostgreSQL Access',

        icon:
          FileLock,

        description:
          'Akses tabel utama via backend',

        run:
          testRLSPolicies,
      },


      {
        key:
          'consoleErrors',

        label:
          'Console Errors',

        icon:
          AlertTriangle,

        description:
          'Runtime error detection',

        run:
          testConsoleErrors,
      },


      {
        key:
          'buildHealth',

        label:
          'Build Health',

        icon:
          Activity,

        description:
          'Import seluruh modul',

        run:
          testBuildHealth,
      },
    ];


  // =====================================================
  // RUN SINGLE
  // =====================================================

  const handleRunSingle =
    async (
      definition:
        TestDef
    ) => {
      await runTest(
        definition.key,
        definition.run
      );
    };


  // =====================================================
  // RUN ALL
  // =====================================================

  const handleRunAll =
    async () => {
      setRunningAll(
        true
      );


      setConsoleErrors(
        []
      );


      let passCount =
        0;

      let failCount =
        0;

      let warningCount =
        0;


      for (
        const definition of
        testDefs
      ) {
        const result =
          await runTest(
            definition.key,
            definition.run
          );


        if (
          result.status ===
          'pass'
        ) {
          passCount++;
        }

        else if (
          result.status ===
          'fail'
        ) {
          failCount++;
        }

        else if (
          result.status ===
          'warning'
        ) {
          warningCount++;
        }
      }


      setRunningAll(
        false
      );


      if (
        failCount ===
          0 &&
        warningCount ===
          0
      ) {
        showToast(
          'Semua modul berhasil',
          'success'
        );
      }

      else if (
        failCount >
        0
      ) {
        showToast(
          `${failCount} modul gagal, ${warningCount} warning`,
          'error'
        );
      }

      else {
        showToast(
          `${warningCount} warning terdeteksi`,
          'warning'
        );
      }
    };


  // =====================================================
  // SUMMARY
  // =====================================================

  const totalTests =
    testDefs.length;


  const completedResults =
    Object.values(
      results
    ).filter(
      (
        result
      ) =>
        result.status ===
          'pass' ||
        result.status ===
          'fail' ||
        result.status ===
          'warning'
    );


  const passCount =
    completedResults.filter(
      (
        result
      ) =>
        result.status ===
        'pass'
    ).length;


  const failCount =
    completedResults.filter(
      (
        result
      ) =>
        result.status ===
        'fail'
    ).length;


  const warnCount =
    completedResults.filter(
      (
        result
      ) =>
        result.status ===
        'warning'
    ).length;


  const healthScore =
    completedResults.length >
    0
      ? Math.round(
          (
            passCount /
            completedResults.length
          ) *
            100
        )
      : 0;


  const scoreColor =
    healthScore >=
    90
      ? 'text-emerald-600 dark:text-emerald-400'
      : healthScore >=
          70
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';


  // =====================================================
  // UI
  // =====================================================

  return (
    <div className="pb-6">

      <div className="mb-6">

        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">

          <FlaskConical className="h-6 w-6" />

          System Testing

        </h1>


        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Halaman QA untuk mengecek kesehatan Smart Sarpras sebelum deployment.
        </p>

      </div>


      {/* SUMMARY */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

          <div className="flex flex-wrap items-center gap-6">

            <div className="text-center">
              <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Total Test
              </p>

              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {
                  totalTests
                }
              </p>
            </div>


            <div className="text-center">
              <p className="text-xs font-medium uppercase text-emerald-600 dark:text-emerald-400">
                PASS
              </p>

              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                {
                  passCount
                }
              </p>
            </div>


            <div className="text-center">
              <p className="text-xs font-medium uppercase text-red-600 dark:text-red-400">
                FAIL
              </p>

              <p className="text-2xl font-bold text-red-600 dark:text-red-400">
                {
                  failCount
                }
              </p>
            </div>


            <div className="text-center">
              <p className="text-xs font-medium uppercase text-amber-600 dark:text-amber-400">
                WARNING
              </p>

              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {
                  warnCount
                }
              </p>
            </div>


            <div className="text-center">
              <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">
                Health Score
              </p>

              <p
                className={cn(
                  'text-2xl font-bold',
                  scoreColor
                )}
              >
                {
                  healthScore
                }
                %
              </p>
            </div>

          </div>


          <button
            onClick={() =>
              void handleRunAll()
            }

            disabled={
              runningAll
            }

            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {runningAll ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}


            {runningAll
              ? 'Menguji...'
              : 'Run All Tests'}
          </button>

        </div>


        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">

          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500"

            style={{
              width:
                `${(
                  completedResults.length /
                  totalTests
                ) * 100}%`,
            }}
          />

        </div>

      </div>


      {/* TEST CARDS */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

        {testDefs.map(
          (
            definition
          ) => {
            const result =
              results[
                definition.key
              ] ?? {
                status:
                  'idle' as TestStatus,

                details:
                  'Belum diuji.',
              };


            const config =
              statusConfig[
                result.status
              ];


            return (
              <div
                key={
                  definition.key
                }

                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
              >

                <div className="mb-3 flex items-start justify-between">

                  <div className="flex items-center gap-3">

                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">

                      <definition.icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />

                    </div>


                    <div>

                      <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
                        {
                          definition.label
                        }
                      </h3>


                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        {
                          definition.description
                        }
                      </p>

                    </div>

                  </div>


                  <span
                    className={cn(
                      'flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold',

                      config.bg,
                      config.color
                    )}
                  >
                    {
                      config.icon
                    }

                    {
                      config.label
                    }
                  </span>

                </div>


                {result.checks &&
                  result.checks.length >
                    0 && (
                    <div className="mb-3 space-y-1">

                      {result.checks.map(
                        (
                          check,
                          index
                        ) => (
                          <div
                            key={
                              index
                            }

                            className="flex items-center gap-2 text-xs"
                          >
                            {check.ok ? (
                              <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                            )}


                            <span
                              className={cn(
                                check.ok
                                  ? 'text-slate-600 dark:text-slate-300'
                                  : 'text-red-600 dark:text-red-400'
                              )}
                            >
                              {
                                check.label
                              }
                            </span>

                          </div>
                        )
                      )}

                    </div>
                  )}


                {result.details && (
                  <p className="mb-3 flex-1 whitespace-pre-line text-xs text-slate-500 dark:text-slate-400">
                    {
                      result.details
                    }
                  </p>
                )}


                <button
                  onClick={() =>
                    void handleRunSingle(
                      definition
                    )
                  }

                  disabled={
                    result.status ===
                      'running' ||
                    runningAll
                  }

                  className="mt-auto flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  {result.status ===
                  'running' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Play className="h-3.5 w-3.5" />
                  )}

                  Test
                </button>

              </div>
            );
          }
        )}

      </div>


      {/* FINAL RESULT */}
      {completedResults.length ===
        totalTests &&
        !runningAll && (
          <div
            className={cn(
              'mt-6 rounded-2xl border p-5 text-center',

              failCount ===
                  0 &&
                warnCount ===
                  0
                ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
                : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
            )}
          >

            {failCount ===
              0 &&
            warnCount ===
              0 ? (
              <p className="flex items-center justify-center gap-2 text-lg font-semibold text-emerald-700 dark:text-emerald-400">

                <CheckCircle2 className="h-5 w-5" />

                Semua modul berhasil

              </p>
            ) : (
              <div>

                <p className="flex items-center justify-center gap-2 text-lg font-semibold text-red-700 dark:text-red-400">

                  <XCircle className="h-5 w-5" />


                  {failCount >
                  0
                    ? `${failCount} modul gagal`
                    : `${warnCount} warning terdeteksi`}

                </p>


                <div className="mt-3 space-y-1 text-sm text-red-600 dark:text-red-400">

                  {testDefs
                    .filter(
                      (
                        definition
                      ) =>
                        results[
                          definition.key
                        ]
                          ?.status ===
                          'fail' ||
                        results[
                          definition.key
                        ]
                          ?.status ===
                          'warning'
                    )
                    .map(
                      (
                        definition
                      ) => (
                        <p
                          key={
                            definition.key
                          }
                        >
                          <span className="font-semibold">
                            {
                              definition.label
                            }
                            :
                          </span>{' '}

                          {
                            results[
                              definition.key
                            ]
                              ?.details
                          }
                        </p>
                      )
                    )}

                </div>

              </div>
            )}

          </div>
        )}

    </div>
  );
}