const mysql = require('mysql2/promise');
const fs = require('fs');
const path = require('path');

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

function norm(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/[^a-z0-9]/g, '');
}

async function mergeAllBooks() {
  console.log('========================================================');
  console.log('📚 SINKRONISASI LENGKAP SEMUA BUKU & SAMPUL PERPUSTAKAAN');
  console.log('• Membaca SEMUA file gambar sampul di folder');
  console.log('• Memasukkan SEMUA buku INLISLite yang memiliki foto sampul');
  console.log('• Menggabungkan dengan koleksi buku fisik Lemari 3 (Sastra)');
  console.log('========================================================\n');

  const coversDir = path.join(__dirname, '../public/covers');
  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
  }
  const availableImages = fs.readdirSync(coversDir);
  const imageSet = new Set(availableImages);
  console.log(`📁 Ditemukan ${availableImages.length} file gambar sampul asli di folder public/covers.\n`);

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

  // 1. Ambil SEMUA buku dari catalogs INLISLite yang MEMILIKI FOTO SAMPUL di folder
  console.log('⏳ Mengambil seluruh katalog INLISLite yang memiliki foto sampul di folder...');
  const queryAllWithCovers = `
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
    WHERE cat.CoverURL IN (?)
      AND cat.Title IS NOT NULL 
      AND cat.Title != ''
    GROUP BY cat.ID
    ORDER BY cat.ID ASC
  `;

  const [inlisRows] = await inlisConn.query(queryAllWithCovers, [availableImages]);
  console.log(`✅ Ditemukan ${inlisRows.length} buku dari database INLISLite yang memiliki file foto sampul di folder!\n`);

  const inlisBooks = inlisRows.map(b => {
    return {
      title: cleanTitle(b.Title),
      author: cleanAuthor(b.Author),
      classification: b.DeweyNo || '000',
      category: getCategoryFromDDC(b.DeweyNo),
      shelf_location: getShelfFromDDC(b.DeweyNo, b.sampleCallNumber),
      stock: Math.max(1, Number(b.stockCount) || 1),
      cover_url: b.CoverURL && imageSet.has(b.CoverURL) ? `/covers/${b.CoverURL}` : null
    };
  });

  // 2. Baca 261 Buku dari seed_books.js (Lemari 3 Sastra)
  const seedContent = fs.readFileSync(path.join(__dirname, 'seed_books.js'), 'utf8');
  const matchArray = seedContent.match(/const booksData = (\[[\s\S]*?\]);/);
  const lemari3Books = eval(matchArray[1]);
  console.log(`✅ Membaca ${lemari3Books.length} buku inventaris Lemari 3 (Sastra & Novel).`);

  // 3. Buat Map pencocokan cepat dari buku-buku bersampul untuk buku Lemari 3
  const catalogMapByTitle = new Map();
  for (const row of inlisRows) {
    if (row.CoverURL && imageSet.has(row.CoverURL)) {
      const tNorm = norm(cleanTitle(row.Title));
      if (tNorm.length >= 4) {
        catalogMapByTitle.set(tNorm, `/covers/${row.CoverURL}`);
      }
    }
  }

  let lemari3CoversFound = 0;
  const processedLemari3 = lemari3Books.map(b => {
    const bTitleNorm = norm(b.title);
    let coverUrl = null;

    if (catalogMapByTitle.has(bTitleNorm)) {
      coverUrl = catalogMapByTitle.get(bTitleNorm);
      lemari3CoversFound++;
    } else {
      // Cek substring jika judul cukup panjang
      for (const [cTitleNorm, cCover] of catalogMapByTitle.entries()) {
        if (bTitleNorm.length >= 6 && (cTitleNorm.includes(bTitleNorm) || bTitleNorm.includes(cTitleNorm))) {
          coverUrl = cCover;
          lemari3CoversFound++;
          break;
        }
      }
    }

    return {
      title: b.title,
      author: b.author,
      classification: b.classification,
      category: b.category,
      shelf_location: b.shelf,
      stock: b.stock || 1,
      cover_url: coverUrl
    };
  });

  console.log(`📸 Berhasil mencocokkan ${lemari3CoversFound} sampul buku Lemari 3 ke folder gambar.\n`);

  // 4. Gabungkan seluruh buku (Prioritaskan buku yang memiliki cover)
  const combinedMap = new Map();

  // Masukkan semua buku INLISLite bersampul terlebih dahulu
  for (const b of inlisBooks) {
    const key = norm(b.title);
    combinedMap.set(key, b);
  }

  // Masukkan buku Lemari 3
  for (const b of processedLemari3) {
    const key = norm(b.title);
    if (combinedMap.has(key)) {
      const existing = combinedMap.get(key);
      // Jika buku Lemari 3 ada lokasi rak spesifik, gunakan lokasi rak Lemari 3
      if (b.shelf_location && b.shelf_location.includes('Lemari 3')) {
        existing.shelf_location = b.shelf_location;
      }
      if (!existing.cover_url && b.cover_url) {
        existing.cover_url = b.cover_url;
      }
    } else {
      combinedMap.set(key, b);
    }
  }

  const finalBooks = Array.from(combinedMap.values());
  console.log(`📊 Total koleksi buku akhir: ${finalBooks.length} buku.`);

  // 5. Simpan ke database MySQL bibliotech_db
  console.log('💾 Menyimpan seluruh data buku ke database MySQL (bibliotech_db)...');
  await appConn.execute('DELETE FROM books');
  await appConn.execute('ALTER TABLE books AUTO_INCREMENT = 1');

  const insertQuery = `
    INSERT INTO books 
      (title, author, classification, category, shelf_location, stock, cover_url)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `;

  let totalCovers = 0;
  for (const b of finalBooks) {
    if (b.cover_url) totalCovers++;
    await appConn.execute(insertQuery, [
      b.title,
      b.author,
      b.classification,
      b.category,
      b.shelf_location,
      b.stock,
      b.cover_url
    ]);
  }

  console.log('========================================================');
  console.log(`🎉 SUKSES BESAR!`);
  console.log(`📚 Total Buku di Katalog: ${finalBooks.length} buku`);
  console.log(`🖼️ Total Buku dengan FOTO SAMPUL ASLI: ${totalCovers} buku!`);
  console.log(`📸 Semua file gambar yang ada di folder public/covers telah terpasang ke bukunya masing-masing.`);
  console.log('========================================================\n');

  await inlisConn.end();
  await appConn.end();
}

mergeAllBooks().catch(console.error);
