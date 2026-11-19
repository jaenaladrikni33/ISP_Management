<div align="center">

# ISP Management Billing

**Aplikasi manajemen pelanggan, tagihan, pembayaran, dan keuangan untuk ISP.**

Menggunakan React dan Vite pada sisi frontend, dengan API PHP dan database MySQL/MariaDB.
Didesain untuk berjalan lokal melalui Laragon atau dihosting pada server Apache.

[![React](https://img.shields.io/badge/React-18-149eca?logo=react&logoColor=white)](https://react.dev/)
[![Vite](https://img.shields.io/badge/Vite-8-646cff?logo=vite&logoColor=white)](https://vite.dev/)
[![PHP](https://img.shields.io/badge/PHP-8.1%2B-777bb4?logo=php&logoColor=white)](https://www.php.net/)
[![MySQL](https://img.shields.io/badge/MySQL%2FMariaDB-Compatible-4479a1?logo=mysql&logoColor=white)](https://www.mysql.com/)

</div>

---

## Daftar Isi

- [Tentang aplikasi](#tentang-aplikasi)
- [Fitur utama](#fitur-utama)
- [Teknologi](#teknologi)
- [Persyaratan](#persyaratan)
- [Menjalankan secara lokal](#menjalankan-secara-lokal)
- [Build dan deployment](#build-dan-deployment)
- [Keamanan dan catatan penting](#keamanan-dan-catatan-penting)
- [Perintah proyek](#perintah-proyek)

## Tentang aplikasi

ISP Management Billing membantu operasional ISP dalam mengelola pelanggan dan administrasi tagihan. Frontend React dilayani oleh Apache, sedangkan backend PHP berkomunikasi dengan database MySQL/MariaDB. Untuk pengembangan, Vite meneruskan permintaan API ke virtual host Laragon.

## Fitur utama

- **Operasional pelanggan** — data pelanggan, paket, dan detail pelanggan.
- **Tagihan dan pembayaran** — pengelolaan tagihan, pembayaran, serta rapel.
- **Keuangan dan laporan** — ringkasan keuangan, setoran/pembayaran CV, rekening, laporan teknisi, dan laporan tahunan.
- **Administrasi aplikasi** — pengaturan identitas perusahaan, impor/ekspor data, dan pengelolaan pengguna serta peran.
- **Akses akun** — login, pendaftaran akun pertama, dan alur reset kata sandi.

## Teknologi

| Bagian | Teknologi |
| --- | --- |
| Frontend | React 18, Vite, Tailwind CSS |
| Backend | PHP 8.1+ |
| Database | MySQL atau MariaDB |
| Web server | Apache dengan `mod_rewrite` |

## Persyaratan

- Laragon atau server Apache dengan PHP **8.1+**.
- Ekstensi PHP `pdo_mysql` dan `fileinfo`.
- MySQL/MariaDB.
- Apache `mod_rewrite` dan dukungan `.htaccess`.
- Node.js **20.19+** atau **22.12+**, serta npm.

## Menjalankan secara lokal

### 1. Siapkan database dan konfigurasi

1. Jalankan Apache dan MySQL dari Laragon.
2. Buka phpMyAdmin, lalu impor [`database/schema.sql`](./database/schema.sql). Skema ini membuat database `ISP_Management` dan tabel yang diperlukan.
3. Salin [`public/api/config.example.php`](./public/api/config.example.php) ke folder utama proyek dengan nama `config.local.php`.
4. Sesuaikan pengaturan database dan `app_url` di `config.local.php`. Nilai contoh menggunakan konfigurasi Laragon bawaan (`root` tanpa kata sandi) dan URL `http://ISP_Management.test`.

> Pastikan `config.local.php` tetap privat. File ini berisi kredensial database dan tidak boleh dimasukkan ke Git.

### 2. Instal dependensi dan jalankan aplikasi

```powershell
npm install
npm run dev
```

Vite menggunakan `http://ISP_Management.test` sebagai target proxy API bawaan. Jika virtual host Laragon Anda berbeda, atur target API sebelum menjalankan Vite:

```powershell
$env:LARAGON_API_TARGET = "http://your-site.test"
npm run dev
```

Buka alamat Vite yang ditampilkan di terminal, biasanya `http://localhost:5173`.

## Build dan deployment

### Build lokal

```powershell
npm run build
```

Hasil build tersedia di folder `dist`. Pada instalasi Laragon, aturan `.htaccess` proyek mengarahkan aplikasi ke file hasil build tersebut.

### Hosting Apache

1. Siapkan hosting yang memenuhi [persyaratan](#persyaratan), lalu buat database dan impor `database/schema.sql`.
2. Buat akun administrator pertama saat situs masih privat atau akses publik dibatasi.
3. Unggah **isi** folder `dist` ke document root domain; jangan unggah seluruh repositori sebagai situs publik.
4. Salin folder `public/api` ke document root dengan nama `api`, lalu salin `public/.htaccess` sebagai `.htaccess` di document root. File ini mengarahkan route aplikasi ke frontend dan `/api` ke backend PHP.
5. Salin `api/config.example.php` menjadi `config.local.php` di document root. Isi kredensial produksi serta URL HTTPS situs.
6. Pastikan HTTPS aktif dan Apache mengizinkan aturan rewrite serta `.htaccess`.

## Keamanan dan catatan penting

- Pendaftaran pertama menjadi administrator; pendaftaran mandiri untuk umum akan ditutup setelah akun pertama dibuat. Buat akun tersebut saat situs belum terbuka untuk publik.
- Administrator dapat membuat akun tambahan melalui menu **Pengguna**. Kata sandi awal yang dibuat hanya ditampilkan satu kali.
- Jangan publikasikan `config.local.php` atau kredensial database.
- Database baru kosong; data dari layanan atau sistem lain tidak dipindahkan otomatis.
- Reset kata sandi melalui email membutuhkan konfigurasi PHP `mail()` dari penyedia hosting.
- Login Google, SMS, dan autentikasi dua faktor tidak tersedia pada backend lokal ini.

## Perintah proyek

| Perintah | Kegunaan |
| --- | --- |
| `npm run dev` | Menjalankan server pengembangan Vite |
| `npm run lint` | Menjalankan ESLint |
| `npm run typecheck` | Memeriksa tipe dan konfigurasi JavaScript dengan TypeScript |
| `npm run build` | Membuat build produksi di folder `dist` |
| `npm run preview` | Meninjau build produksi secara lokal |

---

<div align="center">

Dibangun untuk membantu operasional dan administrasi ISP.

</div>
