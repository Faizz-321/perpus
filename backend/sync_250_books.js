const mysql = require('mysql2/promise');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

// Normalisasi teks
function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Normalisasi judul buku
function normalizeTitle(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/\s*\/.*?$/, '') // Hapus bagian pengarang MARC
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Validasi kecocokan judul
function isSubTitleMatch(exp, cand) {
  const normExp = normalizeTitle(exp);
  const normCand = normalizeTitle(cand);
  if (!normExp || !normCand) return false;
  if (normExp === normCand) return true;

  // Pembandingan kompak tanpa spasi
  const compactExp = normExp.replace(/\s+/g, '');
  const compactCand = normCand.replace(/\s+/g, '');
  if (compactExp === compactCand) return true;
  if (compactExp.length >= 5 && (compactCand.includes(compactExp) || compactExp.includes(compactCand))) return true;

  const stopWords = ['buku', 'edisi', 'jilid', 'tentang', 'cara', 'panduan', 'lengkap', 'the', 'and', 'for', 'pada', 'dalam', 'yang', 'dan'];
  const expWords = normExp.split(' ').filter(w => w.length > 2 && !stopWords.includes(w));
  const candWords = normCand.split(' ').filter(w => w.length > 2 && !stopWords.includes(w));
  if (expWords.length === 0 || candWords.length === 0) return false;

  const common = expWords.filter(w => candWords.includes(w));
  return common.length >= Math.min(2, Math.ceil(expWords.length * 0.5));
}

function isTitleMatch(expectedTitle, candidateTitle) {
  if (!expectedTitle || !candidateTitle) return false;
  if (isSubTitleMatch(expectedTitle, candidateTitle)) return true;

  // Cek jika judul dipisahkan dengan tanda titik dua :, garis -, garis miring /, titik, atau kurung ()
  const parts = expectedTitle.split(/[:\-\/();.]/);
  for (const part of parts) {
    if (part.trim() && isSubTitleMatch(part.trim(), candidateTitle)) return true;
  }

  const candParts = candidateTitle.split(/[:\-\/();.]/);
  for (const cPart of candParts) {
    if (cPart.trim() && isSubTitleMatch(expectedTitle, cPart.trim())) return true;
    for (const part of parts) {
      if (part.trim() && cPart.trim() && isSubTitleMatch(part.trim(), cPart.trim())) return true;
    }
  }

  return false;
}

// Validasi kecocokan penulis secara ketat
function isAuthorMatch(expectedAuthor, candidateAuthors) {
  if (!expectedAuthor) return true;
  if (!candidateAuthors || candidateAuthors.length === 0) return true;

  const normExpected = normalizeText(expectedAuthor);
  const stopWords = ['dr', 'dra', 'drs', 'prof', 'ir', 'haji', 'hajah', 'bunda', 'ustadz', 'kh', 'sh', 'se', 'mm', 'pengarang', 'tidak', 'diketahui', 'tim', 'dkk', 'dan', 'the', 'oleh'];
  const expectedWords = normExpected.split(' ').filter(w => w.length > 2 && !stopWords.includes(w));
  if (expectedWords.length === 0) return true;

  const compactExpected = normExpected.replace(/\s+/g, '');

  for (const cand of candidateAuthors) {
    const rawCand = typeof cand === 'string' ? cand : cand?.name || '';
    const normCand = normalizeText(rawCand);
    if (!normCand) continue;

    const compactCand = normCand.replace(/\s+/g, '');
    if (compactExpected.includes(compactCand) || compactCand.includes(compactExpected)) return true;

    const candWords = normCand.split(' ').filter(w => w.length > 2 && !stopWords.includes(w));
    if (candWords.length > 0 && candWords.every(w => normExpected.includes(w))) return true;

    const matches = expectedWords.filter(w => normCand.includes(w) || compactCand.includes(w));
    if (matches.length > 0 && (matches.length >= Math.ceil(expectedWords.length * 0.4) || normCand.includes(normExpected) || normExpected.includes(normCand))) {
      return true;
    }
  }

  return false;
}

// Ekstrak ISBN bersih dari string di database
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

// Helper fetch JSON
function fetchJson(url) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, { headers: { 'User-Agent': 'LibrarySystem/2.0 (Student Project Parepare)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve);
      }
      if (res.statusCode !== 200) return resolve(null);
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// Helper download image ke file lokal
function downloadImage(url, destPath) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    client.get(url, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return downloadImage(res.headers.location, destPath).then(resolve);
      }
      if (res.statusCode !== 200) {
        return resolve(false);
      }
      const file = fs.createWriteStream(destPath);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        try {
          const stats = fs.statSync(destPath);
          // Bila gambar berupa 1x1 pixel atau corrupt (< 1000 bytes), hapus
          if (stats.size < 1000) {
            fs.unlinkSync(destPath);
            resolve(false);
          } else {
            resolve(true);
          }
        } catch (e) {
          resolve(false);
        }
      });
    }).on('error', () => {
      if (fs.existsSync(destPath)) {
        try { fs.unlinkSync(destPath); } catch (e) {}
      }
      resolve(false);
    });
  });
}

