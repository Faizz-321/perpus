// ============================================================
// PEMBACA PDF UNTUK IMPORT MASSAL BUKU
// - extractBookList : membaca PDF daftar judul & penulis
// - renderCoverPages: mengubah tiap halaman PDF sampul menjadi gambar
// ============================================================
import * as pdfjsLib from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl;

const COVER_WIDTH = 900; // lebar gambar sampul hasil render (px)

async function openPdf(file) {
  const data = new Uint8Array(await file.arrayBuffer());
  return pdfjsLib.getDocument({ data }).promise;
}

// ------------------------------------------------------------
// 1. DAFTAR JUDUL & PENULIS
// ------------------------------------------------------------

const HEADER_FIELDS = [
  { field: 'no', re: /^(no\.?|nomor|#)$/i },
  { field: 'title', re: /^judul/i },
  { field: 'author', re: /^(penulis|pengarang|author)/i },
  { field: 'publisher', re: /^penerbit/i },
  { field: 'year', re: /^(tahun|thn)/i }
];

const NUMBER_CELL = /^\d{1,4}[.)]?$/;
const NUMBER_PREFIX = /^\s*\d{1,4}\s*[.)]\s+/;

// Kelompokkan potongan teks PDF menjadi baris berdasarkan posisi Y
function groupIntoLines(items, pageNo) {
  const parsed = items
    .filter((it) => typeof it.str === 'string')
    .map((it) => ({
      str: it.str,
      x: it.transform[4],
      y: it.transform[5],
      w: it.width || 0,
      h: it.height || Math.abs(it.transform[3]) || 10
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const lines = [];
  for (const it of parsed) {
    const line = lines.find((l) => Math.abs(l.y - it.y) <= Math.max(2, it.h * 0.45));
    if (line) {
      line.items.push(it);
      line.h = Math.max(line.h, it.h);
    } else {
      lines.push({ page: pageNo, y: it.y, h: it.h, items: [it] });
    }
  }

  lines.forEach((l) => l.items.sort((a, b) => a.x - b.x));
  lines.sort((a, b) => b.y - a.y);
  return lines;
}

// Pecah satu baris menjadi sel berdasarkan jarak horizontal antar teks
function lineToCells(items) {
  const cells = [];
  let cur = null;
  for (const it of items) {
    if (!it.str.trim()) {
      continue;
    }
    const gapLimit = Math.max(4, it.h * 0.8);
    if (cur && it.x - cur.end <= gapLimit) {
      const needSpace = it.x - cur.end > it.h * 0.12 && !/\s$/.test(cur.text) && !/^\s/.test(it.str);
      cur.text += (needSpace ? ' ' : '') + it.str;
      cur.end = Math.max(cur.end, it.x + it.w);
    } else {
      cur = { x: it.x, end: it.x + it.w, text: it.str };
      cells.push(cur);
    }
  }
  return cells
    .map((c) => ({ x: c.x, text: c.text.replace(/\s+/g, ' ').trim() }))
    .filter((c) => c.text);
}

// Bagi item ke kolom tabel berdasarkan posisi X header
function lineToColumns(items, columns) {
  const buckets = columns.map(() => []);
  for (const it of items) {
    if (!it.str.trim()) continue;
    let idx = 0;
    for (let c = 0; c < columns.length; c++) {
      if (it.x + 3 >= columns[c].x) idx = c;
    }
    buckets[idx].push(it);
  }
  return buckets.map((b) => lineToCells(b).map((c) => c.text).join(' ').trim());
}

function detectHeader(cells) {
  const mapped = cells.map((c) => {
    const def = HEADER_FIELDS.find((h) => h.re.test(c.text));
    return def ? { field: def.field, x: c.x } : null;
  });
  const fields = mapped.filter(Boolean).map((m) => m.field);
  if (!fields.includes('title') || !fields.includes('author')) return null;
  // Header harus didominasi nama kolom (bukan baris data biasa)
  if (mapped.filter(Boolean).length < Math.ceil(cells.length * 0.6)) return null;
  return mapped.filter(Boolean);
}

function cleanField(s) {
  return String(s || '').replace(/\s+/g, ' ').replace(/^[|\-–—:\s]+|[|\-–—:\s]+$/g, '').trim();
}

function rowFromParts(parts) {
  const [title, author, publisher, year] = parts.map(cleanField);
  return { title: title || '', author: author || '', publisher: publisher || '', year: year || '' };
}

/**
 * Membaca PDF daftar buku.
 * Format yang didukung:
 *  - Tabel dengan header (No | Judul | Penulis | Penerbit | Tahun)
 *  - Satu buku per baris dipisah "|"  →  "1. Laskar Pelangi | Andrea Hirata"
 *  - Tabel tanpa header (kolom dipisah jarak)
 */
export async function extractBookList(file) {
  const pdf = await openPdf(file);
  const rows = [];
  const warnings = [];
  let totalTextLength = 0;
  let header = null; // [{ field, x }]
  let lastRow = null;
  let lastLine = null;

  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const lines = groupIntoLines(content.items, p);

    for (const line of lines) {
      const cells = lineToCells(line.items);
      if (cells.length === 0) continue;
      const fullText = cells.map((c) => c.text).join(' ').trim();
      totalTextLength += fullText.length;

      const isNearPrev =
        lastLine && lastLine.page === line.page && lastLine.y - line.y <= Math.max(line.h, lastLine.h) * 1.9;

      // --- Format "|" (garis tegak) ---
      if (fullText.includes('|')) {
        let parts = fullText.split('|');
        if (parts.filter((s) => s.trim()).length >= 2) {
          parts[0] = parts[0].replace(NUMBER_PREFIX, '');
          if (NUMBER_CELL.test(parts[0].trim()) && parts.length >= 3) parts = parts.slice(1);
          const maybeHeader = parts.map((t) => ({ text: t.trim(), x: 0 }));
          if (!detectHeader(maybeHeader)) {
            lastRow = rowFromParts(parts);
            rows.push(lastRow);
          }
          lastLine = line;
          continue;
        }
      }

      // --- Deteksi header tabel ---
      const foundHeader = detectHeader(cells);
      if (foundHeader) {
        header = foundHeader;
        lastRow = null;
        lastLine = line;
        continue;
      }

      // --- Tabel dengan header: bagi teks sesuai posisi kolom ---
      if (header) {
        const values = lineToColumns(line.items, header);
        const byField = {};
        header.forEach((h, i) => {
          byField[h.field] = values[i];
        });

        const hasNoCol = header.some((h) => h.field === 'no');
        const startsNewRow = hasNoCol ? NUMBER_CELL.test(byField.no || '') : Boolean(byField.title && byField.author);

        if (startsNewRow && byField.title) {
          lastRow = rowFromParts([byField.title, byField.author, byField.publisher, byField.year]);
          rows.push(lastRow);
        } else if (lastRow && isNearPrev && !byField.no) {
          // Lanjutan baris (judul/penulis panjang yang turun ke baris berikutnya)
          ['title', 'author', 'publisher', 'year'].forEach((f) => {
            if (byField[f]) lastRow[f] = cleanField(`${lastRow[f]} ${byField[f]}`);
          });
        }
        lastLine = line;
        continue;
      }

      // --- Tabel tanpa header: kolom dipisah jarak ---
      if (cells.length >= 2) {
        let parts = cells.map((c) => c.text);
        if (parts.length >= 3 && NUMBER_CELL.test(parts[0])) parts = parts.slice(1);
        else parts[0] = parts[0].replace(NUMBER_PREFIX, '');
        lastRow = rowFromParts(parts);
        lastRow._x = cells[NUMBER_CELL.test(cells[0].text) && cells.length >= 3 ? 1 : 0].x;
        rows.push(lastRow);
      } else if (lastRow && isNearPrev && lastRow._x !== undefined && cells[0].x >= lastRow._x - 3) {
        // Judul panjang yang terpotong ke baris bawah
        lastRow.title = cleanField(`${lastRow.title} ${cells[0].text}`);
      }
      lastLine = line;
    }
  }

  const cleaned = rows
    .map(({ _x, ...r }) => r)
    .filter((r) => r.title && !/^(judul|no)$/i.test(r.title));

  if (totalTextLength === 0) {
    throw new Error(
      'PDF daftar judul tidak berisi teks yang bisa dibaca. Kemungkinan PDF hasil scan/foto. Buat ulang dari Word/Excel lalu simpan sebagai PDF.'
    );
  }
  if (cleaned.length === 0) {
    throw new Error(
      'Tidak ada data buku yang dikenali. Pastikan formatnya tabel (No | Judul | Penulis) atau satu baris per buku dengan pemisah "|".'
    );
  }

  cleaned.forEach((r, i) => {
    if (!r.author) warnings.push(`Baris ${i + 1} ("${r.title}") tidak memiliki nama penulis.`);
  });

  return { rows: cleaned, warnings, pageCount: pdf.numPages };
}

// ------------------------------------------------------------
// 2. HALAMAN SAMPUL → GAMBAR
// ------------------------------------------------------------

function canvasToJpeg(canvas, quality = 0.86) {
  return canvas.toDataURL('image/jpeg', quality);
}

async function renderPdfPages(file, onProgress) {
  const pdf = await openPdf(file);
  const out = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const base = page.getViewport({ scale: 1 });
    const scale = Math.min(4, Math.max(1, COVER_WIDTH / base.width));
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    await page.render({ canvas, viewport, background: '#ffffff' }).promise;

    out.push({ source: `Halaman ${p}`, dataUrl: canvasToJpeg(canvas) });
    onProgress?.(p, pdf.numPages);
  }
  return out;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Gagal memuat gambar'));
    img.src = src;
  });
}

