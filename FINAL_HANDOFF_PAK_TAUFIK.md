# Smart Sarpras — Final Handoff untuk Pak Taufik

## Arsitektur final

```text
React + Vite
    |
    v
Node.js + Express (index.cjs)
    |
    v
PostgreSQL sekolah (database smart_sarpras)

File upload -> Google Drive Apps Script
Auth user -> PostgreSQL app_users + app_sessions
Role admin -> admin_users + admin_user_roles + roles
Reset password -> Backend Node + SMTP
```

Auth tidak menggunakan Supabase Auth.

## Flow pengguna

Semua pengguna wajib mempunyai akun.

```text
/auth
  -> Daftar
     username + nama + email + password
  -> Login dengan username atau email
  -> Halaman utama
```

Pengguna biasa tidak melihat tombol Admin.

Untuk memberi akses admin:

```text
Super Admin
  -> Admin
  -> Kelola Pengguna
  -> cari username akun yang sudah daftar
  -> Ubah Role
  -> pilih role
```

Saat akun tersebut login kembali atau me-refresh aplikasi, tombol **Admin** akan muncul otomatis sesuai role dan permission yang diberikan.

Jika email pengguna sudah tercatat sebagai admin pada database lama, pendaftaran dengan email yang sama akan menghubungkan akun baru tersebut ke role admin lama.

## Menjalankan di PostgreSQL sekolah

1. Salin `env.school.example` menjadi `.env`.
2. Isi `PGPASSWORD` dan secret lain hanya di server/lokal.
3. Pastikan PostgreSQL aktif dan database `smart_sarpras` tersedia.
4. Jalankan:

```bash
npm install
npm run migrate:local-auth
npm run check
npm run server
```

Frontend:

```bash
npm run dev
```

## Endpoint auth

```text
POST /api/auth/register
POST /api/auth/login
GET  /api/auth/session
POST /api/auth/logout
POST /api/auth/forgot-password
POST /api/auth/reset-password
```

## Migrasi auth

File:

```text
migrations/20260922_local_auth_password_reset.sql
```

Migration bersifat idempotent dan akan:

- membuat `app_users` jika belum ada;
- menambahkan kolom `username`;
- membuat unique index username dan email;
- membuat `app_sessions`;
- membuat token reset password di schema `private`;
- menghubungkan akun terdaftar dengan data admin lama berdasarkan email bila ada;
- mencabut session lama ketika migration pertama dijalankan.

## Keamanan

- Password tidak disimpan plaintext.
- Password di-hash dengan `scrypt`.
- Session memakai token acak dan database hanya menyimpan hash token.
- Role admin ditentukan backend/database, bukan dari frontend.
- Pengguna biasa tidak bisa membuka route admin hanya dengan memunculkan tombol secara manual.
- Jangan commit `.env`, password PostgreSQL, SMTP password, atau token Google Apps Script.

## Status handoff

Source final ada di branch `main`.

Target production:
`https://sarpras.smkn1-cmi.sch.id`

Database:
`smart_sarpras`
