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

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use('/covers', express.static(COVERS_DIR));

// Konfigurasi Koneksi Database MySQL (XAMPP Default)
// Menggunakan createPool agar koneksi lebih stabil dan otomatis reconnect
const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',         // Default user di XAMPP
  password: '',         // Default password kosong di XAMPP
  database: 'bibliotech_db',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

// Uji coba koneksi pertama kali & inisialisasi tabel
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Gagal terhubung ke database MySQL XAMPP:', err.message);
    console.log('💡 Tips: Pastikan modul MySQL di XAMPP Control Panel sudah berstatus START (Hijau).');
    return;
  }
  console.log('✅ Berhasil terhubung ke database MySQL (bibliotech_db) di XAMPP!');
  connection.release();
  initLostFoundTable();
  initBooksExtraColumns();
});

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
      item_name VARCHAR(255) NOT NULL,
      type ENUM('found', 'lost') NOT NULL DEFAULT 'found',
      location VARCHAR(255) NOT NULL,
      description TEXT NULL,
      report_date DATE NOT NULL,
      status ENUM('unclaimed', 'claimed') DEFAULT 'unclaimed',
      claimed_by VARCHAR(255) NULL,
      claimed_at DATETIME NULL,
      proof_photo LONGTEXT NULL,
      staff_notes VARCHAR(255) NULL,
      contact VARCHAR(100) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `, () => {
    const alterQueries = [
      "ALTER TABLE lost_found ADD COLUMN IF NOT EXISTS description TEXT NULL",
      "ALTER TABLE lost_found ADD COLUMN IF NOT EXISTS claimed_by VARCHAR(255) NULL",
      "ALTER TABLE lost_found ADD COLUMN IF NOT EXISTS claimed_at DATETIME NULL",
      "ALTER TABLE lost_found ADD COLUMN IF NOT EXISTS proof_photo LONGTEXT NULL",
      "ALTER TABLE lost_found ADD COLUMN IF NOT EXISTS staff_notes VARCHAR(255) NULL"
    ];
    alterQueries.forEach(q => pool.query(q, () => {}));

    // Cek sampel awal, jika kosong isi sampel realistis perpustakaan
    pool.query("SELECT COUNT(*) as count FROM lost_found WHERE type = 'found'", (err, rows) => {
      if (!err && rows && rows[0].count === 0) {
        const samples = [
          ['Cas HP Samsung Type-C Hitam', 'found', 'Meja 4 (Lantai 1)', 'Tertinggal di colokan bawah meja setelah jam baca siang. Tersimpan aman di meja staf.', 'unclaimed'],
          ['Tumbler Stainless Biru Dongker', 'found', 'Meja 12 (Zona Baca Tenang)', 'Tertinggal di sudut meja dekat rak majalah. Berisi air minum setengah.', 'unclaimed'],
          ['Kacamata Baca Frame Hitam', 'found', 'Area Lemari 3 (Sastra)', 'Ditemukan di dekat rak 2 novel fiksi.', 'unclaimed']
        ];
        samples.forEach(s => {
          pool.query(
            "INSERT INTO lost_found (item_name, type, location, description, status, report_date) VALUES (?, ?, ?, ?, ?, CURDATE())",
            s
          );
        });
      }
    });
  });
}

// ==========================================
// API ENDPOINTS (Rute Backend)
// ==========================================

// 1. Root Test Endpoint
app.get('/', (req, res) => {
  res.json({
    status: 'online',
    message: 'Backend API BiblioTech Library System berjalan lancar!',
    database: 'bibliotech_db (MySQL XAMPP)'
  });
});

// ------------------------------------------
// FITUR 1: ORDERS (Pemesanan Pinjam Buku via Meja/QR)
// ------------------------------------------

// Ambil semua data pesanan
app.get('/api/orders', (req, res) => {
  const query = 'SELECT * FROM orders ORDER BY created_at DESC';
  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error GET /api/orders:', err);
      return res.status(500).json({ error: 'Gagal mengambil data pesanan' });
    }
    res.json(results);
  });
});

// Buat pesanan baru dari meja pengunjung
app.post('/api/orders', (req, res) => {
  const { book_title, table_no } = req.body;
  if (!book_title || !table_no) {
    return res.status(400).json({ error: 'Judul buku dan nomor meja wajib diisi' });
  }

  // Generate Kode Tiket unik (misal: TKT-4821)
  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const ticket_code = `TKT-${randomNum}`;
  const status = 'pending';
  const query = 'INSERT INTO orders (ticket_code, book_title, table_no, status) VALUES (?, ?, ?, ?)';

  pool.query(query, [ticket_code, book_title, table_no, status], (err, result) => {
    if (err) {
      console.error('Error POST /api/orders:', err);
      return res.status(500).json({ error: 'Gagal membuat pesanan baru' });
    }
    res.status(201).json({
      message: 'Pesanan berhasil dibuat!',
      orderId: result.insertId,
      ticket_code: ticket_code,
      order: { id: result.insertId, ticket_code, book_title, table_no, status }
    });
  });
});

// Ambil detail status pesanan tunggal (untuk live tracking tiket di HP pengunjung)
app.get('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const query = 'SELECT * FROM orders WHERE id = ? OR ticket_code = ? LIMIT 1';
  pool.query(query, [id, id], (err, results) => {
    if (err) {
      console.error('Error GET /api/orders/:id:', err);
      return res.status(500).json({ error: 'Gagal mengambil detail pesanan' });
    }
    if (results.length === 0) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }
    res.json(results[0]);
  });
});

// Update status pesanan (oleh staf perpustakaan)
app.put('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const { status } = req.body;

  const validStatuses = ['pending', 'searching', 'ready', 'completed', 'cancelled'];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ error: 'Status tidak valid' });
  }

  const query = 'UPDATE orders SET status = ? WHERE id = ?';
  pool.query(query, [status, id], (err, result) => {
    if (err) {
      console.error('Error PUT /api/orders/:id:', err);
      return res.status(500).json({ error: 'Gagal mengupdate status pesanan' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Pesanan tidak ditemukan' });
    }
    res.json({ message: 'Status pesanan berhasil diperbarui!', id, status });
  });
});

// Hapus semua pesanan yang sudah selesai atau dibatalkan (Bersihkan riwayat)
app.delete('/api/orders/cleanup/completed', (req, res) => {
  const query = "DELETE FROM orders WHERE status = 'completed' OR status = 'cancelled'";
  pool.query(query, (err, result) => {
    if (err) {
      console.error('Error DELETE /api/orders/cleanup/completed:', err);
      return res.status(500).json({ error: 'Gagal membersihkan pesanan' });
    }
    res.json({ message: `Berhasil menghapus ${result.affectedRows} pesanan!`, count: result.affectedRows });
  });
});

// Hapus satu pesanan spesifik berdasarkan ID
app.delete('/api/orders/:id', (req, res) => {
  const { id } = req.params;
  const query = 'DELETE FROM orders WHERE id = ?';
  pool.query(query, [id], (err, result) => {
    if (err) {
      console.error('Error DELETE /api/orders/:id:', err);
      return res.status(500).json({ error: 'Gagal menghapus pesanan' });
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
// Ambil katalog buku
app.get('/api/books', (req, res) => {
  const query = 'SELECT * FROM books ORDER BY id ASC';
  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error GET /api/books:', err);
      return res.status(500).json({ error: 'Gagal mengambil katalog buku' });
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
app.post('/api/books/:id/rate', (req, res) => {
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
      return res.status(500).json({ error: 'Gagal mencatat rating buku' });
    }

    // 2. Update nilai rata-rata rating, rating_count, dan read_count di tabel books
    const updateQuery = `
      UPDATE books 
      SET 
        rating = ROUND(((rating * rating_count) + ?) / (rating_count + 1), 1),
        rating_count = rating_count + 1,
        read_count = read_count + 1
      WHERE id = ?
    `;

    pool.query(updateQuery, [numRating, id], (errUpdate) => {
      if (errUpdate) {
        console.error('Error UPDATE books rating:', errUpdate);
        return res.status(500).json({ error: 'Gagal memperbarui kalkulasi rating buku' });
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
app.post('/api/books/rate-by-title', (req, res) => {
  const { title, rating, review_text, table_no } = req.body;
  const numRating = parseInt(rating);

  if (!title || !numRating || numRating < 1 || numRating > 5) {
    return res.status(400).json({ error: 'Judul buku dan rating valid (1-5) wajib diisi' });
  }

  // Cari ID buku berdasarkan judul (case-insensitive atau LIKE)
  const cleanTitle = title.trim();
  pool.query('SELECT id FROM books WHERE LOWER(title) = LOWER(?) LIMIT 1', [cleanTitle], (err, rows) => {
    if (err || rows.length === 0) {
      // Jika tidak ketemu exact, coba pencarian LIKE
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
      return res.status(500).json({ error: 'Gagal mencatat rating' });
    }

    const updateQuery = `
      UPDATE books 
      SET 
        rating = ROUND(((rating * rating_count) + ?) / (rating_count + 1), 1),
        rating_count = rating_count + 1,
        read_count = read_count + 1
      WHERE id = ?
    `;

    pool.query(updateQuery, [numRating, bookId], (errUpdate) => {
      if (errUpdate) {
        console.error('Error UPDATE rating:', errUpdate);
        return res.status(500).json({ error: 'Gagal kalkulasi rating' });
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
// FITUR 3: TABLE BOOKINGS (Reservasi Meja)
// ------------------------------------------
app.get('/api/table-bookings', (req, res) => {
  const query = 'SELECT * FROM table_bookings ORDER BY created_at DESC';
  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error GET /api/table-bookings:', err);
      return res.status(500).json({ error: 'Gagal mengambil data booking meja' });
    }
    res.json(results);
  });
});

app.post('/api/table-bookings', (req, res) => {
  const { table_number, booking_date, start_time, end_time } = req.body;
  const query = 'INSERT INTO table_bookings (table_number, booking_date, start_time, end_time) VALUES (?, ?, ?, ?)';
  pool.query(query, [table_number, booking_date || new Date().toISOString().slice(0, 10), start_time, end_time], (err, result) => {
    if (err) {
      console.error('Error POST /api/table-bookings:', err);
      return res.status(500).json({ error: 'Gagal membuat reservasi meja' });
    }
    res.status(201).json({ message: 'Reservasi meja berhasil disimpan!', bookingId: result.insertId });
  });
});

// ------------------------------------------
// FITUR 4: LOST & FOUND (Pemberitahuan Barang Tertinggal & Bukti Serah Terima)
// ------------------------------------------
app.get('/api/lost-found', (req, res) => {
  const query = 'SELECT * FROM lost_found ORDER BY created_at DESC';
  pool.query(query, (err, results) => {
    if (err) {
      console.error('Error GET /api/lost-found:', err);
      return res.status(500).json({ error: 'Gagal mengambil data lost & found' });
    }
    res.json(results);
  });
});

// Staf membuat pengumuman barang tertinggal baru (hanya tulisan teks)
app.post('/api/lost-found', (req, res) => {
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
      return res.status(500).json({ error: 'Gagal menyimpan pengumuman barang' });
    }
    res.status(201).json({ message: 'Pengumuman barang berhasil disimpan!', itemId: result.insertId });
  });
});

// Staf menyerahkan barang ke pemilik beserta foto bukti serah terima
app.put('/api/lost-found/:id/handover', (req, res) => {
  const { id } = req.params;
  const { claimed_by, proof_photo, staff_notes } = req.body;

  if (!claimed_by) {
    return res.status(400).json({ error: 'Nama penerima barang wajib diisi sebagai bukti serah terima' });
  }

  const query = `
    UPDATE lost_found 
    SET 
      status = 'claimed', 
      claimed_by = ?, 
      claimed_at = NOW(), 
      proof_photo = ?, 
      staff_notes = ? 
    WHERE id = ?
  `;

  pool.query(query, [claimed_by, proof_photo || null, staff_notes || null, id], (err, result) => {
    if (err) {
      console.error('Error PUT /api/lost-found/:id/handover:', err);
      return res.status(500).json({ error: 'Gagal mencatat bukti serah terima' });
    }
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Data barang tidak ditemukan' });
    }
    res.json({ message: 'Barang berhasil diserahkan dan foto bukti telah disimpan!', id });
  });
});

// Hapus catatan barang jika keliru/dibersihkan
app.delete('/api/lost-found/:id', (req, res) => {
  const { id } = req.params;
  pool.query('DELETE FROM lost_found WHERE id = ?', [id], (err, result) => {
    if (err) {
      console.error('Error DELETE /api/lost-found/:id:', err);
      return res.status(500).json({ error: 'Gagal menghapus data' });
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

// Menyalakan Server
const PORT = 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server backend berjalan di http://localhost:${PORT}`);
  console.log(`📚 Database aktif: bibliotech_db (MySQL XAMPP localhost:3306)`);
});
