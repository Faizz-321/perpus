const mysql = require('mysql2/promise');
const https = require('https');

function fetchJson(url) {
  return new Promise(resolve => {
    https.get(url, { headers: { 'User-Agent': 'LibrarySystem/2.0' } }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch(e) { resolve(null); }
      });
    }).on('error', () => resolve(null));
  });
}

function cleanLocalAuthor(raw) {
  if (!raw) return 'Pengarang Tidak Diketahui';
  return raw
    .replace(/\s*\(Pengarang\)/gi, '')
    .replace(/\s*\(Penerjemah\)/gi, '')
    .replace(/\s*\(Penyunting\)/gi, '')
    .replace(/\s*\(Editor\)/gi, '')
    .replace(/\s*\(Ilustrator\)/gi, '')
    .replace(/Penyunting\s*[:;]?\s*.*$/i, '')
    .replace(/Penerjemah\s*[:;]?\s*.*$/i, '')
    .replace(/Ilustrator\s*[:;]?\s*.*$/i, '')
    .replace(/Editor\s*[:;]?\s*.*$/i, '')
    .replace(/\[et\.al\]/gi, 'dkk.')
    .replace(/\s*;\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^,\s*/, '')
    .replace(/,\s*$/, '');
}

function cleanLocalTitle(raw) {
  if (!raw) return 'Tanpa Judul';
  return raw
    .replace(/\s*\/.*?$/, '') // Hapus bagian slash pengarang
    .replace(/\s*;\s*$/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function syncTitlesAndAuthors() {
  console.log('========================================================');
  console.log('✨ MENYELARASKAN JUDUL & PENULIS DENGAN SAMPUL BUKU RESMI');
  console.log('========================================================\n');

  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'bibliotech_db'
  });

  const [books] = await conn.query('SELECT id, title, author, isbn, cover_url FROM books');
  console.log(`📋 Memproses ${books.length} buku di katalog...\n`);

  // 1. Sinkronisasi buku online ISBN dengan metadata resmi Open Library
  const onlineBooks = books.filter(b => b.cover_url && b.cover_url.includes('/covers/isbn_'));
  console.log(`🌐 Mengambil metadata resmi untuk ${onlineBooks.length} buku online via ISBN...`);

  const keys = onlineBooks.map(b => 'ISBN:' + b.isbn);
  const olDataMap = new Map();

  for (let i = 0; i < keys.length; i += 50) {
    const chunk = keys.slice(i, i + 50);
    const res = await fetchJson('https://openlibrary.org/api/books?bibkeys=' + chunk.join(',') + '&format=json&jscmd=data');
    if (res) {
      for (const [k, v] of Object.entries(res)) {
        if (v) {
          const cleanIsbn = k.replace('ISBN:', '');
          olDataMap.set(cleanIsbn, v);
        }
      }
    }
    await new Promise(r => setTimeout(r, 100));
  }

  let onlineUpdated = 0;
  for (const b of onlineBooks) {
    const ol = olDataMap.get(b.isbn);
    if (ol) {
      const olTitle = ol.title ? ol.title.trim() : null;
      const olAuthor = (ol.authors && ol.authors.length > 0) ? ol.authors.map(a => a.name).join(', ') : null;

      // Koreksi nama pengarang resmi
      let newAuthor = b.author;
      if (olAuthor) {
        newAuthor = olAuthor;
      }

      // Perbaiki judul jika judul database ada typo/terpotong
      let newTitle = b.title;
      // Jika di DB ada typo seperti "Blode Heat" -> "Blonde Heat", atau perbaikan ejaan resmi
      if (olTitle && (b.title.length < olTitle.length || b.title.includes('Blode') || b.title.includes('Perpect'))) {
        newTitle = olTitle;
      }

      // Khusus Tere Liye huruf kapital
      if (newAuthor.toLowerCase() === 'tere liye') newAuthor = 'Tere Liye';
      if (newAuthor.includes('Wirda Mansu')) newAuthor = 'Wirda Mansur';

      await conn.query('UPDATE books SET title = ?, author = ? WHERE id = ?', [newTitle, newAuthor, b.id]);
      onlineUpdated++;
    }
  }
  console.log(`✅ Berhasil menyelaraskan ${onlineUpdated} buku online dengan nama pengarang & judul resmi.\n`);

  // 2. Bersihkan judul dan pengarang buku koleksi lokal
  const localBooks = books.filter(b => !b.cover_url || !b.cover_url.includes('/covers/isbn_'));
  let localUpdated = 0;
  for (const b of localBooks) {
    const cleanedTitle = cleanLocalTitle(b.title);
    let cleanedAuthor = cleanLocalAuthor(b.author);

    // Perbaiki nama pengarang khusus yang sering ada di koleksi
    if (cleanedAuthor.includes('Coki Pardede') && !cleanedAuthor.includes('Tretan Muslim')) {
      cleanedAuthor = 'Coki Pardede & Tretan Muslim';
    }

    await conn.query('UPDATE books SET title = ?, author = ? WHERE id = ?', [cleanedTitle, cleanedAuthor, b.id]);
    localUpdated++;
  }
  console.log(`✅ Berhasil membersihkan ${localUpdated} buku lokal agar pengarang dan judul rapi dan serasi.\n`);

  // Tampilkan sampel hasil perbaikan
  console.log('========================================================');
  console.log('🔍 CONTOH HASIL PENYELARASAN:');
  const [samples] = await conn.query('SELECT id, title, author, cover_url FROM books LIMIT 15');
  samples.forEach(s => {
    console.log(`📖 [ID ${s.id}] "${s.title}"`);
    console.log(`   ✍️ Penulis: ${s.author}`);
    console.log(`   🖼️ Sampul : ${s.cover_url}`);
    console.log('--------------------------------------------------------');
  });

  await conn.end();
}

if (require.main === module) {
  syncTitlesAndAuthors().catch(console.error);
}

module.exports = { syncTitlesAndAuthors };
