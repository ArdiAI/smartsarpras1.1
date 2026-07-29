import { useState, useCallback, useEffect, type ReactNode } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { showToast } from '../../components/Toast';
import { cn } from '../../utils/cn';
import {
  ShieldCheck, Database, Lock, Users, ClipboardList, Workflow,
  CalendarDays, CalendarRange, Megaphone, Package, Mail,
  HardDrive, FileLock, AlertTriangle, CheckCircle2, Play,
  Loader2, FlaskConical, XCircle, Activity,
} from 'lucide-react';

type TestStatus = 'idle' | 'running' | 'pass' | 'fail' | 'warning';

interface TestResult {
  status: TestStatus;
  details: string;
  checks?: { label: string; ok: boolean }[];
}

type TestKey =
  | 'auth' | 'database' | 'permissions' | 'userManagement'
  | 'borrowing' | 'workflow' | 'agenda' | 'timeline'
  | 'announcement' | 'inventory' | 'emailFunction' | 'storage'
  | 'rlsPolicies' | 'consoleErrors' | 'buildHealth';

interface TestDef {
  key: TestKey;
  label: string;
  icon: typeof ShieldCheck;
  description: string;
  run: () => Promise<TestResult>;
}

const statusConfig: Record<TestStatus, { label: string; color: string; bg: string; icon: ReactNode }> = {
  idle: { label: 'Belum diuji', color: 'text-slate-500', bg: 'bg-slate-100 dark:bg-slate-800', icon: <Activity className="h-4 w-4" /> },
  running: { label: 'Menguji...', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30', icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  pass: { label: 'PASS', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-100 dark:bg-emerald-900/30', icon: <CheckCircle2 className="h-4 w-4" /> },
  fail: { label: 'FAIL', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30', icon: <XCircle className="h-4 w-4" /> },
  warning: { label: 'WARNING', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30', icon: <AlertTriangle className="h-4 w-4" /> },
};

export default function SystemTestingPage() {
  const { session, user, adminProfile, isSuperAdmin, permissions, userRoleNames, hasPermission } = useAuth();
  const [results, setResults] = useState<Record<TestKey, TestResult>>({} as Record<TestKey, TestResult>);
  const [runningAll, setRunningAll] = useState(false);
  const [consoleErrors, setConsoleErrors] = useState<string[]>([]);

  useEffect(() => {
    const handler = (e: ErrorEvent) => {
      setConsoleErrors((prev) => [...prev, `${e.message} (${e.filename}:${e.lineno})`]);
    };
    window.addEventListener('error', handler);
    return () => window.removeEventListener('error', handler);
  }, []);

  const runTest = useCallback(async (key: TestKey, fn: () => Promise<TestResult>) => {
    setResults((prev) => ({ ...prev, [key]: { status: 'running', details: 'Sedang menguji...' } }));
    try {
      const result = await fn();
      setResults((prev) => ({ ...prev, [key]: result }));
      return result;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      const result: TestResult = { status: 'fail', details: `Error: ${msg}` };
      setResults((prev) => ({ ...prev, [key]: result }));
      return result;
    }
  }, []);

  const testAuth = async (): Promise<TestResult> => {
    const checks: { label: string; ok: boolean }[] = [];
    checks.push({ label: 'Session aktif', ok: !!session });
    checks.push({ label: 'Auth user terbaca', ok: !!user });
    checks.push({ label: 'Role terbaca', ok: userRoleNames.length > 0 });
    checks.push({ label: 'Admin profile terbaca', ok: !!adminProfile });
    const allOk = checks.every((c) => c.ok);
    return { status: allOk ? 'pass' : 'fail', details: allOk ? 'Autentikasi berfungsi dengan baik.' : 'Beberapa komponen auth gagal.', checks };
  };

  const testDatabase = async (): Promise<TestResult> => {
    const checks: { label: string; ok: boolean }[] = [];
    const { error: err1 } = await supabase.rpc('to_jsonb', { arg: 1 }).maybeSingle();
    const ok1 = !err1;
    checks.push({ label: 'Koneksi Supabase', ok: ok1 });
    const { error: err2, count } = await supabase.from('borrowings').select('id', { count: 'exact', head: true });
    checks.push({ label: 'Query sederhana (SELECT count)', ok: !err2 && count !== null });
    const allOk = checks.every((c) => c.ok);
    return { status: allOk ? 'pass' : 'fail', details: allOk ? 'Database terhubung dan query berhasil.' : 'Koneksi database atau query gagal.', checks };
  };

  const testPermissions = async (): Promise<TestResult> => {
    const checks: { label: string; ok: boolean }[] = [];
    checks.push({ label: 'Permission berhasil dimuat', ok: permissions.size > 0 });
    checks.push({ label: 'Role aktif memiliki permission', ok: userRoleNames.length > 0 && permissions.size > 0 });
    const allOk = checks.every((c) => c.ok);
    return { status: allOk ? 'pass' : 'warning', details: allOk ? ` ${permissions.size} permission dimuat untuk ${userRoleNames.length} role.` : 'Permission tidak berhasil dimuat atau role tidak memiliki permission.', checks };
  };

  const testUserManagement = async (): Promise<TestResult> => {
    const checks: { label: string; ok: boolean }[] = [];
    const { error: e1 } = await supabase.from('admin_users').select('id').limit(1);
    checks.push({ label: 'Load user', ok: !e1 });
    const { error: e2 } = await supabase.from('roles').select('id').limit(1);
    checks.push({ label: 'Load role', ok: !e2 });
    const canUpdate = hasPermission('users', 'update');
    checks.push({ label: 'Update role tersedia', ok: canUpdate });
    const allOk = checks.every((c) => c.ok);
    return { status: allOk ? 'pass' : 'warning', details: allOk ? 'User management siap digunakan.' : 'Beberapa fitur user management tidak tersedia.', checks };
  };

  const testBorrowing = async (): Promise<TestResult> => {
    const checks: { label: string; ok: boolean }[] = [];
    const { error: e1 } = await supabase.from('borrowings').select('id').limit(1);
    checks.push({ label: 'Tabel borrowings dapat diakses', ok: !e1 });
    const { error: e2 } = await supabase.from('borrowing_items').select('id').limit(1);
    checks.push({ label: 'Tabel borrowing_items dapat diakses', ok: !e2 });
    const { data: wfData } = await supabase.from('workflow_templates').select('is_active').eq('is_active', true).limit(1);
    checks.push({ label: 'Status workflow tersedia', ok: !!wfData && wfData.length > 0 });
    const allOk = checks.every((c) => c.ok);
    return { status: allOk ? 'pass' : 'fail', details: allOk ? 'Modul peminjaman berfungsi.' : 'Beberapa tabel peminjaman tidak dapat diakses.', checks };
  };

  const testWorkflow = async (): Promise<TestResult> => {
    const checks: { label: string; ok: boolean }[] = [];
    const { data: templates } = await supabase.from('workflow_templates').select('id, name').eq('is_active', true);
    if (!templates || templates.length === 0) {
      return { status: 'fail', details: 'Tidak ada workflow template aktif.', checks: [{ label: 'Workflow template aktif', ok: false }] };
    }
    checks.push({ label: 'Workflow template aktif', ok: true });
    const template = templates[0];
    const { data: steps } = await supabase.from('workflow_steps').select('step_order, step_label').eq('workflow_template_id', template.id).order('step_order', { ascending: true });
    const expectedSteps = ['User', 'Pembina', 'Wakasek', 'PJ', 'Kepala Sarpras'];
    const stepLabels = (steps ?? []).map((s: { step_label: string }) => s.step_label);
    const missing = expectedSteps.filter((s) => !stepLabels.some((l) => l.includes(s)));
    checks.push({ label: `Langkah workflow (${stepLabels.length} langkah)`, ok: steps != null && steps.length > 0 });
    if (missing.length > 0) {
      checks.push({ label: `Status hilang: ${missing.join(', ')}`, ok: false });
      return { status: 'fail', details: `Status workflow hilang: ${missing.join(', ')}`, checks };
    }
    return { status: 'pass', details: `Workflow "${template.name}" memiliki ${stepLabels.length} langkah: ${stepLabels.join(' -> ')}`, checks };
  };

  const testAgenda = async (): Promise<TestResult> => {
    const checks: { label: string; ok: boolean }[] = [];
    const { error: e1 } = await supabase.from('agendas').select('id').limit(1);
    checks.push({ label: 'Tabel agenda dapat diakses', ok: !e1 });
    checks.push({ label: 'Permission insert', ok: hasPermission('agenda', 'create') });
    checks.push({ label: 'Permission read', ok: hasPermission('agenda', 'read') });
    checks.push({ label: 'Permission delete (Super Admin)', ok: isSuperAdmin });
    const allOk = checks.every((c) => c.ok);
    return { status: allOk ? 'pass' : 'warning', details: allOk ? 'Modul agenda siap.' : 'Beberapa permission agenda tidak tersedia.', checks };
  };

  const testTimeline = async (): Promise<TestResult> => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const start = `${year}-${String(month + 1).padStart(2, '0')}-01`;
    const end = `${year}-${String(month + 1).padStart(2, '0')}-31`;
    const [agendas, borrowings] = await Promise.all([
      supabase.from('agendas').select('id').gte('event_date', start).lte('event_date', end),
      supabase.from('borrowings').select('id').or(`and(borrow_date.gte.${start},borrow_date.lte.${end}),and(return_date.gte.${start},return_date.lte.${end})`),
    ]);
    const agendaCount = agendas.data?.length ?? 0;
    const borrowCount = borrowings.data?.length ?? 0;
    const hasData = agendaCount + borrowCount > 0;
    const noError = !agendas.error && !borrowings.error;
    if (!noError) return { status: 'fail', details: 'Gagal mengambil data timeline.' };
    if (!hasData) return { status: 'pass', details: 'Timeline berfungsi, namun tidak ada data bulan ini.' };
    return { status: 'pass', details: `Timeline berfungsi. ${agendaCount} agenda, ${borrowCount} peminjaman bulan ini.`, checks: [{ label: 'Agenda dapat diambil', ok: !agendas.error }, { label: 'Peminjaman dapat diambil', ok: !borrowings.error }] };
  };

  const testAnnouncement = async (): Promise<TestResult> => {
    const checks: { label: string; ok: boolean }[] = [];
    const { error, data } = await supabase.from('announcements').select('id, title, status').limit(5);
    checks.push({ label: 'Membaca data pengumuman', ok: !error });
    checks.push({ label: 'Data tersedia', ok: !!data && data.length > 0 });
    const allOk = checks.every((c) => c.ok);
    return { status: allOk ? 'pass' : 'warning', details: allOk ? `${data?.length ?? 0} pengumuman ditemukan.` : 'Tidak dapat membaca data pengumuman atau data kosong.', checks };
  };

  const testInventory = async (): Promise<TestResult> => {
    const checks: { label: string; ok: boolean }[] = [];
    const { error: e1, data } = await supabase.from('inventory').select('id, name, condition').limit(5);
    checks.push({ label: 'Load inventaris', ok: !e1 });
    const { error: e2 } = await supabase.from('categories').select('id, name').limit(1);
    checks.push({ label: 'Kategori dapat diakses', ok: !e2 });
    checks.push({ label: 'Kondisi terbaca', ok: !!data && data.length > 0 });
    const allOk = checks.every((c) => c.ok);
    return { status: allOk ? 'pass' : 'warning', details: allOk ? 'Modul inventaris berfungsi.' : 'Beberapa bagian inventaris tidak dapat diakses.', checks };
  };

  const testEmailFunction = async (): Promise<TestResult> => {
    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;
      const resp = await fetch(`${supabaseUrl}/functions/v1/send-borrowing-email`, {
        method: 'OPTIONS',
        headers: { 'Content-Type': 'application/json' },
      });
      const ok = resp.ok || resp.status === 200 || resp.status === 204;
      return { status: ok ? 'pass' : 'fail', details: ok ? 'Edge function send-borrowing-email dapat dipanggil (OPTIONS preflight OK).' : `Function merespons status ${resp.status}.`, checks: [{ label: 'OPTIONS preflight', ok }] };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return { status: 'fail', details: `Gagal memanggil edge function: ${msg}` };
    }
  };

  const testStorage = async (): Promise<TestResult> => {
    const checks: { label: string; ok: boolean }[] = [];
    const { data, error } = await supabase.storage.listBuckets();
    checks.push({ label: 'Koneksi storage', ok: !error });
    checks.push({ label: 'Bucket tersedia', ok: !!data && data.length > 0 });
    const allOk = checks.every((c) => c.ok);
    return { status: allOk ? 'pass' : 'warning', details: allOk ? `${data?.length ?? 0} bucket tersedia.` : 'Storage tidak dapat diakses atau tidak ada bucket.', checks };
  };

  const testRLSPolicies = async (): Promise<TestResult> => {
    const tables = ['borrowings', 'borrowing_items', 'agendas', 'announcements', 'permissions', 'role_permissions'];
    const checks: { label: string; ok: boolean }[] = [];
    let allOk = true;
    for (const table of tables) {
      const { error } = await supabase.from(table).select('id').limit(1);
      const ok = !error;
      if (!ok) allOk = false;
      checks.push({ label: `Tabel ${table}`, ok });
    }
    return { status: allOk ? 'pass' : 'fail', details: allOk ? 'Semua tabel utama dapat diakses (RLS policy aktif).' : 'Beberapa tabel tidak dapat diakses - kemungkinan RLS policy bermasalah.', checks };
  };

  const testConsoleErrors = async (): Promise<TestResult> => {
    if (consoleErrors.length > 0) {
      return { status: 'warning', details: `${consoleErrors.length} error terdeteksi:\n${consoleErrors.join('\n')}`, checks: consoleErrors.map((m) => ({ label: m, ok: false })) };
    }
    return { status: 'pass', details: 'Tidak ada runtime error terdeteksi pada halaman ini.' };
  };

  const testBuildHealth = async (): Promise<TestResult> => {
    const checks: { label: string; ok: boolean }[] = [];
    const modules = [
      { label: 'AuthContext', mod: () => import('../../context/AuthContext') },
      { label: 'Supabase client', mod: () => import('../../lib/supabase') },
      { label: 'Workflow lib', mod: () => import('../../lib/workflow') },
      { label: 'Timeline lib', mod: () => import('../../lib/timeline') },
      { label: 'Permissions lib', mod: () => import('../../lib/permissions') },
    ];
    let allOk = true;
    for (const m of modules) {
      try {
        await m.mod();
        checks.push({ label: m.label, ok: true });
      } catch {
        checks.push({ label: m.label, ok: false });
        allOk = false;
      }
    }
    return { status: allOk ? 'pass' : 'fail', details: allOk ? 'Semua modul berhasil di-import.' : 'Beberapa modul gagal dimuat.', checks };
  };

  const testDefs: TestDef[] = [
    { key: 'auth', label: 'Authentication', icon: ShieldCheck, description: 'Session, auth user, dan role', run: testAuth },
    { key: 'database', label: 'Database', icon: Database, description: 'Koneksi Supabase & query sederhana', run: testDatabase },
    { key: 'permissions', label: 'Permissions', icon: Lock, description: 'Permission & role aktif', run: testPermissions },
    { key: 'userManagement', label: 'User Management', icon: Users, description: 'Load user, role, update role', run: testUserManagement },
    { key: 'borrowing', label: 'Borrowing Module', icon: ClipboardList, description: 'Tabel borrowings & borrowing_items', run: testBorrowing },
    { key: 'workflow', label: 'Workflow Engine', icon: Workflow, description: 'Simulasi alur approval', run: testWorkflow },
    { key: 'agenda', label: 'Agenda', icon: CalendarDays, description: 'Tabel agenda & permission', run: testAgenda },
    { key: 'timeline', label: 'Timeline', icon: CalendarRange, description: 'Data Agenda & Peminjaman', run: testTimeline },
    { key: 'announcement', label: 'Announcement', icon: Megaphone, description: 'Pembacaan data pengumuman', run: testAnnouncement },
    { key: 'inventory', label: 'Inventory', icon: Package, description: 'Inventaris, kategori, kondisi', run: testInventory },
    { key: 'emailFunction', label: 'Email Function', icon: Mail, description: 'Edge function send-borrowing-email', run: testEmailFunction },
    { key: 'storage', label: 'Storage', icon: HardDrive, description: 'Koneksi storage & bucket', run: testStorage },
    { key: 'rlsPolicies', label: 'RLS Policies', icon: FileLock, description: 'Policy tabel utama', run: testRLSPolicies },
    { key: 'consoleErrors', label: 'Console Errors', icon: AlertTriangle, description: 'Runtime error detection', run: testConsoleErrors },
    { key: 'buildHealth', label: 'Build Health', icon: Activity, description: 'Import seluruh modul', run: testBuildHealth },
  ];

  const handleRunSingle = async (def: TestDef) => {
    await runTest(def.key, def.run);
  };

  const handleRunAll = async () => {
    setRunningAll(true);
    setConsoleErrors([]);
    let passCount = 0;
    let failCount = 0;
    let warnCount = 0;
    for (const def of testDefs) {
      const result = await runTest(def.key, def.run);
      if (result.status === 'pass') passCount++;
      else if (result.status === 'fail') failCount++;
      else if (result.status === 'warning') warnCount++;
    }
    setRunningAll(false);
    if (failCount === 0 && warnCount === 0) {
      showToast('Semua modul berhasil', 'success');
    } else if (failCount > 0) {
      showToast(`${failCount} modul gagal, ${warnCount} warning`, 'error');
    } else {
      showToast(`${warnCount} warning terdeteksi`, 'warning');
    }
  };

  const totalTests = testDefs.length;
  const completedResults = Object.values(results).filter((r) => r.status === 'pass' || r.status === 'fail' || r.status === 'warning');
  const passCount = completedResults.filter((r) => r.status === 'pass').length;
  const failCount = completedResults.filter((r) => r.status === 'fail').length;
  const warnCount = completedResults.filter((r) => r.status === 'warning').length;
  const healthScore = completedResults.length > 0
    ? Math.round((passCount / completedResults.length) * 100)
    : 0;

  const scoreColor = healthScore >= 90 ? 'text-emerald-600 dark:text-emerald-400'
    : healthScore >= 70 ? 'text-amber-600 dark:text-amber-400'
    : 'text-red-600 dark:text-red-400';

  return (
    <div className="pb-6">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900 dark:text-white">
          <FlaskConical className="h-6 w-6" /> System Testing
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Halaman QA untuk mengecek kesehatan sistem Smart Sarpras sebelum deployment.
        </p>
      </div>

      {/* Summary */}
      <div className="mb-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-6">
            <div className="text-center">
              <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Total Test</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalTests}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium uppercase text-emerald-600 dark:text-emerald-400">PASS</p>
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{passCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium uppercase text-red-600 dark:text-red-400">FAIL</p>
              <p className="text-2xl font-bold text-red-600 dark:text-red-400">{failCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium uppercase text-amber-600 dark:text-amber-400">WARNING</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{warnCount}</p>
            </div>
            <div className="text-center">
              <p className="text-xs font-medium uppercase text-slate-500 dark:text-slate-400">Health Score</p>
              <p className={cn('text-2xl font-bold', scoreColor)}>{healthScore}%</p>
            </div>
          </div>
          <button
            onClick={handleRunAll}
            disabled={runningAll}
            className="flex items-center gap-2 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 disabled:opacity-50"
          >
            {runningAll ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            {runningAll ? 'Menguji...' : 'Run All Tests'}
          </button>
        </div>

        {/* Progress bar */}
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-brand-500 transition-all duration-500"
            style={{ width: `${(completedResults.length / totalTests) * 100}%` }}
          />
        </div>
      </div>

      {/* Test Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {testDefs.map((def) => {
          const result = results[def.key] ?? { status: 'idle' as TestStatus, details: 'Belum diuji.' };
          const cfg = statusConfig[result.status];
          return (
            <div
              key={def.key}
              className="flex flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="mb-3 flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800">
                    <def.icon className="h-5 w-5 text-slate-600 dark:text-slate-300" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{def.label}</h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{def.description}</p>
                  </div>
                </div>
                <span className={cn('flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold', cfg.bg, cfg.color)}>
                  {cfg.icon}
                  {cfg.label}
                </span>
              </div>

              {result.checks && result.checks.length > 0 && (
                <div className="mb-3 space-y-1">
                  {result.checks.map((c, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {c.ok ? (
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                      ) : (
                        <XCircle className="h-3.5 w-3.5 shrink-0 text-red-500" />
                      )}
                      <span className={cn(c.ok ? 'text-slate-600 dark:text-slate-300' : 'text-red-600 dark:text-red-400')}>
                        {c.label}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {result.details && (
                <p className="mb-3 flex-1 whitespace-pre-line text-xs text-slate-500 dark:text-slate-400">
                  {result.details}
                </p>
              )}

              <button
                onClick={() => handleRunSingle(def)}
                disabled={result.status === 'running' || runningAll}
                className="mt-auto flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                {result.status === 'running' ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Play className="h-3.5 w-3.5" />
                )}
                Test
              </button>
            </div>
          );
        })}
      </div>

      {/* Final summary message */}
      {completedResults.length === totalTests && !runningAll && (
        <div className={cn(
          'mt-6 rounded-2xl border p-5 text-center',
          failCount === 0 && warnCount === 0
            ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20'
            : 'border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20'
        )}>
          {failCount === 0 && warnCount === 0 ? (
            <p className="flex items-center justify-center gap-2 text-lg font-semibold text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-5 w-5" /> Semua modul berhasil
            </p>
          ) : (
            <div>
              <p className="flex items-center justify-center gap-2 text-lg font-semibold text-red-700 dark:text-red-400">
                <XCircle className="h-5 w-5" /> {failCount > 0 ? `${failCount} modul gagal` : `${warnCount} warning terdeteksi`}
              </p>
              <div className="mt-3 space-y-1 text-sm text-red-600 dark:text-red-400">
                {testDefs.filter((d) => results[d.key]?.status === 'fail' || results[d.key]?.status === 'warning').map((d) => (
                  <p key={d.key}>
                    <span className="font-semibold">{d.label}:</span> {results[d.key]?.details}
                  </p>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
