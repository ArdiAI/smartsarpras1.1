require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

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

const now =
  new Date();

const stamp =
  now
    .toISOString()
    .replace(/[:.]/g, '-');

const backupDir =
  path.resolve(
    process.cwd(),
    'backups'
  );

fs.mkdirSync(
  backupDir,
  {
    recursive: true,
  }
);

const outputFile =
  path.join(
    backupDir,
    `smart-sarpras-${stamp}.dump`
  );

const binary =
  process.env.PG_DUMP_BIN ||
  'pg_dump';

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
  '--format=custom',
  '--no-owner',
  '--no-acl',
  '--file',
  outputFile,
];

console.log(
  `Membuat backup ke: ${outputFile}`
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
    'Gagal menjalankan pg_dump:',
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
  'Backup PostgreSQL selesai.'
);
