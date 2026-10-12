const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

// Fungsi pembersih judul buku
function cleanTitle(rawTitle) {
  if (!rawTitle) return 'Tanpa Judul';
  return rawTitle
    .replace(/\s*\/.*?$/, '') // Hapus bagian setelah tanda slash /
    .replace(/\s*:\s*[A-Z\s]+$/, '') // Hapus sub-judul aneh jika ada
    .replace(/&amp;/g, '&')
    .trim();
}

// Fungsi pembersih nama pengarang
function cleanAuthor(rawAuthor) {
  if (!rawAuthor) return 'Pengarang Tidak Diketahui';
  return rawAuthor
    .replace(/\(Pengarang\)/gi, '')
    .replace(/\(Penerjemah\)/gi, '')
    .replace(/\(Penyunting\)/gi, '')
    .replace(/\(Editor\)/gi, '')
    .replace(/\(Ilustrator\)/gi, '')
    .replace(/\s*;\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^,\s*/, '')
    .replace(/,\s*$/, '');
}

// Fungsi pemetaan kategori dari kode DDC
function getCategoryFromDDC(ddc) {
  if (!ddc) return 'Umum';
  const prefix = ddc.trim().charAt(0);
  switch (prefix) {
    case '0': return 'Komputer & Informasi';
    case '1': return 'Filsafat & Psikologi';
    case '2': return 'Agama';
    case '3': return 'Ilmu Sosial & Pendidikan';
    case '4': return 'Bahasa';
    case '5': return 'Sains & Matematika';
    case '6': return 'Teknologi & Manajemen';
    case '7': return 'Kesenian & Desain';
    case '8': return 'Sastra & Fiksi';
    case '9': return 'Sejarah & Geografi';
    default: return 'Koleksi Umum';
  }
}

// Fungsi pemetaan lokasi rak realistis berdasarkan DDC
function getShelfFromDDC(ddc, callNum) {
  const cat = getCategoryFromDDC(ddc);
  const call = callNum ? ` [${callNum}]` : '';
  const prefix = ddc && ddc.trim() ? ddc.trim().charAt(0) : '0';
  return `Rak ${prefix}00 - ${cat}${call}`;
}

