const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
// Muat variabel dari backend/.env (opsional, misal GEMINI_API_KEY untuk pembaca sampul AI)
try {
  process.loadEnvFile(path.join(__dirname, '.env'));
} catch {
  // File .env tidak wajib ada
}

const COVERS_DIR = path.join(__dirname, '../public/covers');


const app = express();

// ==========================================
// MIDDLEWARE
// ==========================================
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/original/monograf', express.static(path.join(__dirname, '../original/Monograf')));
app.use('/original/Monograf', express.static(path.join(__dirname, '../original/Monograf')));
app.use('/original', express.static(path.join(__dirname, '../original')));
app.use('/covers', express.static(path.join(__dirname, '../original/Monograf')));
app.use('/covers', express.static(COVERS_DIR));
app.use('/ebooks', express.static(path.join(__dirname, '../public/ebooks')));

// Helper simpan Base64 gambar ke file fisik di folder public/covers
function saveBase64Image(base64Data) {
  if (!base64Data) return null;
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    if (base64Data.startsWith('http') || base64Data.startsWith('/covers/') || base64Data.startsWith('/original/')) {
      return base64Data;
    }
    return null;
  }
  const mime = matches[1].toLowerCase();
  const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpeg';
  const buffer = Buffer.from(matches[2], 'base64');
  const filename = `manual_${Date.now()}_${Math.floor(100 + Math.random() * 900)}.${ext}`;
  const coversDir = path.join(__dirname, '../public/covers');
  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
  }
  fs.writeFileSync(path.join(coversDir, filename), buffer);
  return `/covers/${filename}`;
}

// Helper simpan Base64 foto bukti serah terima ke file fisik di folder public/covers
function saveProofPhotoImage(base64Data, id) {
  if (!base64Data) return null;
  const matches = base64Data.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    if (base64Data.startsWith('http') || base64Data.startsWith('/covers/') || base64Data.startsWith('/original/')) {
      return base64Data;
    }
    return base64Data;
  }
  try {
    const mime = matches[1].toLowerCase();
    const ext = mime.includes('png') ? 'png' : mime.includes('webp') ? 'webp' : 'jpeg';
    const buffer = Buffer.from(matches[2], 'base64');
    const filename = `proof_${id || 'lf'}_${Date.now()}_${Math.floor(100 + Math.random() * 900)}.${ext}`;
    const coversDir = path.join(__dirname, '../public/covers');
    if (!fs.existsSync(coversDir)) {
      fs.mkdirSync(coversDir, { recursive: true });
    }
    fs.writeFileSync(path.join(coversDir, filename), buffer);
    console.log(`📸 Foto bukti serah terima berhasil disimpan ke file fisik: /covers/${filename} (${buffer.length} bytes)`);
    return `/covers/${filename}`;
  } catch (err) {
    console.warn('⚠️ Gagal menyimpan foto bukti ke disk fisik, fallback ke base64:', err.message);
    return base64Data;
  }
}

// ==========================================
// KONFIGURASI DATABASE MYSQL (XAMPP / CUSTOM)
// ==========================================
const DB_HOST = process.env.DB_HOST || 'localhost';
const DB_USER = process.env.DB_USER || 'root';
const DB_PASSWORD = process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : '';
const DB_PORT = process.env.DB_PORT ? parseInt(process.env.DB_PORT) : 3306;
const DB_NAME = process.env.DB_NAME || 'bibliotech_db';

let pool = null;
let isDbConnected = false;
let dbInitError = null;

// Fungsi mandiri untuk auto-connect, auto-create database & auto-create tables
async function initializeDatabase() {
  console.log(`🔌 Menghubungkan ke MySQL di ${DB_HOST}:${DB_PORT} (User: ${DB_USER})...`);

  // 1. Koneksi awal ke host MySQL (tanpa pilih database terlebih dahulu)
  // Ini mencegah error "ER_BAD_DB_ERROR: Unknown database 'bibliotech_db'" jika database belum dibuat di phpMyAdmin
  const initConn = mysql.createConnection({
    host: DB_HOST,
    user: DB_USER,
    password: DB_PASSWORD,
    port: DB_PORT
  });

  initConn.connect((err) => {
    if (err) {
      isDbConnected = false;
      dbInitError = err.message;
      console.error('❌ Gagal terhubung ke MySQL Server:', err.message);
      console.error('💡 Tips: Pastikan modul MySQL di XAMPP Control Panel sudah AKTIF (START / Hijau).');
      return;
    }

    console.log('✅ Terhubung ke MySQL Server.');

    // 2. Buat database bibliotech_db otomatis jika belum ada
    initConn.query(
      `CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;`,
      (errDb) => {
        initConn.end(); // Tutup koneksi awal

        if (errDb) {
          isDbConnected = false;
          dbInitError = errDb.message;
          console.error(`❌ Gagal membuat / memverifikasi database '${DB_NAME}':`, errDb.message);
          return;
        }

        console.log(`✅ Database '${DB_NAME}' siap digunakan.`);

        // 3. Buat Connection Pool ke database bibliotech_db
        pool = mysql.createPool({
          host: DB_HOST,
          user: DB_USER,
          password: DB_PASSWORD,
          port: DB_PORT,
          database: DB_NAME,
          waitForConnections: true,
          connectionLimit: 15,
          queueLimit: 0,
          enableKeepAlive: true,
          keepAliveInitialDelay: 10000
        });

        pool.on('error', (poolErr) => {
          console.error('⚠️ Peringatan MySQL Pool:', poolErr.message);
          if (poolErr.code === 'PROTOCOL_CONNECTION_LOST') {
            console.log('🔄 Koneksi MySQL terputus, mencoba menyambung kembali...');
          }
        });

        // 4. Verifikasi dan migrasi semua tabel secara otomatis
        pool.getConnection((poolConnErr, connection) => {
          if (poolConnErr) {
            isDbConnected = false;
            dbInitError = poolConnErr.message;
            console.error('❌ Gagal mendapatkan koneksi dari pool:', poolConnErr.message);
            return;
          }

          isDbConnected = true;
          dbInitError = null;
          console.log(`✅ Koneksi Pool ke database '${DB_NAME}' aktif & stabil!`);
          connection.release();

          // Jalankan migrasi seluruh tabel
          setupAllTables();
        });
      }
    );
  });
}

