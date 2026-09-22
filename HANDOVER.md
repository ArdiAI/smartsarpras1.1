# HANDOVER SMART SARPRAS

Dokumen ini dibuat supaya sistem tetap dapat dipakai setelah pergantian pengurus, termasuk oleh pengurus yang tidak memiliki latar belakang web/programming.

## 1. Pembagian tanggung jawab

### Sarpras 52 / operator
Fokus pada penggunaan panel Admin:
- mengelola agenda;
- memproses peminjaman;
- mengelola inventaris/fasilitas sesuai permission;
- melihat laporan dan aspirasi;
- menjalankan System Testing bila ada masalah;
- melaporkan error ke technical owner.

Operator tidak perlu mengedit source code, database, secret, DNS, atau server.

### Super Admin
Fokus pada:
- user, role, dan permission;
- konfigurasi sistem;
- workflow;
- show/hide fitur publik;
- Activity Logs;
- System Testing;
- backup operasional.

### Technical owner sekolah
Disarankan: Pak Taufik atau pihak sekolah yang ditunjuk.

Technical owner memegang:
- akses repository GitHub;
- akses PostgreSQL sekolah dan backup database;
- server production;
- domain/DNS;
- environment variables production;
- Google Drive dan Apps Script;
- recovery dan restore database.

Jangan menjadikan satu siswa sebagai satu-satunya pemilik akses teknis.

## 2. Pemeriksaan rutin operator

Minimal seminggu sekali:
1. Login Admin.
2. Buka System Testing.
3. Jalankan seluruh test.
4. Pastikan tidak ada FAIL.
5. Periksa Activity Logs untuk aktivitas tidak wajar.
6. Pastikan pengajuan yang menunggu persetujuan tidak tertinggal.

Jika ada FAIL, catat:
- nama test;
- pesan error;
- tanggal/jam;
- screenshot;
- halaman yang bermasalah.

Kirim informasi tersebut ke technical owner. Jangan mengubah database atau source code jika tidak memahami dampaknya.

## 3. Jika website bermasalah

Urutan pengecekan:
1. Coba refresh dan login ulang.
2. Coba dari browser/perangkat lain.
3. Buka System Testing.
4. Jika seluruh API gagal, technical owner mengecek backend/server.
5. Jika login gagal tetapi backend sehat, cek auth lokal PostgreSQL (`app_users`/`app_sessions`) dan konfigurasi SMTP bila masalahnya reset password.
6. Jika data gagal dimuat, cek PostgreSQL dan backend Node.
7. Jika upload gagal, cek Google Drive Apps Script.
8. Jika hanya satu fitur gagal, catat endpoint/error dari browser console dan serahkan ke technical owner.

## 4. Sebelum pergantian pengurus

Technical owner wajib memastikan:
- minimal dua akun sekolah memiliki akses administrasi yang diperlukan;
- repository tidak hanya dimiliki akun pribadi siswa;
- PostgreSQL sekolah dan backup dapat diakses technical owner;
- folder Drive/Apps Script dapat diakses pihak sekolah;
- domain dan server memiliki dokumentasi credential recovery;
- backup database terbaru sudah dibuat;
- restore pernah diuji pada database non-production;
- seluruh secret lama yang pernah terpublikasi sudah dirotasi;
- System Testing lulus;
- `npm run check` lulus pada source release terakhir.

## 5. Hal yang tidak boleh dilakukan operator

- Jangan mengirim isi `.env` ke chat/grup.
- Jangan mengubah `PGPASSWORD`, token Apps Script, SMTP password, atau secret lain tanpa technical owner.
- Jangan menjalankan restore ke database production tanpa backup dan persetujuan technical owner.
- Jangan menjalankan SQL DELETE/UPDATE massal untuk memperbaiki tampilan.
- Jangan force-push branch `main`.
- Jangan menghapus folder Google Drive aplikasi hanya karena record database sudah dihapus.

## 6. Kontinuitas tahunan

Saat pergantian Sarpras:
1. Tambahkan akun pengurus baru.
2. Berikan role minimum yang dibutuhkan.
3. Cabut/nonaktifkan akun pengurus lama yang tidak lagi membutuhkan akses.
4. Jangan berbagi satu password Super Admin untuk satu divisi.
5. Review workflow approval dan approver email.
6. Jalankan System Testing.
7. Buat backup.
8. Catat nama technical owner aktif.

## 7. Dokumen teknis

- `README.md`: gambaran project.
- `DEPLOYMENT.md`: deploy/restart/rollback.
- `MIGRATION_STATUS.md`: arsitektur dan status migrasi.
- `.env.example`: daftar environment variable tanpa secret.
- `FINAL_RELEASE_CHECKLIST.md`: checklist sebelum final release.
