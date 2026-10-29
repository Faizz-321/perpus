const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

function cleanTitle(raw) {
  if (!raw) return 'Tanpa Judul';
  return raw
    .replace(/\s*\/.*?$/, '')
    .replace(/\s*;\s*$/, '')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanAuthor(raw) {
  if (!raw) return 'Pengarang Tidak Diketahui';
  return raw
    .replace(/\(Pengarang\)/gi, '')
    .replace(/\(Penerjemah\)/gi, '')
    .replace(/\(Penyunting\)/gi, '')
    .replace(/\(Editor\)/gi, '')
    .replace(/\(Ilustrator\)/gi, '')
    .replace(/\[et\.al\]/gi, 'dkk.')
    .replace(/\s*;\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^,\s*/, '')
    .replace(/,\s*$/, '') || 'Pengarang Tidak Diketahui';
}

function cleanIsbn(raw) {
  if (!raw) return null;
  const match13 = raw.match(/97[89][\d\-\s]{10,14}[\dX]/i);
  if (match13) {
    const clean = match13[0].replace(/[^\dX]/gi, '');
    if (clean.length === 13) return clean;
  }
  const match10 = raw.match(/[\d\-\s]{9,13}[\dX]/i);
  if (match10) {
    const clean = match10[0].replace(/[^\dX]/gi, '');
    if (clean.length === 10) return clean;
  }
  const digitsOnly = raw.replace(/[^\dX]/gi, '');
  if (digitsOnly.length === 10 || digitsOnly.length === 13) return digitsOnly;
  return null;
}

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

function getShelfFromDDC(ddc, callNum) {
  const cat = getCategoryFromDDC(ddc);
  const call = callNum ? ` [${callNum}]` : '';
  const prefix = ddc && ddc.trim() ? ddc.trim().charAt(0) : '0';
  return `Rak ${prefix}00 - ${cat}${call}`;
}

function normTitle(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function syncAllCoveredBooks() {
  console.log('========================================================');
  console.log('📚 MENARIK SELURUH BUKU BERSAMPUL DARI DATABASE & FOLDER');
  console.log('========================================================\n');

  const origDir = path.join(__dirname, '../original/Monograf');
  const pubDir = path.join(__dirname, '../public/covers');
  const distDir = path.join(__dirname, '../dist/covers');

  if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
  if (fs.existsSync(path.join(__dirname, '../dist')) && !fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
  }

  // 1. Kumpulkan seluruh file sampul fisik yang valid (> 100 bytes) di folder
  const validCoverMap = new Map(); // lowercase filename -> actual filename

  if (fs.existsSync(origDir)) {
    const origFiles = fs.readdirSync(origDir);
    let copiedToPub = 0;
    for (const f of origFiles) {
      const fullPath = path.join(origDir, f);
      try {
        const st = fs.statSync(fullPath);
        if (!st.isFile() || st.size <= 100) continue;
        validCoverMap.set(f.toLowerCase(), f);

        const pubDest = path.join(pubDir, f);
        if (!fs.existsSync(pubDest)) {
          fs.copyFileSync(fullPath, pubDest);
          copiedToPub++;
        }
        if (fs.existsSync(distDir)) {
          const distDest = path.join(distDir, f);
          if (!fs.existsSync(distDest)) {
            fs.copyFileSync(fullPath, distDest);
          }
        }
      } catch {}
    }
    console.log(`📁 Folder original/Monograf : ${validCoverMap.size} file sampul valid (${copiedToPub} baru disalin ke public/covers).`);
  }

  // Tambahkan juga file sampul valid yang ada di public/covers
  const pubFiles = fs.readdirSync(pubDir);
  for (const f of pubFiles) {
    const fullPath = path.join(pubDir, f);
    try {
      const st = fs.statSync(fullPath);
      if (st.isFile() && st.size > 100 && !validCoverMap.has(f.toLowerCase())) {
        validCoverMap.set(f.toLowerCase(), f);
      }
    } catch {}
  }
  console.log(`📁 Total file sampul unik tersedia di folder : ${validCoverMap.size} file.\n`);

  // 2. Baca referensi lokasi rak Lemari 3 jika tersedia
  const lemari3Map = new Map();
  const seedPath = path.join(__dirname, 'seed_books.js');
  if (fs.existsSync(seedPath)) {
    try {
      const seedContent = fs.readFileSync(seedPath, 'utf8');
      const matchArray = seedContent.match(/const booksData = (\[[\s\S]*?\]);/);
      if (matchArray) {
        const lemari3Books = eval(matchArray[1]);
        for (const b of lemari3Books) {
          lemari3Map.set(normTitle(b.title), b);
        }
      }
    } catch {}
  }

  const appConn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'bibliotech_db'
  });

  // Pastikan kolom isbn & catalog_id tersedia di tabel books
  const [cols] = await appConn.query('SHOW COLUMNS FROM books');
  const colNames = cols.map((c) => c.Field);
  if (!colNames.includes('isbn')) {
    await appConn.query('ALTER TABLE books ADD COLUMN isbn VARCHAR(100) DEFAULT NULL');
  }
  if (!colNames.includes('catalog_id')) {
    await appConn.query('ALTER TABLE books ADD COLUMN catalog_id INT DEFAULT NULL');
  }

  // Simpan statistik rating/baca dari buku yang sedang ada & buku manual staf (jika ada)
  const [existingBooks] = await appConn.query('SELECT * FROM books');
  const existingStatsMap = new Map();
  const manualStaffBooks = [];
  for (const eb of existingBooks) {
    existingStatsMap.set(Number(eb.id), {
      rating: eb.rating,
      rating_count: eb.rating_count,
      read_count: eb.read_count
    });
    if (eb.cover_url && eb.cover_url.includes('/covers/manual_')) {
      const fname = path.basename(eb.cover_url).toLowerCase();
      if (validCoverMap.has(fname)) {
        manualStaffBooks.push(eb);
      }
    }
  }

  // Cek juga rating asli dari tabel book_ratings
  const [realRatings] = await appConn.query(`
    SELECT book_id, ROUND(AVG(rating), 1) as avg_rating, COUNT(*) as cnt
    FROM book_ratings
    GROUP BY book_id
  `).catch(() => [[]]);
  const realRatingMap = new Map();
  for (const rr of realRatings) {
    realRatingMap.set(Number(rr.book_id), {
      rating: rr.avg_rating,
      rating_count: rr.cnt
    });
  }

  // 3. Tarik semua buku dari inlislite_v3.catalogs yang sampulnya ada di folder
  let matchedBooks = [];
  const [dbs] = await appConn.query("SHOW DATABASES LIKE 'inlislite_v3'");
  if (dbs.length > 0) {
    console.log('⏳ Menarik seluruh katalog bersampul dari database inlislite_v3...');
    const inlisConn = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'inlislite_v3'
    });

    const [catalogs] = await inlisConn.query(`
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
      WHERE cat.CoverURL IS NOT NULL 
        AND TRIM(cat.CoverURL) != ''
        AND cat.Title IS NOT NULL 
        AND TRIM(cat.Title) != ''
      GROUP BY cat.ID
      ORDER BY cat.ID ASC
    `);

    for (const c of catalogs) {
      const rawFile = path.basename(c.CoverURL.trim()).toLowerCase();
      if (!validCoverMap.has(rawFile)) continue;

      const actualFile = validCoverMap.get(rawFile);
      const title = cleanTitle(c.Title);
      const author = cleanAuthor(c.Author);
      const isbn = cleanIsbn(c.ISBN);
      const ddc = c.DeweyNo ? c.DeweyNo.trim() : '000';
      const category = getCategoryFromDDC(ddc);
      let shelf = getShelfFromDDC(ddc, c.sampleCallNumber);
      let stock = Math.max(1, Number(c.stockCount) || 1);

      const l3 = lemari3Map.get(normTitle(title));
      if (l3) {
        if (l3.shelf) shelf = l3.shelf;
        if (l3.stock) stock = Math.max(stock, l3.stock);
      }

      const prev = existingStatsMap.get(Number(c.ID));
      const realR = realRatingMap.get(Number(c.ID));

      const rating = realR ? realR.rating : (prev ? prev.rating : (4.2 + (c.ID % 8) * 0.1).toFixed(1));
      const ratingCount = realR ? realR.rating_count : (prev ? prev.rating_count : Math.floor(5 + (c.ID % 20)));
      const readCount = prev ? prev.read_count : Math.floor(10 + (c.ID % 40));

      matchedBooks.push([
        c.ID,
        title,
        author,
        ddc,
        category,
        shelf,
        stock,
        `/covers/${actualFile}`,
        rating,
        ratingCount,
        readCount,
        isbn,
        c.ID
      ]);
    }

    await inlisConn.end();
  } else {
    // Fallback ke books_backup_all jika inlislite_v3 tidak ada
    console.log('⏳ Menarik seluruh buku bersampul dari bibliotech_db.books_backup_all...');
    const [bkpRows] = await appConn.query(`
      SELECT * FROM books_backup_all
      WHERE cover_url IS NOT NULL AND TRIM(cover_url) != ''
      ORDER BY id ASC
    `);
    for (const b of bkpRows) {
      const rawFile = path.basename(b.cover_url.trim()).toLowerCase();
      if (!validCoverMap.has(rawFile)) continue;
      const actualFile = validCoverMap.get(rawFile);
      matchedBooks.push([
        b.id,
        b.title,
        b.author,
        b.classification || '000',
        b.category || 'Koleksi Umum',
        b.shelf_location || 'Rak Koleksi Utama',
        b.stock || 1,
        `/covers/${actualFile}`,
        b.rating || 4.5,
        b.rating_count || 5,
        b.read_count || 12,
        b.isbn || null,
        b.catalog_id || b.id
      ]);
    }
  }

  console.log(`✅ Ditemukan ${matchedBooks.length} buku di database yang sampulnya tersedia di folder!\n`);

  if (matchedBooks.length === 0) {
    console.error('❌ Tidak ada buku yang cocok, membatalkan perubahan agar data aman.');
    await appConn.end();
    return;
  }

  // 4. Simpan ke tabel aktif bibliotech_db.books secara batch
  console.log('💾 Memperbarui tabel aktif bibliotech_db.books...');
  await appConn.query('TRUNCATE TABLE books');

  const BATCH_SIZE = 200;
  const insertCols = '(id, title, author, classification, category, shelf_location, stock, cover_url, rating, rating_count, read_count, isbn, catalog_id)';

  for (let i = 0; i < matchedBooks.length; i += BATCH_SIZE) {
    const chunk = matchedBooks.slice(i, i + BATCH_SIZE);
    const placeholders = chunk.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
    const flatValues = chunk.flat();
    await appConn.query(`INSERT INTO books ${insertCols} VALUES ${placeholders}`, flatValues);
  }

  // Kembalikan juga buku unggahan manual staf jika ada
  for (const mb of manualStaffBooks) {
    await appConn.query(
      `INSERT IGNORE INTO books (title, author, classification, category, shelf_location, stock, cover_url, rating, rating_count, read_count, isbn)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        mb.title,
        mb.author,
        mb.classification || '000',
        mb.category || 'Koleksi Umum',
        mb.shelf_location || 'Rak Utama',
        mb.stock || 1,
        mb.cover_url,
        mb.rating || 4.5,
        mb.rating_count || 5,
        mb.read_count || 12,
        mb.isbn || null
      ]
    );
  }

  const [finalStats] = await appConn.query(`
    SELECT 
      COUNT(*) as total_books,
      COUNT(CASE WHEN cover_url IS NOT NULL AND TRIM(cover_url) != '' THEN 1 END) as with_cover,
      COUNT(CASE WHEN isbn IS NOT NULL AND TRIM(isbn) != '' THEN 1 END) as with_isbn
    FROM books
  `);

  console.log('========================================================');
  console.log('🎉 BERHASIL MENARIK SELURUH BUKU BERSAMPUL!');
  console.log(`   • Total Buku Aktif di Website : ${finalStats[0].total_books} buku`);
  console.log(`   • Memiliki File Sampul di Folder : ${finalStats[0].with_cover} buku (100% LENGKAP)`);
  console.log(`   • Memiliki Nomor ISBN         : ${finalStats[0].with_isbn} buku`);
  console.log('========================================================\n');

  await appConn.end();
}

if (require.main === module) {
  syncAllCoveredBooks().catch((err) => {
    console.error('❌ Terjadi kesalahan:', err);
    process.exit(1);
  });
}

module.exports = { syncAllCoveredBooks };

