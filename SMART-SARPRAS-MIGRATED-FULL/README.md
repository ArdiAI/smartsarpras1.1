# Smart Sarpras

Versi ini sudah disatukan ke arsitektur migrasi:

- Supabase: **Auth saja**
- PostgreSQL: **data aplikasi**
- Google Drive + Apps Script: **file/foto/lampiran**
- Backend aktif: **`index.cjs`**

## Jalankan lokal

1. Pastikan `.env` asli milik project tetap ada di komputer lokal. Jika perlu, lihat `.env.example`.
2. Install dependency bila belum ada: `npm install`
3. Terminal backend: `npm run server`
4. Terminal frontend: `npm run dev`

Backend default berjalan pada `http://localhost:3001`.

Lihat `MIGRATION_STATUS.md` untuk daftar modul yang sudah dipindahkan.
