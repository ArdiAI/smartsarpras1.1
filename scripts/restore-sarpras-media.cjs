require('dotenv').config();

const fs = require('node:fs');
const path = require('node:path');
const pool = require('../db.cjs');

const sourceDir = path.resolve(
  process.cwd(),
  process.env.MEDIA_SOURCE_DIR || 'media-source'
);

const outputDir = path.resolve(
  process.cwd(),
  'public',
  'media',
  'sarpras'
);

const mappings = [
  // facilities
  { table: 'facilities', id: 'c249f86c-964e-4651-a3b6-c2df1c862c5d', pattern: '99eed7ea-7a5c-439f-a8b4-b1a4b6c02e27', target: 'fac-c249f86c-964e-4651-a3b6-c2df1c862c5d.jpg' },
  { table: 'facilities', id: '86c3233c-e042-42d2-9d49-9eb2032c6c62', pattern: '_mg_7162', target: 'fac-86c3233c-e042-42d2-9d49-9eb2032c6c62.jpg' },
  { table: 'facilities', id: '56f991ec-636e-41d8-9a10-9b5c864379b7', pattern: '_mg_7290', target: 'fac-56f991ec-636e-41d8-9a10-9b5c864379b7.jpg' },
  { table: 'facilities', id: 'ff4dd387-a9d5-4097-a465-dd49b56b1693', pattern: '016bfc2b-1d07-4f0f-bc0c-f7c924d1e50c', target: 'fac-ff4dd387-a9d5-4097-a465-dd49b56b1693.jpg' },
  { table: 'facilities', id: '76c4a59f-d982-4199-a9f0-f7ac31fe3995', pattern: '_mg_7286', target: 'fac-76c4a59f-d982-4199-a9f0-f7ac31fe3995.jpg' },
  { table: 'facilities', id: '65f66639-b524-4d81-993f-a68586b0edc6', pattern: '1787589523832-fysku6', target: 'fac-65f66639-b524-4d81-993f-a68586b0edc6.jpg' },
  { table: 'facilities', id: '0125956b-02ce-442b-be3c-6790e9af0cbd', pattern: '1787555470712-4rqna0', target: 'fac-0125956b-02ce-442b-be3c-6790e9af0cbd.jpg' },
  { table: 'facilities', id: '9a658b93-dcfe-4c3f-b675-d6d6bdfeab79', pattern: '1787589441991-zv9xbm', target: 'fac-9a658b93-dcfe-4c3f-b675-d6d6bdfeab79.jpg' },
  { table: 'facilities', id: '8dbee225-544c-4bfd-aa5a-3da6cef90167', pattern: '1787589363985-ynmvyh', target: 'fac-8dbee225-544c-4bfd-aa5a-3da6cef90167.jpg' },
  { table: 'facilities', id: '43ccedd5-43fc-47e4-9484-ee88bbc7195a', pattern: '21.35.26', target: 'fac-43ccedd5-43fc-47e4-9484-ee88bbc7195a.jpg' },

  // inventory
  { table: 'inventory', id: '0c686295-2f74-4440-aa6e-f0979293ae12', pattern: 'b5e3ee74-3513-4d3a-ae94-8fe391f377d0', target: 'inv-0c686295-2f74-4440-aa6e-f0979293ae12.jpg' },
  { table: 'inventory', id: '9f2465bd-6cf3-4b30-a382-b2a0dcb8988a', pattern: '33adc26e-06a7-4412-a6aa-4d025844d817', target: 'inv-9f2465bd-6cf3-4b30-a382-b2a0dcb8988a.jpg' },
  { table: 'inventory', id: '3e5f1715-aae1-4fd4-ba0d-ce44c7e9a618', pattern: '7be9542d-bd4e-4c7f-bd83-59506b2d7266', target: 'inv-3e5f1715-aae1-4fd4-ba0d-ce44c7e9a618.jpg' },
  { table: 'inventory', id: '3b66497d-58fe-4d1b-bd31-74b3b2c83e6b', pattern: 'images_20_4', altPattern: 'images (4)', target: 'inv-3b66497d-58fe-4d1b-bd31-74b3b2c83e6b.jpg' },
  { table: 'inventory', id: '0d71670b-2d29-4274-aa0d-07679d7b777a', pattern: 'images_20_6', altPattern: 'images (6)', target: 'inv-0d71670b-2d29-4274-aa0d-07679d7b777a.jpg' },
  { table: 'inventory', id: 'e7aa04fd-3c4c-4697-a0b5-bdb156fbb29d', pattern: '9f9b0995963dadd251f082ad3e544b', target: 'inv-e7aa04fd-3c4c-4697-a0b5-bdb156fbb29d.jpg' },
  { table: 'inventory', id: '870c6318-93c0-4ba8-b163-fc6a9f3b0421', pattern: 'images_20_2', altPattern: 'images (2)', target: 'inv-870c6318-93c0-4ba8-b163-fc6a9f3b0421.jpg' },
  { table: 'inventory', id: 'cd4e5218-208c-48bd-98ef-e28df0e46f0a', pattern: 'images_20_3', altPattern: 'images (3)', target: 'inv-cd4e5218-208c-48bd-98ef-e28df0e46f0a.jpg' },
  { table: 'inventory', id: 'e04aef30-3efb-44ee-9b28-6b7f09aae649', pattern: 'images_20_5', altPattern: 'images (5)', target: 'inv-e04aef30-3efb-44ee-9b28-6b7f09aae649.jpg' },
];

function walk(dir) {
  const files = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }

  return files;
}

function normalize(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/%20/g, '_20_')
    .replace(/\s+/g, '_')
    .replace(/[()]/g, (m) => m);
}

async function main() {
  if (!fs.existsSync(sourceDir)) {
    throw new Error(
      `Folder sumber tidak ditemukan: ${sourceDir}. Download folder Drive File_Fasilitas dan File_inventory ke folder media-source terlebih dahulu.`
    );
  }

  fs.mkdirSync(outputDir, { recursive: true });

  const sourceFiles = walk(sourceDir);
  const found = [];
  const missing = [];

  for (const mapping of mappings) {
    const pattern = normalize(mapping.pattern);
    const altPattern = mapping.altPattern
      ? normalize(mapping.altPattern)
      : null;

    const match = sourceFiles.find((file) => {
      const name = normalize(path.basename(file));
      return name.includes(pattern) || (altPattern && name.includes(altPattern));
    });

    if (!match) {
      missing.push(mapping);
      continue;
    }

    const targetPath = path.join(outputDir, mapping.target);
    fs.copyFileSync(match, targetPath);

    const publicUrl = `/media/sarpras/${mapping.target}`;

    await pool.query(
      `UPDATE public.${mapping.table} SET image_url = $1 WHERE id = $2`,
      [publicUrl, mapping.id]
    );

    found.push({
      table: mapping.table,
      id: mapping.id,
      source: path.basename(match),
      url: publicUrl,
    });
  }

  console.log('');
  console.log('MEDIA RESTORE SELESAI');
  console.table(
    found.map((item) => ({
      table: item.table,
      file: item.source,
      url: item.url,
    }))
  );

  if (missing.length > 0) {
    console.warn('');
    console.warn(
      `Belum ditemukan ${missing.length} file:`
    );

    for (const item of missing) {
      console.warn(
        `- ${item.table} ${item.id} (cari: ${item.pattern})`
      );
    }
  }

  console.log('');
  console.log(
    `Berhasil: ${found.length}/${mappings.length}. Refresh Vite setelah selesai.`
  );
}

main()
  .catch((error) => {
    console.error(
      'MEDIA RESTORE GAGAL:',
      error?.message || error
    );
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
