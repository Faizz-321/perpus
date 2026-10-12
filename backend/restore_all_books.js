const mysql = require('mysql2/promise');

async function restoreAllBooks() {
  console.log('========================================================');
  console.log('🔄 MENGEMBALIKAN SELURUH KOLEKSI BUKU DARI BACKUP');
  console.log('========================================================\n');

  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'bibliotech_db'
  });

  const [checkBackup] = await conn.query("SHOW TABLES LIKE 'books_backup_all'");
  if (checkBackup.length === 0) {
    console.log("❌ Tabel 'books_backup_all' tidak ditemukan. Menggunakan import_all_books.js jika ingin mengimpor ulang.");
    await conn.end();
    return;
  }

  const [bRows] = await conn.query('SELECT COUNT(*) as cnt FROM books_backup_all');
  console.log(`📦 Ditemukan cadangan lengkap berisi ${bRows[0].cnt} buku.`);

  // Kembalikan ke tabel books
  await conn.query('TRUNCATE TABLE books');
  await conn.query('INSERT INTO books SELECT * FROM books_backup_all');

  const [finalRows] = await conn.query('SELECT COUNT(*) as cnt FROM books');
  console.log(`✅ Berhasil mengembalikan seluruh ${finalRows[0].cnt} buku ke tabel aktif 'books'!\n`);

  await conn.end();
}

if (require.main === module) {
  restoreAllBooks().catch(console.error);
}

module.exports = { restoreAllBooks };
