const mysql = require('mysql2/promise');
const https = require('https');
const http = require('http');
const fs = require('fs');
const path = require('path');

function isbn13to10(isbn) {
  const clean = (isbn || '').replace(/[^0-9X]/gi, '');
  if (clean.length === 10) return clean;
  if (clean.length === 13 && clean.startsWith('978')) {
    const core = clean.slice(3, 12);
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += parseInt(core[i]) * (10 - i);
    const rem = (11 - (sum % 11)) % 11;
    const check = rem === 10 ? 'X' : rem.toString();
    return core + check;
  }
  return null;
}

function downloadImage(url, destPath) {
  return new Promise((resolve) => {
    const client = url.startsWith('https') ? https : http;
    const req = client.get(url, { timeout: 8000 }, (res) => {
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
    });
    req.on('timeout', () => {
      req.destroy();
      if (fs.existsSync(destPath)) try { fs.unlinkSync(destPath); } catch (e) {}
      resolve(false);
    });
    req.on('error', () => {
      if (fs.existsSync(destPath)) try { fs.unlinkSync(destPath); } catch (e) {}
      resolve(false);
    });
  });
}

// Data pembaruan khusus untuk buku-buku yang diselaraskan dengan ISBN & cover resmi
const specificUpdates = {
  // ID 559: The Laws of Lifetime Growth
  559: {
    title: 'The Laws of Lifetime Growth : Always Make Your Future Bigger Than Your Past',
    author: 'Dan Sullivan, Catherine Nomura'
  },
  // ID 13669: A Cup of Chicken Soup for the Soul
  13669: {
    title: 'A Cup of Chicken Soup for the Soul',
    author: 'Jack Canfield, Mark Victor Hansen'
  },
  // ID 13622: The Tipping Point
  13622: {
    title: 'The Tipping Point : How Little Things Can Make a Big Difference',
    author: 'Malcolm Gladwell'
  },
  // ID 13641: Twilight
  13641: {
    title: 'Twilight',
    author: 'Stephenie Meyer'
  },
  // ID 726: Torres El Nino My Story
  726: {
    title: 'Torres : El Nino My Story',
    author: 'Fernando Torres'
  },
  // ID 1202: Rahasia Super Achiever
  1202: {
    title: 'Rahasia Super Achiever : Menggali 15 Karakter Pribadi Super',
    author: 'Philip Baker'
  },
  // ID 10976: Blur (Melody Maker)
  10976: {
    title: 'Blur : The Illustrated Story (Melody Maker)',
    author: 'Paul Lester'
  },
  // ID 12561: Strategi Public Relations
  12561: {
    title: 'Public Relations Strategy (PR in Practice)',
    author: 'Sandra Oliver'
  },
  // ID 13588: Blonde Heat
  13588: {
    title: 'Blonde Heat',
    author: 'Susan Johnson'
  },
  // ID 13611: That Perfect Someone
  13611: {
    title: 'That Perfect Someone',
    author: 'Johanna Lindsey'
  },
  // ID 13612: The Pirate and the Pagan
  13612: {
    title: 'The Pirate and the Pagan',
    author: 'Virginia Henley'
  },
  // ID 13621: The Stars Shine Down
  13621: {
    title: 'The Stars Shine Down',
    author: 'Sidney Sheldon'
  },
  // ID 13629: Shopaholic Ties the Knot
  13629: {
    title: 'Shopaholic Ties the Knot',
    author: 'Sophie Kinsella'
  },
  // ID 13674: Three Complete Novels
  13674: {
    title: 'Three Complete Novels : A Night of Gaiety, A Duke In Danger, Secret Harbor',
    author: 'Barbara Cartland'
  }
};

