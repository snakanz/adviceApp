// Advicly Service Worker for Push Notifications
const CACHE_NAME = 'advicly-v1';
const urlsToCache = [
  '/',
  '/static/js/bundle.js',
  '/static/css/main.css',
  '/manifest.json'
];

// Install event - cache resources
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event - serve from cache when offline
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        // Return cached version or fetch from network
        return response || fetch(event.request);
      }
    )
  );
});

// Push event - handle incoming push notifications
self.addEventListener('push', (event) => {
  console.log('Push event received:', event);
  
  let notificationData = {
    title: 'Advicly Notification',
    body: 'You have a new notification',
    icon: '/favicon.ico',
    badge: '/favicon.ico',
    tag: 'advicly-notification',
    requireInteraction: false,
    actions: [
      {
        action: 'view',
        title: 'View',
        icon: '/favicon.ico'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };

  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        ...notificationData,
        ...data,
        data: data // Store original data for click handling
      };
    } catch (e) {
      console.error('Error parsing push data:', e);
      notificationData.body = event.data.text();
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Notification click event
self.addEventListener('notificationclick', (event) => {
  console.log('Notification clicked:', event);
  
  event.notification.close();
  
  const data = event.notification.data;
  let url = '/';
  
  // Determine URL based on notification type
  if (data) {
    switch (data.type) {
      case 'meeting_reminder':
        url = `/meetings?id=${data.meetingId}`;
        break;
      case 'meeting_summary':
        url = `/meetings?id=${data.meetingId}`;
        break;
      case 'client_update':
        url = `/clients?id=${data.clientId}`;
        break;
      case 'ask_advicly':
        url = `/ask-advicly?thread=${data.threadId}`;
        break;
      default:
        url = data.url || '/';
    }
  }
  
  // Handle action buttons
  if (event.action === 'view' || !event.action) {
    event.waitUntil(
      clients.matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          // Check if there's already a window/tab open
          for (const client of clientList) {
            if (client.url.includes(self.location.origin) && 'focus' in client) {
              client.postMessage({
                type: 'NOTIFICATION_CLICK',
                url: url,
                data: data
              });
              return client.focus();
            }
          }
          
          // If no window is open, open a new one
          if (clients.openWindow) {
            return clients.openWindow(url);
          }
        })
    );
  }
  // Dismiss action - notification is already closed above
});

// Background sync for offline actions
self.addEventListener('sync', (event) => {
  if (event.tag === 'background-sync') {
    event.waitUntil(
      // Handle background sync tasks
      console.log('Background sync triggered')
    );
  }
});

// Message event - handle messages from main thread
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
