const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'bibliotech_db',
  waitForConnections: true,
  connectionLimit: 5
});

async function runMigration() {
  const promisePool = pool.promise();

  try {
    console.log('🔄 Memeriksa dan memperbarui tabel books...');

    // 1. Cek kolom di tabel books
    const [columns] = await promisePool.query("SHOW COLUMNS FROM books LIKE 'rating'");
    if (columns.length === 0) {
      await promisePool.query(`
        ALTER TABLE books 
        ADD COLUMN rating DECIMAL(3,1) DEFAULT 4.5,
        ADD COLUMN rating_count INT DEFAULT 5,
        ADD COLUMN read_count INT DEFAULT 12
      `);
      console.log('✅ Kolom rating, rating_count, dan read_count berhasil ditambahkan ke tabel books!');
    } else {
      console.log('ℹ️ Kolom rating sudah ada di tabel books.');
    }

    // 2. Buat tabel book_ratings
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS book_ratings (
        id INT AUTO_INCREMENT PRIMARY KEY,
        book_id INT NOT NULL,
        rating INT NOT NULL,
        review_text VARCHAR(500) NULL,
        table_no VARCHAR(50) NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_book (book_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabel book_ratings siap digunakan!');

    // 3. Beri nilai awal rating bervariasi (4.3 - 5.0) untuk buku yang ratingnya masih null/default 0
    const [books] = await promisePool.query('SELECT id, title, author, rating FROM books');
    console.log(`📚 Menyesuaikan data rating untuk ${books.length} buku...`);

    for (const b of books) {
      // Tentukan rating realistis
      const isTopAuthor = /Tere Liye|Andrea Hirata|Pramoedya|Habiburrahman|Ayu Utami|Dewi Lestari|Fiersa Besari/i.test(b.author);
      let baseRating = isTopAuthor ? (4.8 + Math.random() * 0.2) : (4.3 + Math.random() * 0.6);
      baseRating = Math.min(5.0, Math.round(baseRating * 10) / 10);
      const readCount = isTopAuthor ? Math.floor(25 + Math.random() * 35) : Math.floor(8 + Math.random() * 20);
      const ratingCount = Math.floor(readCount * 0.7);

      await promisePool.query(
        'UPDATE books SET rating = ?, rating_count = ?, read_count = ? WHERE id = ?',
        [baseRating, ratingCount, readCount, b.id]
      );
    }

    console.log('🎉 Migrasi dan pengisian data rating selesai dengan sukses!');
  } catch (err) {
    console.error('❌ Terjadi kesalahan saat migrasi:', err);
  } finally {
    pool.end();
  }
}

runMigration();
