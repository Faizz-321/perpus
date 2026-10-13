// Utility Pengumuman Suara & Bel Panggilan untuk Perpustakaan Umum Kota Parepare
// Menggunakan Web Audio API (Nada Ding-Dong) + Native Indonesian Voice Audio (Google TTS)

/**
 * Memainkan nada bel 2-nada "Ting-Tung" / Chime khas pengumuman resmi perpustakaan / bandara
 */
export function playChime() {
  return new Promise((resolve) => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return resolve();

      const ctx = new AudioCtx();
      const now = ctx.currentTime;

      // Nada 1: D5 (587.33 Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, now);
      gain1.gain.setValueAtTime(0.28, now);
      gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.6);

      // Nada 2: A4 (440 Hz)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(440, now + 0.35);
      gain2.gain.setValueAtTime(0.3, now + 0.35);
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.35);
      osc2.stop(now + 1.2);

      setTimeout(() => {
        resolve();
      }, 850);
    } catch (e) {
      resolve();
    }
  });
}

let sharedAudioCtx = null;

function getSharedAudioContext() {
  if (typeof window === 'undefined') return null;
  if (!sharedAudioCtx) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (AudioCtx) {
      sharedAudioCtx = new AudioCtx();
    }
  }
  return sharedAudioCtx;
}

// Global auto-unlock on first user interaction anywhere
if (typeof window !== 'undefined') {
  const unlock = () => {
    try {
      const ctx = getSharedAudioContext();
      if (ctx && ctx.state === 'suspended') {
        ctx.resume();
      }
    } catch (e) {}
  };
  window.addEventListener('click', unlock, { passive: true });
  window.addEventListener('touchstart', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
}

let cachedWavUrl = null;
function getChimeWavUrl() {
  if (cachedWavUrl) return cachedWavUrl;
  try {
    const sampleRate = 22050;
    const duration = 2.0;
    const numSamples = Math.floor(sampleRate * duration);
    const buffer = new ArrayBuffer(44 + numSamples * 2);
    const view = new DataView(buffer);

    view.setUint32(0, 0x52494646, false); // "RIFF"
    view.setUint32(4, 36 + numSamples * 2, true);
    view.setUint32(8, 0x57415645, false); // "WAVE"
    view.setUint32(12, 0x666d7420, false); // "fmt "
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // Mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true); // 16-bit
    view.setUint32(36, 0x64617461, false); // "data"
    view.setUint32(40, numSamples * 2, true);

    const notes = [
      { freq: 1046.5, start: 0.0, dur: 0.20 },
      { freq: 1318.51, start: 0.20, dur: 0.20 },
      { freq: 1567.98, start: 0.40, dur: 0.50 },
      { freq: 1046.5, start: 1.00, dur: 0.20 },
      { freq: 1318.51, start: 1.20, dur: 0.20 },
      { freq: 2093.00, start: 1.40, dur: 0.60 }
    ];

    for (let i = 0; i < numSamples; i++) {
      const t = i / sampleRate;
      let sample = 0;
      for (const n of notes) {
        if (t >= n.start && t < n.start + n.dur) {
          const relT = t - n.start;
          const decay = Math.exp(-relT * 6);
          sample += (Math.sin(2 * Math.PI * n.freq * relT) * 0.75) * decay;
        }
      }
      const intSample = Math.max(-32767, Math.min(32767, Math.floor(sample * 28000)));
      view.setInt16(44 + i * 2, intSample, true);
    }

    const blob = new Blob([buffer], { type: 'audio/wav' });
    cachedWavUrl = URL.createObjectURL(blob);
    return cachedWavUrl;
  } catch (e) {
    return null;
  }
}

let lastAlarmTime = 0;

/**
 * Memainkan nada alarm notifikasi berdurasi 2 detik saat ada pesanan baru masuk untuk staf
 * Karakter: Nada melodi arpeggio ganda 2 detik yang jernih dan berulang
 */
export async function playNewOrderAlarm(force = false) {
  const nowMs = Date.now();
  if (!force && nowMs - lastAlarmTime < 4000) {
    return; // Hindari penumpukan audio
  }
  lastAlarmTime = nowMs;

  let played = false;

  // 1. Coba via Web Audio API (jernih & instan, durasi 2 detik)
  try {
    const ctx = getSharedAudioContext();
    if (ctx) {
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const now = ctx.currentTime;
      const notes = [
        { freq: 1046.5, time: now + 0.0, dur: 0.20 },
        { freq: 1318.51, time: now + 0.20, dur: 0.20 },
        { freq: 1567.98, time: now + 0.40, dur: 0.50 },
        { freq: 1046.5, time: now + 1.00, dur: 0.20 },
        { freq: 1318.51, time: now + 1.20, dur: 0.20 },
        { freq: 2093.00, time: now + 1.40, dur: 0.60 }
      ];

      notes.forEach((note) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(note.freq, note.time);

        gain.gain.setValueAtTime(0.001, note.time);
        gain.gain.exponentialRampToValueAtTime(0.45, note.time + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, note.time + note.dur);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(note.time);
        osc.stop(note.time + note.dur);
      });
      played = true;
    }
  } catch (err) {
    console.warn('Web Audio API alarm error:', err);
  }

  // 2. Fallback via HTML5 Audio element jika Web Audio belum jalan
  if (!played) {
    try {
      const url = getChimeWavUrl();
      if (url) {
        const audio = new Audio(url);
        audio.volume = 0.85;
        await audio.play();
      }
    } catch (e) {
      console.warn('Fallback HTML5 Audio gagal:', e);
    }
  }
}



