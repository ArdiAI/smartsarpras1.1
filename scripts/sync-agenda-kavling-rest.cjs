require('dotenv').config();

const { Pool } = require('pg');

const SOURCE_URL =
  String(
    process.env.SOURCE_SUPABASE_URL ||
    process.env.VITE_SUPABASE_URL ||
    'https://nhpwomtzjxejihenglpb.supabase.co'
  ).replace(/\/+$/, '');

const SOURCE_KEY =
  String(
    process.env.SOURCE_SUPABASE_KEY ||
    process.env.VITE_SUPABASE_ANON_KEY ||
    ''
  ).trim();

const CONFIRMED =
  process.argv.includes('--yes');

function destinationConfig() {
  const required = [
    'PGHOST',
    'PGUSER',
    'PGPASSWORD',
    'PGDATABASE',
  ];

  const missing = required.filter(
    (key) =>
      !String(
        process.env[key] || ''
      ).trim()
  );

  if (missing.length > 0) {
    throw new Error(
      `Env PostgreSQL lokal belum lengkap: ${missing.join(', ')}`
    );
  }

  const useSsl =
    String(
      process.env.PGSSL || ''
    )
      .trim()
      .toLowerCase() ===
    'true';

  return {
    host:
      process.env.PGHOST,
    port:
      Number(
        process.env.PGPORT ||
        5432
      ),
    user:
      process.env.PGUSER,
    password:
      process.env.PGPASSWORD,
    database:
      process.env.PGDATABASE,
    ssl:
      useSsl
        ? {
            rejectUnauthorized:
              String(
                process.env
                  .PGSSL_REJECT_UNAUTHORIZED ??
                  'true'
              )
                .trim()
                .toLowerCase() !==
              'false',
          }
        : false,
  };
}

async function fetchTable(
  tableName
) {
  if (!SOURCE_KEY) {
    throw new Error(
      'SOURCE_SUPABASE_KEY / VITE_SUPABASE_ANON_KEY belum ada di .env'
    );
  }

  const rows = [];
  const pageSize = 500;
  let offset = 0;

  while (true) {
    const url =
      new URL(
        `${SOURCE_URL}/rest/v1/${tableName}`
      );

    url.searchParams.set(
      'select',
      '*'
    );
    url.searchParams.set(
      'order',
      'id.asc'
    );
    url.searchParams.set(
      'limit',
      String(
        pageSize
      )
    );
    url.searchParams.set(
      'offset',
      String(
        offset
      )
    );

    const response =
      await fetch(
        url,
        {
          headers: {
            apikey:
              SOURCE_KEY,
            Authorization:
              `Bearer ${SOURCE_KEY}`,
            Accept:
              'application/json',
          },
        }
      );

    if (!response.ok) {
      const body =
        await response
          .text()
          .catch(
            () => ''
          );

      throw new Error(
        `Gagal mengambil ${tableName} dari Supabase: ${response.status} ${body}`
      );
    }

    const page =
      await response.json();

    if (
      !Array.isArray(
        page
      )
    ) {
      throw new Error(
        `Respons Supabase untuk ${tableName} bukan array.`
      );
    }

    rows.push(
      ...page
    );

    if (
      page.length <
      pageSize
    ) {
      break;
    }

    offset +=
      page.length;
  }

  return rows;
}

async function localColumns(
  client,
  tableName
) {
  const result =
    await client.query(
      `
        SELECT
          column_name
        FROM information_schema.columns
        WHERE
          table_schema = 'public'
          AND table_name = $1
        ORDER BY ordinal_position
      `,
      [
        tableName,
      ]
    );

  return result.rows.map(
    (
      row
    ) =>
      row.column_name
  );
}

function quoteIdent(
  value
) {
  return `"${String(
    value
  ).replaceAll(
    '"',
    '""'
  )}"`;
}