async function syncIsbnSearchBooks() {
  console.log('========================================================');
  console.log('📚 SINKRONISASI RESMI ISBN, SAMPUL & PENULIS DARI ISBNSearch');
  console.log('========================================================\n');

  const publicCoversDir = path.join(__dirname, '../public/covers');
  const distCoversDir = path.join(__dirname, '../dist/covers');

  if (!fs.existsSync(publicCoversDir)) fs.mkdirSync(publicCoversDir, { recursive: true });
  if (!fs.existsSync(distCoversDir)) fs.mkdirSync(distCoversDir, { recursive: true });

  const conn = await mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'bibliotech_db'
  });

  const [books] = await conn.query('SELECT id, title, author, isbn, cover_url FROM books ORDER BY id ASC');
  console.log(`📋 Memeriksa ${books.length} buku di database bibliotech_db...\n`);

  let downloadedCount = 0;
  let updatedMetaCount = 0;

  for (const b of books) {
    const cleanIsbn = (b.isbn || '').replace(/[^0-9X]/gi, '');
    const isbn10 = isbn13to10(cleanIsbn);

    if (!isbn10) continue;

    // URL gambar resmi Amazon (CDN penyedia gambar untuk ISBNsearch.org)
    const amazonImgUrl = `https://images-na.ssl-images-amazon.com/images/P/${isbn10}.01.LZZZZZZZ.jpg`;
    const targetFileName = `isbn_${cleanIsbn}.jpg`;
    const publicTargetPath = path.join(publicCoversDir, targetFileName);
    const distTargetPath = path.join(distCoversDir, targetFileName);

    // Cek apakah Amazon memiliki sampul resmi untuk ISBN ini
    const isSpecialFix = (b.id === 559); // Buku The Laws of Lifetime Growth yang sebelumnya tertukar
    const isOnlineBook = b.cover_url && b.cover_url.includes('isbn_');

    if (isSpecialFix || isOnlineBook) {
      // Unduh sampul resmi dari Amazon / ISBNsearch
      const success = await downloadImage(amazonImgUrl, publicTargetPath);
      if (success) {
        // Copy ke dist/covers jika ada
        if (fs.existsSync(distCoversDir)) {
          fs.copyFileSync(publicTargetPath, distTargetPath);
        }
        downloadedCount++;

        const newCoverUrl = `/covers/${targetFileName}`;
        await conn.query('UPDATE books SET cover_url = ? WHERE id = ?', [newCoverUrl, b.id]);
        console.log(`🖼️ [ID ${b.id}] Berhasil perbarui sampul resmi: ${targetFileName} (Buku: ${b.title.substring(0, 40)}...)`);
      }
    }

    // Perbarui metadata pengarang / judul jika ada penyesuaian khusus
    if (specificUpdates[b.id]) {
      const up = specificUpdates[b.id];
      await conn.query('UPDATE books SET title = ?, author = ? WHERE id = ?', [up.title, up.author, b.id]);
      updatedMetaCount++;
      console.log(`✍️ [ID ${b.id}] Penulis & Judul disinkronkan: "${up.title}" oleh ${up.author}`);
    }
  }

  // Bersihkan juga format nama penulis umum
  const [allUpdated] = await conn.query('SELECT id, author FROM books');
  for (const b of allUpdated) {
    if (!b.author) continue;
    let clean = b.author
      .replace(/\(Pengarang\)/gi, '')
      .replace(/\(Penerjemah\)/gi, '')
      .replace(/\(Penyunting\)/gi, '')
      .replace(/\[et\.al\]/gi, 'dkk.')
      .replace(/,\s*,/g, ',')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/^,\s*/, '')
      .replace(/,\s*$/, '');
    
    if (clean !== b.author) {
      await conn.query('UPDATE books SET author = ? WHERE id = ?', [clean, b.id]);
    }
  }

  console.log('\n========================================================');
  console.log(`✅ SINKRONISASI SELESAI DENGAN SUKSES!`);
  console.log(`   • Sampul resmi yang diunduh & diperbarui: ${downloadedCount} buku`);
  console.log(`   • Judul & Penulis resmi yang diselaraskan: ${updatedMetaCount} buku`);
  console.log('========================================================\n');

  // Tampilkan verifikasi buku ID 559
  const [b559] = await conn.query('SELECT id, title, author, isbn, cover_url FROM books WHERE id = 559');
  console.log('🔍 VERIFIKASI BUKU ID 559:');
  console.log(b559[0]);

  await conn.end();
}

syncIsbnSearchBooks().catch(console.error);
