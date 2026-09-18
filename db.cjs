const { Pool } = require('pg');

const useSsl =
  String(
    process.env.PGSSL ||
    ''
  )
    .trim()
    .toLowerCase() ===
  'true';

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
  ssl: useSsl
    ? {
        rejectUnauthorized:
          String(
            process.env.PGSSL_REJECT_UNAUTHORIZED ??
              'true'
          )
            .trim()
            .toLowerCase() !==
          'false',
      }
    : false,
});

pool.on('error', (err) => {
  console.error('PostgreSQL pool error:', err);
});

module.exports = pool;