/**
 * Memainkan suara Bahasa Indonesia Asli yang jernih dan fasih
 * Mengutamakan Audio Google Indonesian TTS dari Backend, dengan fallback Web Speech API
 */
export function speakIndonesian(text) {
  return new Promise((resolve) => {
    // 1. Coba putar audio asli Bahasa Indonesia dari endpoint backend
    const audioUrl = `/api/tts?text=${encodeURIComponent(text)}`;
    const audio = new Audio(audioUrl);

    audio.onended = () => resolve();
    audio.onerror = () => {
      // 2. Fallback ke Web Speech API jika backend offline
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
          const utterance = new SpeechSynthesisUtterance(text);
          utterance.lang = 'id-ID';
          utterance.rate = 0.95;
          utterance.pitch = 1.05;

          const voices = window.speechSynthesis.getVoices();
          const idVoice = voices.find(v => 
            v.lang === 'id-ID' || 
            v.lang.startsWith('id') || 
            v.name.toLowerCase().includes('indonesia') ||
            v.name.toLowerCase().includes('gadis')
          );
          if (idVoice) utterance.voice = idVoice;

          utterance.onend = () => resolve();
          utterance.onerror = () => resolve();
          window.speechSynthesis.speak(utterance);
        } catch (e) {
          resolve();
        }
      } else {
        resolve();
      }
    };

    audio.play().catch(() => {
      // Jika browser memblokir autoplay, coba fallback
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'id-ID';
        utterance.rate = 0.95;
        utterance.onend = () => resolve();
        window.speechSynthesis.speak(utterance);
      } else {
        resolve();
      }
    });
  });
}

/**
 * Panggil pesanan: Ding-Dong bel + Pengumuman Suara Bahasa Indonesia Asli
 * Format: "Perhatian, pesanan untuk Meja 3, silakan mengambil bukunya di meja staf. Terima kasih."
 */
export async function announceTableOrder(tableNo, ticketCode) {
  // 1. Bunyikan Bel Ding-Dong
  await playChime();

  // 2. Baca Pengumuman dalam Bahasa Indonesia Resmi & Sopan
  let spokenCode = '';
  if (ticketCode) {
    spokenCode = `tiket ${ticketCode.replace('TKT-', 'T K T ')}, `;
  }
  const sentence = `Perhatian, pesanan untuk ${tableNo}, ${spokenCode}silakan mengambil bukunya di meja staf. Terima kasih.`;
  await speakIndonesian(sentence);
}
