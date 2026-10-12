const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const OUT_DIR = path.join(__dirname, '../public/templates');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

// 15 Sampel Buku Populer Indonesia
const BOOKS = [
  { no: 1, title: 'Laskar Pelangi', author: 'Andrea Hirata', publisher: 'Bentang Pustaka', year: '2005', color: [0.15, 0.45, 0.75] },
  { no: 2, title: 'Bumi', author: 'Tere Liye', publisher: 'Gramedia', year: '2014', color: [0.35, 0.25, 0.65] },
  { no: 3, title: 'Negeri 5 Menara', author: 'Ahmad Fuadi', publisher: 'Gramedia', year: '2009', color: [0.12, 0.55, 0.45] },
  { no: 4, title: 'Dilan 1990', author: 'Pidi Baiq', publisher: 'Pastel Books', year: '2014', color: [0.85, 0.45, 0.15] },
  { no: 5, title: 'Ronggeng Dukuh Paruk', author: 'Ahmad Tohari', publisher: 'Gramedia', year: '1982', color: [0.65, 0.25, 0.25] },
  { no: 6, title: 'Bumi Manusia', author: 'Pramoedya Ananta Toer', publisher: 'Hasta Mitra', year: '1980', color: [0.55, 0.45, 0.25] },
  { no: 7, title: 'Ayat-Ayat Cinta', author: 'Habiburrahman El Shirazy', publisher: 'Republika', year: '2004', color: [0.2, 0.5, 0.35] },
  { no: 8, title: 'Perahu Kertas', author: 'Dee Lestari', publisher: 'Bentang Pustaka', year: '2009', color: [0.25, 0.55, 0.75] },
  { no: 9, title: 'Cantik Itu Luka', author: 'Eka Kurniawan', publisher: 'Gramedia', year: '2002', color: [0.75, 0.2, 0.45] },
  { no: 10, title: 'Pulang', author: 'Leila S Chudori', publisher: 'KPG', year: '2012', color: [0.3, 0.35, 0.5] },
  { no: 11, title: 'Sang Pemimpi', author: 'Andrea Hirata', publisher: 'Bentang Pustaka', year: '2006', color: [0.2, 0.6, 0.65] },
  { no: 12, title: 'Hujan', author: 'Tere Liye', publisher: 'Gramedia', year: '2016', color: [0.25, 0.45, 0.6] },
  { no: 13, title: 'Filosofi Teras', author: 'Henry Manampiring', publisher: 'Kompas', year: '2018', color: [0.5, 0.3, 0.6] },
  { no: 14, title: 'Laut Bercerita', author: 'Leila S Chudori', publisher: 'KPG', year: '2017', color: [0.1, 0.35, 0.55] },
  { no: 15, title: 'Gadis Kretek', author: 'Ratih Kumala', publisher: 'Gramedia', year: '2012', color: [0.65, 0.4, 0.2] }
];

async function generateTablePdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4 Portrait
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Judul Dokumen
  page.drawText('DAFTAR BUKU KOLEKSI PERPUSTAKAAN', {
    x: 40,
    y: 800,
    size: 14,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.3)
  });
  page.drawText('Format: Tabel Resmi Pengadaan Buku Baru', {
    x: 40,
    y: 785,
    size: 9,
    font: fontReg,
    color: rgb(0.4, 0.4, 0.4)
  });

  // Header Tabel
  const startY = 755;
  const colX = [40, 68, 235, 385, 490];
  const headers = ['No', 'Judul Buku', 'Penulis / Pengarang', 'Penerbit', 'Tahun'];

  page.drawRectangle({
    x: 35,
    y: startY - 5,
    width: 525,
    height: 22,
    color: rgb(0.92, 0.94, 0.98)
  });

  headers.forEach((h, i) => {
    page.drawText(h, { x: colX[i], y: startY, size: 9, font: fontBold, color: rgb(0.15, 0.2, 0.35) });
  });

  // Baris Data
  let curY = startY - 26;
  BOOKS.forEach((b) => {
    page.drawText(String(b.no), { x: colX[0], y: curY, size: 8.5, font: fontReg });
    page.drawText(b.title.slice(0, 32), { x: colX[1], y: curY, size: 8.5, font: fontBold });
    page.drawText(b.author.slice(0, 26), { x: colX[2], y: curY, size: 8.5, font: fontReg });
    page.drawText(b.publisher.slice(0, 20), { x: colX[3], y: curY, size: 8.5, font: fontReg });
    page.drawText(b.year, { x: colX[4], y: curY, size: 8.5, font: fontReg });

    // Garis pemisah tipis
    page.drawLine({
      start: { x: 35, y: curY - 5 },
      end: { x: 560, y: curY - 5 },
      thickness: 0.5,
      color: rgb(0.85, 0.85, 0.88)
    });

    curY -= 22;
  });

  const bytes = await pdfDoc.save();
  fs.writeFileSync(path.join(OUT_DIR, 'contoh_daftar_buku_tabel.pdf'), bytes);
  console.log('✓ contoh_daftar_buku_tabel.pdf dibuat');
}

