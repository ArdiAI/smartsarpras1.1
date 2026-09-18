# DEPLOYMENT SMART SARPRAS

## Arsitektur production

```text
Browser
  |
  v
Frontend React/Vite (HTTPS)
  |
  v
Backend Node/Express (HTTPS)
  |
  +--> PostgreSQL / Supabase Postgres
  +--> Supabase Auth
  +--> Google Drive Apps Script
```

Database dan Auth boleh tetap memakai Supabase. Backend Node/Express tetap harus berjalan pada server production.

## 1. Persiapan server

Kebutuhan:
- Node.js versi yang kompatibel dengan project;
- npm;
- Git;
- PostgreSQL client tools (`pg_dump` dan `pg_restore`) untuk backup/recovery;
- reverse proxy/hosting HTTPS;
- akses jaringan ke Supabase dan Google Apps Script.

Clone repository lalu:

```bash
npm ci
npm run check
```

Jangan deploy jika `npm run check` gagal.

## 2. Environment production

Salin:

```bash
cp .env.example .env
```

Isi `.env` hanya pada server. Jangan commit file tersebut.

Untuk production:
- `NODE_ENV=production`;
- `VITE_API_URL` harus menunjuk ke URL backend production, bukan localhost;
- `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE` menunjuk ke PostgreSQL yang benar;
- aktifkan `PGSSL=true` jika koneksi production mewajibkan SSL;
- isi `SUPABASE_URL` dan key Auth;
- isi Google Apps Script URL/token;
- tambahkan origin frontend di `ALLOWED_ORIGINS` jika domain berbeda dari domain default.

Secret backend tidak boleh memakai prefix `VITE_`.

## 3. Build frontend

```bash
npm ci
npm run build
```

Hasil frontend ada di folder `dist/`.

Konfigurasikan web server agar SPA React mengarahkan route yang tidak ditemukan ke `index.html`.

## 4. Menjalankan backend

Untuk test:

```bash
npm run server
```

Backend default memakai port 3001.

Pada production, jalankan backend memakai process manager/service milik server sekolah agar otomatis hidup kembali setelah reboot. Technical owner menentukan apakah memakai systemd, container, PM2, atau mekanisme hosting yang tersedia.

## 5. Health check setelah deploy

Cek:
- backend health endpoint;
- login;
- dashboard;
- inventaris;
- fasilitas;
- agenda;
- laporan;
- timeline;
- workflow peminjaman bila fitur diaktifkan;
- upload file;
- email notification;
- Activity Logs.

Kemudian login Super Admin dan jalankan seluruh test di halaman System Testing.

## 6. Backup

Pastikan PostgreSQL client tersedia:

```bash
pg_dump --version
pg_restore --version
```

Buat backup:

```bash
npm run backup:db
```

File masuk ke folder lokal `backups/` dan folder tersebut tidak ikut Git.

Salin backup ke lokasi sekolah yang aman. Jangan hanya menyimpan backup di server yang sama dengan production.

Backup database tidak otomatis membackup file di Google Drive.

## 7. Restore

Restore bersifat berisiko/destruktif dan hanya dilakukan technical owner.

Contoh PowerShell:

```powershell
$env:CONFIRM_RESTORE="YES"
npm run restore:db -- backups\smart-sarpras-xxxx.dump
Remove-Item Env:CONFIRM_RESTORE
```

Contoh Linux:

```bash
CONFIRM_RESTORE=YES npm run restore:db -- backups/smart-sarpras-xxxx.dump
```

Uji restore terlebih dahulu pada database non-production.

## 8. Rollback aplikasi

Jika release baru bermasalah:
1. jangan menghapus database;
2. catat commit bermasalah;
3. checkout/tag release terakhir yang sehat;
4. jalankan `npm ci`;
5. jalankan `npm run check`;
6. build dan restart backend;
7. jalankan System Testing.

Database migration yang sudah mengubah data/schema tidak otomatis mundur hanya karena source code di-rollback.

## 9. Secret rotation

Jika secret pernah masuk repository/chat/tempat publik:
- ganti secret di provider;
- update `.env` production;
- restart backend;
- test integrasi;
- baru anggap secret lama tidak berlaku.

Prioritas: database password, Apps Script token, SMTP credential, service-role/secret key jika ada.
