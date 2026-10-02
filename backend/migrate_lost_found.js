const mysql = require('mysql2');

const pool = mysql.createPool({
  host: 'localhost',
  user: 'root',
  password: '',
  database: 'bibliotech_db',
  waitForConnections: true,
  connectionLimit: 5
});

async function runMigration() {
  const promisePool = pool.promise();

  try {
    console.log('🔄 Memperbarui struktur tabel lost_found untuk Fitur Klaim & Ciri Rahasia...');

    // 1. Cek & tambah kolom category di lost_found
    const [catCol] = await promisePool.query("SHOW COLUMNS FROM lost_found LIKE 'category'");
    if (catCol.length === 0) {
      await promisePool.query("ALTER TABLE lost_found ADD COLUMN category VARCHAR(100) DEFAULT 'Lainnya'");
      console.log('✅ Kolom category ditambahkan!');
    }

    // 2. Cek & tambah kolom secret_question di lost_found
    const [sqCol] = await promisePool.query("SHOW COLUMNS FROM lost_found LIKE 'secret_question'");
    if (sqCol.length === 0) {
      await promisePool.query("ALTER TABLE lost_found ADD COLUMN secret_question VARCHAR(255) DEFAULT 'Sebutkan ciri khusus atau isi barang'");
      console.log('✅ Kolom secret_question ditambahkan!');
    }

    // 3. Update status enum jika belum ada pending_verification
    try {
      await promisePool.query("ALTER TABLE lost_found MODIFY COLUMN status ENUM('unclaimed', 'pending_verification', 'claimed') DEFAULT 'unclaimed'");
      console.log('✅ Status ENUM diperbarui dengan pending_verification!');
    } catch (e) {
      console.warn('Status column update:', e.message);
    }

    // 4. Buat tabel lost_found_claims
    await promisePool.query(`
      CREATE TABLE IF NOT EXISTS lost_found_claims (
        id INT AUTO_INCREMENT PRIMARY KEY,
        item_id INT NOT NULL,
        claim_code VARCHAR(30) NOT NULL,
        claimant_name VARCHAR(255) NOT NULL,
        claimant_contact VARCHAR(255) NOT NULL,
        secret_proof TEXT NOT NULL,
        status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_item (item_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
    console.log('✅ Tabel lost_found_claims siap digunakan!');

    // 5. Cek apakah sudah ada data awal, jika kosong isi sampel realistis
    const [items] = await promisePool.query('SELECT COUNT(*) as count FROM lost_found WHERE type = "found"');
    if (items[0].count === 0) {
      const sampleItems = [
        ['Tumbler Stainless Hitam', 'found', 'Meja 5 (Zona Baca Tenang)', 'Botol Minum', 'unclaimed', 'Sebutkan merk / stiker yang ada di tumbler', '081234567890'],
        ['Flashdisk Sandisk Merah 32GB', 'found', 'Komputer OPAC 2', 'Elektronik', 'unclaimed', 'Sebutkan nama folder atau file dokumen di dalamnya', '081234567890'],
        ['Kacamata Frame Hitam Bulat', 'found', 'Area Lemari 3 (Sastra)', 'Aksesoris', 'unclaimed', 'Sebutkan warna kotak / lap pembersih kacamata', '081234567890'],
        ['Dompet Kulit Cokelat', 'found', 'Meja 12 (Lantai 1)', 'Dokumen & Dompet', 'unclaimed', 'Sebutkan inisial nama di kartu identitas di dalam dompet', '081234567890'],
        ['Charger Laptop Type-C 65W', 'found', 'Meja 8 (Zona Diskusi)', 'Elektronik', 'unclaimed', 'Sebutkan merk charger dan ada coretan/tanda apa', '081234567890'],
      ];

      for (const item of sampleItems) {
        await promisePool.query(
          'INSERT INTO lost_found (item_name, type, location, category, status, secret_question, contact, report_date) VALUES (?, ?, ?, ?, ?, ?, ?, CURDATE())',
          item
        );
      }
      console.log('✅ 5 Sampel barang temuan realistis berhasil ditambahkan!');
    }

    console.log('🎉 Migrasi Lost & Found Klaim selesai!');
  } catch (err) {
    console.error('❌ Gagal migrasi:', err);
  } finally {
    pool.end();
  }
}

runMigration();