// ==========================================
// SETUP & MIGRASI SEMUA TABEL
// ==========================================
function setupAllTables() {
  if (!pool) return;

  // 1. Tabel Books
  pool.query(`
    CREATE TABLE IF NOT EXISTS books (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(500) NOT NULL,
      author VARCHAR(500) NOT NULL,
      classification VARCHAR(50) DEFAULT '813',
      category VARCHAR(100) DEFAULT 'Novel',
      shelf_location VARCHAR(100) DEFAULT 'Lemari 3, Rak 1',
      stock INT DEFAULT 1,
      rating DECIMAL(3,1) DEFAULT 4.5,
      rating_count INT DEFAULT 5,
      read_count INT DEFAULT 12,
      cover_url VARCHAR(500) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `, () => {
    // Cek jika kosong isi sampel
    pool.query('SELECT COUNT(*) as count FROM books', (err, rows) => {
      if (!err && rows && rows[0].count === 0) {
        const seedBooks = [
          ['The Design of Everyday Things', 'Don Norman', 'Design', '813', 'Lemari 3, Rak 1', 3, 4.8, 12, 45, '/covers/1.jpg'],
          ['Clean Code', 'Robert C. Martin', 'Programming', '005', 'Lemari 2, Rak 4', 2, 4.9, 20, 89, '/covers/10.jpeg'],
          ['Sapiens: A Brief History of Humankind', 'Yuval Noah Harari', 'History', '900', 'Lemari 1, Rak 2', 4, 4.7, 15, 62, '/covers/100.jpeg'],
          ['Atomic Habits', 'James Clear', 'Self Improvement', '158', 'Lemari 3, Rak 3', 5, 4.9, 30, 110, '/covers/1000.jpeg'],
          ['Refactoring: Improving the Design of Existing Code', 'Martin Fowler', 'Programming', '005', 'Lemari 2, Rak 4', 2, 4.8, 8, 34, '/covers/1001.jpeg'],
          ['Thinking, Fast and Slow', 'Daniel Kahneman', 'Psychology', '150', 'Lemari 1, Rak 5', 3, 4.6, 14, 50, '/covers/1002.jpeg']
        ];
        seedBooks.forEach(b => {
          pool.query(
            'INSERT INTO books (title, author, category, classification, shelf_location, stock, rating, rating_count, read_count, cover_url) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
            b
          );
        });
        console.log('🌱 Data awal tabel books berhasil diisi.');
      }
    });
  });

  // 2. Tabel Book Ratings
  pool.query(`
    CREATE TABLE IF NOT EXISTS book_ratings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      book_id INT NOT NULL,
      rating INT NOT NULL,
      review_text TEXT NULL,
      table_no VARCHAR(100) NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_book (book_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 3. Tabel Orders (Pemesanan Pinjam Buku via Meja)
  pool.query(`
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ticket_code VARCHAR(50) NOT NULL,
      book_title TEXT NOT NULL,
      table_no VARCHAR(100) NOT NULL,
      status ENUM('pending', 'searching', 'ready', 'completed', 'cancelled') DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `, () => {
    // Pastikan kolom book_title bertipe TEXT agar judul buku panjang / banyak buku tidak overflow (ER_DATA_TOO_LONG)
    pool.query('ALTER TABLE orders MODIFY COLUMN book_title TEXT NOT NULL', () => {});
    pool.query('ALTER TABLE orders MODIFY COLUMN ticket_code VARCHAR(50) NOT NULL', () => {});
    pool.query('ALTER TABLE orders MODIFY COLUMN table_no VARCHAR(100) NOT NULL', () => {});
    pool.query('ALTER TABLE orders ADD COLUMN call_count INT DEFAULT 0', () => {});
    pool.query('ALTER TABLE orders ADD COLUMN last_called_at DATETIME NULL', () => {});
    pool.query('ALTER TABLE orders ADD COLUMN visitor_last_seen DATETIME NULL', () => {});
  });


  // 4. Tabel Status Meja & Real-Time Occupancy (library_tables)
  pool.query(`
    CREATE TABLE IF NOT EXISTS library_tables (
      id INT AUTO_INCREMENT PRIMARY KEY,
      table_number VARCHAR(50) NOT NULL UNIQUE,
      zone VARCHAR(100) NOT NULL DEFAULT 'Zona Baca Utama',
      capacity INT DEFAULT 4,
      status ENUM('available', 'occupied', 'reserved', 'maintenance') DEFAULT 'available',
      current_user_name VARCHAR(255) NULL,
      occupied_at DATETIME NULL,
      expected_checkout DATETIME NULL,
      session_token VARCHAR(100) NULL,
      pos_x INT DEFAULT 0,
      pos_y INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `, () => {
    // Seed data meja jika kosong
    pool.query('SELECT COUNT(*) as count FROM library_tables', (err, rows) => {
      if (!err && rows && rows[0].count === 0) {
        const defaultTables = [
          ['Meja 01', 'Zona Baca Utama', 4, 'available', 1, 1],
          ['Meja 02', 'Zona Baca Utama', 4, 'occupied', 1, 2],
          ['Meja 03', 'Zona Baca Utama', 4, 'available', 1, 3],
          ['Meja 04', 'Zona Baca Utama', 4, 'occupied', 1, 4],
          ['Meja 05', 'Zona Baca Utama', 4, 'available', 2, 1],
          ['Meja 06', 'Zona Baca Utama', 4, 'available', 2, 2],
          ['Meja 07', 'Zona Komputer & Riset', 2, 'occupied', 2, 3],
          ['Meja 08', 'Zona Komputer & Riset', 2, 'available', 2, 4],
          ['Meja 09', 'Zona Komputer & Riset', 2, 'available', 3, 1],
          ['Meja 10', 'Zona Komputer & Riset', 2, 'occupied', 3, 2],
          ['Meja 11', 'Zona Baca Tenang', 4, 'available', 3, 3],
          ['Meja 12', 'Zona Baca Tenang', 4, 'occupied', 3, 4],
          ['Meja 13', 'Zona Baca Tenang', 4, 'available', 4, 1],
          ['Meja 14', 'Zona Baca Tenang', 4, 'available', 4, 2],
          ['Meja 15', 'Bilik Diskusi', 6, 'reserved', 4, 3],
          ['Meja 16', 'Bilik Diskusi', 6, 'available', 4, 4]
        ];
        defaultTables.forEach(t => {
          pool.query(
            'INSERT INTO library_tables (table_number, zone, capacity, status, pos_x, pos_y, occupied_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
            [t[0], t[1], t[2], t[3], t[4], t[5], t[3] === 'occupied' ? new Date() : null]
          );
        });
        console.log('🏛️ Data awal 16 meja perpustakaan berhasil diisi.');
      }
    });
  });

  // 5. Tabel Table Bookings (Reservasi Meja)
  pool.query(`
    CREATE TABLE IF NOT EXISTS table_bookings (
      id INT AUTO_INCREMENT PRIMARY KEY,
      table_number VARCHAR(50) NOT NULL,
      booking_date DATE NOT NULL,
      start_time TIME NOT NULL,
      end_time TIME NOT NULL,
      status ENUM('booked', 'occupied', 'completed', 'cancelled') DEFAULT 'booked',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 6. Inisialisasi tabel lost_found, kolom ekstra, & log pembaca ebook
  initLostFoundTable();
  initBooksExtraColumns();
  initEbookReadsTable();
}

// Tambah kolom penerbit & tahun terbit pada tabel books (untuk fitur import massal)
function initBooksExtraColumns() {
  const alterQueries = [
    "ALTER TABLE books ADD COLUMN IF NOT EXISTS publisher VARCHAR(255) NULL",
    "ALTER TABLE books ADD COLUMN IF NOT EXISTS publish_year VARCHAR(10) NULL"
  ];
  alterQueries.forEach(q => pool.query(q, (err) => {
    if (err) console.warn('⚠️ Gagal menambah kolom books:', err.message);
  }));
}

// Inisialisasi tabel lost_found & kolom bukti foto
function initLostFoundTable() {
  pool.query(`
    CREATE TABLE IF NOT EXISTS lost_found (
      id INT AUTO_INCREMENT PRIMARY KEY,
      item_name VARCHAR(500) NOT NULL,
      type ENUM('found', 'lost') NOT NULL DEFAULT 'found',
      location VARCHAR(500) NOT NULL,
      description TEXT NULL,
      report_date DATE NOT NULL,
      status VARCHAR(50) DEFAULT 'unclaimed',
      claimed_by VARCHAR(255) NULL,
      claimed_at DATETIME NULL,
      proof_photo LONGTEXT NULL,
      staff_notes VARCHAR(500) NULL,
      contact VARCHAR(100) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `, () => {
    // Normalisasi data status kosong atau NULL menjadi 'unclaimed'
    pool.query("UPDATE lost_found SET status = 'unclaimed' WHERE status IS NULL OR status = ''", () => {});

    // Cek jika tabel kosong, masukkan sampel
    pool.query("SELECT COUNT(*) as count FROM lost_found WHERE type = 'found'", (err, rows) => {
      if (!err && rows && rows[0].count === 0) {
        const samples = [
          ['Cas HP Samsung Type-C Hitam', 'found', 'Meja 4 (Lantai 1)', 'Tertinggal di colokan bawah meja setelah jam baca siang. Tersimpan aman di meja staf.', 'unclaimed'],
          ['Tumbler Stainless Biru Dongker', 'found', 'Meja 12 (Zona Baca Tenang)', 'Tertinggal di sudut meja dekat rak majalah. Berisi air minum setengah.', 'unclaimed'],
          ['Kacamata Baca Frame Hitam', 'found', 'Area Lemari 3 (Sastra)', 'Ditemukan di dekat rak 2 novel fiksi.', 'unclaimed']
        ];
        samples.forEach(s => {
          pool.query(
            'INSERT INTO lost_found (item_name, type, location, description, status, report_date) VALUES (?, ?, ?, ?, ?, CURDATE())',
            s
          );
        });
      }
    });
  });
}

// Inisialisasi tabel log pembaca e-book & data sampel rekapitulasi
let memoryEbookReads = [];

function initEbookReadsTable() {
  pool.query(`
    CREATE TABLE IF NOT EXISTS ebook_reads (
      id INT AUTO_INCREMENT PRIMARY KEY,
      ebook_id VARCHAR(100) NOT NULL,
      title VARCHAR(500) NOT NULL,
      category VARCHAR(100) DEFAULT 'Koleksi Umum',
      reader_session VARCHAR(100) NULL,
      read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_read_at (read_at),
      INDEX idx_ebook (ebook_id),
      INDEX idx_category (category)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `, () => {
    pool.query('SELECT COUNT(*) as count FROM ebook_reads', (err, rows) => {
      if (!err && rows && rows[0].count === 0) {
        console.log('🌱 Mengisi data sampel pembaca e-book untuk rekapitulasi staf...');
        const sampleReads = [
          // Hari ini (28 Okt 2026)
          ['1yzQux9HBstAI_mDl0kZxyayM9MH1VZ6L', '099_Burung_Kecil_di_Pegunungan_Besar', 'BACAAN ANAK', '2026-10-28 08:35:10'],
          ['ebk_02', 'Atomic Habits - Perubahan Kecil Hasil Luar Biasa', 'INSPIRASI', '2026-10-28 09:12:45'],
          ['ebk_03', 'Biografi B.J. Habibie : Kisah Pengabdian Teknokrat', 'BIOGRAFI', '2026-10-28 09:50:20'],
          ['ebk_04', 'Negeri 5 Menara - A. Fuadi', 'NOVEL', '2026-10-28 10:15:33'],
          ['ebk_05', 'Tips & Trik Pemrograman Modern', 'TIPS & TRIK', '2026-10-28 10:45:00'],
          ['ebk_06', 'Laskar Pelangi - Andrea Hirata', 'NOVEL', '2026-10-28 11:20:18'],
          ['ebk_07', 'Sapiens : Riwayat Singkat Umat Manusia', 'INSPIRASI', '2026-10-28 13:10:05'],
          ['ebk_08', 'Kisah 25 Nabi dan Rasul untuk Anak', 'BACAAN ANAK', '2026-10-28 14:05:40'],
          ['ebk_04', 'Negeri 5 Menara - A. Fuadi', 'NOVEL', '2026-10-28 14:40:12'],
          ['ebk_02', 'Atomic Habits - Perubahan Kecil Hasil Luar Biasa', 'INSPIRASI', '2026-10-28 15:15:50'],

          // Kemarin & Hari-hari sebelumnya di Oktober 2026
          ['ebk_06', 'Laskar Pelangi - Andrea Hirata', 'NOVEL', '2026-10-27 09:20:00'],
          ['ebk_03', 'Biografi B.J. Habibie : Kisah Pengabdian Teknokrat', 'BIOGRAFI', '2026-10-27 10:30:15'],
          ['ebk_02', 'Atomic Habits - Perubahan Kecil Hasil Luar Biasa', 'INSPIRASI', '2026-10-27 13:45:00'],
          ['ebk_09', 'Filosofi Teras - Henry Manampiring', 'INSPIRASI', '2026-10-26 08:45:10'],
          ['ebk_04', 'Negeri 5 Menara - A. Fuadi', 'NOVEL', '2026-10-26 11:15:00'],
          ['ebk_01', '099_Burung_Kecil_di_Pegunungan_Besar', 'BACAAN ANAK', '2026-10-25 14:20:30'],
          ['ebk_02', 'Atomic Habits - Perubahan Kecil Hasil Luar Biasa', 'INSPIRASI', '2026-10-24 10:10:10'],
          ['ebk_10', 'Bumi Manusia - Pramoedya Ananta Toer', 'NOVEL', '2026-10-24 15:30:00'],
          ['ebk_03', 'Biografi B.J. Habibie : Kisah Pengabdian Teknokrat', 'BIOGRAFI', '2026-10-23 09:40:00'],
          ['ebk_05', 'Tips & Trik Pemrograman Modern', 'TIPS & TRIK', '2026-10-22 11:00:00'],
          ['ebk_06', 'Laskar Pelangi - Andrea Hirata', 'NOVEL', '2026-10-22 14:10:20'],
          ['ebk_02', 'Atomic Habits - Perubahan Kecil Hasil Luar Biasa', 'INSPIRASI', '2026-10-20 10:05:00'],
          ['ebk_07', 'Sapiens : Riwayat Singkat Umat Manusia', 'INSPIRASI', '2026-10-18 13:20:00'],
          ['ebk_04', 'Negeri 5 Menara - A. Fuadi', 'NOVEL', '2026-10-15 09:30:00'],
          ['ebk_01', '099_Burung_Kecil_di_Pegunungan_Besar', 'BACAAN ANAK', '2026-10-12 11:45:00'],
          ['ebk_03', 'Biografi B.J. Habibie : Kisah Pengabdian Teknokrat', 'BIOGRAFI', '2026-10-08 14:00:00'],
          ['ebk_06', 'Laskar Pelangi - Andrea Hirata', 'NOVEL', '2026-10-05 10:20:00'],
          ['ebk_02', 'Atomic Habits - Perubahan Kecil Hasil Luar Biasa', 'INSPIRASI', '2026-10-02 09:15:00'],

          // Bulan-bulan sebelumnya di tahun 2026
          ['ebk_06', 'Laskar Pelangi - Andrea Hirata', 'NOVEL', '2026-09-25 10:00:00'],
          ['ebk_02', 'Atomic Habits - Perubahan Kecil Hasil Luar Biasa', 'INSPIRASI', '2026-09-18 14:30:00'],
          ['ebk_03', 'Biografi B.J. Habibie : Kisah Pengabdian Teknokrat', 'BIOGRAFI', '2026-09-10 11:15:00'],
          ['ebk_04', 'Negeri 5 Menara - A. Fuadi', 'NOVEL', '2026-08-28 09:40:00'],
          ['ebk_01', '099_Burung_Kecil_di_Pegunungan_Besar', 'BACAAN ANAK', '2026-08-15 13:20:00'],
          ['ebk_07', 'Sapiens : Riwayat Singkat Umat Manusia', 'INSPIRASI', '2026-08-04 15:00:00'],
          ['ebk_06', 'Laskar Pelangi - Andrea Hirata', 'NOVEL', '2026-07-20 10:30:00'],
          ['ebk_02', 'Atomic Habits - Perubahan Kecil Hasil Luar Biasa', 'INSPIRASI', '2026-07-11 11:45:00'],
          ['ebk_03', 'Biografi B.J. Habibie : Kisah Pengabdian Teknokrat', 'BIOGRAFI', '2026-06-18 14:15:00'],
          ['ebk_04', 'Negeri 5 Menara - A. Fuadi', 'NOVEL', '2026-05-22 09:10:00'],
          ['ebk_05', 'Tips & Trik Pemrograman Modern', 'TIPS & TRIK', '2026-04-14 13:50:00'],
          ['ebk_02', 'Atomic Habits - Perubahan Kecil Hasil Luar Biasa', 'INSPIRASI', '2026-03-19 10:25:00'],
          ['ebk_06', 'Laskar Pelangi - Andrea Hirata', 'NOVEL', '2026-02-12 11:30:00'],
          ['ebk_03', 'Biografi B.J. Habibie : Kisah Pengabdian Teknokrat', 'BIOGRAFI', '2026-01-20 14:40:00']
        ];

        sampleReads.forEach(s => {
          pool.query(
            'INSERT INTO ebook_reads (ebook_id, title, category, read_at) VALUES (?, ?, ?, ?)',
            s
          );
        });
        console.log(`✅ ${sampleReads.length} log pembaca e-book contoh berhasil diisi.`);
      }
    });
  });
}

// Mulai inisialisasi database
initializeDatabase();

// Middleware helper untuk memastikan koneksi DB siap sebelum memproses query
function checkDb(req, res, next) {
  if (!pool) {
    return res.status(503).json({
      error: 'Database belum terhubung. Pastikan MySQL di XAMPP sudah berjalan (START).',
      detail: dbInitError
    });
  }
  next();
}

// ==========================================
// API ENDPOINTS
// ==========================================

// 1. Root & Health Check
app.get('/', (req, res) => {
  res.json({
    status: isDbConnected ? 'online' : 'database_disconnected',
    message: isDbConnected
      ? 'Backend API BiblioTech Library System berjalan lancar!'
      : 'Backend berjalan, tetapi belum terhubung ke MySQL.',
    database: `${DB_NAME} (MySQL ${DB_HOST}:${DB_PORT})`,
    connected: isDbConnected
  });
});

app.get('/api/health', (req, res) => {
  if (!isDbConnected || !pool) {
    return res.status(503).json({
      status: 'error',
      message: 'Database tidak terhubung',
      database: DB_NAME,
      error: dbInitError
    });
  }
  pool.query('SELECT 1 + 1 AS solution', (err) => {
    if (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }
    res.json({ status: 'healthy', database: DB_NAME, connected: true });
  });
});

// Proxy & Cache Thumbnail E-Book Google Drive (Menghindari 429 Rate Limit Google)
app.get('/api/ebooks/cover/:id', (req, res) => {
  const fileId = req.params.id;
  if (!fileId || !/^[a-zA-Z0-9_-]+$/.test(fileId)) {
    return res.status(400).send('Invalid file ID');
  }

  const localPng = path.join(COVERS_DIR, `${fileId}.png`);
  if (fs.existsSync(localPng)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(localPng);
  }

  const localJpg = path.join(COVERS_DIR, `${fileId}.jpg`);
  if (fs.existsSync(localJpg)) {
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    return res.sendFile(localJpg);
  }

  // Ambil langsung dari Google UserContent tanpa referer dev server
  const https = require('https');
  const googleUrl = `https://lh3.googleusercontent.com/d/${fileId}=w400`;

  https.get(googleUrl, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
    }
  }, (gRes) => {
    if (gRes.statusCode === 200 && gRes.headers['content-type'] && gRes.headers['content-type'].includes('image')) {
      res.setHeader('Content-Type', gRes.headers['content-type']);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      if (!fs.existsSync(COVERS_DIR)) fs.mkdirSync(COVERS_DIR, { recursive: true });
      const fileStream = fs.createWriteStream(localPng);
      gRes.pipe(fileStream);
      gRes.pipe(res);
    } else {
      res.status(gRes.statusCode || 404).send('Cover not found');
    }
  }).on('error', (err) => {
    res.status(500).send(err.message);
  });
});

// ------------------------------------------
// FITUR 1: ORDERS (Pemesanan Pinjam Buku via Meja/QR)
// ------------------------------------------

// Map Kehadiran Real-Time Pengunjung di Web: orderId -> timestamp (ms)
const visitorPresenceMap = new Map();

function markVisitorOnline(orderId) {
  if (!orderId) return;
  const numId = Number(orderId);
  visitorPresenceMap.set(numId, Date.now());
  pool.query('UPDATE orders SET visitor_last_seen = NOW() WHERE id = ?', [numId], () => {});
}

function markVisitorOffline(orderId) {
  if (!orderId) return;
  const numId = Number(orderId);
  visitorPresenceMap.delete(numId);
  pool.query('UPDATE orders SET visitor_last_seen = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE id = ?', [numId], () => {});
}

// Ambil semua data pesanan (dengan status kehadiran pengunjung di web)
app.get('/api/orders', checkDb, (req, res) => {
  const query = 'SELECT * FROM orders ORDER BY created_at DESC';
  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error GET /api/orders:', err);
      return res.status(500).json({ error: 'Gagal mengambil data pesanan', detail: err.message });
    }
    const now = Date.now();
    const enrichedResults = results.map(row => {
      const memLastSeen = visitorPresenceMap.get(row.id) || 0;
      const dbLastSeen = row.visitor_last_seen ? new Date(row.visitor_last_seen).getTime() : 0;
      const effectiveLastSeen = Math.max(memLastSeen, dbLastSeen);
      // Dianggap aktif di web jika ada aktivitas/ping dalam 8 detik terakhir
      const isOnline = (now - effectiveLastSeen) < 8000;
      return {
        ...row,
        visitor_online: isOnline,
        visitor_last_seen_ms: effectiveLastSeen || null
      };
    });
    res.json(enrichedResults);
  });
});

