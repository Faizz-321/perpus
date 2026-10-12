// ============================================================
// PEMBACA TULISAN SAMPUL
// - Tesseract.js (gratis, berjalan di browser)
// - Gemini Vision via backend (opsional, lebih akurat)
// ============================================================
import { createWorker } from 'tesseract.js';
import { enhanceForOcr } from './pdfReader';
import { bestScoreForCover } from './coverMatcher';

export async function getAiStatus() {
  try {
    const res = await fetch('/api/books/import/ai-status');
    if (!res.ok) return { gemini: false };
    return await res.json();
  } catch {
    return { gemini: false };
  }
}

async function readWithGemini(dataUrl) {
  const res = await fetch('/api/books/import/read-cover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: dataUrl })
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Gagal membaca sampul dengan AI');
  return data.text || '';
}

/**
 * Membaca teks dari semua sampul.
 * @param {Array<{index:number, dataUrl:string}>} covers
 * @param {Array<{title:string, author:string}>} books  dipakai untuk memutuskan perlu OCR ulang atau tidak
 * @param {'tesseract'|'gemini'} engine
 * @param {(info:{done:number,total:number,stage:string,progress?:number})=>void} onProgress
 * @returns {Promise<Array<{index:number, ocrText:string, engine:string}>>}
 */
export async function readAllCovers(covers, books, engine, onProgress) {
  const results = [];
  let worker = null;

  const ensureWorker = async () => {
    if (!worker) {
      onProgress?.({ done: results.length, total: covers.length, stage: 'Menyiapkan mesin pembaca (OCR)...' });
      worker = await createWorker(['ind', 'eng']);
    }
    return worker;
  };

  const tesseractRead = async (cover) => {
    const w = await ensureWorker();
    const first = await w.recognize(cover.dataUrl);
    let text = first.data.text || '';

    // Jika hasil kurang meyakinkan, baca ulang versi yang dipertajam
    if (bestScoreForCover(text, books) < 0.55) {
      const enhanced = await enhanceForOcr(cover.dataUrl);
      const second = await w.recognize(enhanced);
      text = `${text}\n${second.data.text || ''}`;
    }
    return text;
  };

  try {
    for (let i = 0; i < covers.length; i++) {
      const cover = covers[i];
      onProgress?.({ done: i, total: covers.length, stage: `Membaca tulisan sampul ${i + 1} dari ${covers.length}...` });

      let text = '';
      let usedEngine = engine;
      if (engine === 'gemini') {
        try {
          text = await readWithGemini(cover.dataUrl);
        } catch (err) {
          console.warn('Gemini gagal, beralih ke Tesseract:', err.message);
          usedEngine = 'tesseract';
          text = await tesseractRead(cover);
        }
      } else {
        text = await tesseractRead(cover);
      }

      results.push({ index: cover.index, ocrText: text.replace(/\s+/g, ' ').trim(), engine: usedEngine });
    }
    onProgress?.({ done: covers.length, total: covers.length, stage: 'Selesai membaca semua sampul' });
  } finally {
    if (worker) await worker.terminate();
  }

  return results;
}
