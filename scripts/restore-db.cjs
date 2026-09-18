require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

if (
  process.env.CONFIRM_RESTORE !==
  'YES'
) {
  console.error(
    'Restore dibatalkan. Set CONFIRM_RESTORE=YES hanya setelah memastikan file backup dan database tujuan benar.'
  );
  process.exit(1);
}

const input =
  process.argv[2];

if (!input) {
  console.error(
    'Pemakaian: node scripts/restore-db.cjs <file.dump>'
  );
  process.exit(1);
}

const backupFile =
  path.resolve(
    process.cwd(),
    input
  );

if (
  !fs.existsSync(
    backupFile
  )
) {
  console.error(
    `File backup tidak ditemukan: ${backupFile}`
  );
  process.exit(1);
}

const required = [
  'PGHOST',
  'PGUSER',
  'PGPASSWORD',
  'PGDATABASE',
];

const missing =
  required.filter(
    (key) =>
      !String(
        process.env[key] ||
        ''
      ).trim()
  );

if (missing.length > 0) {
  console.error(
    `Env database belum lengkap: ${missing.join(', ')}`
  );
  process.exit(1);
}

const binary =
  process.env.PG_RESTORE_BIN ||
  'pg_restore';

const args = [
  '--host',
  process.env.PGHOST,
  '--port',
  String(
    process.env.PGPORT ||
    5432
  ),
  '--username',
  process.env.PGUSER,
  '--dbname',
  process.env.PGDATABASE,
  '--clean',
  '--if-exists',
  '--no-owner',
  '--no-acl',
  '--exit-on-error',
  backupFile,
];

console.warn(
  `PERINGATAN: restore akan mengubah database ${process.env.PGDATABASE} di ${process.env.PGHOST}.`
);

const result =
  spawnSync(
    binary,
    args,
    {
      stdio: 'inherit',
      env: {
        ...process.env,
        PGPASSWORD:
          process.env.PGPASSWORD,
      },
    }
  );

if (result.error) {
  console.error(
    'Gagal menjalankan pg_restore:',
    result.error.message
  );
  process.exit(1);
}

if (result.status !== 0) {
  process.exit(
    result.status || 1
  );
}

console.log(
  'Restore PostgreSQL selesai.'
);
