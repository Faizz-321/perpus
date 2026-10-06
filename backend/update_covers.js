const fs = require('fs');
const mysql = require('mysql2/promise');

async function updateCovers() {
  try {
    const xmlData = fs.readFileSync('../fileee.xml', 'utf8');
    const connection = await mysql.createConnection({
      host: 'localhost',
      user: 'root',
      password: '',
      database: 'bibliotech_db'
    });

    console.log('Terhubung ke database, mulai mencocokkan ISBN dari XML...');
    const [books] = await connection.execute('SELECT id, title FROM books');

    const records = xmlData.split('<record');
    let matchCount = 0;
    let foundIsbns = 0;

    for (let record of records) {
      if (!record.includes('</record>')) continue;
      
      // Cari ISBN di tag 020
      const isbnMatch = record.match(/<datafield tag="020"[\s\S]*?<subfield code="a">(.*?)<\/subfield>/);
      let isbn = isbnMatch ? isbnMatch[1].trim() : null;
      if (isbn) {
          isbn = isbn.replace(/[^0-9Xx-]/g, ''); // Bersihkan ISBN
      }

      // Cari Judul di tag 245
      const titleMatch = record.match(/<datafield tag="245"[\s\S]*?<subfield code="a">(.*?)<\/subfield>/);
      let title = titleMatch ? titleMatch[1].trim() : null;
      
      if (isbn && title) {
        foundIsbns++;
        // Bersihkan judul dari karakter trailing seperti / atau : yang umum di MARC
        title = title.replace(/\s*\/.*?$/, '').trim(); 
        title = title.replace(/\s*:.*?$/, '').trim();

        // Cari di database (case insensitive & substring match)
        const matchedBook = books.find(b => 
          b.title.toLowerCase() === title.toLowerCase() || 
          b.title.toLowerCase().includes(title.toLowerCase()) || 
          title.toLowerCase().includes(b.title.toLowerCase())
        );
        
        if (matchedBook) {
          // Buat URL cover menggunakan OpenLibrary
          const coverUrl = `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg`;
          await connection.execute('UPDATE books SET cover_url = ? WHERE id = ?', [coverUrl, matchedBook.id]);
          matchCount++;
          console.log(`Cocok: "${title}" -> ISBN: ${isbn}`);
        }
      }
    }

    console.log(`\nSelesai! Ditemukan ${foundIsbns} buku dengan ISBN di XML.`);
    console.log(`Berhasil mencocokkan dan memperbarui sampul untuk ${matchCount} buku di database!`);
    await connection.end();
  } catch (err) {
    console.error('Terjadi kesalahan:', err);
  }
}

updateCovers();
