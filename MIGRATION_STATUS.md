# Smart Sarpras — Status Migrasi

## Arsitektur aktif

- **Supabase:** Auth saja (login, session, reset password).
- **PostgreSQL:** seluruh data aplikasi.
- **Google Drive via Apps Script:** file/foto/lampiran.
- **Node/Express (`index.cjs`):** API penghubung frontend ke PostgreSQL dan Google Drive.

## Sudah dimigrasikan

- Landing/dashboard publik dan statistik.
- Inventory dan kategori.
- Fasilitas dan pengelola fasilitas.
- Agenda + lampiran.
- Laporan kerusakan.
- Pengumuman.
- Aspirasi.
- Kavling (input, data, verifikasi/status/admin).
- Tim pengelola.
- Timeline dan rekap.
- History + hapus dengan permission.
- Peminjaman dan workflow/admin routes.
- Master kelas dan ekstrakurikuler.
- Admin dashboard, statistik, activity logs.
- Roles, permissions, users, approver emails, system config/settings.
- Proposal: data ke PostgreSQL dan dokumen ke Google Drive.
- Upload gambar inventory/fasilitas/pengumuman/system settings: Google Drive.
- System Testing storage: mengecek konfigurasi Google Drive, bukan Supabase Storage.

## Catatan

- Email/notifikasi peminjaman masih memiliki jalur lama yang dapat memakai Supabase Edge Function jika route notifikasi dijalankan. Fitur ini tidak memengaruhi migrasi data/storage dan sebelumnya memang ditunda.
- File Google Drive tidak otomatis dihapus ketika record PostgreSQL dihapus. Ini sengaja agar penghapusan data tidak gagal hanya karena file Drive.
- `server/` di project lama adalah backend lama. Paket final menggunakan **`index.cjs` di root**.

## Menjalankan lokal

Terminal 1:

```powershell
npm run server
```

Terminal 2:

```powershell
npm run dev
```

Backend default: `http://localhost:3001`.
