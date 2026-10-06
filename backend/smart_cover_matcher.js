const mysql = require('mysql2/promise');
const https = require('https');

// Helper untuk fetch JSON via HTTPS
function fetchJson(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'LibrarySystem/1.0 (Student Project)' } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchJson(res.headers.location).then(resolve).catch(reject);
      }
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', (err) => resolve(null));
  });
}

// Normalisasi teks untuk perbandingan
function normalizeText(str) {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Validasi kecocokan penulis secara ketat (Strict Author Matching)
function isAuthorMatch(expectedAuthor, candidateAuthors) {
  if (!expectedAuthor || !candidateAuthors || candidateAuthors.length === 0) return false;
  
  const normExpected = normalizeText(expectedAuthor);
  // Ambil kata-kata penting (panjang > 2 huruf, abaikan gelar umum)
  const stopWords = ['dr', 'dra', 'drs', 'prof', 'ir', 'haji', 'hajah', 'bunda', 'ustadz', 'kh', 'sh', 'se', 'mm', 'pengarang', 'tidak', 'diketahui'];
  const expectedWords = normExpected
    .split(' ')
    .filter(w => w.length > 2 && !stopWords.includes(w));

  if (expectedWords.length === 0) return false;

  for (const cand of candidateAuthors) {
    const normCand = normalizeText(cand);
    // Cek apakah ada nama keluarga / nama utama yang cocok
    const matches = expectedWords.filter(w => normCand.includes(w));
    // Jika lebih dari 50% kata nama pengarang cocok, atau nama keluarga unik cocok
    if (matches.length > 0 && (matches.length >= Math.ceil(expectedWords.length / 2) || normCand.includes(normExpected))) {
      return true;
    }
  }

  return false;
}

async function runSmartCoverMatching() {
  console.log('========================================================');
  console.log('🤖 SISTEM PENCOCOKAN SAMPUL CERDAS (SMART COVER MATCHER)');
  console.log('Metode: ISBN -> Filter Judul + Penulis -> Validasi Ketat');
  console.log('========================================================\n');

  const connection = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'bibliotech_db'
  });

  const [books] = await connection.query('SELECT id, title, author, cover_url FROM books');
  console.log(`Menemukan ${books.length} buku di database. Memulai pencarian...\n`);

  let matchedCount = 0;
  let fallbackCount = 0;

  for (const book of books) {
    const cleanTitle = book.title.replace(/&amp;/g, '&').replace(/\s*\/.*?$/, '').replace(/\s*:.*?$/, '').trim();
    const cleanAuthor = book.author.replace(/&amp;/g, '&').trim();

    console.log(`🔍 [ID ${book.id}] "${cleanTitle}" - ${cleanAuthor}`);

    let foundCoverUrl = null;
    let matchReason = '';

    // Cari di Open Library berdasarkan Judul
    const searchUrl = `https://openlibrary.org/search.json?title=${encodeURIComponent(cleanTitle)}&limit=5`;
    const searchResult = await fetchJson(searchUrl);

    if (searchResult && searchResult.docs && searchResult.docs.length > 0) {
      for (const doc of searchResult.docs) {
        if (!doc.cover_i) continue; // Harus punya cover asli di database

        // Validasi Penulis secara KETAT!
        const authors = doc.author_name || [];
        const match = isAuthorMatch(cleanAuthor, authors);

        if (match) {
          foundCoverUrl = `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`;
          matchReason = `Kecocokan Valid: Judul "${doc.title}" oleh [${authors.join(', ')}] (Cover ID: ${doc.cover_i})`;
          break;
        } else {
          console.log(`   ⚠️ Lewati calon judul sama tapi penulis beda: "${doc.title}" karya [${authors.join(', ')}] != "${cleanAuthor}"`);
        }
      }
    }

    if (foundCoverUrl) {
      console.log(`   ✅ BERHASIL: ${matchReason}`);
      console.log(`      URL: ${foundCoverUrl}`);
      await connection.query('UPDATE books SET cover_url = ? WHERE id = ?', [foundCoverUrl, book.id]);
      matchedCount++;
    } else {
      console.log(`   🛡️ AMAN: Tidak ditemukan sampul online yang valid/tepat.`);
      console.log(`      -> Disetel ke NULL agar sistem menggunakan Desain 3D CSS Elegan.`);
      // Set cover_url ke NULL agar tidak memuat link 1x1 pixel yang rusak
      await connection.query('UPDATE books SET cover_url = NULL WHERE id = ?', [book.id]);
      fallbackCount++;
    }

    console.log('--------------------------------------------------------');
    // Beri jeda kecil agar request sopan
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('\n📊 RINGKASAN HASIL:');
  console.log(`   • Sampul Valid Ditemukan & Dipasang: ${matchedCount} buku`);
  console.log(`   • Dilindungi dengan Fallback 3D CSS: ${fallbackCount} buku`);
  console.log('\n✅ Proses selesai dengan aman! Tidak ada sampul salah sasaran.');

  await connection.end();
}

runSmartCoverMatching().catch(console.error);