async function imageFileToJpeg(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadImage(url);
    const scale = Math.min(1, COVER_WIDTH / img.width);
    const canvas = document.createElement('canvas');
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvasToJpeg(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/**
 * Mengubah file sampul (PDF banyak halaman, atau beberapa file gambar) menjadi daftar gambar.
 * @returns {Promise<Array<{ index:number, source:string, dataUrl:string }>>}
 */
export async function renderCoverPages(files, onProgress) {
  const list = Array.from(files);
  const covers = [];

  for (const file of list) {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) {
      const pages = await renderPdfPages(file, (done, total) => onProgress?.(covers.length + done, null, total));
      const prefix = list.length > 1 ? `${file.name} · ` : '';
      pages.forEach((pg) => covers.push({ ...pg, source: prefix + pg.source }));
    } else if (file.type.startsWith('image/')) {
      covers.push({ source: file.name, dataUrl: await imageFileToJpeg(file) });
      onProgress?.(covers.length, null, list.length);
    }
  }

  return covers.map((c, i) => ({ ...c, index: i }));
}

// Versi gambar yang dipertajam (abu-abu + kontras tinggi) untuk OCR ulang
export async function enhanceForOcr(dataUrl) {
  const img = await loadImage(dataUrl);
  const canvas = document.createElement('canvas');
  const scale = img.width < 1200 ? 1.5 : 1;
  canvas.width = Math.round(img.width * scale);
  canvas.height = Math.round(img.height * scale);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const d = imgData.data;
  let min = 255;
  let max = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = g;
    if (g < min) min = g;
    if (g > max) max = g;
  }
  const range = Math.max(1, max - min);
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] - min) / range) * 255;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL('image/png');
}
