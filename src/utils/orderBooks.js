/**
 * Utilitas untuk memproses, memformat, dan memisahkan judul buku pada pesanan (orders).
 * 
 * Mengatasi masalah judul buku yang mengandung tanda koma (contoh: "Pelacur,Politik Dan He he he")
 * agar TIDAK terbelah menjadi 2 buku yang salah di Dashboard Staf maupun Tiket Pengunjung.
 */

/**
 * Serialisasi daftar buku yang dipesan ke dalam format string aman (JSON array).
 * Format ini menjamin judul dengan koma, tanda petik, maupun karakter khusus tidak terpotong.
 * 
 * @param {Array<string|object>} books - Array buku atau judul buku
 * @returns {string} String JSON yang aman disimpan ke database MySQL
 */
export function serializeOrderBookTitles(books) {
  if (!books) return '[]';
  if (!Array.isArray(books)) {
    return JSON.stringify([String(books).trim()].filter(Boolean));
  }
  const titles = books
    .map(b => (typeof b === 'string' ? b.trim() : (b?.title || '')).trim())
    .filter(Boolean);
  return JSON.stringify(titles);
}

/**
 * Parsing string judul buku dari database ke dalam array judul buku yang akurat.
 * 
 * Mendukung:
 * 1. JSON Array: '["Judul 1", "Judul, dengan koma"]'
 * 2. Delimiter khusus: " ||| ", " /// ", " || "
 * 3. Pencocokan Cerdas dengan Katalog Buku: Jika sebuah judul di database mengandung koma
 *    (misal "Pelacur,Politik Dan He he he"), sistem memeriksa katalog buku agar tidak dipecah sembarangan.
 * 4. Backward-compatibility untuk data lama yang digabung dengan koma spasi (", ").
 * 
 * @param {string|Array} bookField - Field buku dari pesanan
 * @param {Array} [catalogBooks=[]] - Daftar buku dari katalog / API untuk verifikasi judul asli
 * @returns {string[]} Array judul buku
 */
export function parseOrderBookTitles(bookField, catalogBooks = []) {
  if (!bookField) return [];
  if (Array.isArray(bookField)) {
    return bookField
      .map(b => (typeof b === 'string' ? b.trim() : (b?.title || '')).trim())
      .filter(Boolean);
  }
  if (typeof bookField !== 'string') {
    return [String(bookField).trim()].filter(Boolean);
  }

  const trimmed = bookField.trim();
  if (!trimmed) return [];

  // 1. Coba parse sebagai JSON Array
  if ((trimmed.startsWith('[') && trimmed.endsWith(']')) || (trimmed.startsWith('{') && trimmed.endsWith('}'))) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed
          .map(b => (typeof b === 'string' ? b.trim() : (b?.title || '')).trim())
          .filter(Boolean);
      }
    } catch {
      // Jika bukan valid JSON, lanjutkan ke langkah berikutnya
    }
  }

  // 2. Cek delimiter non-koma yang mungkin digunakan
  if (trimmed.includes(' ||| ')) {
    return trimmed.split(' ||| ').map(s => s.trim()).filter(Boolean);
  }
  if (trimmed.includes(' /// ')) {
    return trimmed.split(' /// ').map(s => s.trim()).filter(Boolean);
  }
  if (trimmed.includes(' || ')) {
    return trimmed.split(' || ').map(s => s.trim()).filter(Boolean);
  }
  if (trimmed.includes('\n')) {
    return trimmed.split('\n').map(s => s.trim()).filter(Boolean);
  }

  // 3. Pencocokan Cerdas dengan Katalog Buku (Smart Catalog Matching)
  // Menangani kasus judul buku yang ada komanya seperti "Pelacur,Politik Dan He he he"
  if (Array.isArray(catalogBooks) && catalogBooks.length > 0) {
    // 3a. Cek apakah string pesanan persis cocok 100% dengan satu judul buku
    const exactMatch = catalogBooks.find(
      b => b?.title && b.title.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (exactMatch) {
      return [exactMatch.title.trim()];
    }

    // 3b. Greedy matching untuk pesanan lama berisi multi-buku yang digabung koma
    if (trimmed.includes(',')) {
      const sortedCatalog = [...catalogBooks]
        .filter(b => b?.title && b.title.trim().length > 0)
        .sort((a, b) => b.title.trim().length - a.title.trim().length);

      let remaining = trimmed;
      const matchedTitles = [];

      while (remaining.length > 0) {
        remaining = remaining.replace(/^[\s,]+/, '');
        if (!remaining) break;

        const remLower = remaining.toLowerCase();
        const found = sortedCatalog.find(b => {
          const t = b.title.trim().toLowerCase();
          if (remLower === t) return true;
          if (remLower.startsWith(t + ',') || remLower.startsWith(t + ' ,') || remLower.startsWith(t + ' , ')) return true;
          return false;
        });

        if (found) {
          matchedTitles.push(found.title.trim());
          remaining = remaining.slice(found.title.trim().length);
        } else {
          break;
        }
      }

      if (matchedTitles.length > 0 && remaining.trim() === '') {
        return matchedTitles;
      }
    }
  }

  // 4. Fallback jika tidak ada di katalog:
  // Jika koma TIDAK diikuti spasi (seperti "Pelacur,Politik"), JANGAN di-split!
  // Karena kemungkinan besar itu adalah 1 judul dengan tanda baca koma tanpa spasi.
  if (trimmed.includes(', ')) {
    return trimmed.split(', ').map(s => s.trim()).filter(Boolean);
  }

  // Jika koma nempel tanpa spasi ("Pelacur,Politik Dan He he he"), anggap sebagai 1 judul utuh
  return [trimmed];
}

/**
 * Format string ramah tampilan untuk notifikasi atau baris ringkas
 * @param {string|Array} bookField 
 * @param {Array} [catalogBooks=[]]
 * @param {string} [separator=' • ']
 * @returns {string}
 */
export function formatOrderBookTitles(bookField, catalogBooks = [], separator = ' • ') {
  const titles = parseOrderBookTitles(bookField, catalogBooks);
  return titles.join(separator);
}
