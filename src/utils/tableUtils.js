/**
 * Utilitas untuk mengelola nomor meja dan integrasi URL QR Code Meja Perpustakaan.
 */

export const TOTAL_LIBRARY_TABLES = 24;

export const ALL_LIBRARY_TABLES = Array.from(
  { length: TOTAL_LIBRARY_TABLES },
  (_, i) => `Meja ${i + 1}`
);

/**
 * Normalisasi input parameter URL meja menjadi format standar "Meja X".
 * Mendukung format:
 * - "1" atau "01" -> "Meja 1"
 * - "meja 1", "meja01", "Meja-5" -> "Meja 1", "Meja 5"
 * - "Meja 12" -> "Meja 12"
 * 
 * @param {string|number} param 
 * @returns {string|null} Format "Meja X" atau null jika tidak valid
 */
export function normalizeTableParam(param) {
  if (param === null || param === undefined) return null;
  const raw = String(param).trim();
  if (!raw) return null;

  // Cari angka di dalam string
  const numMatch = raw.match(/\d+/);
  if (numMatch) {
    const num = parseInt(numMatch[0], 10);
    if (!isNaN(num) && num > 0) {
      return `Meja ${num}`;
    }
  }

  // Jika string huruf langsung (misal "VIP", "Bilik 1")
  return raw;
}

/**
 * Buat tautan URL pemesanan buku untuk meja tertentu
 * @param {string} baseUrl - Domain dasar (misal https://xxx.pinggy-free.link atau http://localhost:5173)
 * @param {number|string} tableIdentifier - Angka (1) atau nama ("Meja 1")
 * @returns {string} URL lengkap
 */
export function generateTableOrderUrl(baseUrl, tableIdentifier) {
  const cleanBase = (baseUrl || '').trim().replace(/\/+$/, '');
  const normalized = normalizeTableParam(tableIdentifier);
  const match = normalized?.match(/\d+/);
  const tableNum = match ? match[0] : (tableIdentifier || '1');
  return `${cleanBase}/qr-system?meja=${tableNum}`;
}