// Buat pesanan baru dari meja pengunjung
app.post('/api/orders', checkDb, (req, res) => {
  let { book_title, table_no, books_list } = req.body;

  // Jika books_list dikirim sebagai array, simpan sebagai JSON array yang aman agar judul berkoma tidak terbelah
  if (Array.isArray(books_list) && books_list.length > 0) {
    const titles = books_list
      .map(b => (typeof b === 'string' ? b.trim() : (b?.title || '')).trim())
      .filter(Boolean);
    book_title = JSON.stringify(titles);
  } else if (Array.isArray(book_title)) {
    book_title = JSON.stringify(book_title);
  }

  if (!book_title || !table_no) {
    return res.status(400).json({ error: 'Judul buku dan nomor meja wajib diisi' });
  }

  // Generate Kode Tiket unik (misal: TKT-4821)
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const ticket_code = `TKT-${randomNum}`;
  const status = 'pending';
  const query = 'INSERT INTO orders (ticket_code, book_title, table_no, status, visitor_last_seen) VALUES (?, ?, ?, ?, NOW())';

  pool.query(query, [ticket_code, book_title, table_no, status], (err, result) => {
    if (err) {
      console.error('Error POST /api/orders:', err);
      return res.status(500).json({ error: 'Gagal membuat pesanan baru', detail: err.message });
    }
    markVisitorOnline(result.insertId);
    res.status(201).json({
      message: 'Pesanan berhasil dibuat!',
      orderId: result.insertId,
      ticket_code: ticket_code,
      order: { id: result.insertId, ticket_code, book_title, table_no, status }
    });
  });
});

