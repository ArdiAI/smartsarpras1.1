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

function resolvePgDumpBinary() {
  const configured =
    String(
      process.env.PG_DUMP_BIN ||
      ''
    ).trim();

  if (configured) {
    return configured;
  }

  if (process.platform === 'win32') {
    const roots = [
      process.env.ProgramFiles,
      process.env['ProgramFiles(x86)'],
      'C:\\Program Files',
    ]
      .filter(Boolean)
      .map((root) =>
        path.join(
          root,
          'PostgreSQL'
        )
      );

    for (const root of roots) {
      if (!fs.existsSync(root)) {
        continue;
      }

      const versions =
        fs.readdirSync(
          root,
          {
            withFileTypes: true,
          }
        )
          .filter(
            (entry) =>
              entry.isDirectory()
          )
          .map(
            (entry) =>
              entry.name
          )
          .sort(
            (a, b) =>
              Number(b) -
              Number(a)
          );

      for (const version of versions) {
        const candidate =
          path.join(
            root,
            version,
            'bin',
            'pg_dump.exe'
          );

        if (
          fs.existsSync(
            candidate
          )
        ) {
          return candidate;
        }
      }
    }
  }

  return 'pg_dump';
}

const binary =
  resolvePgDumpBinary();

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

console.log(
  `pg_dump: ${binary}`
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

  if (
    result.error.code ===
    'ENOENT'
  ) {
    console.error(
      'pg_dump.exe tidak ditemukan. Isi PG_DUMP_BIN di .env dengan path lengkap ke pg_dump.exe.'
    );
  }

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
