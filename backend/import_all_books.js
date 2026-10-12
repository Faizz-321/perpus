const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

// Fungsi pembersih judul buku dari format katalog perpustakaan / MARC
function cleanTitle(rawTitle) {
  if (!rawTitle) return 'Tanpa Judul';
  return rawTitle
    .replace(/\s*\/.*?$/, '') // Hapus bagian setelah tanda slash /
    .replace(/\s*:\s*[A-Z\s]+$/, '') // Hapus sub-judul aneh jika ada
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
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

// Ekstrak ISBN standar (13 digit atau 10 digit)
function extractISBNs(raw) {
  if (!raw) return [];
  const isbns = [];
  const match13 = raw.match(/97[89][\d\-\s]{10,14}[\dX]/gi);
  if (match13) {
    for (const m of match13) {
      const clean = m.replace(/[^\dX]/gi, '');
      if (clean.length === 13 && !isbns.includes(clean)) isbns.push(clean);
    }
  }
  const tokens = raw.split(/[;,/]/);
  for (const tok of tokens) {
    const cleaned = tok.replace(/\(10\)|\(13\)|isbn/gi, '').replace(/[^\dX]/gi, '');
    if (cleaned.length === 10 && !isbns.includes(cleaned)) {
      isbns.push(cleaned);
    } else if (cleaned.length === 13 && cleaned.startsWith('97') && !isbns.includes(cleaned)) {
      isbns.push(cleaned);
    }
  }
  return isbns;
}

// Pemetaan kategori dari DDC
function getCategoryFromDDC(ddc) {
  if (!ddc) return 'Koleksi Umum';
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

// Pemetaan lokasi rak realistis
function getShelfFromDDC(ddc, callNum) {
  const cat = getCategoryFromDDC(ddc);
  const call = callNum ? ` [${callNum}]` : '';
  const prefix = ddc ? ddc.trim().charAt(0) : '0';
  return `Rak ${prefix}00 - ${cat}${call}`;
}

function norm(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function importAllBooks() {
  console.log('========================================================');
  console.log('📚 IMPORT SELURUH BUKU KE DATABASE BIBLIOTECH_DB');
  console.log('Sumber: inlislite_v3.catalogs + Lemari 3 (Sastra)');
  console.log('========================================================\n');

  const coversDir = path.join(__dirname, '../public/covers');
  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
  }
  const localCoverFiles = new Set(fs.readdirSync(coversDir));
  console.log(`📁 Ditemukan ${localCoverFiles.size} file foto sampul di folder public/covers.\n`);

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

  // Pastikan skema tabel books memiliki kolom isbn & catalog_id
  await appConn.query('ALTER TABLE books MODIFY title VARCHAR(500) NOT NULL');
  await appConn.query('ALTER TABLE books MODIFY author VARCHAR(500) NOT NULL');
  await appConn.query('ALTER TABLE books MODIFY shelf_location VARCHAR(255) DEFAULT \'Rak Koleksi Utama\'');
  
  const [cols] = await appConn.query('SHOW COLUMNS FROM books');
  const colNames = cols.map(c => c.Field);
  if (!colNames.includes('isbn')) {
    await appConn.query('ALTER TABLE books ADD COLUMN isbn VARCHAR(100) DEFAULT NULL');
  }
  if (!colNames.includes('catalog_id')) {
    await appConn.query('ALTER TABLE books ADD COLUMN catalog_id INT DEFAULT NULL');
  }

  // 1. Ambil seluruh katalog dari INLISLite
  console.log('⏳ Mengambil seluruh 13,680 katalog dari database inlislite_v3...');
  const catQuery = `
    SELECT 
      cat.ID, 
      cat.Title, 
      cat.Author, 
      cat.DeweyNo, 
      cat.ISBN,
      cat.CoverURL,
      COUNT(col.ID) as stockCount,
      MIN(col.CallNumber) as sampleCallNumber
    FROM catalogs cat
    LEFT JOIN collections col ON col.Catalog_id = cat.ID
    GROUP BY cat.ID
    ORDER BY cat.ID ASC
  `;

  const [inlisRows] = await inlisConn.query(catQuery);
  console.log(`✅ Berhasil mengambil ${inlisRows.length} data katalog dari INLISLite.`);

  // 2. Baca buku dari Lemari 3 (seed_books.js)
  const seedContent = fs.readFileSync(path.join(__dirname, 'seed_books.js'), 'utf8');
  const matchArray = seedContent.match(/const booksData = (\[[\s\S]*?\]);/);
  const lemari3Books = eval(matchArray[1]);
  console.log(`✅ Membaca ${lemari3Books.length} data buku dari Lemari 3 (seed_books.js).\n`);

  // Index Lemari 3 by normalized title
  const lemari3Map = new Map();
  for (const b of lemari3Books) {
    lemari3Map.set(norm(b.title), b);
  }

  // Siapkan data buku lengkap
  const finalBooks = [];
  let localCoverCount = 0;
  let hasIsbnCount = 0;

  for (const r of inlisRows) {
    const cTitle = cleanTitle(r.Title);
    const cAuthor = cleanAuthor(r.Author);
    const ddc = r.DeweyNo || '000';
    const category = getCategoryFromDDC(ddc);
    let shelf = getShelfFromDDC(ddc, r.sampleCallNumber);
    let stock = Math.max(1, Number(r.stockCount) || 1);

    // Cek kecocokan dengan Lemari 3
    const keyNorm = norm(cTitle);
    if (lemari3Map.has(keyNorm)) {
      const l3 = lemari3Map.get(keyNorm);
      if (l3.shelf) shelf = l3.shelf;
      if (l3.stock) stock = Math.max(stock, l3.stock);
      lemari3Map.delete(keyNorm); // Tandai sudah terhubung
    }

    // Ekstrak ISBN
    const isbns = extractISBNs(r.ISBN);
    const primaryIsbn = isbns[0] || (r.ISBN ? r.ISBN.replace(/[^0-9Xx-]/g, '').slice(0, 30) : null);
    if (primaryIsbn) hasIsbnCount++;

    // Cek apakah ada file cover di folder public/covers
    let coverUrl = null;
    if (r.CoverURL && localCoverFiles.has(r.CoverURL)) {
      coverUrl = `/covers/${r.CoverURL}`;
      localCoverCount++;
    }

    // Rating dan read count realistis
    const isPopular = /Tere Liye|Andrea Hirata|Pramoedya|Habiburrahman|Dewi Lestari|Coki Pardede/i.test(cAuthor);
    const rating = isPopular ? (4.7 + Math.random() * 0.3) : (4.2 + Math.random() * 0.7);
    const roundedRating = Math.min(5.0, Math.round(rating * 10) / 10);
    const readCount = isPopular ? Math.floor(20 + Math.random() * 30) : Math.floor(5 + Math.random() * 20);
    const ratingCount = Math.floor(readCount * 0.7);

    finalBooks.push({
      catalog_id: r.ID,
      title: cTitle,
      author: cAuthor,
      classification: ddc,
      category: category,
      shelf_location: shelf,
      stock: stock,
      rating: roundedRating,
      rating_count: ratingCount,
      read_count: readCount,
      cover_url: coverUrl,
      isbn: primaryIsbn
    });
  }

  // Masukkan sisa buku Lemari 3 yang belum ada di INLISLite
  for (const [key, l3] of lemari3Map.entries()) {
    finalBooks.push({
      catalog_id: null,
      title: l3.title,
      author: l3.author,
      classification: l3.classification || '813',
      category: l3.category || 'Novel',
      shelf_location: l3.shelf || 'Lemari 3, Rak 1',
      stock: l3.stock || 1,
      rating: 4.6,
      rating_count: 8,
      read_count: 14,
      cover_url: null,
      isbn: null
    });
  }

  console.log(`📊 Total koleksi yang akan dimasukkan ke database: ${finalBooks.length} buku.`);
  console.log(`   • Buku yang langsung memiliki foto sampul lokal: ${localCoverCount} buku`);
  console.log(`   • Buku dengan ISBN yang siap dicari online: ${hasIsbnCount} buku\n`);

  // 3. Reset tabel books di bibliotech_db dan batch insert
  console.log('💾 Mereset dan menyimpan seluruh buku ke bibliotech_db...');
  await appConn.query('DELETE FROM books');
  await appConn.query('ALTER TABLE books AUTO_INCREMENT = 1');

  const batchSize = 500;
  for (let i = 0; i < finalBooks.length; i += batchSize) {
    const chunk = finalBooks.slice(i, i + batchSize);
    const values = [];
    const placeholders = chunk.map(b => {
      values.push(
        b.title,
        b.author,
        b.classification,
        b.category,
        b.shelf_location,
        b.stock,
        b.rating,
        b.rating_count,
        b.read_count,
        b.cover_url,
        b.isbn,
        b.catalog_id
      );
      return '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)';
    }).join(', ');

    const sql = `
      INSERT INTO books 
        (title, author, classification, category, shelf_location, stock, rating, rating_count, read_count, cover_url, isbn, catalog_id)
      VALUES ${placeholders}
    `;

    await appConn.query(sql, values);
    process.stdout.write(`   ✓ Tersimpan: ${Math.min(i + batchSize, finalBooks.length)} / ${finalBooks.length} buku\r`);
  }

  console.log('\n\n========================================================');
  console.log(`🎉 SUKSES! Seluruh ${finalBooks.length} buku berhasil dimasukkan ke sistem!`);
  console.log('========================================================\n');

  await inlisConn.end();
  await appConn.end();
}

if (require.main === module) {
  importAllBooks().catch(console.error);
}

module.exports = { importAllBooks, cleanTitle, cleanAuthor, extractISBNs };