// Ambil detail status pesanan tunggal (untuk live tracking tiket di HP pengunjung)
app.get('/api/orders/:id', checkDb, (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM orders WHERE id = ? OR ticket_code = ? LIMIT 1';
  pool.query(query, [id, id], (err, results) => {
    if (err) {
      console.error('Error GET /api/orders/:id:', err);
      return res.status(500).json({ error: 'Gagal mengambil detail pesanan', detail: err.message });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }
    const order = results[0];
    // Pengunjung sedang aktif di web melihat tiketnya
    markVisitorOnline(order.id);
    res.json({
      ...order,
      visitor_online: true
    });
  });
});

// Endpoint Heartbeat / Ping dari Pengunjung yang masih aktif di halaman web
app.post('/api/orders/:id/ping', checkDb, (req, res) => {
  const { id } = req.params;
  markVisitorOnline(id);
  res.json({ ok: true, visitor_online: true });
});

// Endpoint saat Pengunjung Menutup Web / Meninggalkan Halaman (Beacon)
app.post('/api/orders/:id/leave', checkDb, (req, res) => {
  const { id } = req.params;
  markVisitorOffline(id);
  res.json({ ok: true, visitor_online: false });
});

// Update status pesanan (oleh staf perpustakaan)
app.put('/api/orders/:id', checkDb, (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'searching', 'ready', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid' });
  }

  if (status === 'completed' || status === 'cancelled') {
    visitorPresenceMap.delete(Number(id));
  }

  const isReady = status === 'ready';
  const query = isReady
    ? 'UPDATE orders SET status = ?, call_count = COALESCE(call_count, 0) + 1, last_called_at = NOW() WHERE id = ?'
    : 'UPDATE orders SET status = ? WHERE id = ?';

  pool.query(query, isReady ? [status, id] : [status, id], (err, result) => {
    if (err) {
      console.error('Error PUT /api/orders/:id:', err);
      return res.status(500).json({ error: 'Gagal mengupdate status pesanan', detail: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }
    res.json({ message: 'Status pesanan berhasil diperbarui!', id, status });
  });
});

// Endpoint Panggil / Panggil Ulang Pesanan ke HP Pengunjung
app.post('/api/orders/:id/call', checkDb, (req, res) => {
  const { id } = req.params;
  const query = 'UPDATE orders SET call_count = COALESCE(call_count, 0) + 1, last_called_at = NOW() WHERE id = ?';
  pool.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error POST /api/orders/:id/call:', err);
      return res.status(500).json({ error: 'Gagal memanggil pesanan', detail: err.message });
    }
    pool.query('SELECT * FROM orders WHERE id = ?', [id], (err2, rows) => {
      res.json({
        message: 'Pesanan berhasil dipanggil!',
        id,
        order: (rows && rows[0]) || null
      });
    });
  });
});


// Hapus semua pesanan yang sudah selesai atau dibatalkan (Bersihkan riwayat)
app.delete('/api/orders/cleanup/completed', checkDb, (req, res) => {
  const query = "DELETE FROM orders WHERE status = 'completed' OR status = 'cancelled'";
  pool.query(query, (err, result) => {
    if (err) {
      console.error('Error DELETE /api/orders/cleanup/completed:', err);
      return res.status(500).json({ error: 'Gagal membersihkan pesanan', detail: err.message });
    }
    res.json({ message: `Berhasil menghapus ${result.affectedRows} pesanan!`, count: result.affectedRows });
  });
});

// Hapus satu pesanan spesifik berdasarkan ID
app.delete('/api/orders/:id', checkDb, (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM orders WHERE id = ?';
  pool.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error DELETE /api/orders/:id:', err);
      return res.status(500).json({ error: 'Gagal menghapus pesanan', detail: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }
    res.json({ message: 'Pesanan berhasil dihapus!', id });
  });
});

// ------------------------------------------
// FITUR 2: BOOKS (Katalog Buku & Rating)
// ------------------------------------------

