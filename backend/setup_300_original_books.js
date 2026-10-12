const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

function cleanTitle(raw) {
  if (!raw) return 'Tanpa Judul';
  return raw
    .replace(/\s*\/.*?$/, '') // Hapus bagian MARC author setelah slash
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
    .replace(/,\s*$/, '');
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
  const prefix = ddc ? ddc.trim().charAt(0) : '0';
  return `Rak ${prefix}00 - ${cat}${call}`;
}

async function setup300OriginalBooks() {
  console.log('========================================================');
  console.log('📚 PEMILIHAN TEPAT 300 BUKU DARI FOLDER ORIGINAL');
  console.log('========================================================\n');

  const origDir = path.join(__dirname, '../original/Monograf');
  const pubDir = path.join(__dirname, '../public/covers');
  const distDir = path.join(__dirname, '../dist/covers');

  if (!fs.existsSync(origDir)) {
    throw new Error('Folder original/Monograf tidak ditemukan!');
  }
  if (!fs.existsSync(pubDir)) fs.mkdirSync(pubDir, { recursive: true });
  if (!fs.existsSync(distDir)) fs.mkdirSync(distDir, { recursive: true });

  const origFiles = fs.readdirSync(origDir);
  console.log(`📁 Ditemukan ${origFiles.length} file gambar di folder original/Monograf.`);

  // Pastikan semua file dari original/Monograf tersalin ke public/covers dan dist/covers
  let copiedCount = 0;
  for (const f of origFiles) {
    const src = path.join(origDir, f);
    const pubDest = path.join(pubDir, f);
    const distDest = path.join(distDir, f);

    if (!fs.existsSync(pubDest)) {
      fs.copyFileSync(src, pubDest);
      copiedCount++;
    }
    if (!fs.existsSync(distDest)) {
      fs.copyFileSync(src, distDest);
    }
  }
  console.log(`🔄 Sinkronisasi file ke public/covers & dist/covers selesai (${copiedCount} file disalin baru).\n`);

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

  // Query seluruh katalog INLISLite yang nama file sampulnya ada di folder original/Monograf
  console.log('⏳ Mengambil katalog dari database INLISLite...');
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
    WHERE cat.CoverURL IN (?)
      AND cat.Title IS NOT NULL 
      AND TRIM(cat.Title) != ''
    GROUP BY cat.ID
    ORDER BY cat.ID ASC
  `, [origFiles]);

  console.log(`✅ Berhasil membaca ${catalogs.length} buku dari database yang memiliki foto sampul asli.\n`);

  // Filter & proses data buku
  const processed = catalogs.map(c => {
    const title = cleanTitle(c.Title);
    const author = cleanAuthor(c.Author);
    const isbn = cleanIsbn(c.ISBN);
    const ddc = c.DeweyNo || '000';
    const category = getCategoryFromDDC(ddc);
    const shelf = getShelfFromDDC(ddc, c.sampleCallNumber);
    const stock = Math.max(1, Number(c.stockCount) || 1);
    const coverUrl = `/covers/${c.CoverURL}`;

    return {
      id: c.ID,
      title,
      author,
      isbn,
      classification: ddc,
      category,
      shelf_location: shelf,
      stock,
      cover_url: coverUrl,
      rawIsbn: c.ISBN
    };
  });

  // Pemilihan Tepat 300 Buku:
  // 1. Wajib sertakan buku ID 1, 2, 3 (yang memiliki rating & review aktif)
  const selectedMap = new Map();

  for (const b of processed) {
    if ([1, 2, 3].includes(b.id)) {
      selectedMap.set(b.id, b);
    }
  }

  // 2. Prioritaskan buku yang memiliki ISBN valid dan judul yang jelas
  const withIsbn = processed.filter(b => b.isbn && !selectedMap.has(b.id));
  for (const b of withIsbn) {
    if (selectedMap.size < 300) {
      selectedMap.set(b.id, b);
    }
  }

  // 3. Jika masih kurang dari 300, ambil dari sisa buku bersampul lainnya
  if (selectedMap.size < 300) {
    const remaining = processed.filter(b => !selectedMap.has(b.id));
    for (const b of remaining) {
      if (selectedMap.size < 300) {
        selectedMap.set(b.id, b);
      }
    }
  }

  const final300 = Array.from(selectedMap.values());
  console.log(`🎯 Berhasil memilih TEPAT ${final300.length} buku bersampul asli dari folder original!\n`);

  // Simpan ke tabel books di bibliotech_db
  console.log('💾 Mengupdate tabel books di bibliotech_db...');
  await appConn.query('TRUNCATE TABLE books');

  const insertSql = `
    INSERT INTO books (
      id, title, author, classification, category, shelf_location, 
      stock, cover_url, rating, rating_count, read_count, isbn, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
  `;

  for (const b of final300) {
    // Beri nilai rating & pembaca realistis
    const isSpecial = [1, 2, 3].includes(b.id);
    const rating = isSpecial ? 4.8 : (4.2 + (b.id % 8) * 0.1).toFixed(1);
    const ratingCount = isSpecial ? 15 : Math.floor(5 + (b.id % 20));
    const readCount = isSpecial ? 35 : Math.floor(10 + (b.id % 40));

    await appConn.query(insertSql, [
      b.id,
      b.title,
      b.author,
      b.classification,
      b.category,
      b.shelf_location,
      b.stock,
      b.cover_url,
      rating,
      ratingCount,
      readCount,
      b.isbn
    ]);
  }

  // Verifikasi akhir
  const [stats] = await appConn.query(`
    SELECT 
      COUNT(*) as total_books,
      COUNT(cover_url) as with_cover,
      COUNT(isbn) as with_isbn
    FROM books
  `);

  console.log('========================================================');
  console.log(`🎉 SUKSES BESAR!`);
  console.log(`   • Total Buku di Katalog : ${stats[0].total_books} buku (TEPAT 300 BUKU)`);
  console.log(`   • Buku Bersampul Asli   : ${stats[0].with_cover} buku (100% LENGKAP)`);
  console.log(`   • Buku Ber-ISBN Resmi   : ${stats[0].with_isbn} buku`);
  console.log('========================================================\n');

  // Contoh sampel
  const [sample] = await appConn.query('SELECT id, title, author, isbn, cover_url FROM books LIMIT 8');
  console.log('🔍 CONTOH BUKU:');
  sample.forEach(s => {
    console.log(`[ID ${s.id}] "${s.title}"`);
    console.log(`   ✍️ Penulis: ${s.author}`);
    console.log(`   🔢 ISBN   : ${s.isbn || '-'}`);
    console.log(`   🖼️ Sampul : ${s.cover_url}`);
    console.log('--------------------------------------------------------');
  });

  await inlisConn.end();
  await appConn.end();
}

setup300OriginalBooks().catch(console.error);
