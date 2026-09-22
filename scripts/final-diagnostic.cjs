require('dotenv').config();

const pool = require('../db.cjs');

const rows = [];

function add(check, status, detail) {
  rows.push({ check, status, detail });
}

function hasEnv(name) {
  return Boolean(String(process.env[name] || '').trim());
}

async function tableExists(name) {
  const r = await pool.query(
    `SELECT to_regclass($1) IS NOT NULL AS ok`,
    [`public.${name}`]
  );
  return Boolean(r.rows[0]?.ok);
}

async function count(table) {
  const r = await pool.query(
    `SELECT COUNT(*)::int AS n FROM public."${table}"`
  );
  return Number(r.rows[0]?.n || 0);
}

async function main() {
  const nodeEnv = String(process.env.NODE_ENV || 'development').trim();
  const apiUrl = String(process.env.VITE_API_URL || '').trim();

  if (
    nodeEnv === 'production' &&
    /localhost|127\.0\.0\.1/i.test(apiUrl)
  ) {
    add(
      'Production API URL',
      'FAIL',
      'VITE_API_URL masih menunjuk localhost/127.0.0.1'
    );
  } else {
    add(
      'Production API URL',
      'PASS',
      apiUrl || 'same-origin /api'
    );
  }

  for (const name of ['PGHOST', 'PGUSER', 'PGPASSWORD', 'PGDATABASE']) {
    add(
      `ENV ${name}`,
      hasEnv(name) ? 'PASS' : 'FAIL',
      hasEnv(name) ? 'set' : 'belum diisi'
    );
  }

  add(
    'Google Drive upload',
    hasEnv('GOOGLE_APPS_SCRIPT_URL') ? 'PASS' : 'WARN',
    hasEnv('GOOGLE_APPS_SCRIPT_URL') ? 'configured' : 'GOOGLE_APPS_SCRIPT_URL kosong'
  );

  add(
    'SMTP reset password',
    hasEnv('SMTP_HOST') && hasEnv('SMTP_USER') && hasEnv('SMTP_PASS')
      ? 'PASS'
      : 'WARN',
    hasEnv('SMTP_HOST') && hasEnv('SMTP_USER') && hasEnv('SMTP_PASS')
      ? 'configured'
      : 'SMTP belum lengkap'
  );

  const requiredTables = [
    'agendas',
    'agenda_attachments',
    'kavling',
    'inventory',
    'facilities',
    'borrowing_guide_steps',
    'app_users',
    'app_sessions',
    'admin_users',
    'admin_user_roles',
    'roles',
  ];

  for (const table of requiredTables) {
    const exists = await tableExists(table);
    add(
      `Table ${table}`,
      exists ? 'PASS' : 'FAIL',
      exists ? 'ada' : 'tidak ditemukan'
    );
  }

  if (await tableExists('agendas')) {
    const n = await count('agendas');
    add(
      'Agenda count',
      n >= 1059 ? 'PASS' : 'WARN',
      String(n)
    );
  }

  if (await tableExists('kavling')) {
    const n = await count('kavling');
    add(
      'Kavling count',
      n >= 723 ? 'PASS' : 'WARN',
      String(n)
    );
  }

  if (await tableExists('agenda_attachments')) {
    add(
      'Agenda attachments',
      'PASS',
      String(await count('agenda_attachments'))
    );
  }

  if (await tableExists('borrowing_guide_steps')) {
    const n = await count('borrowing_guide_steps');
    add(
      'Borrowing guide rows',
      n > 0 ? 'PASS' : 'WARN',
      n > 0
        ? String(n)
        : '0 baris; halaman akan tampil kosong sampai Super Admin menambah panduan'
    );
  }

  for (const table of ['inventory', 'facilities']) {
    if (!(await tableExists(table))) continue;

    const r = await pool.query(
      `
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (
            WHERE image_url ILIKE '%supabase%'
          )::int AS supabase_urls,
          COUNT(*) FILTER (
            WHERE image_url LIKE '/media/%'
          )::int AS local_urls,
          COUNT(*) FILTER (
            WHERE image_url IS NULL OR trim(image_url) = ''
          )::int AS empty_urls
        FROM public."${table}"
      `
    );

    const x = r.rows[0];

    add(
      `${table} image URLs`,
      Number(x.supabase_urls) === 0 ? 'PASS' : 'WARN',
      `total=${x.total}, supabase=${x.supabase_urls}, local=${x.local_urls}, empty=${x.empty_urls}`
    );
  }

  if (
    await tableExists('admin_users') &&
    await tableExists('app_users')
  ) {
    const r = await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE is_active = true)::int AS active_admins,
        COUNT(*) FILTER (
          WHERE is_active = true AND user_id IS NULL
        )::int AS unlinked_admins
      FROM public.admin_users
    `);

    add(
      'Admin account linkage',
      Number(r.rows[0].unlinked_admins) === 0 ? 'PASS' : 'WARN',
      `active=${r.rows[0].active_admins}, unlinked=${r.rows[0].unlinked_admins}`
    );
  }

  console.log('');
  console.log('SMART SARPRAS - FINAL DIAGNOSTIC');
  console.table(rows);

  const failed = rows.filter((row) => row.status === 'FAIL');
  const warned = rows.filter((row) => row.status === 'WARN');

  console.log('');
  console.log(
    `Summary: PASS=${rows.length - failed.length - warned.length}, WARN=${warned.length}, FAIL=${failed.length}`
  );

  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(
      'FINAL DIAGNOSTIC GAGAL:',
      error?.message || error
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
