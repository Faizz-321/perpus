// Service Worker Notifikasi Panggilan Perpustakaan Umum Kota Parepare
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Tangani klik pada notifikasi pop-up di HP / Komputer
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  // Buka atau fokuskan kembali ke tab perpustakaan
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow('/qr-system');
      }
    })
  );
});
