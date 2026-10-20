import { playChime } from './soundAnnouncement';

/**
 * Daftarkan Service Worker agar siap menerima showNotification di HP / Android
 */
export async function registerNotificationServiceWorker() {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) {
    return null;
  }
  try {
    const reg = await navigator.serviceWorker.register('/sw.js');
    return reg;
  } catch (err) {
    console.warn('Peringatan Service Worker:', err);
    return null;
  }
}

/**
 * Meminta izin notifikasi browser (Web Notification API)
 * dan memicu Service Worker untuk dukungan di HP Android
 */
export async function requestBrowserNotificationPermission() {
  if (typeof window === 'undefined') return 'unsupported';

  if (!('Notification' in window)) {
    return 'unsupported';
  }

  try {
    // Daftarkan service worker terlebih dahulu
    await registerNotificationServiceWorker();

    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      // Buka kunci Web Audio API
      try {
        playChime(false);
      } catch (e) {}

      // Kirim notifikasi pertama sebagai konfirmasi aktif
      await sendBrowserNotification('🔔 Notifikasi Panggilan Aktif', {
        body: 'HP Anda akan berbunyi & bergetar saat pesanan buku siap diambil di meja staf!',
        tag: 'welcome-perpus-parepare'
      });
    }
    return permission;
  } catch (err) {
    console.error('Error saat meminta izin notifikasi:', err);
    return 'denied';
  }
}

/**
 * Mengirim notifikasi ke browser / HP menggunakan Service Worker (Android/Chrome)
 * dengan fallback ke new Notification (Desktop)
 */
export async function sendBrowserNotification(title, options = {}) {
  if (typeof window === 'undefined') return false;

  // 1. Getar HP jika didukung perangkat (vibration pattern)
  try {
    if ('vibrate' in navigator) {
      navigator.vibrate([300, 150, 300, 150, 400]);
    }
  } catch (e) {}

  const defaultOptions = {
    icon: '/Lambang.png',
    badge: '/Lambang.png',
    vibrate: [300, 150, 300],
    requireInteraction: true,
    ...options
  };

  // 2. Metode Utama (WAJIB untuk HP / Android Chrome): Lewat Service Worker
  if ('serviceWorker' in navigator) {
    try {
      let reg = await navigator.serviceWorker.getRegistration();
      if (!reg) {
        reg = await navigator.serviceWorker.register('/sw.js');
      }
      if (reg) {
        // Tunggu hingga service worker aktif jika baru dipasang
        if (reg.installing || reg.waiting) {
          await new Promise((resolve) => {
            const sw = reg.installing || reg.waiting;
            sw.addEventListener('statechange', () => {
              if (sw.state === 'activated') resolve();
            });
            setTimeout(resolve, 800);
          });
        }

        if (reg.showNotification) {
          await reg.showNotification(title, defaultOptions);
          return true;
        }
      }
    } catch (swErr) {
      console.warn('Kirim notif via ServiceWorker gagal, mencoba fallback desktop:', swErr);
    }
  }

  // 3. Metode Fallback (Desktop Chrome / Safari / Firefox): new Notification
  try {
    if ('Notification' in window && Notification.permission === 'granted') {
      const notif = new Notification(title, defaultOptions);
      if (options.onClick) {
        notif.onclick = options.onClick;
      }
      return true;
    }
  } catch (notifErr) {
    console.warn('new Notification() tidak didukung di perangkat ini:', notifErr);
  }

  return false;
}