async function insertRows(
  client,
  tableName,
  rows,
  destinationColumns
) {
  if (
    rows.length === 0
  ) {
    return;
  }

  const sourceColumns =
    Object.keys(
      rows[0]
    );

  const columns =
    sourceColumns.filter(
      (
        column
      ) =>
        destinationColumns.includes(
          column
        )
    );

  const missing =
    sourceColumns.filter(
      (
        column
      ) =>
        !destinationColumns.includes(
          column
        )
    );

  if (
    missing.length > 0
  ) {
    throw new Error(
      `Schema lokal ${tableName} tertinggal. Kolom belum ada: ${missing.join(', ')}`
    );
  }

  const batchSize =
    100;

  for (
    let offset = 0;
    offset <
    rows.length;
    offset +=
    batchSize
  ) {
    const batch =
      rows.slice(
        offset,
        offset +
          batchSize
      );

    const values = [];
    const tuples = [];

    for (
      const row of
      batch
    ) {
      const placeholders =
        [];

      for (
        const column of
        columns
      ) {
        values.push(
          row[column]
        );

        placeholders.push(
          `$${values.length}`
        );
      }

      tuples.push(
        `(${placeholders.join(', ')})`
      );
    }

    await client.query(
      `
        INSERT INTO public.${quoteIdent(
          tableName
        )} (
          ${columns
            .map(
              quoteIdent
            )
            .join(', ')}
        )
        VALUES
          ${tuples.join(', ')}
      `,
      values
    );
  }
}

async function countTable(
  client,
  tableName
) {
  const result =
    await client.query(
      `
        SELECT
          COUNT(*)::int
            AS rows
        FROM public.${quoteIdent(
          tableName
        )}
      `
    );

  return Number(
    result.rows[0]
      .rows
  );
}

async function main() {
  if (!CONFIRMED) {
    throw new Error(
      'Gunakan npm run sync:agenda-kavling:rest agar konfirmasi --yes ikut dijalankan.'
    );
  }

  console.log(
    'Mengambil agenda + kavling terbaru dari Supabase...'
  );

  const [
    agendas,
    agendaAttachments,
    kavling,
  ] =
    await Promise.all([
      fetchTable(
        'agendas'
      ),
      fetchTable(
        'agenda_attachments'
      ),
      fetchTable(
        'kavling'
      ),
    ]);

  console.log(
    `Supabase => agenda: ${agendas.length}, lampiran: ${agendaAttachments.length}, kavling: ${kavling.length}`
  );

  const pool =
    new Pool(
      destinationConfig()
    );

  const client =
    await pool.connect();

  let inTransaction =
    false;

  try {
    console.log(
      `Lokal sebelum => agenda: ${await countTable(client, 'agendas')}, kavling: ${await countTable(client, 'kavling')}`
    );

    const destinationColumns = {};

    for (
      const tableName of
      [
        'agendas',
        'agenda_attachments',
        'kavling',
      ]
    ) {
      destinationColumns[
        tableName
      ] =
        await localColumns(
          client,
          tableName
        );

      if (
        destinationColumns[
          tableName
        ].length === 0
      ) {
        throw new Error(
          `Tabel lokal public.${tableName} tidak ditemukan.`
        );
      }
    }

    await client.query(
      'BEGIN'
    );

    inTransaction =
      true;

    await client.query(
      `
        TRUNCATE TABLE
          public.agenda_attachments,
          public.agendas,
          public.kavling
        RESTART IDENTITY
      `
    );

    await insertRows(
      client,
      'agendas',
      agendas,
      destinationColumns
        .agendas
    );

    await insertRows(
      client,
      'agenda_attachments',
      agendaAttachments,
      destinationColumns
        .agenda_attachments
    );

    await insertRows(
      client,
      'kavling',
      kavling,
      destinationColumns
        .kavling
    );

    const after = {
      agendas:
        await countTable(
          client,
          'agendas'
        ),
      agendaAttachments:
        await countTable(
          client,
          'agenda_attachments'
        ),
      kavling:
        await countTable(
          client,
          'kavling'
        ),
    };

    if (
      after.agendas !==
        agendas.length ||
      after.agendaAttachments !==
        agendaAttachments.length ||
      after.kavling !==
        kavling.length
    ) {
      throw new Error(
        `Verifikasi jumlah gagal: ${JSON.stringify(after)}`
      );
    }

    await client.query(
      'COMMIT'
    );

    inTransaction =
      false;

    console.log(
      `BERHASIL => agenda: ${after.agendas}, kavling: ${after.kavling}`
    );

    console.log(
      'Refresh localhost:5173.'
    );
  } catch (error) {
    if (
      inTransaction
    ) {
      await client
        .query(
          'ROLLBACK'
        )
        .catch(
          () => {}
        );
    }

    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch(
  (
    error
  ) => {
    console.error(
      'SYNC GAGAL:',
      error?.message ||
        error
    );

    process.exitCode =
      1;
  }
);
