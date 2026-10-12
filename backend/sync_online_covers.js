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
    .replace(/\s*\/.*?$/, '') // Hapus bagian MARC author
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Evaluasi kecocokan substring/kata judul
function isSubTitleMatch(exp, cand) {
  const normExp = normalizeTitle(exp);
  const normCand = normalizeTitle(cand);
  if (!normExp || !normCand) return false;
  if (normExp === normCand) return true;

  // Pembandingan kompak tanpa spasi (menangani variasi penulisan seperti 'EkaHindra' vs 'Eka Hindra')
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

// Validasi Kecocokan Judul (Title Matching)
function isTitleMatch(expectedTitle, candidateTitle) {
  if (!expectedTitle || !candidateTitle) return false;
  if (isSubTitleMatch(expectedTitle, candidateTitle)) return true;

  // Pecah berdasarkan pemisah subjudul seperti :, -, /
  const parts = expectedTitle.split(/[:\-\/]/);
  for (const part of parts) {
    if (isSubTitleMatch(part.trim(), candidateTitle)) return true;
  }
  return false;
}

// Validasi Kecocokan Penulis secara Ketat (Strict Author Matching)
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

    const matches = expectedWords.filter(w => normCand.includes(w) || compactCand.includes(w));
    if (matches.length > 0 && (matches.length >= Math.ceil(expectedWords.length * 0.4) || normCand.includes(normExpected) || normExpected.includes(normCand))) {
      return true;
    }
  }

  return false;
}