async function syncMonografBooks() {
  console.log('========================================================');
  console.log('📚 SINKRONISASI BUKU DARI DATABASE DENGAN SAMPUL ORIGINAL/MONOGRAF');
  console.log('========================================================\n');

  const monografDir = path.join(__dirname, '../original/Monograf');
  const publicCoversDir = path.join(__dirname, '../public/covers');

  if (!fs.existsSync(monografDir)) {
    console.error(`❌ Folder ${monografDir} tidak ditemukan!`);
    process.exit(1);
  }

  // 1. Bersihkan file cover online (online_*.jpg) di public/covers
  if (fs.existsSync(publicCoversDir)) {
    const publicFiles = fs.readdirSync(publicCoversDir);
    let deletedOnline = 0;
    for (const pf of publicFiles) {
      if (pf.startsWith('online_')) {
        fs.unlinkSync(path.join(publicCoversDir, pf));
        deletedOnline++;
      }
    }
    if (deletedOnline > 0) {
      console.log(`🗑️ Berhasil menghapus ${deletedOnline} file sampul online (online_*.jpg) dari public/covers.`);
    }
  } else {
    fs.mkdirSync(publicCoversDir, { recursive: true });
  }

  // 2. Baca file yang ada di original/Monograf
  const monografFiles = fs.readdirSync(monografDir);
  console.log(`📁 Ditemukan ${monografFiles.length} file sampul di folder original/Monograf.`);

  // Buat map pencocokan file (case-insensitive)
  const fileMap = new Map();
  for (const file of monografFiles) {
    fileMap.set(file.toLowerCase(), file);
  }

  // 3. Pastikan semua file monograf juga tersedia di public/covers
  let copiedCount = 0;
  for (const file of monografFiles) {
    const src = path.join(monografDir, file);
    const dest = path.join(publicCoversDir, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(src, dest);
      copiedCount++;
    }
  }
  if (copiedCount > 0) {
    console.log(`📋 Menyalin ${copiedCount} file dari original/Monograf ke public/covers.`);
  }

  // 4. Hubungkan ke database MySQL
  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'bibliotech_db'
  });

  console.log('🔌 Terhubung ke database MySQL bibliotech_db.');

  // 5. Hapus semua data buku lama terlebih dahulu
  console.log('🗑️ Menghapus semua buku yang sebelumnya ditampilkan...');
  await conn.execute('DELETE FROM books');
  await conn.execute('ALTER TABLE books AUTO_INCREMENT = 1');
  console.log('✅ Tabel books berhasil dikosongkan & reset AUTO_INCREMENT.');

  // 6. Tarik buku dari catalogs yang memiliki sampul di original/Monograf
  console.log('⏳ Mengambil katalog buku dari database...');
  const [catalogs] = await conn.query(`
    SELECT 
      cat.ID, 
      cat.Title, 
      cat.Author, 
      cat.DeweyNo, 
      cat.CoverURL,
      COUNT(col.ID) as stockCount,
      MIN(col.CallNumber) as sampleCallNumber
    FROM catalogs cat
    LEFT JOIN collections col ON col.Catalog_id = cat.ID
    WHERE cat.CoverURL IS NOT NULL 
      AND cat.Title IS NOT NULL 
      AND TRIM(cat.Title) != ''
    GROUP BY cat.ID
    ORDER BY cat.ID ASC
  `);

  console.log(`🔍 Total katalog dengan CoverURL di database: ${catalogs.length}`);

  // 7. Filter ketat: CUKUP tarik buku yang memiliki sampul di folder original/Monograf
  const booksToInsert = [];

  for (const cat of catalogs) {
    const rawCover = cat.CoverURL ? cat.CoverURL.trim() : '';
    if (!rawCover) continue;

    const lowerCover = rawCover.toLowerCase();
    if (fileMap.has(lowerCover)) {
      const actualFileName = fileMap.get(lowerCover);
      const cleanT = cleanTitle(cat.Title);
      const cleanA = cleanAuthor(cat.Author);
      const ddc = cat.DeweyNo ? cat.DeweyNo.trim() : '000';
      const categoryName = getCategoryFromDDC(ddc);
      const shelf = getShelfFromDDC(ddc, cat.sampleCallNumber);
      const stock = Math.max(1, Number(cat.stockCount) || 1);
      
      // Simpan cover_url yang merujuk ke folder original/monograf
      const coverUrl = `/original/monograf/${actualFileName}`;

      booksToInsert.push({
        title: cleanT,
        author: cleanA,
        classification: ddc,
        category: categoryName,
        shelf_location: shelf,
        stock: stock,
        cover_url: coverUrl
      });
    }
  }

  console.log(`🎯 Ditemukan ${booksToInsert.length} buku yang memiliki sampul valid di original/Monograf.`);

  // 8. Masukkan ke tabel books secara batch
  console.log('💾 Memasukkan data buku ke tabel books...');
  const insertQuery = `
    INSERT INTO books 
      (title, author, classification, category, shelf_location, stock, rating, rating_count, read_count, cover_url)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  let insertedCount = 0;
  for (const b of booksToInsert) {
    // Generate rating acak realistis antara 4.2 - 5.0
    const randomRating = (4.2 + Math.random() * 0.8).toFixed(1);
    const randomRatingCount = Math.floor(Math.random() * 25) + 3;
    const randomReadCount = Math.floor(Math.random() * 60) + 10;

    await conn.execute(insertQuery, [
      b.title,
      b.author,
      b.classification,
      b.category,
      b.shelf_location,
      b.stock,
      randomRating,
      randomRatingCount,
      randomReadCount,
      b.cover_url
    ]);
    insertedCount++;
  }

  console.log('========================================================');
  console.log(`🎉 SUKSES!`);
  console.log(`📚 Berhasil memasukkan ${insertedCount} buku ke database.`);
  console.log(`🖼️ Seluruh buku 100% memiliki sampul dari folder original/monograf.`);
  console.log(`🚫 Sistem pencarian sampul online telah dinonaktifkan.`);
  console.log('========================================================\n');

  await conn.end();
}

syncMonografBooks().catch(err => {
  console.error('❌ Gagal menjalankan sinkronisasi:', err);
  process.exit(1);
});
