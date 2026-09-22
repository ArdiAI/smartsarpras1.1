# FINAL RELEASE CHECKLIST

Gunakan checklist ini sebelum release yang akan diserahkan ke pengurus berikutnya.

## Source
- [ ] `git status` bersih.
- [ ] Branch production adalah `main`.
- [ ] `npm ci` berhasil.
- [ ] `npm run check` berhasil.
- [ ] GitHub Actions pada commit release hijau.
- [ ] Tidak ada `.env`, password, token, atau private key di commit terbaru.

## Security
- [ ] Secret lama yang pernah terpublikasi sudah dirotasi.
- [ ] Password auth lokal hanya disimpan sebagai hash `scrypt` dan reset password SMTP sudah dites.
- [ ] Endpoint write publik membutuhkan session login.
- [ ] Rate limit aktif untuk submission/upload.
- [ ] HTTPS aktif untuk frontend dan backend.
- [ ] PostgreSQL production memakai konfigurasi SSL yang benar.
- [ ] Hanya role yang diperlukan yang mendapat akses admin/superadmin.

## Data
- [ ] Backup PostgreSQL terbaru tersedia.
- [ ] Backup tersimpan di lokasi terpisah dari server production.
- [ ] Restore pernah diuji pada database non-production.
- [ ] Folder Google Drive aplikasi dapat diakses technical owner sekolah.

## Ownership
- [ ] Pak Taufik/technical owner memiliki akses GitHub.
- [ ] Technical owner memiliki akses PostgreSQL sekolah dan backup database.
- [ ] Technical owner memiliki akses server/domain.
- [ ] Technical owner memiliki akses Drive/Apps Script.
- [ ] Tidak ada layanan kritis yang hanya bisa diakses akun pribadi pengurus lama.

## Functional test
- [ ] Login/logout.
- [ ] Inventaris/fasilitas.
- [ ] Agenda satu hari dan multi-hari.
- [ ] Timeline publik menjaga privasi.
- [ ] Laporan wajib foto.
- [ ] Export Excel.
- [ ] Peminjaman show/hide global.
- [ ] Workflow approval.
- [ ] Activity Logs.
- [ ] Upload Drive.
- [ ] Email notification.
- [ ] System Testing: tidak ada FAIL.

## Handover
- [ ] Sarpras 52 mendapat akun operator sendiri.
- [ ] Role Sarpras 52 memakai prinsip minimum access.
- [ ] Pengurus baru tahu lokasi System Testing dan Activity Logs.
- [ ] `HANDOVER.md` dibaca bersama technical owner.
- [ ] `DEPLOYMENT.md` dapat diakses technical owner.
- [ ] Commit final diberi tag/release yang mudah dikenali.
