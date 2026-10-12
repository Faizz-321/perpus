const mysql = require('mysql2/promise');

async function setup250FullCovers() {
  console.log('========================================================');
  console.log('🌟 PENERAPAN OPSI A: 250 BUKU LENGKAP BERSAMPUL & BER-ISBN');
  console.log('========================================================\n');

  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'bibliotech_db'
  });

  // 1. Ambil seluruh buku yang memiliki sampul hasil pencarian online ISBN (117 buku)
  const [onlineBooks] = await conn.query("SELECT * FROM books_backup_all WHERE cover_url LIKE '/covers/isbn_%'");
  console.log(`✅ Mengambil ${onlineBooks.length} buku hasil pencarian sampul online via ISBN.`);

  // 2. Ambil buku bersampul yang memiliki nomor ISBN dari backup untuk melengkapi tepat 250 buku
  const needed = 250 - onlineBooks.length; // 133 buku
  const [extraBooks] = await conn.query(
    "SELECT * FROM books_backup_all WHERE cover_url LIKE '/covers/%' AND cover_url NOT LIKE '/covers/isbn_%' AND isbn IS NOT NULL AND TRIM(isbn) != '' ORDER BY id ASC LIMIT ?",
    [needed]
  );
  console.log(`✅ Mengambil ${extraBooks.length} buku bersampul pelengkap yang memiliki kode ISBN valid.`);

  const all250 = [...onlineBooks, ...extraBooks];
  console.log(`🎯 Total buku terkumpul: ${all250.length} buku.\n`);

  // 3. Masukkan ke tabel books aktif
  await conn.query('TRUNCATE TABLE books');

  const insertSql = `
    INSERT INTO books (id, title, author, category, isbn, shelf_location, stock, cover_url, rating, rating_count, read_count, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  for (const b of all250) {
    await conn.query(insertSql, [
      b.id,
      b.title,
      b.author,
      b.category,
      b.isbn,
      b.shelf_location,
      b.stock,
      b.cover_url,
      b.rating || 0,
      b.rating_count || 0,
      b.read_count || 0,
      b.created_at || new Date()
    ]);
  }

  // 4. Periksa statistik akhir
  const [stats] = await conn.query(`
    SELECT 
      COUNT(*) as total_books,
      COUNT(cover_url) as with_cover,
      COUNT(CASE WHEN cover_url LIKE '/covers/isbn_%' THEN 1 END) as online_isbn_covers,
      COUNT(CASE WHEN cover_url LIKE '/covers/%' AND cover_url NOT LIKE '/covers/isbn_%' THEN 1 END) as other_covers,
      COUNT(CASE WHEN cover_url IS NULL OR cover_url = '' THEN 1 END) as without_cover
    FROM books
  `);

  console.log('========================================================');
  console.log('📊 STATUS KATALOG 250 BUKU SEKARANG:');
  console.log(`   • Total Buku Aktif          : ${stats[0].total_books} buku`);
  console.log(`   • Buku Memiliki Sampul Foto : ${stats[0].with_cover} buku (100% LENGKAP!)`);
  console.log(`   • Sampul Hasil Online ISBN  : ${stats[0].online_isbn_covers} buku`);
  console.log(`   • Sampul Koleksi Lengkap    : ${stats[0].other_covers} buku`);
  console.log(`   • Buku Tanpa Sampul         : ${stats[0].without_cover} buku (Nol Kosong)`);
  console.log('========================================================\n');

  await conn.end();
}

if (require.main === module) {
  setup250FullCovers().catch(console.error);
}

module.exports = { setup250FullCovers };
