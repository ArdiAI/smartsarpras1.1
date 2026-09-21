require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const pool = require('../db.cjs');

async function main() {
  const migrationPath = path.resolve(
    __dirname,
    '..',
    'migrations',
    '20260922_local_auth_password_reset.sql'
  );

  const sql = fs.readFileSync(
    migrationPath,
    'utf8'
  );

  console.log(
    'Applying Smart Sarpras local-auth migration...'
  );

  await pool.query(sql);

  const result = await pool.query(`
    SELECT
      (SELECT COUNT(*)::int FROM public.app_users)
        AS app_users,
      (SELECT COUNT(*)::int
       FROM public.admin_users
       WHERE is_active = true)
        AS active_admins,
      (SELECT COUNT(*)::int
       FROM public.admin_users
       WHERE is_active = true
         AND user_id IS NOT NULL)
        AS linked_admins
  `);

  console.log(
    'Migration complete:',
    result.rows[0]
  );
}

main()
  .catch((error) => {
    console.error(
      'Local-auth migration failed:',
      error?.message || error
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
