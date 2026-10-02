const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

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

// Uji coba koneksi pertama kali
pool.getConnection((err, connection) => {
  if (err) {
    console.error('❌ Gagal terhubung ke database MySQL XAMPP:', err.message);
    console.log('💡 Tips: Pastikan modul MySQL di XAMPP Control Panel sudah berstatus START (Hijau).');
    return;
  }
  console.log('✅ Berhasil terhubung ke database MySQL (bibliotech_db) di XAMPP!');
  connection.release();
});

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
// FITUR 4: LOST & FOUND (Barang Hilang / Temuan)
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

app.post('/api/lost-found', (req, res) => {
  const { item_name, type, location, contact } = req.body;
  const query = 'INSERT INTO lost_found (item_name, type, location, report_date, contact) VALUES (?, ?, ?, CURDATE(), ?)';
  pool.query(query, [item_name, type, location, contact], (err, result) => {
    if (err) {
      console.error('Error POST /api/lost-found:', err);
      return res.status(500).json({ error: 'Gagal menyimpan laporan barang' });
    }
    res.status(201).json({ message: 'Laporan barang berhasil disimpan!', itemId: result.insertId });
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
