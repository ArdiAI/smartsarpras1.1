# FINAL ACCEPTANCE REPORT — SMART SARPRAS

Tanggal audit: 19 September 2026  
Baseline aplikasi yang diuji: `5329e5cf21325868f80d96a5e01278a838e9c3c7`

> File laporan ini sendiri tidak mengubah behavior runtime aplikasi.

## Ringkasan

Status automated/static/database acceptance: **PASS**

Belum boleh disebut production-final sampai bagian **Manual sebelum deploy final** diselesaikan oleh technical owner karena membutuhkan akses akun/server/credential yang tidak disimpan di repository.

## Hasil acceptance

| No | Area | Status | Hasil |
|---:|---|---|---|
| 1 | GitHub CI | PASS | Workflow `Smart Sarpras CI` pada baseline selesai `success`. |
| 2 | TypeScript / Vite build | PASS | Dijalankan oleh `npm run check` di CI. |
| 3 | Syntax backend | PASS | `index.cjs`, `auth.cjs`, dan `db.cjs` lolos check CI. |
| 4 | Protected write API | PASS | 10/10 endpoint write user memerlukan `requireAuth`. |
| 5 | Protected sensitive read API | PASS | proposal, laporan by email, timeline, rekap memerlukan login; db-summary memerlukan admin. |
| 6 | Public borrowing global flag | PASS | `public_borrowing_enabled=false` saat audit. |
| 7 | Public borrowing route/navbar | PASS | Navbar memakai feature flag dan route `/pinjam` memakai `BorrowingFeatureRoute`. |
| 8 | Timeline public privacy | PASS | Public Timeline tidak merender title, organisasi, atau description dari event. |
| 9 | Agenda date integrity | PASS | 0 agenda invalid; start/end wajib; constraint `end_date >= event_date` aktif. |
| 10 | Agenda multi-day timeline | PASS | Event diperluas ke seluruh tanggal inklusif; month overlap dan count multi-hari diperbaiki. |
| 11 | Damage report photo | PASS | Frontend wajib foto, backend wajib `image_url`, DB constraint aktif untuk data baru. |
| 12 | Borrowing date/time integrity | PASS | Tanggal kembali, jam mulai, jam selesai wajib; DB constraints aktif; 0 data invalid. |
| 13 | Borrowing mixed type protection | PASS | Barang + fasilitas tidak dapat dicampur dalam satu pengajuan. |
| 14 | Facility double booking | PASS | Backend menolak fasilitas yang bentrok dengan request pending/approved. |
| 15 | Inventory overbooking | PASS | Backend menghitung reserved quantity pada jadwal yang overlap sebelum menerima request baru. |
| 16 | Workflow approval | PASS | Tepat 3 workflow aktif: barang, fasilitas, lainnya. Masing-masing 4 step. |
| 17 | Workflow approvers | PASS | Setiap step memiliki role dan minimal 1 admin aktif yang terpasang. |
| 18 | Super Admin audit | PASS | Activity Logs aktif; Super Admin diaudit pada admin routes dan authenticated user routes. |
| 19 | RLS critical tables | PASS | RLS aktif pada inventory, facilities, borrowings, organizations, proposals, admin_users. |
| 20 | Supabase Edge Functions | PASS | Semua Edge Function saat audit memiliki `verify_jwt=true`. |
| 21 | Legacy Edge Functions | PASS | `upload-file`, `migrate-kavling-temp`, dan `get_public_stats` telah dijadikan endpoint legacy 410. |
| 22 | Email Edge Function auth | PASS | `send-borrowing-email` wajib JWT valid; backend meneruskan JWT user/admin aktif. |
| 23 | System Testing email check | PASS | Backend System Testing telah diperbarui agar mengirim JWT ke email Edge Function. |
| 24 | Backup tooling | PASS | `npm run backup:db` tersedia dan menghasilkan PostgreSQL custom dump via `pg_dump`. |
| 25 | Restore guard | PASS | Restore membutuhkan `CONFIRM_RESTORE=YES`. |
| 26 | Handover documentation | PASS | README, HANDOVER, DEPLOYMENT, FINAL_RELEASE_CHECKLIST, MIGRATION_STATUS tersedia. |
| 27 | Runtime smoke-test tooling | PASS | `npm run acceptance` tersedia; bersifat non-destructive. |
| 28 | Security Advisor ERROR | PASS | Tidak ada temuan level ERROR pada Supabase Security Advisor saat audit. |

## Catatan data historis

- Ada laporan kerusakan lama yang dibuat sebelum kebijakan foto wajib. Data historis tersebut tidak diubah atau dipalsukan.
- Constraint foto memakai pendekatan yang mempertahankan record lama tetapi memblokir record baru tanpa foto.
- Pada saat borrowing schedule constraint dipasang, tabel peminjaman tidak memiliki record sehingga aturan dapat dikunci tanpa migrasi data lama.

## Workflow yang diverifikasi

Semua workflow aktif memakai urutan:

1. Pembina OSIS/MPK
2. Wakasek Kesiswaan
3. PJ Sarpras
4. Staff Sarpras

Jumlah user aktif yang tersedia saat audit:
- Pembina OSIS/MPK: minimal 1
- Wakasek Kesiswaan: minimal 2
- PJ Sarpras: minimal 1
- Staff Sarpras: minimal 1

## Security Advisor tersisa

Tidak ada ERROR.

Masih ada:
- INFO: beberapa tabel backend-only memiliki RLS aktif tanpa policy Data API. Ini sesuai desain karena akses aplikasi dilakukan lewat backend Node/PostgreSQL, bukan langsung dari browser.
- WARN: **Leaked Password Protection Supabase Auth masih disabled.**

## Manual sebelum deploy final

Bagian ini belum dapat dilakukan otomatis dari repository karena membutuhkan akses credential/server production.

- [ ] Rotate seluruh secret lama yang pernah masuk Git history, terutama PostgreSQL password dan token sensitif.
- [ ] Aktifkan **Leaked Password Protection** pada Supabase Auth.
- [ ] Pastikan Pak Taufik/technical owner sekolah memiliki akses GitHub, Supabase, server/domain, Drive dan Apps Script.
- [ ] Jalankan `npm run backup:db` dengan environment production dan simpan dump di lokasi terpisah.
- [ ] Uji restore dump pada database non-production.
- [ ] Pastikan production PostgreSQL menggunakan SSL sesuai provider (`PGSSL=true` jika diwajibkan).
- [ ] Pastikan frontend/backend production HTTPS dan `VITE_API_URL` tidak lagi localhost.
- [ ] Jalankan live smoke test setelah backend hidup:

```powershell
npm run acceptance
```

Tanpa token, script menguji health, public feature flag, dan memastikan endpoint terlindungi menghasilkan 401.

Untuk route authenticated, set access token hanya di environment sementara:

```powershell
$env:ACCEPTANCE_ACCESS_TOKEN="<SESSION_TOKEN_SEMENTARA>"
npm run acceptance
Remove-Item Env:ACCEPTANCE_ACCESS_TOKEN
```

Jangan commit atau membagikan token tersebut.

- [ ] Login Super Admin dan jalankan **System Testing → Run All**.
- [ ] Lakukan satu pengujian nyata: agenda, laporan dengan foto, dan bila fitur borrowing diaktifkan satu request peminjaman sampai approval.

## Release decision

**Automated acceptance: PASS.**

**Production final: PENDING MANUAL CHECKS** di atas.

Setelah seluruh manual check selesai dan System Testing tidak memiliki FAIL, release dapat ditandai sebagai final handover kepada Sarpras 52.
