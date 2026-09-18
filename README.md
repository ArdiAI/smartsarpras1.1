# Smart Sarpras

Smart Sarpras adalah sistem sarana/prasarana berbasis React + Vite + Node/Express.

## Arsitektur aktif

- **Frontend:** React + Vite + TypeScript.
- **Backend:** Node/Express melalui `index.cjs`.
- **Database:** PostgreSQL; saat ini dapat diarahkan ke Supabase Postgres melalui `PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE`.
- **Auth:** Supabase Auth.
- **File/foto/lampiran:** Google Drive + Apps Script.

Frontend tidak mengakses credential database secara langsung. Operasi data aplikasi utama berjalan melalui backend Express.

## Jalankan lokal

1. Salin `.env.example` menjadi `.env`, lalu isi credential lokal yang diperlukan.
2. Install dependency:

```powershell
npm install
```

3. Terminal backend:

```powershell
npm run server
```

4. Terminal frontend:

```powershell
npm run dev
```

Backend default: `http://localhost:3001`.

## Validasi sebelum deploy

```powershell
npm ci
npm run check
```

`npm run check` menjalankan pemeriksaan syntax backend/auth/database dan build frontend.

## Backup database

Jika PostgreSQL client tools sudah tersedia:

```powershell
npm run backup:db
```

Backup lokal masuk ke folder `backups/` dan tidak di-commit.

## Dokumentasi penting

- [HANDOVER.md](HANDOVER.md) — panduan estafet untuk operator, Super Admin, dan technical owner.
- [DEPLOYMENT.md](DEPLOYMENT.md) — deploy, restart, backup, restore, dan rollback.
- [FINAL_RELEASE_CHECKLIST.md](FINAL_RELEASE_CHECKLIST.md) — checklist sebelum release final.
- [MIGRATION_STATUS.md](MIGRATION_STATUS.md) — status migrasi arsitektur.
- [.env.example](.env.example) — daftar environment variable tanpa secret.

## Ownership

Untuk keberlanjutan, akses GitHub, Supabase, server/domain, dan Google Drive/Apps Script sebaiknya dimiliki atau dapat dipulihkan oleh pihak sekolah/technical owner, bukan hanya akun pribadi satu pengurus.