async function generateLinePdf() {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.28, 841.89]); // A4
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  page.drawText('DAFTAR BUKU BARU (FORMAT BARIS PEMISAH |)', {
    x: 40,
    y: 800,
    size: 13,
    font: fontBold,
    color: rgb(0.1, 0.15, 0.3)
  });
  page.drawText('Petunjuk: Satu buku per baris dengan format Judul | Penulis | Penerbit | Tahun', {
    x: 40,
    y: 785,
    size: 8.5,
    font: fontReg,
    color: rgb(0.4, 0.4, 0.4)
  });

  let curY = 745;
  BOOKS.forEach((b) => {
    const line = `${b.no}. ${b.title} | ${b.author} | ${b.publisher} | ${b.year}`;
    page.drawText(line, {
      x: 45,
      y: curY,
      size: 9.5,
      font: fontReg,
      color: rgb(0.15, 0.15, 0.2)
    });
    curY -= 24;
  });

  const bytes = await pdfDoc.save();
  fs.writeFileSync(path.join(OUT_DIR, 'contoh_daftar_buku_baris.pdf'), bytes);
  console.log('✓ contoh_daftar_buku_baris.pdf dibuat');
}

async function generateShuffledCoversPdf() {
  const pdfDoc = await PDFDocument.create();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  // Acak urutan buku secara sengaja agar staf bisa melihat kekuatan pencocok cerdas!
  // Urutan acak tetap deterministik:
  const shuffledOrder = [6, 1, 11, 3, 14, 2, 8, 12, 4, 15, 7, 9, 13, 5, 10]; // 1-indexed
  const shuffledBooks = shuffledOrder.map((no) => BOOKS.find((b) => b.no === no));

  for (let i = 0; i < shuffledBooks.length; i++) {
    const b = shuffledBooks[i];
    // Halaman ukuran cover rasio buku 3:4 (420 x 594 pt)
    const page = pdfDoc.addPage([420, 594]);
    const [cr, cg, cb] = b.color;

    // Latar belakang sampul warna-warni
    page.drawRectangle({
      x: 0,
      y: 0,
      width: 420,
      height: 594,
      color: rgb(cr, cg, cb)
    });

    // Bingkai dekorasi elegan
    page.drawRectangle({
      x: 20,
      y: 20,
      width: 380,
      height: 554,
      borderColor: rgb(1, 1, 1),
      borderWidth: 2,
      color: rgb(cr * 0.9, cg * 0.9, cb * 0.9)
    });

    // Tag kecil penerbit di atas
    page.drawText(b.publisher.toUpperCase(), {
      x: 40,
      y: 530,
      size: 10,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    // Judul Buku Besar & Jelas (untuk dibaca OCR dengan akurat)
    const words = b.title.split(' ');
    let titleY = 380;
    if (words.length <= 2) {
      page.drawText(b.title.toUpperCase(), {
        x: 40,
        y: titleY,
        size: 26,
        font: fontBold,
        color: rgb(1, 1, 1)
      });
    } else {
      const line1 = words.slice(0, 2).join(' ').toUpperCase();
      const line2 = words.slice(2).join(' ').toUpperCase();
      page.drawText(line1, { x: 40, y: titleY + 16, size: 24, font: fontBold, color: rgb(1, 1, 1) });
      page.drawText(line2, { x: 40, y: titleY - 14, size: 22, font: fontBold, color: rgb(1, 1, 1) });
    }

    // Garis aksen emas
    page.drawLine({
      start: { x: 40, y: 310 },
      end: { x: 220, y: 310 },
      thickness: 3,
      color: rgb(0.95, 0.8, 0.3)
    });

    // Penulis
    page.drawText('KARYA', {
      x: 40,
      y: 280,
      size: 9,
      font: fontReg,
      color: rgb(0.9, 0.9, 0.9)
    });
    page.drawText(b.author.toUpperCase(), {
      x: 40,
      y: 255,
      size: 16,
      font: fontBold,
      color: rgb(1, 1, 1)
    });

    // Keterangan nomor halaman acak di pojok bawah
    page.drawText(`HALAMAN ${i + 1} (URUTAN ACAK)`, {
      x: 40,
      y: 45,
      size: 8,
      font: fontReg,
      color: rgb(0.85, 0.85, 0.85)
    });
  }

  const bytes = await pdfDoc.save();
  fs.writeFileSync(path.join(OUT_DIR, 'contoh_sampul_acak.pdf'), bytes);
  console.log('✓ contoh_sampul_acak.pdf dibuat (15 halaman sampul urutan teracak)');
}

async function main() {
  console.log('Membuat file PDF template contoh...');
  await generateTablePdf();
  await generateLinePdf();
  await generateShuffledCoversPdf();
  console.log('Semua PDF contoh berhasil dibuat di public/templates/!');
}

main().catch(console.error);
