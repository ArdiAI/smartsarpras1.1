# Smart Sarpras — Final Handoff untuk Pak Taufik

## Arsitektur final

```text
React + Vite
    |
    v
Node.js + Express (index.cjs)
    |
    v
PostgreSQL (database smart_sarpras)

File upload -> Google Drive Apps Script
Admin Auth -> PostgreSQL app_users + app_sessions
Reset password -> Backend Node + SMTP
```

Supabase Auth tidak dibutuhkan oleh flow login admin yang baru.

## Menjalankan di PostgreSQL sekolah

1. Salin `env.school.example` menjadi `.env`.
2. Isi `PGPASSWORD` dan secret lain hanya di server/lokal, jangan commit ke GitHub.
3. Pastikan PostgreSQL aktif dan database `smart_sarpras` tersedia.
4. Jalankan:

```bash
npm install
npm run migrate:local-auth
npm run check
npm run server
```

Frontend lokal:

```bash
npm run dev
```

## Endpoint pengecekan

Backend:

```text
GET /api/health
```

Login admin:

```text
POST /api/auth/login
GET  /api/auth/session
POST /api/auth/logout
```

Reset password:

```text
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

## Migrasi auth

File:

```text
migrations/20260922_local_auth_password_reset.sql
```

Migration tersebut bersifat idempotent dan akan:

- membuat `app_users` jika belum ada;
- membuat `app_sessions` jika belum ada;
- membuat penyimpanan token reset di schema `private`;
- menghubungkan admin aktif ke akun auth lokal;
- mencabut session lama saat migrasi.

Admin lama harus membuat/set password baru pada sistem lokal. Password tidak disimpan plaintext.

## Catatan keamanan

- Jangan commit `.env`.
- Jangan masukkan password PostgreSQL, SMTP password, atau token Google Apps Script ke source code/frontend.
- Backend memakai parameterized SQL melalui package `pg`.
- Password lokal di-hash dengan `scrypt`.
- Token session disimpan dalam bentuk hash di database.

## Status handoff

Source utama ada di branch `main`.

Target production:
`https://sarpras.smkn1-cmi.sch.id`

Database production sekolah:
`smart_sarpras`