// Ambil katalog buku (dioptimalkan hanya mengirim kolom yang dibutuhkan UI agar loading cepat & ringan)
app.get('/api/books', checkDb, (req, res) => {
  const { search, category, limit, offset } = req.query;

  let query = `
    SELECT 
      id, title, author, category, classification, 
      shelf_location, stock, rating, rating_count, read_count, cover_url 
    FROM books
  `;
  const params = [];
  const conditions = [];

  if (category && category !== 'ALL' && category !== 'FAVORITE') {
    conditions.push('category = ?');
    params.push(category);
  }

  if (search && search.trim()) {
    conditions.push('(title LIKE ? OR author LIKE ? OR category LIKE ?)');
    const searchTerm = `%${search.trim()}%`;
    params.push(searchTerm, searchTerm, searchTerm);
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY id ASC';

  if (limit) {
    query += ' LIMIT ?';
    params.push(parseInt(limit));
    if (offset) {
      query += ' OFFSET ?';
      params.push(parseInt(offset));
    }
  }

  pool.query(query, params, (err, results) => {
    if (err) {
      console.error('Error GET /api/books:', err);
      return res.status(500).json({ error: 'Gagal mengambil katalog buku', detail: err.message });
    }
    // Nonaktifkan cache browser agar perubahan data, penambahan, dan penghapusan buku seketika ter-update
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.json(results);
  });
});

// Update / Pasang Sampul Buku (Hanya Sampul Lokal Terverifikasi)
app.put('/api/books/:id/cover', checkDb, async (req, res) => {
  const { id } = req.params;
  const { cover_url } = req.body;

  if (!cover_url) {
    return res.status(400).json({ error: 'Parameter cover_url wajib diisi' });
  }

  try {
    const [result] = await pool.promise().query('UPDATE books SET cover_url = ? WHERE id = ?', [cover_url, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Buku tidak ditemukan' });
    }

    res.json({
      message: 'Sampul buku berhasil dipasang!',
      id: parseInt(id),
      cover_url
    });
  } catch (err) {
    console.error('Error PUT /api/books/:id/cover:', err);
    res.status(500).json({ error: 'Gagal memperbarui sampul buku', detail: err.message });
  }
});

// Tambah Buku Baru oleh Staf (dengan upload sampul Base64)
app.post('/api/books', checkDb, (req, res) => {
  const { title, author, category, classification, shelf_location, stock, cover_url, cover_image } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Judul buku wajib diisi' });
  }
  if (!author || !author.trim()) {
    return res.status(400).json({ error: 'Nama pengarang wajib diisi' });
  }

  let finalCoverUrl = null;
  if (cover_image && typeof cover_image === 'string' && cover_image.startsWith('data:image')) {
    finalCoverUrl = saveBase64Image(cover_image);
  } else if (cover_url && typeof cover_url === 'string' && cover_url.trim()) {
    finalCoverUrl = cover_url.trim();
  }

  const query = `
    INSERT INTO books 
      (title, author, category, classification, shelf_location, stock, cover_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  pool.query(query, [
    title.trim(),
    author.trim(),
    category && category.trim() ? category.trim() : 'Umum',
    classification && classification.trim() ? classification.trim() : '000',
    shelf_location && shelf_location.trim() ? shelf_location.trim() : 'Rak Utama',
    parseInt(stock) || 1,
    finalCoverUrl
  ], (err, result) => {
    if (err) {
      console.error('Error POST /api/books:', err);
      return res.status(500).json({ error: 'Gagal menyimpan buku ke database', detail: err.message });
    }
    res.status(201).json({
      message: 'Buku baru berhasil ditambahkan ke katalog!',
      bookId: result.insertId,
      book: {
        id: result.insertId,
        title: title.trim(),
        author: author.trim(),
        category: category || 'Umum',
        classification: classification || '000',
        shelf_location: shelf_location || 'Rak Utama',
        stock: parseInt(stock) || 1,
        cover_url: finalCoverUrl
      }
    });
  });
});

// Edit / Update Buku oleh Staf
app.put('/api/books/:id', checkDb, (req, res) => {
  const { id } = req.params;
  const { title, author, category, classification, shelf_location, stock, cover_url, cover_image } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Judul buku wajib diisi' });
  }

  let finalCoverUrl = cover_url || null;
  if (cover_image && typeof cover_image === 'string' && cover_image.startsWith('data:image')) {
    finalCoverUrl = saveBase64Image(cover_image);
  }

  const query = `
    UPDATE books 
    SET 
      title = ?,
      author = ?,
      category = ?,
      classification = ?,
      shelf_location = ?,
      stock = ?,
      cover_url = ?
    WHERE id = ?
  `;

  pool.query(query, [
    title.trim(),
    author ? author.trim() : 'Pengarang Tidak Diketahui',
    category || 'Umum',
    classification || '000',
    shelf_location || 'Rak Utama',
    parseInt(stock) || 1,
    finalCoverUrl,
    id
  ], (err, result) => {
    if (err) {
      console.error('Error PUT /api/books/:id:', err);
      return res.status(500).json({ error: 'Gagal memperbarui data buku', detail: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Buku tidak ditemukan' });
    }
    res.json({ message: 'Data buku berhasil diperbarui!', id, cover_url: finalCoverUrl });
  });
});

// Hapus Buku Fisik dari Katalog oleh Staf (Mendukung method DELETE & POST /delete untuk kehandalan proxy/tunnel)
const handleDeleteBookHandler = (req, res) => {
  const id = req.params.id || req.body?.id;
  if (!id) {
    return res.status(400).json({ error: 'ID buku wajib disertakan' });
  }

  console.log(`[DELETE /api/books] Permintaan hapus buku ID: ${id}`);

  // 1. Bersihkan rating & ulasan buku terlebih dahulu jika ada
  pool.query('DELETE FROM book_ratings WHERE book_id = ?', [id], (ratingErr) => {
    if (ratingErr) {
      console.warn(`[DELETE /api/books] Catatan: Rating buku ${id} tidak ada atau gagal dibersihkan:`, ratingErr.message);
    }

    // 2. Hapus data buku dari tabel books
    pool.query('DELETE FROM books WHERE id = ?', [id], (err, result) => {
      if (err) {
        console.error(`[DELETE /api/books] Error menghapus buku ID ${id}:`, err);
        return res.status(500).json({ error: 'Gagal menghapus buku dari database', detail: err.message });
      }

      console.log(`[DELETE /api/books] Hasil hapus ID ${id}: affectedRows = ${result.affectedRows}`);
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: 'Buku tidak ditemukan di database (kemungkinan sudah dihapus sebelumnya)' });
      }

      res.json({ success: true, message: 'Buku berhasil dihapus dari katalog!', id });
    });
  });
};

app.delete('/api/books/:id', checkDb, handleDeleteBookHandler);
app.post('/api/books/:id/delete', checkDb, handleDeleteBookHandler);

// Cari Foto Sampul Otomatis dari Internet (Open Library API)
app.post('/api/books/search-cover', async (req, res) => {
  const { title, author } = req.body;
  if (!title) return res.status(400).json({ error: 'Judul buku wajib diisi' });

  try {
    const q = encodeURIComponent(`${title} ${author || ''}`.trim());
    const searchUrl = `https://openlibrary.org/search.json?q=${q}&limit=5`;
    const response = await fetch(searchUrl, {
      headers: { 'User-Agent': 'LibrarySystem/1.0 (Student Project)' }
    });
    if (!response.ok) throw new Error('Gagal menghubungi OpenLibrary');
    const data = await response.json();

    const candidates = [];
    if (data && data.docs) {
      for (const doc of data.docs) {
        if (doc.cover_i) {
          candidates.push({
            title: doc.title,
            author: doc.author_name ? doc.author_name.join(', ') : '',
            cover_url: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`
          });
          if (candidates.length >= 5) break;
        }
      }
    }
    res.json({ found: candidates.length > 0, candidates });
  } catch (err) {
    console.error('Error search-cover:', err);
    res.status(500).json({ error: 'Gagal mencari sampul buku', detail: err.message });
  }
});

// ------------------------------------------
// FITUR NOTIFIKASI PESANAN MASUK (untuk staff)
// ------------------------------------------
// Ambil pesanan pending terbaru dalam 1 jam terakhir (notifikasi untuk staf)
app.get('/api/notifications', checkDb, (req, res) => {
  const query = `
    SELECT id, ticket_code, book_title, table_no, created_at
    FROM orders 
    WHERE status = 'pending' 
      AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)
    ORDER BY created_at DESC
    LIMIT 20
  `;
  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error GET /api/notifications:', err);
      return res.status(500).json({ error: 'Gagal mengambil notifikasi', detail: err.message });
    }
    res.json(results);
  });
});

// Ambil statistik sampul buku (Lokal Folder, Online ISBN, CSS 3D)
app.get('/api/books/cover-stats', (req, res) => {
  const query = `
    SELECT 
      COUNT(*) as total_books,
      COUNT(cover_url) as with_cover,
      COUNT(CASE WHEN cover_url LIKE '/covers/isbn_%' THEN 1 END) as online_isbn_covers,
      COUNT(CASE WHEN cover_url LIKE '/covers/%' AND cover_url NOT LIKE '/covers/isbn_%' THEN 1 END) as local_folder_covers,
      COUNT(CASE WHEN cover_url IS NULL OR cover_url = '' THEN 1 END) as css_3d_covers
    FROM books
  `;
  pool.query(query, (err, rows) => {
    if (err) {
      console.error('Error GET /api/books/cover-stats:', err);
      return res.status(500).json({ error: 'Gagal mengambil statistik sampul' });
    }
    res.json(rows[0]);
  });
});

// ------------------------------------------
// FITUR 2B: IMPORT MASSAL BUKU (PDF Daftar Judul + PDF Sampul)
// ------------------------------------------

// Cek apakah pembaca sampul AI (Gemini) tersedia
app.get('/api/books/import/ai-status', (req, res) => {
  res.json({
    gemini: Boolean(process.env.GEMINI_API_KEY),
    model: process.env.GEMINI_MODEL || 'gemini-2.5-flash'
  });
});

// Baca teks judul & penulis dari gambar sampul menggunakan Gemini Vision
app.post('/api/books/import/read-cover', async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'GEMINI_API_KEY belum diatur di backend/.env' });
  }

  const { image } = req.body;
  const match = typeof image === 'string' && image.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/);
  if (!match) {
    return res.status(400).json({ error: 'Format gambar sampul tidak valid' });
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  const prompt =
    'Ini adalah foto/gambar sampul depan sebuah buku. Baca tulisan yang tercetak di sampul. ' +
    'Kembalikan JSON dengan format {"title": "...", "author": "...", "other_text": "..."}. ' +
    'title = judul utama buku, author = nama penulis/pengarang, other_text = tulisan lain (penerbit, subjudul). ' +
    'Jika tidak terbaca, isi string kosong. Jangan menebak judul yang tidak tertulis.';

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: match[1], data: match[2] } }
          ]
        }],
        generationConfig: { temperature: 0, responseMimeType: 'application/json' }
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data?.error?.message || `HTTP ${response.status}`);
    }

    const rawText = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '{}';
    let parsed = {};
    try {
      parsed = JSON.parse(rawText);
    } catch {
      parsed = { title: '', author: '', other_text: rawText };
    }

    res.json({
      title: parsed.title || '',
      author: parsed.author || '',
      text: [parsed.title, parsed.author, parsed.other_text].filter(Boolean).join('\n')
    });
  } catch (err) {
    console.error('Error /api/books/import/read-cover:', err.message);
    res.status(502).json({ error: 'Gagal membaca sampul dengan AI: ' + err.message });
  }
});

// Simpan banyak buku sekaligus beserta gambar sampulnya
app.post('/api/books/bulk-import', async (req, res) => {
  const { books } = req.body;
  if (!Array.isArray(books) || books.length === 0) {
    return res.status(400).json({ error: 'Daftar buku kosong' });
  }

  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
  }

  const db = pool.promise();
  const saved = [];
  const failed = [];

  for (let i = 0; i < books.length; i++) {
    const b = books[i] || {};
    const title = String(b.title || '').trim();
    if (!title) {
      failed.push({ index: i, error: 'Judul kosong' });
      continue;
    }

    let coverUrl = null;
    try {
      const imgMatch = typeof b.cover_image === 'string' && b.cover_image.match(/^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/);
      if (imgMatch) {
        const ext = imgMatch[1] === 'jpeg' ? 'jpg' : imgMatch[1];
        const fileName = `upload_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 8)}.${ext}`;
        fs.writeFileSync(path.join(COVERS_DIR, fileName), Buffer.from(imgMatch[2], 'base64'));
        coverUrl = `/covers/${fileName}`;
      }

      const [result] = await db.query(
        `INSERT INTO books (title, author, publisher, publish_year, category, shelf_location, stock, cover_url, rating, rating_count, read_count)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0, 0)`,
        [
          title.slice(0, 500),
          (String(b.author || '').trim() || 'Tidak Diketahui').slice(0, 500),
          String(b.publisher || '').trim() || null,
          String(b.publish_year || '').trim().slice(0, 10) || null,
          String(b.category || '').trim() || 'Koleksi Umum',
          String(b.shelf_location || '').trim() || 'Rak Koleksi Utama',
          Math.max(1, parseInt(b.stock, 10) || 1),
          coverUrl
        ]
      );
      saved.push({ index: i, id: result.insertId, title, cover_url: coverUrl });
    } catch (err) {
      console.error(`Error bulk-import buku "${title}":`, err.message);
      failed.push({ index: i, title, error: err.message });
    }
  }

  res.status(saved.length > 0 ? 201 : 500).json({
    message: `${saved.length} buku berhasil disimpan${failed.length ? `, ${failed.length} gagal` : ''}.`,
    saved,
    failed
  });
});

// Beri rating bintang pada buku (berdasarkan ID buku)
app.post('/api/books/:id/rate', checkDb, (req, res) => {
  const { id } = req.params;
  const { rating, review_text, table_no } = req.body;
  const numRating = parseInt(rating);

  if (!numRating || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Rating harus berupa angka antara 1 sampai 5 bintang' });
  }

  // 1. Simpan ulasan ke tabel book_ratings
  const insertQuery = 'INSERT INTO book_ratings (book_id, rating, review_text, table_no) VALUES (?, ?, ?, ?)';
  pool.query(insertQuery, [id, numRating, review_text || null, table_no || null], (err) => {
    if (err) {
      console.error('Error INSERT book_ratings:', err);
      return res.status(500).json({ error: 'Gagal mencatat rating buku', detail: err.message });
    }

    // 2. Update nilai rata-rata rating secara aman menggunakan COALESCE (mencegah NULL atau NaN)
    const updateQuery = `
      UPDATE books 
      SET 
        rating = ROUND(((COALESCE(rating, 4.5) * COALESCE(rating_count, 0)) + ?) / (COALESCE(rating_count, 0) + 1), 1),
        rating_count = COALESCE(rating_count, 0) + 1,
        read_count = COALESCE(read_count, 0) + 1
      WHERE id = ?
    `;

    pool.query(updateQuery, [numRating, id], (errUpdate) => {
      if (errUpdate) {
        console.error('Error UPDATE books rating:', errUpdate);
        return res.status(500).json({ error: 'Gagal memperbarui kalkulasi rating buku', detail: errUpdate.message });
      }

      // Ambil data buku terbaru setelah di-rate
      pool.query('SELECT id, title, rating, rating_count, read_count FROM books WHERE id = ?', [id], (errGet, rows) => {
        if (errGet || rows.length === 0) {
          return res.json({ message: 'Rating berhasil disimpan!', rating: numRating });
        }
        res.json({
          message: 'Rating berhasil disimpan! Terima kasih atas ulasannya.',
          book: rows[0]
        });
      });
    });
  });
});

// Beri rating berdasarkan judul buku (berguna saat selesai membaca dari tiket pesanan)
app.post('/api/books/rate-by-title', checkDb, (req, res) => {
  const { title, rating, review_text, table_no } = req.body;
  const numRating = parseInt(rating);

  if (!title || !numRating || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Judul buku dan rating valid (1-5) wajib diisi' });
  }

  const cleanTitle = title.trim();
  pool.query('SELECT id FROM books WHERE LOWER(title) = LOWER(?) LIMIT 1', [cleanTitle], (err, rows) => {
    if (err || rows.length === 0) {
      pool.query('SELECT id FROM books WHERE title LIKE ? LIMIT 1', [`%${cleanTitle}%`], (errLike, rowsLike) => {
        if (errLike || rowsLike.length === 0) {
          return res.status(404).json({ error: 'Buku tidak ditemukan di katalog' });
        }
        const bookId = rowsLike[0].id;
        rateBookById(bookId, numRating, review_text, table_no, res);
      });
      return;
    }
    const bookId = rows[0].id;
    rateBookById(bookId, numRating, review_text, table_no, res);
  });
});

// Helper function untuk rate book
function rateBookById(bookId, numRating, review_text, table_no, res) {
  const insertQuery = 'INSERT INTO book_ratings (book_id, rating, review_text, table_no) VALUES (?, ?, ?, ?)';
  pool.query(insertQuery, [bookId, numRating, review_text || null, table_no || null], (err) => {
    if (err) {
      console.error('Error INSERT book_ratings:', err);
      return res.status(500).json({ error: 'Gagal mencatat rating', detail: err.message });
    }

    const updateQuery = `
      UPDATE books 
      SET 
        rating = ROUND(((COALESCE(rating, 4.5) * COALESCE(rating_count, 0)) + ?) / (COALESCE(rating_count, 0) + 1), 1),
        rating_count = COALESCE(rating_count, 0) + 1,
        read_count = COALESCE(read_count, 0) + 1
      WHERE id = ?
    `;

    pool.query(updateQuery, [numRating, bookId], (errUpdate) => {
      if (errUpdate) {
        console.error('Error UPDATE rating:', errUpdate);
        return res.status(500).json({ error: 'Gagal kalkulasi rating', detail: errUpdate.message });
      }

      pool.query('SELECT id, title, rating, rating_count, read_count FROM books WHERE id = ?', [bookId], (errGet, rows) => {
        res.json({
          message: 'Rating berhasil disimpan!',
          book: rows && rows.length > 0 ? rows[0] : null
        });
      });
    });
  });
}

// ------------------------------------------
// FITUR 3: REAL-TIME TABLE OCCUPANCY & STATUS MONITORING
// ------------------------------------------

// Ambil status real-time semua meja beserta statistik kapasitas ruangan
app.get('/api/tables', checkDb, (req, res) => {
  const query = 'SELECT * FROM library_tables ORDER BY id ASC';
  pool.query(query, (err, tables) => {
    if (err) {
      console.error('Error GET /api/tables:', err);
      return res.status(500).json({ error: 'Gagal mengambil data status meja', detail: err.message });
    }

    // Hitung statistik ruangan real-time
    const totalTables = tables.length;
    let totalSeats = 0;
    let occupiedTables = 0;
    let occupiedSeats = 0;
    let availableTables = 0;
    let availableSeats = 0;
    let reservedTables = 0;
    let maintenanceTables = 0;

    tables.forEach(t => {
      const cap = t.capacity || 4;
      totalSeats += cap;
      if (t.status === 'occupied') {
        occupiedTables++;
        occupiedSeats += cap;
      } else if (t.status === 'available') {
        availableTables++;
        availableSeats += cap;
      } else if (t.status === 'reserved') {
        reservedTables++;
      } else if (t.status === 'maintenance') {
        maintenanceTables++;
      }
    });

    const occupancyRate = totalTables > 0 ? Math.round((occupiedTables / totalTables) * 100) : 0;
    const seatOccupancyRate = totalSeats > 0 ? Math.round((occupiedSeats / totalSeats) * 100) : 0;

    res.json({
      tables,
      stats: {
        total_tables: totalTables,
        total_seats: totalSeats,
        occupied_tables: occupiedTables,
        occupied_seats: occupiedSeats,
        available_tables: availableTables,
        available_seats: availableSeats,
        reserved_tables: reservedTables,
        maintenance_tables: maintenanceTables,
        occupancy_rate: occupancyRate,
        seat_occupancy_rate: seatOccupancyRate,
        server_time: new Date().toISOString()
      }
    });
  });
});

// Update status meja (oleh staf atau sistem)
app.put('/api/tables/:id/status', checkDb, (req, res) => {
  const { id } = req.params;
  const { status, current_user_name, expected_checkout } = req.body;

  const validStatuses = ['available', 'occupied', 'reserved', 'maintenance'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status meja tidak valid (available, occupied, reserved, maintenance)' });
  }

  let query = '';
  let params = [];

  if (status === 'occupied') {
    query = 'UPDATE library_tables SET status = ?, current_user_name = ?, occupied_at = NOW(), expected_checkout = ? WHERE id = ? OR table_number = ?';
    params = [status, current_user_name || 'Pengunjung', expected_checkout || null, id, id];
  } else if (status === 'available') {
    query = 'UPDATE library_tables SET status = ?, current_user_name = NULL, occupied_at = NULL, expected_checkout = NULL, session_token = NULL WHERE id = ? OR table_number = ?';
    params = [status, id, id];
  } else {
    query = 'UPDATE library_tables SET status = ? WHERE id = ? OR table_number = ?';
    params = [status, id, id];
  }

  pool.query(query, params, (err, result) => {
    if (err) {
      console.error('Error PUT /api/tables/:id/status:', err);
      return res.status(500).json({ error: 'Gagal memperbarui status meja', detail: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Meja tidak ditemukan' });
    }
    res.json({ message: 'Status meja berhasil diperbarui!', id, status });
  });
});

// Quick toggle status meja (Available <-> Occupied)
app.post('/api/tables/:id/toggle', checkDb, (req, res) => {
  const { id } = req.params;
  pool.query('SELECT status FROM library_tables WHERE id = ? OR table_number = ? LIMIT 1', [id, id], (err, rows) => {
    if (err || rows.length === 0) {
      return res.status(404).json({ error: 'Meja tidak ditemukan' });
    }
    const currentStatus = rows[0].status;
    const newStatus = currentStatus === 'occupied' ? 'available' : 'occupied';

    const updateQuery = newStatus === 'occupied'
      ? 'UPDATE library_tables SET status = "occupied", occupied_at = NOW() WHERE id = ? OR table_number = ?'
      : 'UPDATE library_tables SET status = "available", occupied_at = NULL, current_user_name = NULL, session_token = NULL WHERE id = ? OR table_number = ?';

    pool.query(updateQuery, [id, id], (updateErr) => {
      if (updateErr) {
        return res.status(500).json({ error: 'Gagal mengubah status meja', detail: updateErr.message });
      }
      res.json({ message: `Meja diubah menjadi ${newStatus}!`, id, status: newStatus });
    });
  });
});

// Check-in meja oleh pengunjung via QR Code
app.post('/api/tables/checkin', checkDb, (req, res) => {
  const { table_number, user_name, session_token, duration_minutes = 120 } = req.body;
  if (!table_number) {
    return res.status(400).json({ error: 'Nomor meja wajib diisi' });
  }

  // Idempotent Check-in: jika meja sudah occupied dengan session_token yang sama, kembalikan sukses tanpa error
  const checkQuery = 'SELECT * FROM library_tables WHERE table_number = ? LIMIT 1';
  pool.query(checkQuery, [table_number], (err, rows) => {
    if (err || rows.length === 0) {
      return res.status(404).json({ error: 'Nomor meja tidak terdaftar di sistem' });
    }

    const table = rows[0];
    const updateQuery = `
      UPDATE library_tables 
      SET 
        status = 'occupied', 
        current_user_name = ?, 
        session_token = ?, 
        occupied_at = COALESCE(occupied_at, NOW()),
        expected_checkout = DATE_ADD(NOW(), INTERVAL ? MINUTE)
      WHERE table_number = ?
    `;

    pool.query(updateQuery, [user_name || 'Pengunjung', session_token || null, duration_minutes, table_number], (updateErr) => {
      if (updateErr) {
        console.error('Error Checkin Meja:', updateErr);
        return res.status(500).json({ error: 'Gagal melakukan check-in meja', detail: updateErr.message });
      }

      res.json({
        message: `Berhasil Check-In di ${table_number}!`,
        table_number,
        zone: table.zone,
        status: 'occupied',
        checkin_time: new Date()
      });
    });
  });
});

// Check-out / Release meja oleh pengunjung atau staf
app.post('/api/tables/checkout', checkDb, (req, res) => {
  const { table_number, id } = req.body;
  const target = table_number || id;
  if (!target) {
    return res.status(400).json({ error: 'Nomor meja atau ID meja wajib disertakan' });
  }

  const query = `
    UPDATE library_tables 
    SET 
      status = 'available', 
      current_user_name = NULL, 
      occupied_at = NULL, 
      expected_checkout = NULL, 
      session_token = NULL 
    WHERE table_number = ? OR id = ?
  `;

  pool.query(query, [target, target], (err, result) => {
    if (err) {
      console.error('Error Checkout Meja:', err);
      return res.status(500).json({ error: 'Gagal melakukan check-out meja', detail: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Meja tidak ditemukan' });
    }
    res.json({ message: `Meja ${target} berhasil dikosongkan (Tersedia kembali)!`, target, status: 'available' });
  });
});

// Reset semua meja menjadi Tersedia (Available)
app.post('/api/tables/reset-all', checkDb, (req, res) => {
  const query = "UPDATE library_tables SET status = 'available', current_user_name = NULL, occupied_at = NULL, expected_checkout = NULL, session_token = NULL";
  pool.query(query, (err, result) => {
    if (err) {
      console.error('Error Reset All Tables:', err);
      return res.status(500).json({ error: 'Gagal mereset data meja', detail: err.message });
    }
    res.json({ message: `Berhasil mereset ${result.affectedRows} meja menjadi Tersedia!`, count: result.affectedRows });
  });
});

// ------------------------------------------
// FITUR 3.1: TABLE BOOKINGS (Reservasi Meja)
// ------------------------------------------
app.get('/api/table-bookings', checkDb, (req, res) => {
  const query = 'SELECT * FROM table_bookings ORDER BY created_at DESC';
  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error GET /api/table-bookings:', err);
      return res.status(500).json({ error: 'Gagal mengambil data booking meja', detail: err.message });
    }
    res.json(results);
  });
});

app.post('/api/table-bookings', checkDb, (req, res) => {
  const { table_number, booking_date, start_time, end_time } = req.body;
  const query = 'INSERT INTO table_bookings (table_number, booking_date, start_time, end_time) VALUES (?, ?, ?, ?)';
  pool.query(query, [table_number, booking_date || new Date().toISOString().slice(0, 10), start_time, end_time], (err, result) => {
    if (err) {
      console.error('Error POST /api/table-bookings:', err);
      return res.status(500).json({ error: 'Gagal membuat reservasi meja', detail: err.message });
    }
    res.status(201).json({ message: 'Reservasi meja berhasil disimpan!', bookingId: result.insertId });
  });
});

// ------------------------------------------
// FITUR 4: LOST & FOUND (Pemberitahuan Barang Tertinggal & Bukti Serah Terima)
// ------------------------------------------
app.get('/api/lost-found', checkDb, (req, res) => {
  const query = 'SELECT * FROM lost_found ORDER BY id DESC';
  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error GET /api/lost-found:', err);
      return res.status(500).json({ error: 'Gagal mengambil data lost & found', detail: err.message });
    }
    res.json(results);
  });
});

// Staf membuat pengumuman barang temuan ATAU pengunjung lapor kehilangan
app.post('/api/lost-found', checkDb, (req, res) => {
  const { item_name, type, location, description, contact } = req.body;
  if (!item_name || !location) {
    return res.status(400).json({ error: 'Nama barang dan lokasi wajib diisi' });
  }

  if (type === 'lost' && (!contact || !contact.trim())) {
    return res.status(400).json({ error: 'Nomor telepon / kontak wajib diisi agar staf bisa menghubungi Anda saat barang ditemukan' });
  }

  const query = 'INSERT INTO lost_found (item_name, type, location, description, report_date, status, contact) VALUES (?, ?, ?, ?, CURDATE(), "unclaimed", ?)';
  pool.query(query, [item_name, type || 'found', location, description || '', contact || null], (err, result) => {
    if (err) {
      console.error('Error POST /api/lost-found:', err);
      return res.status(500).json({ error: 'Gagal menyimpan pengumuman barang', detail: err.message });
    }
    res.status(201).json({ message: 'Pengumuman barang berhasil disimpan!', itemId: result.insertId });
  });
});

// Staf menyerahkan barang ke pemilik beserta foto bukti serah terima
app.put('/api/lost-found/:id/handover', checkDb, (req, res) => {
  const { id } = req.params;
  const { claimed_by, proof_photo, staff_notes } = req.body;

  if (!claimed_by || !claimed_by.trim()) {
    return res.status(400).json({ error: 'Nama penerima barang wajib diisi sebagai bukti serah terima' });
  }

  // Simpan foto bukti jika berupa base64 ke file fisik disk di folder public/covers
  const finalProofPhoto = saveProofPhotoImage(proof_photo, id);

  const query = `
    UPDATE lost_found 
    SET 
      status = 'claimed', 
      claimed_by = ?, 
      claimed_at = IF(claimed_at IS NULL, NOW(), claimed_at), 
      proof_photo = COALESCE(?, proof_photo), 
      staff_notes = ? 
    WHERE id = ?
  `;

  pool.query(query, [claimed_by.trim(), finalProofPhoto || null, staff_notes ? staff_notes.trim() : null, id], (err, result) => {
    if (err) {
      console.error('Error PUT /api/lost-found/:id/handover:', err);
      return res.status(500).json({ error: 'Gagal mencatat bukti serah terima di database', detail: err.message });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Data barang tidak ditemukan di database' });
    }
    console.log(`✅ Bukti serah terima barang #${id} berhasil disimpan untuk ${claimed_by}. Foto: ${finalProofPhoto ? 'Tersimpan' : 'Kosong'}`);
    res.json({ message: 'Barang berhasil diserahkan dan foto bukti telah disimpan!', id, proof_photo: finalProofPhoto });
  });
});

