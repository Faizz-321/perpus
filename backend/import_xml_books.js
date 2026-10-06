const fs = require('fs');
const mysql = require('mysql2/promise');

async function importXmlBooks() {
  try {
    const xmlData = fs.readFileSync('../fileee.xml', 'utf8');
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'bibliotech_db'
    });

    console.log('Terhubung ke database, mulai memproses XML...');
    
    // Hapus semua buku yang 261 itu
    await connection.execute('DELETE FROM books');
    await connection.execute('ALTER TABLE books AUTO_INCREMENT = 1');
    console.log('Berhasil menghapus buku lama.');

    const records = xmlData.split('<record');
    let insertedCount = 0;

    for (let record of records) {
      if (!record.includes('</record>')) continue;
      
      // Ambil ISBN
      const isbnMatch = record.match(/<datafield tag="020"[\s\S]*?<subfield code="a">(.*?)<\/subfield>/);
      let isbn = isbnMatch ? isbnMatch[1].trim().replace(/[^0-9Xx-]/g, '') : null;

      // Ambil Judul
      const titleMatch = record.match(/<datafield tag="245"[\s\S]*?<subfield code="a">(.*?)<\/subfield>/);
      let title = titleMatch ? titleMatch[1].trim().replace(/\s*\/.*?$/, '').replace(/\s*:.*?$/, '') : 'Tanpa Judul';

      // Ambil Pengarang
      const authorMatch = record.match(/<datafield tag="100"[\s\S]*?<subfield code="a">(.*?)<\/subfield>/);
      let author = authorMatch ? authorMatch[1].trim() : 'Pengarang Tidak Diketahui';

      // Ambil Kategori (Subject)
      const categoryMatch = record.match(/<datafield tag="650"[\s\S]*?<subfield code="a">(.*?)<\/subfield>/);
      let category = categoryMatch ? categoryMatch[1].trim() : 'Umum';

      // Ambil Klasifikasi (Dewey)
      const classMatch = record.match(/<datafield tag="082"[\s\S]*?<subfield code="a">(.*?)<\/subfield>/);
      let classification = classMatch ? classMatch[1].trim() : '-';

      // Biarkan NULL agar sistem menggunakan cover 3D CSS elegan,
      // atau jalankan `node smart_cover_matcher.js` untuk mencocokkan cover online secara akurat.
      let coverUrl = null;

      // Masukkan ke database
      const query = `
        INSERT INTO books (title, author, classification, category, shelf_location, stock, cover_url) 
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      await connection.execute(query, [
        title, 
        author, 
        classification, 
        category, 
        'Rak Utama', 
        1, 
        coverUrl
      ]);

      insertedCount++;
      console.log(`+ Menambahkan: ${title} (ISBN: ${isbn || 'Tidak ada'})`);
    }

    console.log(`\n✅ Selesai! Berhasil memasukkan ${insertedCount} buku dari XML ke database.`);
    await connection.end();
  } catch (err) {
    console.error('Terjadi kesalahan:', err);
  }
}

importXmlBooks();
