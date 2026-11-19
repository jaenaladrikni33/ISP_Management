# ISP_Management Billing

ISP_Management Billing berjalan menggunakan backend PHP/MySQL lokal melalui Laragon. Frontend dibuat dengan React/Vite; perintah `npm run build` menghasilkan file yang disajikan oleh Apache. Aplikasi ini tidak memerlukan platform aplikasi hosted.

## Persyaratan

- Laragon dengan Apache, PHP 8.1+, MySQL/MariaDB, serta ekstensi PHP `pdo_mysql` dan `fileinfo`.
- Node.js 20.19+ atau 22.12+ dan npm.
- Apache dengan `mod_rewrite` dan dukungan `.htaccess`.

## Penyiapan awal di Laragon

1. Jalankan Apache dan MySQL dari Laragon.
2. Di phpMyAdmin, impor [`database/schema.sql`](./database/schema.sql). File ini membuat database `leanet_local` beserta tabel-tabelnya.
3. Salin `public/api/config.example.php` ke folder utama proyek dengan nama `config.local.php`. Untuk pengaturan Laragon bawaan, nilai contoh menggunakan pengguna MySQL `root` tanpa kata sandi.
4. Jika Laragon menggunakan nama virtual host yang berbeda, ubah `app_url` di `config.local.php`. Kemudian, pasang paket yang diperlukan:

   ```powershell
   npm install
   ```

5. Jalankan frontend. Target proxy API bawaan adalah `http://ISP_Management.test`:

   ```powershell
   npm run dev
   ```

   Jika URL virtual host Anda berbeda, atur target terlebih dahulu:

   ```powershell
   $env:LARAGON_API_TARGET = "http://your-site.test"
   npm run dev
   ```

6. Buka URL Vite yang ditampilkan di terminal (biasanya `http://localhost:5173`). Permintaan API akan diteruskan ke virtual host Laragon.

Akun pertama yang didaftarkan akan menjadi administrator, dan pendaftaran mandiri untuk umum akan otomatis ditutup setelah akun tersebut dibuat. Buat admin pertama saat situs masih privat (atau batasi akses publik selama penyiapan). Setelah itu, administrator dapat menambahkan akun melalui menu **User & Peran**; kata sandi awal yang dibuat hanya ditampilkan satu kali.

Nama perusahaan dan logo aplikasi dapat diubah melalui menu **Pengaturan**. Logo menerima JPG, PNG, atau WebP dengan ukuran maksimal 5 MB; nama dan logo akan diperbarui pada sidebar serta identitas tab browser.

## Build dan publikasi

Jalankan `npm run build`. Di Laragon, file `.htaccess` pada folder utama akan menyajikan isi folder `dist` yang dihasilkan, sehingga virtual host proyek yang sudah ada dapat digunakan setelah proses build.

Untuk menggunakan domain pribadi:

1. Gunakan layanan hosting yang mendukung PHP 8.1+, MySQL/MariaDB, `pdo_mysql`, `fileinfo`, dan aturan rewrite Apache.
2. Buat database lalu impor `database/schema.sql`. Untuk mencegah penyiapan admin satu kali terbuka untuk umum, buat admin pertama saat akses situs dibatasi, atau pindahkan database lokal yang sudah disiapkan ke hosting.
3. Unggah **isi** folder `dist` ke document root domain (bukan seluruh repositori kode sumber).
4. Salin `api/config.example.php` ke `config.local.php` di document root domain, lalu masukkan kredensial database produksi dan URL situs yang menggunakan HTTPS.
5. Aktifkan HTTPS sebelum menggunakan aplikasi. Jaga `config.local.php` agar tetap privat; aturan Apache yang disertakan akan menolak akses langsung ke file tersebut.

Database baru dalam keadaan kosong. Data yang tersimpan di layanan sebelumnya tidak dipindahkan secara otomatis. Pengiriman email untuk reset kata sandi memerlukan konfigurasi PHP `mail()` dari penyedia hosting. Login Google, SMS, dan autentikasi dua faktor tidak tersedia pada backend lokal ini.

## Pemeriksaan

```powershell
npm run lint
npm run typecheck
npm run build
```
