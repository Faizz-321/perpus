// ============================================================
// PENCOCOKAN SAMPUL CERDAS
// Membandingkan teks yang terbaca dari sampul (OCR / AI) dengan
// daftar judul & penulis, lalu mencari pasangan terbaik secara
// keseluruhan (Hungarian Algorithm) agar 1 judul = 1 sampul.
// ============================================================

const STOP_WORDS = new Set([
  'dan', 'di', 'ke', 'dari', 'yang', 'untuk', 'dengan', 'pada', 'oleh', 'karya', 'atau', 'itu', 'ini',
  'the', 'of', 'a', 'an', 'and', 'to', 'in', 'on', 'for'
]);
const AUTHOR_STOP = new Set(['dr', 'dra', 'drs', 'prof', 'ir', 'hj', 'h', 'kh', 'sh', 'se', 'mm', 'msi', 'mpd', 'spd', 'tidak', 'diketahui']);

export function normalizeText(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function tokenize(s, stop = STOP_WORDS) {
  const all = normalizeText(s).split(' ').filter((t) => t.length > 1);
  const filtered = all.filter((t) => !stop.has(t));
  return filtered.length ? filtered : all;
}

function levenshtein(a, b) {
  if (a === b) return 0;
  const prev = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    let diag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, diag + (a[i - 1] === b[j - 1] ? 0 : 1));
      diag = tmp;
    }
  }
  return prev[b.length];
}

// Nilai 0..1: seberapa baik satu kata target ditemukan dalam teks OCR
function tokenCredit(target, ocrTokens, ocrJoined) {
  let best = 0;
  for (const o of ocrTokens) {
    if (o === target) return 1;
    if (target.length >= 4 && o.length >= 3) {
      const sim = 1 - levenshtein(target, o) / Math.max(target.length, o.length);
      if (sim >= 0.72 && sim > best) best = sim;
    }
  }
  // Kata menempel karena OCR (misal "LASKARPELANGI")
  if (best < 0.9 && target.length >= 4 && ocrJoined.includes(target)) best = Math.max(best, 0.9);
  return best;
}

function fieldScore(targetText, ocr, stop) {
  const targets = tokenize(targetText, stop);
  if (targets.length === 0) return null;

  const totalWeight = targets.reduce((s, t) => s + t.length, 0);
  const got = targets.reduce((s, t) => s + t.length * tokenCredit(t, ocr.tokens, ocr.joined), 0);
  let score = got / totalWeight;

  // Bonus: seluruh frasa muncul utuh di sampul
  const phrase = normalizeText(targetText).replace(/ /g, '');
  if (phrase.length >= 4 && ocr.joined.includes(phrase)) score = 1;
  return score;
}

function prepareOcr(text) {
  const norm = normalizeText(text);
  return { tokens: norm.split(' ').filter((t) => t.length > 1), joined: norm.replace(/ /g, '') };
}

/** Skor kemiripan 0..1 antara teks sampul dan satu buku */
export function scoreCoverAgainstBook(ocrText, book) {
  const ocr = prepareOcr(ocrText);
  if (ocr.tokens.length === 0) return 0;

  const t = fieldScore(book.title, ocr, STOP_WORDS) ?? 0;
  const hasAuthor = book.author && !/^tidak diketahui$/i.test(book.author.trim());
  const a = hasAuthor ? fieldScore(book.author, ocr, AUTHOR_STOP) : null;

  return a === null ? t : 0.7 * t + 0.3 * a;
}

/**
 * Hungarian Algorithm (minimisasi biaya) untuk matriks persegi.
 * Mengembalikan assignment[row] = col.
 */