// Hapus catatan barang jika keliru/dibersihkan
app.delete('/api/lost-found/:id', checkDb, (req, res) => {
  const { id } = req.params;
  pool.query('DELETE FROM lost_found WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error DELETE /api/lost-found/:id:', err);
      return res.status(500).json({ error: 'Gagal menghapus data', detail: err.message });
    }
    res.json({ message: 'Data berhasil dihapus', id });
  });
});

// ------------------------------------------
// FITUR 5: TEXT-TO-SPEECH (Suara Bahasa Indonesia Alami)
// ------------------------------------------
app.get('/api/tts', async (req, res) => {
  const { text } = req.query;
  if (!text) return res.status(400).send('Parameter text wajib diisi');

  try {
    const ttsUrl = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=id&client=tw-ob`;
    const response = await fetch(ttsUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)'
      }
    });

    if (!response.ok) throw new Error('Gagal mengambil audio TTS');

    res.set({
      'Content-Type': 'audio/mpeg',
      'Cache-Control': 'public, max-age=86400'
    });

    const arrayBuffer = await response.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (err) {
    console.error('Error /api/tts:', err);
    res.status(500).json({ error: 'Gagal memproses suara TTS' });
  }
});

// ------------------------------------------
// FITUR 6: E-BOOK DIGITAL GOOGLE DRIVE
// ------------------------------------------
app.get('/api/ebooks', (req, res) => {
  try {
    const ebooksPath = path.join(__dirname, '../src/data/ebooksData.json');
    if (!fs.existsSync(ebooksPath)) {
      return res.json([]);
    }
    const raw = fs.readFileSync(ebooksPath, 'utf8');
    const list = JSON.parse(raw);
    const { category, q } = req.query;
    let result = list;
    if (category && category !== 'ALL') {
      result = result.filter(b => b.category === category);
    }
    if (q) {
      const query = q.toLowerCase();
      result = result.filter(b => b.title.toLowerCase().includes(query) || (b.category && b.category.toLowerCase().includes(query)));
    }
    res.json(result);
  } catch (err) {
    console.error('Error GET /api/ebooks:', err);
    res.status(500).json({ error: 'Gagal memuat katalog e-book' });
  }
});

// Tambah E-Book Baru ke Katalog Perpustakaan oleh Staf
app.post('/api/ebooks', (req, res) => {
  try {
    const { title, category, drive_url, pdf_data, pdf_filename, cover_image, cover_url } = req.body;
    if (!title || !title.trim()) {
      return res.status(400).json({ error: 'Judul e-book wajib diisi' });
    }

    const ebooksPath = path.join(__dirname, '../src/data/ebooksData.json');
    let list = [];
    if (fs.existsSync(ebooksPath)) {
      list = JSON.parse(fs.readFileSync(ebooksPath, 'utf8'));
    }

    // 1. Ekstrak Google Drive ID jika staf memasukkan link Google Drive
    let driveId = null;
    let driveViewUrl = null;
    let drivePreviewUrl = null;
    let driveDownloadUrl = null;

    if (drive_url && typeof drive_url === 'string') {
      const match = drive_url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || drive_url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (match && match[1]) {
        driveId = match[1];
      } else if (!drive_url.startsWith('http') && drive_url.length > 15) {
        driveId = drive_url.trim();
      }
    }

    // Buat ID unik e-book
    const newId = driveId || `ebk_${Date.now()}_${Math.floor(100 + Math.random() * 900)}`;

    if (driveId) {
      driveViewUrl = `https://drive.google.com/file/d/${driveId}/view`;
      drivePreviewUrl = `https://drive.google.com/file/d/${driveId}/preview`;
      driveDownloadUrl = `https://drive.google.com/uc?export=download&id=${driveId}`;
    }

    // 2. Simpan file PDF fisik jika di-upload dalam base64
    let localPdfUrl = null;
    if (pdf_data && typeof pdf_data === 'string' && pdf_data.startsWith('data:application/pdf;base64,')) {
      const pdfBuffer = Buffer.from(pdf_data.replace('data:application/pdf;base64,', ''), 'base64');
      const pdfDir = path.join(__dirname, '../public/ebooks');
      if (!fs.existsSync(pdfDir)) fs.mkdirSync(pdfDir, { recursive: true });
      const safeName = (pdf_filename || `ebook_${Date.now()}.pdf`).replace(/[^a-zA-Z0-9_.-]/g, '_');
      fs.writeFileSync(path.join(pdfDir, safeName), pdfBuffer);
      localPdfUrl = `/ebooks/${safeName}`;
    }

    // 3. Simpan foto sampul jika ada
    let finalThumbnail = cover_url || null;
    if (cover_image && typeof cover_image === 'string' && cover_image.startsWith('data:image')) {
      finalThumbnail = saveBase64Image(cover_image);
    } else if (!finalThumbnail && driveId) {
      finalThumbnail = `https://lh3.googleusercontent.com/d/${driveId}=w400`;
    }

    const newBook = {
      id: newId,
      title: title.trim(),
      rawTitle: (pdf_filename || title.trim()) + '.pdf',
      category: category ? category.trim() : 'Koleksi Umum',
      thumbnail: finalThumbnail || '/logo-perpus.png',
      driveViewUrl: driveViewUrl || localPdfUrl || drive_url || '',
      drivePreviewUrl: drivePreviewUrl || localPdfUrl || drive_url || '',
      driveDownloadUrl: driveDownloadUrl || localPdfUrl || '',
      pdfUrl: localPdfUrl || null,
      hasCover: Boolean(finalThumbnail),
      created_at: new Date().toISOString()
    };

    list.unshift(newBook);
    fs.writeFileSync(ebooksPath, JSON.stringify(list, null, 2), 'utf8');

    console.log(`[POST /api/ebooks] Staf berhasil menambahkan e-book: "${newBook.title}" (ID: ${newBook.id}). Total: ${list.length}`);
    res.json({
      success: true,
      message: `E-book "${newBook.title}" berhasil ditambahkan ke katalog perpustakaan!`,
      data: newBook,
      totalCount: list.length
    });
  } catch (err) {
    console.error('Error POST /api/ebooks:', err);
    res.status(500).json({ error: 'Gagal menyimpan e-book baru', detail: err.message });
  }
});

