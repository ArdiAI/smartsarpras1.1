# Snapshot Acuan Data Terbaru

Diperiksa pada 22 September 2026 dari database operasional aktif yang menjadi sumber migrasi.

## Jumlah baris sumber

| Tabel | Baris |
|---|---:|
| about_settings | 5 |
| admin_user_roles | 7 |
| admin_users | 7 |
| agenda_attachments | 21 |
| agendas | 1059 |
| announcements | 2 |
| app_sessions | 0 |
| app_users | 7 |
| approval_history | 0 |
| approval_workflows | 2 |
| aspirasi | 1 |
| borrowing_guide_steps | 0 |
| borrowing_items | 0 |
| borrowings | 0 |
| categories | 6 |
| damage_reports | 8 |
| facilities | 10 |
| facility_managers | 0 |
| inventory | 9 |
| kavling | 723 |
| master_ekstrakurikuler | 34 |
| master_kelas | 65 |
| notification_queue | 1003 |
| organizations | 0 |
| permissions | 56 |
| proposals | 1 |
| role_approver_emails | 0 |
| role_permissions | 215 |
| roles | 13 |
| system_activity_logs | 518 |
| system_banners | 2 |
| system_config | 28 |
| system_settings | 4 |
| team_members | 13 |
| workflow_steps | 18 |
| workflow_templates | 5 |

## Aktivitas terbaru pada tabel utama

| Tabel | Baris | Penulisan terbaru |
|---|---:|---|
| kavling | 723 | 2026-09-20 12:40:32 UTC |
| agendas | 1059 | 2026-09-18 13:42:42 UTC |
| system_activity_logs | 518 | 2026-09-18 08:59:23 UTC |
| inventory | 9 | 2026-08-26 06:48:48 UTC |
| facilities | 10 | 2026-08-24 16:38:45 UTC |

## Aturan mirror

- Semua tabel operasional/public disalin ke PostgreSQL sekolah.
- `app_users` dan `app_sessions` tidak ditimpa, karena auth lokal sekolah sekarang menjadi sumber akun/login.
- `admin_users` dan mapping role tetap disalin, tetapi `user_id` dikosongkan agar akun lokal dapat tertaut ulang berdasarkan email.
- `notification_queue` ikut disalin untuk kelengkapan data, tetapi `processed` diubah menjadi `true` pada tujuan supaya 1003 event lama tidak diproses ulang.
- Setiap tabel diverifikasi dengan jumlah baris dan SHA-256 checksum sebelum transaction di-commit.
