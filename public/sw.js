// LevelUp Service Worker
// Uses workbox-style precaching injected by vite-plugin-pwa (injectManifest strategy)
// and handles push notification delivery when the app is in the background.

import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';

self.skipWaiting();
clientsClaim();

// Precache files injected by vite-plugin-pwa at build time
precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

// ── Notification delivery ──────────────────────────────────────────────────────
// When the main thread posts a SHOW_NOTIFICATION message, we show it here so it
// appears even if the tab is backgrounded (SW controls the notification).
self.addEventListener('message', event => {
  if (event.data?.type === 'SHOW_NOTIFICATION') {
    const { title, body } = event.data;
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200],
    });
  }

  // Periodic check: the main thread sends scheduled notifications stored in
  // localStorage via postMessage. We fire any that are now due.
  if (event.data?.type === 'CHECK_SCHEDULES') {
    const schedules = event.data.schedules || [];
    const now = new Date();
    const nowDay = now.getDay();
    const nowHH = now.getHours();
    const nowMM = now.getMinutes();

    for (const s of schedules) {
      if (s.type === 'once') {
        const fireAt = new Date(s.fireAt);
        if (now >= fireAt) {
          self.registration.showNotification(s.title, {
            body: s.body,
            icon: '/icons/icon-192.png',
          });
        }
      } else if (s.type === 'weekly') {
        const [h, m] = s.time.split(':').map(Number);
        if (nowDay === s.jsDay && nowHH === h && nowMM === m) {
          self.registration.showNotification(s.title, {
            body: s.body,
            icon: '/icons/icon-192.png',
          });
        }
      }
    }
  }
});

// Tapping a notification opens the app
self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
    })
  );
});