// Hapus e-book dari katalog perpustakaan oleh staf (Mendukung DELETE & POST /delete)
const handleDeleteEbookHandler = (req, res) => {
  try {
    const id = req.params.id || req.body?.id;
    if (!id) {
      return res.status(400).json({ error: 'ID e-book wajib disertakan' });
    }
    const ebooksPath = path.join(__dirname, '../src/data/ebooksData.json');
    if (!fs.existsSync(ebooksPath)) {
      return res.status(404).json({ error: 'Data e-book tidak ditemukan' });
    }
    const raw = fs.readFileSync(ebooksPath, 'utf8');
    const list = JSON.parse(raw);
    const targetBook = list.find(b => b.id === id);
    if (!targetBook) {
      return res.status(404).json({ error: 'E-book dengan ID tersebut tidak ditemukan' });
    }
    const filtered = list.filter(b => b.id !== id);
    fs.writeFileSync(ebooksPath, JSON.stringify(filtered, null, 2), 'utf8');
    console.log(`[DELETE /api/ebooks] Staf menghapus e-book: "${targetBook.title}" (ID: ${id}). Sisa koleksi: ${filtered.length}`);
    res.json({
      success: true,
      message: `E-book "${targetBook.title}" berhasil dihapus dari katalog perpustakaan`,
      deletedBook: targetBook,
      remainingCount: filtered.length
    });
  } catch (err) {
    console.error('Error DELETE /api/ebooks/:id:', err);
    res.status(500).json({ error: 'Gagal menghapus e-book dari server', detail: err.message });
  }
};

