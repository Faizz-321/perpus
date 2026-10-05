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