// Ekstrak ISBN bersih (13 digit atau 10 digit)
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
    client.get(url, { headers: { 'User-Agent': 'ParepareLibrarySystem/2.0 (Contact: library@parepare.go.id)' } }, (res) => {
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

// Helper download image ke folder lokal
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
          // Bila gambar berupa 1x1 pixel transparan atau corrupt (< 1000 bytes), hapus
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

async function syncOnlineCovers() {
  console.log('========================================================');
  console.log('🌐 SINKRONISASI SAMPUL ONLINE VIA ISBN (OPEN LIBRARY)');
  console.log('Ketentuan:');
  console.log('• Hanya buku tanpa sampul lokal di folder');
  console.log('• Gunakan ISBN dari database');
  console.log('• Validasi Judul & Penulis agar sampul akurat');
  console.log('• Unduh langsung file sampul ke folder public/covers');
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

  // Ambil buku yang belum memiliki cover_url dan memiliki isbn
  const [books] = await conn.query(`
    SELECT id, title, author, isbn 
    FROM books 
    WHERE (cover_url IS NULL OR cover_url = '') 
      AND isbn IS NOT NULL 
      AND TRIM(isbn) != ''
    ORDER BY id ASC
  `);

  console.log(`📋 Menemukan ${books.length} buku yang belum memiliki sampul di folder & memiliki ISBN.`);
  console.log('🚀 Memulai pencarian daring dalam batch (50 ISBN per request)...\n');

  // Siapkan pemetaan ISBN ke Book
  const isbnToBookList = new Map();
  const uniqueIsbnKeys = [];

  for (const book of books) {
    const isbns = extractISBNs(book.isbn);
    for (const rawIsbn of isbns) {
      const key = `ISBN:${rawIsbn}`;
      if (!isbnToBookList.has(key)) {
        isbnToBookList.set(key, []);
        uniqueIsbnKeys.push(key);
      }
      isbnToBookList.get(key).push(book);
    }
  }

  console.log(`🔑 Total ${uniqueIsbnKeys.length} ISBN unik yang akan dicek ke server Open Library.\n`);

  let matchedCovers = 0;
  let downloadedCount = 0;
  let mismatchedCount = 0;
  const batchSize = 50;

  for (let i = 0; i < uniqueIsbnKeys.length; i += batchSize) {
    const chunk = uniqueIsbnKeys.slice(i, i + batchSize);
    const chunkStr = chunk.join(',');
    const url = `https://openlibrary.org/api/books?bibkeys=${chunkStr}&format=json&jscmd=data`;

    const res = await fetchJson(url);

    if (res && typeof res === 'object') {
      for (const [isbnKey, olData] of Object.entries(res)) {
        if (!olData) continue;

        const candidateTitle = olData.title || '';
        const candidateAuthors = olData.authors || [];
        const coverObj = olData.cover;

        // Ambil URL sampul resolusi tertinggi
        const onlineCoverUrl = coverObj ? (coverObj.large || coverObj.medium || coverObj.small) : null;
        if (!onlineCoverUrl) continue;

        const matchedBookList = isbnToBookList.get(isbnKey) || [];

        for (const localBook of matchedBookList) {
          // Validasi Judul & Penulis
          const titleMatches = isTitleMatch(localBook.title, candidateTitle);
          const authorMatches = isAuthorMatch(localBook.author, candidateAuthors);

          if (titleMatches && authorMatches) {
            const cleanIsbn = isbnKey.replace('ISBN:', '');
            const localFileName = `isbn_${cleanIsbn}.jpg`;
            const destPath = path.join(coversDir, localFileName);

            // Unduh file sampul ke folder lokal jika belum ada
            let fileReady = fs.existsSync(destPath);
            if (!fileReady) {
              fileReady = await downloadImage(onlineCoverUrl, destPath);
              if (fileReady) {
                downloadedCount++;
                // Sync juga ke dist/covers jika folder dist ada
                if (fs.existsSync(distCoversDir)) {
                  try {
                    fs.copyFileSync(destPath, path.join(distCoversDir, localFileName));
                  } catch (e) {}
                }
              }
            }

            if (fileReady) {
              const coverUrlPath = `/covers/${localFileName}`;
              await conn.query('UPDATE books SET cover_url = ? WHERE id = ?', [coverUrlPath, localBook.id]);
              matchedCovers++;
              console.log(`✅ [ID ${localBook.id}] COCOK: "${localBook.title}"`);
              console.log(`   OL Judul : "${candidateTitle}"`);
              console.log(`   Sampul   : ${coverUrlPath} (Tersimpan di folder)`);
              console.log('--------------------------------------------------------');
            }
          } else {
            mismatchedCount++;
            console.log(`⚠️ [ID ${localBook.id}] Ditolak (Tidak Cocok):`);
            console.log(`   Lokal    : "${localBook.title}" oleh ${localBook.author}`);
            console.log(`   Online   : "${candidateTitle}" oleh ${candidateAuthors.map(a => a.name).join(', ')}`);
            console.log('--------------------------------------------------------');
          }
        }
      }
    }

    const progress = Math.min(i + batchSize, uniqueIsbnKeys.length);
    process.stdout.write(`⏳ Progress batch: ${progress} / ${uniqueIsbnKeys.length} ISBN diproses...\r`);
    await new Promise(r => setTimeout(r, 150));
  }

  console.log('\n\n========================================================');
  console.log('📊 RINGKASAN HASIL PENCARIAN ONLINE:');
  console.log(`   • Sampul Valid Ditemukan & Diunduh: ${matchedCovers} buku`);
  console.log(`   • File Gambar Baru di Folder: ${downloadedCount} file`);
  console.log(`   • Calon Tidak Cocok / Ditolak: ${mismatchedCount} buku`);
  console.log('========================================================\n');

  // Cek status akhir di database
  const [finalStatus] = await conn.query(`
    SELECT 
      COUNT(*) as total,
      COUNT(cover_url) as with_cover,
      COUNT(CASE WHEN cover_url IS NULL THEN 1 END) as without_cover
    FROM books
  `);
  console.log('📚 Status Database Akhir:');
  console.log(`   • Total Buku           : ${finalStatus[0].total}`);
  console.log(`   • Memiliki Foto Sampul : ${finalStatus[0].with_cover}`);
  console.log(`   • Sampul Elegan 3D CSS : ${finalStatus[0].without_cover}`);
  console.log('========================================================\n');

  await conn.end();
}

if (require.main === module) {
  syncOnlineCovers().catch(console.error);
}

module.exports = { syncOnlineCovers };