async function runSync250Books() {
  console.log('========================================================');
  console.log('📚 PENCARIAN SAMPUL KHUSUS 250 BUKU DARI DATABASE XAMPP');
  console.log('Metode: Ambil ISBN dari XAMPP -> Cari Online -> Cocokkan Judul & Penulis');
  console.log('========================================================\n');

  const coversDir = path.join(__dirname, '../public/covers');
  if (!fs.existsSync(coversDir)) {
    fs.mkdirSync(coversDir, { recursive: true });
  }
  const distCoversDir = path.join(__dirname, '../dist/covers');

  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'bibliotech_db'
  });

  // Ambil 250 buku pertama dari database XAMPP yang belum punya sampul di folder
  const query = `
    SELECT id, title, author, isbn 
    FROM books 
    WHERE (cover_url IS NULL OR cover_url = '') 
      AND isbn IS NOT NULL 
      AND TRIM(isbn) != ''
    ORDER BY id ASC 
    LIMIT 250
  `;

  const [books] = await conn.query(query);
  console.log(`📋 Berhasil mengambil ${books.length} buku dari database XAMPP untuk diproses.\n`);

  let matchedCount = 0;
  let downloadedCount = 0;
  let fallbackCount = 0;
  let mismatchedCount = 0;

  // Batch query Open Library dengan 50 ISBN per batch
  const batchSize = 50;
  for (let i = 0; i < books.length; i += batchSize) {
    const chunk = books.slice(i, i + batchSize);
    
    // Kumpulkan ISBN bersih dari chunk ini
    const isbnMap = new Map();
    const queryKeys = [];

    for (const b of chunk) {
      const isbns = extractISBNs(b.isbn);
      for (const cleanIsbn of isbns) {
        const key = `ISBN:${cleanIsbn}`;
        if (!isbnMap.has(key)) {
          isbnMap.set(key, []);
          queryKeys.push(key);
        }
        isbnMap.get(key).push(b);
      }
    }

    // Eksekusi batch bibkeys query (50 per batch)
    if (queryKeys.length > 0) {
      const url = `https://openlibrary.org/api/books?bibkeys=${queryKeys.join(',')}&format=json&jscmd=data`;
      const res = await fetchJson(url);

      if (res && typeof res === 'object') {
        for (const [key, olData] of Object.entries(res)) {
          if (!olData) continue;

          const candidateTitle = olData.title || '';
          const candidateAuthors = olData.authors || [];
          const coverObj = olData.cover;
          const coverUrl = coverObj ? (coverObj.large || coverObj.medium || coverObj.small) : null;

          const targetBooks = isbnMap.get(key) || [];

          for (const book of targetBooks) {
            const titleMatch = isTitleMatch(book.title, candidateTitle);
            const authorMatch = isAuthorMatch(book.author, candidateAuthors);

            if (coverUrl && titleMatch && authorMatch) {
              const cleanIsbn = key.replace('ISBN:', '');
              const fileName = `isbn_${cleanIsbn}.jpg`;
              const filePath = path.join(coversDir, fileName);

              let ready = fs.existsSync(filePath);
              if (!ready) {
                ready = await downloadImage(coverUrl, filePath);
                if (ready) {
                  downloadedCount++;
                  if (fs.existsSync(distCoversDir)) {
                    try { fs.copyFileSync(filePath, path.join(distCoversDir, fileName)); } catch(e) {}
                  }
                }
              }

              if (ready) {
                const dbCoverUrl = `/covers/${fileName}`;
                await conn.query('UPDATE books SET cover_url = ? WHERE id = ?', [dbCoverUrl, book.id]);
                matchedCount++;
                book.cover_url = dbCoverUrl;
                console.log(`✅ [ID ${book.id}] BERHASIL COCOK: "${book.title}"`);
                console.log(`   ISBN     : ${cleanIsbn} (dari database XAMPP)`);
                console.log(`   OL Judul : "${candidateTitle}"`);
                console.log(`   Sampul   : ${dbCoverUrl} (Tersimpan di folder public/covers)`);
                console.log('--------------------------------------------------------');
              }
            } else if (coverUrl && (!titleMatch || !authorMatch)) {
              mismatchedCount++;
              console.log(`⚠️ [ID ${book.id}] Dilewati (Judul/Penulis Beda): "${book.title}" != "${candidateTitle}"`);
            }
          }
        }
      }
    }

    // Hitung buku tanpa cover di chunk ini
    for (const book of chunk) {
      if (!book.cover_url) {
        fallbackCount++;
      }
    }

    const processed = Math.min(i + batchSize, books.length);
    console.log(`⏳ Progress: ${processed} dari ${books.length} buku selesai diproses...`);
    await new Promise(r => setTimeout(r, 100));
  }

  console.log('========================================================');
  console.log('📊 RINGKASAN HASIL 250 BUKU:');
  console.log(`   • Total Buku Diproses                  : ${books.length} buku`);
  console.log(`   • Sampul Ditemukan Online & Diunduh    : ${matchedCount} buku`);
  console.log(`   • File Sampul Baru di public/covers    : ${downloadedCount} file`);
  console.log(`   • Dilindungi dengan Desain 3D CSS      : ${fallbackCount} buku`);
  console.log('========================================================\n');

  // Cek total statistik buku di database XAMPP
  const [totalDb] = await conn.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(cover_url) as with_cover,
      COUNT(CASE WHEN cover_url LIKE '/covers/isbn_%' THEN 1 END) as online_covers,
      COUNT(CASE WHEN cover_url IS NULL OR cover_url = '' THEN 1 END) as css_covers
    FROM books
  `);

  console.log('📚 Status Database XAMPP Saat Ini:');
  console.log(`   • Total Koleksi Buku      : ${totalDb[0].total}`);
  console.log(`   • Total Buku Bersampul    : ${totalDb[0].with_cover}`);
  console.log(`   • Sampul dari Online ISBN : ${totalDb[0].online_covers}`);
  console.log(`   • Sampul Elegan 3D CSS    : ${totalDb[0].css_covers}`);
  console.log('========================================================\n');

  await conn.end();
}

if (require.main === module) {
  runSync250Books().catch(console.error);
}

module.exports = { runSync250Books };