app.delete('/api/ebooks/:id', handleDeleteEbookHandler);
app.post('/api/ebooks/:id/delete', handleDeleteEbookHandler);

// ------------------------------------------
// FITUR REKAPITULASI PEMBACA E-BOOK & PESANAN
// ------------------------------------------

// Catat log pembaca e-book saat pengunjung membuka bacaan
app.post('/api/ebooks/read-log', (req, res) => {
  const { ebook_id, title, category, reader_session } = req.body;
  if (!ebook_id || !title) {
    return res.status(400).json({ error: 'ebook_id dan title wajib diisi' });
  }

  const cleanCategory = category || 'Koleksi Umum';
  const sessionToken = reader_session || null;
  const now = new Date();

  const newRead = {
    id: Date.now(),
    ebook_id,
    title,
    category: cleanCategory,
    reader_session: sessionToken,
    read_at: now.toISOString()
  };
  memoryEbookReads.unshift(newRead);
  if (memoryEbookReads.length > 500) memoryEbookReads.pop();

  if (!pool || !isDbConnected) {
    return res.status(201).json({ message: 'Log pembaca disimpan (offline mode)', data: newRead });
  }

  pool.query(
    'INSERT INTO ebook_reads (ebook_id, title, category, reader_session, read_at) VALUES (?, ?, ?, ?, NOW())',
    [ebook_id, title, cleanCategory, sessionToken],
    (err, result) => {
      if (err) {
        console.warn('⚠️ Gagal simpan log pembaca ke MySQL:', err.message);
        return res.status(201).json({ message: 'Log tersimpan di memori', data: newRead });
      }
      res.status(201).json({ message: 'Log pembaca berhasil dicatat', id: result.insertId });
    }
  );
});

// Ambil seluruh log pembaca e-book untuk rekap staf
app.get('/api/ebooks/read-log', (req, res) => {
  if (!pool || !isDbConnected) {
    return res.json(memoryEbookReads);
  }

  const query = 'SELECT * FROM ebook_reads ORDER BY read_at DESC LIMIT 1000';
  pool.query(query, (err, rows) => {
    if (err) {
      console.warn('Gagal ambil log pembaca dari MySQL:', err.message);
      return res.json(memoryEbookReads);
    }
    res.json(rows);
  });
});

// Endpoint terpadu rekapitulasi pelayanan (Harian, Bulanan, Tahunan)
app.get('/api/rekap/summary', (req, res) => {
  const { period = 'daily', date, month, year } = req.query;

  let ordersDateFilter = '1=1';
  let ebookDateFilter = '1=1';
  const ordersParams = [];
  const ebookParams = [];

  const todayStr = new Date().toISOString().slice(0, 10);
  const targetDate = date || todayStr;
  const currentMonthStr = todayStr.slice(0, 7);
  const targetMonth = month || currentMonthStr;
  const currentYearStr = todayStr.slice(0, 4);
  const targetYear = year || currentYearStr;

  if (period === 'daily') {
    ordersDateFilter = 'DATE(created_at) = ?';
    ordersParams.push(targetDate);
    ebookDateFilter = 'DATE(read_at) = ?';
    ebookParams.push(targetDate);
  } else if (period === 'monthly') {
    ordersDateFilter = "DATE_FORMAT(created_at, '%Y-%m') = ?";
    ordersParams.push(targetMonth);
    ebookDateFilter = "DATE_FORMAT(read_at, '%Y-%m') = ?";
    ebookParams.push(targetMonth);
  } else if (period === 'yearly') {
    ordersDateFilter = 'YEAR(created_at) = ?';
    ordersParams.push(targetYear);
    ebookDateFilter = 'YEAR(read_at) = ?';
    ebookParams.push(targetYear);
  }

  if (!pool || !isDbConnected) {
    return res.json({
      period,
      targetDate,
      targetMonth,
      targetYear,
      orders: [],
      ebookReads: memoryEbookReads,
      isOffline: true
    });
  }

  const ordersSql = `SELECT id, ticket_code, book_title, table_no, status, created_at, updated_at FROM orders WHERE ${ordersDateFilter} ORDER BY created_at DESC`;
  const ebookSql = `SELECT id, ebook_id, title, category, read_at FROM ebook_reads WHERE ${ebookDateFilter} ORDER BY read_at DESC`;

  pool.query(ordersSql, ordersParams, (errOrders, ordersRows = []) => {
    if (errOrders) {
      console.warn('Gagal query rekap orders:', errOrders.message);
      ordersRows = [];
    }

    pool.query(ebookSql, ebookParams, (errEbook, ebookRows = []) => {
      if (errEbook) {
        console.warn('Gagal query rekap ebook_reads:', errEbook.message);
        ebookRows = memoryEbookReads;
      }

      res.json({
        period,
        targetDate,
        targetMonth,
        targetYear,
        orders: ordersRows,
        ebookReads: ebookRows,
        totalOrdersCount: ordersRows.length,
        totalEbookReadsCount: ebookRows.length
      });
    });
  });
});


// Menyalakan Server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server backend berjalan di http://localhost:${PORT}`);
  console.log(`📚 Target database: ${DB_NAME} (MySQL ${DB_HOST}:${DB_PORT})`);
});
