require('dotenv').config();

const pool = require('../db.cjs');

const mappings = [
  ['facilities','c249f86c-964e-4651-a3b6-c2df1c862c5d','1EglJgbLyjtonoUAaTjCpBw651hvZiCGH'],
  ['facilities','86c3233c-e042-42d2-9d49-9eb2032c6c62','1J32zV_9JpAIFXvUUFci1rghFaVWJfK37'],
  ['facilities','56f991ec-636e-41d8-9a10-9b5c864379b7','1_zTcaMPZbtFATpPqBF3hNJ63hnPYngxK'],
  ['facilities','ff4dd387-a9d5-4097-a465-dd49b56b1693','10a30drn4kx5ykqxg69j6wc5bbiy6qoVT'],
  ['facilities','76c4a59f-d982-4199-a9f0-f7ac31fe3995','1DCjfNc98oNA7FjAXC1sc_9mVuW_R9_mE'],
  ['facilities','65f66639-b524-4d81-993f-a68586b0edc6','1uDuiaZ-FdadoWwweMh1hhOJQzerzX3lC'],
  ['facilities','0125956b-02ce-442b-be3c-6790e9af0cbd','1ksPn1nHow1qG0S93Zb8eTOasdhMts5mo'],
  ['facilities','9a658b93-dcfe-4c3f-b675-d6d6bdfeab79','1LIU0Ww36nGfJ7bx0kBdNI2lH18ytvkFk'],
  ['facilities','8dbee225-544c-4bfd-aa5a-3da6cef90167','1IBrtN_DF6FZ4ZE-ivE1FND_KusnSXXl8'],
  ['facilities','43ccedd5-43fc-47e4-9484-ee88bbc7195a','1ear9gXGtoULatoy6emfBgOytvGgPoO43'],
  ['inventory','0c686295-2f74-4440-aa6e-f0979293ae12','1LM3Zb862CWfiUPyTfu3RcIAvrWJ2LXKZ'],
  ['inventory','9f2465bd-6cf3-4b30-a382-b2a0dcb8988a','1y-pHqF0_4sgq9h9zwxLuWyxUK5E8UHns'],
  ['inventory','3e5f1715-aae1-4fd4-ba0d-ce44c7e9a618','1ldxvn0V_IHMKjpXBc8-O9dSZEUXmMbLl'],
  ['inventory','3b66497d-58fe-4d1b-bd31-74b3b2c83e6b','1QoGa1HOLiNkdxDL17FSyvt2Uw4gpPDad'],
  ['inventory','0d71670b-2d29-4274-aa0d-07679d7b777a','1f9z0qBwUOrgTGmfjOUrsVEXvk3rM5peQ'],
  ['inventory','e7aa04fd-3c4c-4697-a0b5-bdb156fbb29d','15mGCCT36pWJl4_PvR0Yfn8PCpovOEy2d'],
  ['inventory','870c6318-93c0-4ba8-b163-fc6a9f3b0421','19Iwk11TFN-nXNqNI3g23dDVXmGSTpaAY'],
  ['inventory','cd4e5218-208c-48bd-98ef-e28df0e46f0a','1lGC7u9iPBdkgjxadNjKur-oeZ0u2okn4'],
  ['inventory','e04aef30-3efb-44ee-9b28-6b7f09aae649','1LDIo_YTIsWYi9YxgJkjLVsuH-ebGZfUK'],
];

function driveUrl(fileId) {
  return `https://drive.google.com/file/d/${fileId}/view`;
}

async function main() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const results = [];

    for (const [table, id, fileId] of mappings) {
      const result = await client.query(
        `UPDATE public.${table}
         SET image_url = $1
         WHERE id = $2
         RETURNING id, name, image_url`,
        [driveUrl(fileId), id]
      );

      if (result.rowCount !== 1) {
        throw new Error(`${table} ${id} tidak ditemukan di database lokal`);
      }

      results.push({
        table,
        name: result.rows[0].name,
        fileId,
      });
    }

    await client.query('COMMIT');

    console.log('');
    console.log('MIGRASI URL GAMBAR KE GOOGLE DRIVE SELESAI');
    console.table(results);
    console.log('');
    console.log(`Berhasil: ${results.length}/${mappings.length}`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

main()
  .catch((error) => {
    console.error('MIGRASI GAGAL:', error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
