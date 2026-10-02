# Sistem Perpustakaan Umum Kota Parepare

Sistem Informasi & Manajemen Perpustakaan Modern untuk **Perpustakaan Umum Kota Parepare**, dilengkapi fitur Pemesanan Buku Meja (QR Kiosk), Dashboard Staf Real-time dengan Pemanggil Suara Bahasa Indonesia (TTS), Reservasi Meja Belajar, dan Layanan Lost & Found.

---

## ✨ Fitur Unggulan
1. **Kios Pemesanan Meja (QR System)**
   - Pindai QR di meja belajar dan pesan hingga 3 buku sekaligus.
   - Tiket Digital Antrean dengan kode tiket unik (contoh: `TKT-4819`) & status interaktif 4 tahap.
   - Kunci layar antrean agar pengunjung tertib dan menunggu panggilan.
2. **Katalog 261 Koleksi Inventaris Nyata**
   - Koleksi buku lengkap klasifikasi DDC 813 (Sastra & Novel).
   - Dilengkapi posisi rak presisi (`Lemari 3, Rak 1 - Rak 5`) untuk mempermudah pencarian fisik staf.
   - Tampilan visual 3D Cover buku realistis.
3. **Dashboard Staf & Pemanggil Suara Otomatis**
   - Pemantauan antrean buku secara *real-time*.
   - Filter status pesanan (*Semua, Perlu Diproses, Siap Diambil, Selesai, Dibatalkan*).
   - Pengumuman Suara Otomatis Bahasa Indonesia (*Chime lonceng ganda + "Perhatian, pesanan untuk Meja X, silakan mengambil bukunya di meja staf"*).
   - Tombol verifikasi kecocokan tiket dan fitur hapus/bersihkan antrean.
4. **Reservasi Meja Belajar & Lost & Found**
   - Pemesanan zona meja belajar (Zona Tenang, Diskusi, PC).
   - Laporan barang hilang dan barang temuan di area perpustakaan.

---

## 🛠️ Persyaratan Sistem
1. **XAMPP** (Modul Apache & MySQL aktif)
2. **Node.js** (Versi 18 ke atas) & npm

---

## 🗄️ Database MySQL (`bibliotech_db`)
File skrip SQL berada di: [`backend/database.sql`](./backend/database.sql)

Tabel yang tersedia:
- `books`: Koleksi 261 buku inventaris beserta lokasi rak dan stok.
- `orders`: Pesanan buku dari meja pengunjung beserta kode tiket digital.
- `table_bookings`: Data pemesanan meja belajar.
- `lost_found`: Data laporan barang hilang & temuan.

---

## 🚀 Cara Menjalankan Aplikasi

### 1. Aktifkan XAMPP
- Buka **XAMPP Control Panel**.
- Klik **Start** pada modul **Apache** dan **MySQL**.

### 2. Konfigurasi Database (Jika Belum Ada)
Buka browser dan buka **phpMyAdmin** ([http://localhost/phpmyadmin](http://localhost/phpmyadmin)):
- Buat database dengan nama `bibliotech_db`.
- Klik tab **Import** -> pilih file `backend/database.sql` -> klik **Go**.
- Atau jalankan seeder koleksi buku:
  ```bash
  cd backend
  node seed_books.js
  ```

### 3. Jalankan Server Backend (API & Audio TTS)
Buka terminal di direktori `backend`:
```bash
cd backend
npm install
node server.js
```
*Server API aktif di: `http://localhost:5000`*

### 4. Jalankan Aplikasi Frontend (React + Vite)
Buka terminal baru di root folder proyek:
```bash
npm install
npm run dev
```
*Aplikasi frontend aktif di: `http://localhost:5173`*

---

## 🏛️ Identitas & Branding
- **Instansi**: Perpustakaan Umum Kota Parepare
- **Logo**: Lambang Resmi Kota Parepare (`Lambang.png`)
