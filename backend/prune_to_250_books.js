const mysql = require('mysql2/promise');

async function pruneTo250Books() {
  console.log('========================================================');
  console.log('✂️  MEMOTONG DATABASE MENJADI TEPAT 250 BUKU UNTUK TESTING');
  console.log('========================================================\n');

  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'bibliotech_db'
  });

  // 1. Amankan data: Backup seluruh koleksi ke tabel books_backup_all
  console.log('📦 Membuat cadangan (backup) tabel books_backup_all...');
  await conn.query('DROP TABLE IF EXISTS books_backup_all');
  await conn.query('CREATE TABLE books_backup_all AS SELECT * FROM books');
  const [bRows] = await conn.query('SELECT COUNT(*) as cnt FROM books_backup_all');
  console.log(`✅ Seluruh ${bRows[0].cnt} buku berhasil dicadangkan dengan aman di tabel 'books_backup_all'.\n`);

  // 2. Pilih tepat 250 ID buku terbaik:
  // - Buku ID 1, 2, 3 (yang memiliki riwayat ulasan/rating)
  // - Semua 117 buku hasil pencarian online ISBN
  // - 80 buku dengan sampul lokal yang sudah ada di folder
  // - 50 buku tanpa sampul ber-ISBN (untuk menguji 3D CSS cover & pencarian online)
  const ids = new Set();
  ids.add(1);
  ids.add(2);
  ids.add(3);

  // Ambil buku dengan online ISBN cover
  const [online] = await conn.query("SELECT id FROM books WHERE cover_url LIKE '/covers/isbn_%'");
  for (const r of online) {
    if (ids.size < 250) ids.add(r.id);
  }

  // Ambil buku dengan local folder cover
  const [local] = await conn.query("SELECT id FROM books WHERE cover_url LIKE '/covers/%' AND cover_url NOT LIKE '/covers/isbn_%' ORDER BY id ASC");
  for (const r of local) {
    if (ids.size < 200) ids.add(r.id);
  }

  // Lengkapi sisanya dengan buku 3D CSS (cover_url is null) yang punya ISBN
  const [css] = await conn.query("SELECT id FROM books WHERE (cover_url IS NULL OR cover_url = '') AND isbn IS NOT NULL ORDER BY id ASC");
  for (const r of css) {
    if (ids.size < 250) ids.add(r.id);
  }

  // Jika masih belum 250, ambil sembarang buku dari ID awal
  if (ids.size < 250) {
    const [any] = await conn.query("SELECT id FROM books ORDER BY id ASC");
    for (const r of any) {
      if (ids.size < 250) ids.add(r.id);
    }
  }

  const selectedIds = Array.from(ids);
  console.log(`🎯 Terpilih tepat ${selectedIds.length} buku untuk dipertahankan.`);

  // 3. Hapus buku lainnya dari tabel books
  console.log('🗑️  Menghapus buku lainnya dari tabel books...');
  const [delRes] = await conn.query('DELETE FROM books WHERE id NOT IN (?)', [selectedIds]);
  console.log(`✅ Berhasil menghapus ${delRes.affectedRows} buku.`);

  // 4. Verifikasi sisa buku
  const [finalRows] = await conn.query('SELECT COUNT(*) as cnt FROM books');
  console.log(`\n📚 Total buku di tabel books sekarang: ${finalRows[0].cnt} buku`);

  // 5. Cek statistik sampul
  const [stats] = await conn.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(cover_url) as with_cover,
      COUNT(CASE WHEN cover_url LIKE '/covers/isbn_%' THEN 1 END) as online_covers,
      COUNT(CASE WHEN cover_url LIKE '/covers/%' AND cover_url NOT LIKE '/covers/isbn_%' THEN 1 END) as local_covers,
      COUNT(CASE WHEN cover_url IS NULL OR cover_url = '' THEN 1 END) as css_3d_covers
    FROM books
  `);

  console.log('========================================================');
  console.log('📊 STATISTIK 250 BUKU AKTIF DI SISTEM:');
  console.log(`   • Total Buku               : ${stats[0].total}`);
  console.log(`   • Sampul Online (ISBN)     : ${stats[0].online_covers}`);
  console.log(`   • Sampul Folder Lokal      : ${stats[0].local_covers}`);
  console.log(`   • Sampul Interaktif 3D CSS : ${stats[0].css_3d_covers}`);
  console.log('========================================================\n');

  await conn.end();
}

if (require.main === module) {
  pruneTo250Books().catch(console.error);
}

module.exports = { pruneTo250Books };