function hungarian(cost) {
  const n = cost.length;
  const INF = Number.MAX_SAFE_INTEGER;
  const u = new Array(n + 1).fill(0);
  const v = new Array(n + 1).fill(0);
  const p = new Array(n + 1).fill(0);
  const way = new Array(n + 1).fill(0);

  for (let i = 1; i <= n; i++) {
    p[0] = i;
    let j0 = 0;
    const minv = new Array(n + 1).fill(INF);
    const used = new Array(n + 1).fill(false);
    do {
      used[j0] = true;
      const i0 = p[j0];
      let delta = INF;
      let j1 = 0;
      for (let j = 1; j <= n; j++) {
        if (used[j]) continue;
        const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
        if (cur < minv[j]) {
          minv[j] = cur;
          way[j] = j0;
        }
        if (minv[j] < delta) {
          delta = minv[j];
          j1 = j;
        }
      }
      for (let j = 0; j <= n; j++) {
        if (used[j]) {
          u[p[j]] += delta;
          v[j] -= delta;
        } else {
          minv[j] -= delta;
        }
      }
      j0 = j1;
    } while (p[j0] !== 0);
    do {
      const j1 = way[j0];
      p[j0] = p[j1];
      j0 = j1;
    } while (j0);
  }

  const assignment = new Array(n).fill(-1);
  for (let j = 1; j <= n; j++) {
    if (p[j] > 0) assignment[p[j] - 1] = j - 1;
  }
  return assignment;
}

export const CONFIDENCE = {
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
  ELIMINATION: 'elimination',
  ORDER: 'order',
  MANUAL: 'manual',
  NONE: 'none'
};

/**
 * Cocokkan daftar buku dengan sampul berdasarkan teks sampul.
 * @param {Array<{title:string, author:string}>} books
 * @param {Array<{index:number, ocrText:string}>} covers
 * @returns {Array<{ coverIndex:number|null, score:number, confidence:string }>} sejajar dengan books
 */
export function matchBooksToCovers(books, covers) {
  const nB = books.length;
  const nC = covers.length;
  const scores = books.map((b) => covers.map((c) => scoreCoverAgainstBook(c.ocrText || '', b)));

  const N = Math.max(nB, nC);
  const cost = Array.from({ length: N }, (_, i) =>
    Array.from({ length: N }, (_, j) => (i < nB && j < nC ? 1 - scores[i][j] : 1))
  );
  // Biaya dalam bilangan bulat agar stabil
  const intCost = cost.map((row) => row.map((c) => Math.round(c * 100000)));
  const assignment = hungarian(intCost);

  const result = books.map((_, i) => {
    const j = assignment[i];
    if (j < 0 || j >= nC) return { coverIndex: null, score: 0, confidence: CONFIDENCE.NONE };

    const s = scores[i][j];
    let competitor = 0;
    for (let k = 0; k < nB; k++) if (k !== i) competitor = Math.max(competitor, scores[k][j]);
    for (let l = 0; l < nC; l++) if (l !== j) competitor = Math.max(competitor, scores[i][l]);
    const margin = s - competitor;

    let confidence = CONFIDENCE.LOW;
    if (s >= 0.55 && margin >= 0.12) confidence = CONFIDENCE.HIGH;
    else if (s >= 0.3) confidence = CONFIDENCE.MEDIUM;

    return { coverIndex: covers[j].index, score: s, confidence };
  });

  // Eliminasi: jika hanya tersisa 1 pasangan lemah dan jumlah judul = sampul,
  // pasangan itu otomatis benar bila semua pasangan lain sudah yakin.
  if (nB === nC) {
    const weak = result.filter((r) => r.confidence === CONFIDENCE.LOW || r.confidence === CONFIDENCE.MEDIUM);
    if (weak.length === 1) weak[0].confidence = CONFIDENCE.ELIMINATION;
  }

  return result;
}

/** Pencocokan berdasarkan urutan (judul ke-n = sampul ke-n) */
export function matchByOrder(books, covers) {
  return books.map((_, i) => ({
    coverIndex: i < covers.length ? covers[i].index : null,
    score: 1,
    confidence: i < covers.length ? CONFIDENCE.ORDER : CONFIDENCE.NONE
  }));
}

/** Skor terbaik sebuah sampul terhadap semua buku (untuk memutuskan OCR ulang) */
export function bestScoreForCover(ocrText, books) {
  let best = 0;
  for (const b of books) best = Math.max(best, scoreCoverAgainstBook(ocrText, b));
  return best;
}
