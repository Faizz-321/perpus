const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Fungsi pembersih judul buku dari format katalog perpustakaan
function cleanTitle(rawTitle) {
  if (!rawTitle) return 'Tanpa Judul';
  return rawTitle
    .replace(/\s*\/.*?$/, '') // Hapus bagian setelah tanda slash /
    .replace(/\s*:\s*[A-Z\s]+$/, '') // Hapus sub-judul aneh jika ada
    .replace(/&amp;/g, '&')
    .trim();
}

// Fungsi pembersih nama pengarang dari embel-embel INLISLite
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

// Fungsi pemetaan kategori dari kode DDC (Dewey Decimal Classification)
function getCategoryFromDDC(ddc) {
  if (!ddc) return 'Umum';
  const prefix = ddc.charAt(0);
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
  const prefix = ddc ? ddc.charAt(0) : '0';
  return `Rak ${prefix}00 - ${cat}${call}`;
}

async function importSampleBooksWithCovers() {
  console.log('========================================================');
  console.log('📸 IMPOR 30 BUKU SAMPEL LENGKAP DENGAN FOTO SAMPUL ASLI');
  console.log('Sumber: inlislite_v3 + Folder original/Monograf');
  console.log('========================================================\n');

  // Baca daftar file gambar yang tersedia di public/covers
  const coversDir = path.join(__dirname, '../public/covers');
  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
  }
  const availableImages = fs.readdirSync(coversDir);
  console.log(`Ditemukan ${availableImages.length} file foto sampul di folder public/covers.\n`);

  const inlisConn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'inlislite_v3'
  });

  const appConn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'bibliotech_db'
  });

  // Kosongkan buku lama di bibliotech_db
  await appConn.execute('DELETE FROM books');
  await appConn.execute('ALTER TABLE books AUTO_INCREMENT = 1');
  console.log('✅ Berhasil mereset tabel books di bibliotech_db.\n');

  // Ambil buku dari berbagai kategori DDC yang MEMILIKI FOTO SAMPUL ASLI
  const ddcCategories = [
    { prefix: '8', name: 'Sastra & Fiksi', limit: 5 },
    { prefix: '1', name: 'Filsafat & Psikologi', limit: 4 },
    { prefix: '2', name: 'Agama Islam', limit: 4 },
    { prefix: '3', name: 'Ilmu Sosial & Pendidikan', limit: 4 },
    { prefix: '6', name: 'Teknologi & Terapan', limit: 4 },
    { prefix: '0', name: 'Komputer & Informasi', limit: 3 },
    { prefix: '5', name: 'Sains & Matematika', limit: 3 },
    { prefix: '7', name: 'Kesenian & Desain', limit: 3 },
  ];

  let totalInserted = 0;
  let coversAttached = 0;

  for (const cat of ddcCategories) {
    const query = `
      SELECT 
        cat.ID, 
        cat.Title, 
        cat.Author, 
        cat.DeweyNo, 
        cat.ISBN, 
        cat.Publisher, 
        cat.PublishYear,
        cat.CoverURL,
        COUNT(col.ID) as stockCount,
        MIN(col.CallNumber) as sampleCallNumber
      FROM catalogs cat
      JOIN collections col ON col.Catalog_id = cat.ID
      WHERE cat.DeweyNo LIKE ?
        AND cat.CoverURL IN (?)
        AND cat.Title IS NOT NULL 
        AND cat.Title != ''
        AND cat.Author IS NOT NULL 
        AND cat.Author != ''
      GROUP BY cat.ID
      HAVING stockCount > 0
      ORDER BY stockCount DESC, cat.ID ASC
      LIMIT ?
    `;

    const [rows] = await inlisConn.query(query, [`${cat.prefix}%`, availableImages, cat.limit]);

    console.log(`📁 Mengambil ${rows.length} buku untuk kategori [${cat.name}]:`);

    for (const b of rows) {
      const cleanT = cleanTitle(b.Title);
      const cleanA = cleanAuthor(b.Author);
      const categoryName = getCategoryFromDDC(b.DeweyNo);
      const shelf = getShelfFromDDC(b.DeweyNo, b.sampleCallNumber);
      const stock = Math.max(1, Number(b.stockCount) || 1);
      const ddc = b.DeweyNo || '000';

      // Pastikan file cover ada di public/covers
      let coverUrl = null;
      if (b.CoverURL && availableImages.includes(b.CoverURL)) {
        coverUrl = `/covers/${b.CoverURL}`;
        coversAttached++;
      }

      const insertQuery = `
        INSERT INTO books 
          (title, author, classification, category, shelf_location, stock, cover_url)
        VALUES 
          (?, ?, ?, ?, ?, ?, ?)
      `;

      await appConn.execute(insertQuery, [
        cleanT,
        cleanA,
        ddc,
        categoryName,
        shelf,
        stock,
        coverUrl
      ]);

      totalInserted++;
      console.log(`   🖼️ [DDC ${ddc}] ${cleanT} (Stok: ${stock}) | Cover: ${coverUrl}`);
    }
    console.log('');
  }

  console.log('========================================================');
  console.log(`🎉 SUKSES BESAR! Berhasil mengimpor ${totalInserted} buku sampel.`);
  console.log(`📸 Seluruh ${coversAttached} buku langsung dipasangi FOTO SAMPUL ASLI!`);
  console.log('========================================================');

  await inlisConn.end();
  await appConn.end();
}

importSampleBooksWithCovers().catch(console.error);
