require('dotenv').config();

const crypto = require('node:crypto');
const { Pool } = require('pg');

const CONFIRM_VALUE = 'YES';
const BATCH_SIZE = Math.max(
  25,
  Math.min(
    500,
    Number(process.env.SYNC_BATCH_SIZE || 100) || 100
  )
);

const PRESERVED_TABLES = new Set([
  'app_users',
  'app_sessions',
]);

const DRY_RUN =
  process.argv.includes('--dry-run') ||
  String(process.env.SYNC_DRY_RUN || '')
    .trim()
    .toUpperCase() === 'YES';

function envBool(name, fallback = false) {
  const raw = String(process.env[name] ?? '').trim().toLowerCase();

  if (!raw) return fallback;

  return ['1', 'true', 'yes', 'y', 'on'].includes(raw);
}

function quoteIdent(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function sourcePoolConfig() {
  const connectionString =
    String(process.env.SOURCE_DATABASE_URL || '').trim();

  const useSsl = envBool('SOURCE_PGSSL', true);
  const rejectUnauthorized = envBool(
    'SOURCE_PGSSL_REJECT_UNAUTHORIZED',
    true
  );

  if (connectionString) {
    return {
      connectionString,
      ssl: useSsl
        ? { rejectUnauthorized }
        : false,
      max: 4,
    };
  }

  const required = [
    'SOURCE_PGHOST',
    'SOURCE_PGUSER',
    'SOURCE_PGPASSWORD',
    'SOURCE_PGDATABASE',
  ];

  const missing = required.filter(
    (key) => !String(process.env[key] || '').trim()
  );

  if (missing.length > 0) {
    throw new Error(
      `Env database sumber belum lengkap: ${missing.join(', ')}`
    );
  }

  return {
    host: process.env.SOURCE_PGHOST,
    port: Number(process.env.SOURCE_PGPORT || 5432),
    user: process.env.SOURCE_PGUSER,
    password: process.env.SOURCE_PGPASSWORD,
    database: process.env.SOURCE_PGDATABASE,
    ssl: useSsl
      ? { rejectUnauthorized }
      : false,
    max: 4,
  };
}

function destinationPoolConfig() {
  const required = [
    'PGHOST',
    'PGUSER',
    'PGPASSWORD',
    'PGDATABASE',
  ];

  const missing = required.filter(
    (key) => !String(process.env[key] || '').trim()
  );

  if (missing.length > 0) {
    throw new Error(
      `Env database tujuan belum lengkap: ${missing.join(', ')}`
    );
  }

  const useSsl = envBool('PGSSL', false);
  const rejectUnauthorized = envBool(
    'PGSSL_REJECT_UNAUTHORIZED',
    true
  );

  return {
    host: process.env.PGHOST,
    port: Number(process.env.PGPORT || 5432),
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: useSsl
      ? { rejectUnauthorized }
      : false,
    max: 4,
  };
}

async function databaseIdentity(client) {
  const result = await client.query(`
    SELECT
      current_database() AS database_name,
      current_user AS user_name,
      COALESCE(inet_server_addr()::text, 'local-socket') AS server_addr,
      COALESCE(inet_server_port(), 0) AS server_port
  `);

  return result.rows[0];
}

async function getPublicTables(client) {
  const result = await client.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  return result.rows.map((row) => row.table_name);
}

async function getTableColumns(client, tableName) {
  const result = await client.query(
    `
      SELECT
        column_name,
        data_type,
        udt_name,
        is_nullable,
        column_default,
        is_identity,
        identity_generation,
        is_generated
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = $1
      ORDER BY ordinal_position
    `,
    [tableName]
  );

  return result.rows;
}

async function getForeignKeyEdges(client, tableNames) {
  if (tableNames.length === 0) return [];

  const result = await client.query(
    `
      SELECT DISTINCT
        child.relname AS child_table,
        parent.relname AS parent_table
      FROM pg_constraint con
      JOIN pg_class child
        ON child.oid = con.conrelid
      JOIN pg_namespace child_ns
        ON child_ns.oid = child.relnamespace
      JOIN pg_class parent
        ON parent.oid = con.confrelid
      JOIN pg_namespace parent_ns
        ON parent_ns.oid = parent.relnamespace
      WHERE con.contype = 'f'
        AND child_ns.nspname = 'public'
        AND parent_ns.nspname = 'public'
        AND child.relname = ANY($1::text[])
        AND parent.relname = ANY($1::text[])
      ORDER BY parent.relname, child.relname
    `,
    [tableNames]
  );

  return result.rows;
}

function topologicalSort(tableNames, edges) {
  const nodes = new Set(tableNames);
  const indegree = new Map();
  const children = new Map();

  for (const table of nodes) {
    indegree.set(table, 0);
    children.set(table, new Set());
  }

  for (const edge of edges) {
    const parent = edge.parent_table;
    const child = edge.child_table;

    if (!nodes.has(parent) || !nodes.has(child)) continue;
    if (parent === child) continue;

    if (!children.get(parent).has(child)) {
      children.get(parent).add(child);
      indegree.set(child, indegree.get(child) + 1);
    }
  }

  const queue = [...nodes]
    .filter((table) => indegree.get(table) === 0)
    .sort();

  const ordered = [];

  while (queue.length > 0) {
    const current = queue.shift();
    ordered.push(current);

    for (const child of [...children.get(current)].sort()) {
      indegree.set(child, indegree.get(child) - 1);

      if (indegree.get(child) === 0) {
        queue.push(child);
        queue.sort();
      }
    }
  }

  if (ordered.length !== nodes.size) {
    const remaining = [...nodes]
      .filter((table) => !ordered.includes(table))
      .sort();

    console.warn(
      `Peringatan: dependency cycle terdeteksi pada: ${remaining.join(', ')}. ` +
      'Tabel tersebut akan diproses setelah tabel acyclic.'
    );

    ordered.push(...remaining);
  }

  return ordered;
}

function normalizedType(column) {
  return `${column.data_type}:${column.udt_name}`;
}

function assertSchemaCompatible(
  tableName,
  sourceColumns,
  destinationColumns
) {
  const sourceMap = new Map(
    sourceColumns.map((column) => [column.column_name, column])
  );

  const destinationMap = new Map(
    destinationColumns.map((column) => [column.column_name, column])
  );

  const missingDestinationColumns = sourceColumns
    .filter(
      (column) =>
        column.is_generated === 'NEVER' &&
        !destinationMap.has(column.column_name)
    )
    .map((column) => column.column_name);

  if (missingDestinationColumns.length > 0) {
    throw new Error(
      `Schema tujuan untuk ${tableName} tertinggal. Kolom belum ada: ` +
      missingDestinationColumns.join(', ')
    );
  }

  for (const [columnName, sourceColumn] of sourceMap) {
    const destinationColumn = destinationMap.get(columnName);

    if (!destinationColumn) continue;
    if (sourceColumn.is_generated !== 'NEVER') continue;
    if (destinationColumn.is_generated !== 'NEVER') continue;

    if (
      normalizedType(sourceColumn) !==
      normalizedType(destinationColumn)
    ) {
      throw new Error(
        `Tipe kolom berbeda pada ${tableName}.${columnName}: ` +
        `sumber=${normalizedType(sourceColumn)}, ` +
        `tujuan=${normalizedType(destinationColumn)}`
      );
    }
  }

  const requiredDestinationOnly = destinationColumns.filter((column) => {
    if (sourceMap.has(column.column_name)) return false;
    if (column.is_generated !== 'NEVER') return false;
    if (column.is_nullable === 'YES') return false;
    if (column.column_default !== null) return false;
    if (column.is_identity === 'YES') return false;
    return true;
  });

  if (requiredDestinationOnly.length > 0) {
    throw new Error(
      `Schema tujuan ${tableName} memiliki kolom wajib yang tidak ada di sumber: ` +
      requiredDestinationOnly
        .map((column) => column.column_name)
        .join(', ')
    );
  }
}

function insertableCommonColumns(sourceColumns, destinationColumns) {
  const sourceMap = new Map(
    sourceColumns.map((column) => [column.column_name, column])
  );

  return destinationColumns
    .filter((column) => sourceMap.has(column.column_name))
    .filter((column) => column.is_generated === 'NEVER')
    .map((column) => column.column_name);
}

function stableNormalize(value) {
  if (value === null || value === undefined) return value;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return {
      __type: 'buffer',
      base64: value.toString('base64'),
    };
  }

  if (Array.isArray(value)) {
    return value.map(stableNormalize);
  }

  if (typeof value === 'object') {
    const normalized = {};

    for (const key of Object.keys(value).sort()) {
      normalized[key] = stableNormalize(value[key]);
    }

    return normalized;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  return value;
}

function digestRows(rows, columns) {
  const rowDigests = rows.map((row) => {
    const compactRow = {};

    for (const column of columns) {
      compactRow[column] = stableNormalize(row[column]);
    }

    return crypto
      .createHash('sha256')
      .update(JSON.stringify(compactRow))
      .digest('hex');
  });

  rowDigests.sort();

  return crypto
    .createHash('sha256')
    .update(rowDigests.join('\n'))
    .digest('hex');
}

async function getPrimaryKeyColumns(client, tableName) {
  const result = await client.query(
    `
      SELECT a.attname AS column_name
      FROM pg_index i
      JOIN pg_class t
        ON t.oid = i.indrelid
      JOIN pg_namespace n
        ON n.oid = t.relnamespace
      JOIN LATERAL unnest(i.indkey)
        WITH ORDINALITY AS keys(attnum, ordinality)
        ON true
      JOIN pg_attribute a
        ON a.attrelid = t.oid
       AND a.attnum = keys.attnum
      WHERE i.indisprimary = true
        AND n.nspname = 'public'
        AND t.relname = $1
      ORDER BY keys.ordinality
    `,
    [tableName]
  );

  return result.rows.map((row) => row.column_name);
}

function buildOrderBy(primaryKeyColumns) {
  if (primaryKeyColumns.length === 0) {
    return '';
  }

  return ` ORDER BY ${primaryKeyColumns
    .map(quoteIdent)
    .join(', ')}`;
}

async function loadRows(client, tableName, columns, orderByClause) {
  const selectColumns = columns
    .map(quoteIdent)
    .join(', ');

  const result = await client.query(
    `SELECT ${selectColumns} FROM public.${quoteIdent(tableName)}${orderByClause}`
  );

  return result.rows;
}

function transformRows(tableName, rows, preserveAuth) {
  if (preserveAuth && tableName === 'admin_users') {
    return rows.map((row) => ({
      ...row,
      user_id: null,
    }));
  }

  if (tableName === 'notification_queue') {
    return rows.map((row) => ({
      ...row,
      processed: true,
    }));
  }

  return rows;
}

async function insertRows(
  client,
  tableName,
  columns,
  destinationColumns,
  rows
) {
  if (rows.length === 0) return;

  const destinationMap = new Map(
    destinationColumns.map((column) => [column.column_name, column])
  );

  const hasGeneratedAlwaysIdentity = columns.some((columnName) => {
    const column = destinationMap.get(columnName);
    return (
      column?.is_identity === 'YES' &&
      column?.identity_generation === 'ALWAYS'
    );
  });

  const quotedColumns = columns
    .map(quoteIdent)
    .join(', ');

  for (let offset = 0; offset < rows.length; offset += BATCH_SIZE) {
    const batch = rows.slice(offset, offset + BATCH_SIZE);
    const values = [];
    const tuples = [];

    for (const row of batch) {
      const placeholders = [];

      for (const column of columns) {
        values.push(row[column]);
        placeholders.push(`$${values.length}`);
      }

      tuples.push(`(${placeholders.join(', ')})`);
    }

    const overrideClause =
      hasGeneratedAlwaysIdentity
        ? ' OVERRIDING SYSTEM VALUE'
        : '';

    await client.query(
      `
        INSERT INTO public.${quoteIdent(tableName)} (${quotedColumns})${overrideClause}
        VALUES ${tuples.join(', ')}
      `,
      values
    );
  }
}

async function main() {
  if (
    !DRY_RUN &&
    String(process.env.CONFIRM_FULL_DATA_SYNC || '')
      .trim()
      .toUpperCase() !== CONFIRM_VALUE
  ) {
    throw new Error(
      'Full data sync dibatalkan. Set CONFIRM_FULL_DATA_SYNC=YES setelah backup database tujuan berhasil.'
    );
  }

  const source = new Pool(sourcePoolConfig());
  const destination = new Pool(destinationPoolConfig());

  const sourceClient = await source.connect();
  const destinationClient = await destination.connect();

  let transactionStarted = false;

  try {
    const sourceIdentity = await databaseIdentity(sourceClient);
    const destinationIdentity = await databaseIdentity(destinationClient);

    console.log('Sumber :', sourceIdentity);
    console.log('Tujuan :', destinationIdentity);

    const sameDatabase =
      sourceIdentity.database_name === destinationIdentity.database_name &&
      sourceIdentity.server_addr === destinationIdentity.server_addr &&
      Number(sourceIdentity.server_port) === Number(destinationIdentity.server_port);

    if (sameDatabase) {
      throw new Error(
        'Database sumber dan tujuan terdeteksi sama. Sync dihentikan untuk mencegah kehilangan data.'
      );
    }

    const [sourceTables, destinationTables] = await Promise.all([
      getPublicTables(sourceClient),
      getPublicTables(destinationClient),
    ]);

    const destinationSet = new Set(destinationTables);
    const sourceSyncTables = sourceTables.filter(
      (table) => !PRESERVED_TABLES.has(table)
    );

    const missingTables = sourceSyncTables.filter(
      (table) => !destinationSet.has(table)
    );

    if (missingTables.length > 0) {
      throw new Error(
        'Schema PostgreSQL sekolah belum lengkap. Tabel belum ada: ' +
        missingTables.join(', ') +
        '. Samakan schema terlebih dahulu sebelum full sync.'
      );
    }

    const syncTables = sourceSyncTables;
    const tableMeta = new Map();

    for (const tableName of syncTables) {
      const [sourceColumns, destinationColumns, primaryKeyColumns] =
        await Promise.all([
          getTableColumns(sourceClient, tableName),
          getTableColumns(destinationClient, tableName),
          getPrimaryKeyColumns(sourceClient, tableName),
        ]);

      assertSchemaCompatible(
        tableName,
        sourceColumns,
        destinationColumns
      );

      const columns = insertableCommonColumns(
        sourceColumns,
        destinationColumns
      );

      if (columns.length === 0) {
        throw new Error(
          `Tidak ada kolom yang dapat disinkronkan untuk ${tableName}`
        );
      }

      tableMeta.set(tableName, {
        sourceColumns,
        destinationColumns,
        primaryKeyColumns,
        columns,
      });
    }

    const edges = await getForeignKeyEdges(
      sourceClient,
      syncTables
    );

    const orderedTables = topologicalSort(
      syncTables,
      edges
    );

    console.log(
      `Akan menyinkronkan ${orderedTables.length} tabel public.`
    );

    console.log(
      `Dipertahankan lokal: ${[...PRESERVED_TABLES].sort().join(', ') || '(tidak ada)'}`
    );

    if (DRY_RUN) {
      console.log('');
      console.log('DRY RUN: tidak ada data tujuan yang diubah.');

      for (const tableName of orderedTables) {
        const countResult = await sourceClient.query(
          `SELECT COUNT(*)::int AS rows FROM public.${quoteIdent(tableName)}`
        );

        console.log(
          `[SOURCE] ${tableName}: ${countResult.rows[0].rows} baris`
        );
      }

      return;
    }

    await destinationClient.query('BEGIN');
    transactionStarted = true;

    const truncateTargets = orderedTables
      .map((table) => `public.${quoteIdent(table)}`)
      .join(', ');

    await destinationClient.query(
      `TRUNCATE TABLE ${truncateTargets} RESTART IDENTITY`
    );

    const summary = [];

    for (const tableName of orderedTables) {
      const meta = tableMeta.get(tableName);
      const orderBy = buildOrderBy(
        meta.primaryKeyColumns
      );

      const sourceRowsRaw = await loadRows(
        sourceClient,
        tableName,
        meta.columns,
        orderBy
      );

      const sourceRows = transformRows(
        tableName,
        sourceRowsRaw,
        true
      );

      await insertRows(
        destinationClient,
        tableName,
        meta.columns,
        meta.destinationColumns,
        sourceRows
      );

      const destinationRows = await loadRows(
        destinationClient,
        tableName,
        meta.columns,
        orderBy
      );

      const sourceDigest = digestRows(
        sourceRows,
        meta.columns
      );

      const destinationDigest = digestRows(
        destinationRows,
        meta.columns
      );

      if (sourceRows.length !== destinationRows.length) {
        throw new Error(
          `Verifikasi jumlah baris gagal pada ${tableName}: ` +
          `sumber=${sourceRows.length}, tujuan=${destinationRows.length}`
        );
      }

      if (sourceDigest !== destinationDigest) {
        throw new Error(
          `Checksum berbeda pada ${tableName}. Transaction akan di-rollback.`
        );
      }

      summary.push({
        table: tableName,
        rows: sourceRows.length,
        sha256: sourceDigest,
      });

      console.log(
        `[OK] ${tableName}: ${sourceRows.length} baris`
      );
    }

    await destinationClient.query('COMMIT');
    transactionStarted = false;

    console.log('');
    console.log('FULL DATA SYNC SELESAI');
    console.table(summary.map(({ table, rows }) => ({ table, rows })));
    console.log('');
    console.log(
      'Auth lokal dipertahankan. admin_users.user_id diset NULL agar role lama dapat ditautkan kembali berdasarkan email saat user mendaftar. notification_queue ikut disalin tetapi ditandai processed=true agar notifikasi lama tidak terkirim ulang.'
    );
  } catch (error) {
    if (transactionStarted) {
      try {
        await destinationClient.query('ROLLBACK');
      } catch (rollbackError) {
        console.error(
          'Rollback juga gagal:',
          rollbackError?.message || rollbackError
        );
      }
    }

    throw error;
  } finally {
    sourceClient.release();
    destinationClient.release();
    await source.end();
    await destination.end();
  }
}

main().catch((error) => {
  console.error('');
  console.error(
    'FULL DATA SYNC GAGAL:',
    error?.message || error
  );
  process.exitCode = 1;
});
