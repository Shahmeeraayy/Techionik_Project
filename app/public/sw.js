const CACHE_NAME = 'sm2-tech-portal-v1';
const CORE_ROUTES = [
  '/',
  '/tech/jobs',
  '/tech/current-job',
  '/tech/history',
  '/tech/chat',
  '/tech/profile',
  '/manifest.webmanifest',
  '/pwa-icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ROUTES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.map((key) => (key === CACHE_NAME ? undefined : caches.delete(key)))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE_NAME);
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await cache.match(request);
    if (cached) return cached;
    if (request.mode === 'navigate') return cache.match('/tech/jobs');
    throw new Error('Offline and no cached response available.');
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE_NAME);
  const cached = await cache.match(request);
  const fetchPromise = fetch(request)
    .then((response) => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || fetchPromise;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  const isCoreTechRoute = CORE_ROUTES.includes(url.pathname) || url.pathname.startsWith('/tech/');
  const isApiRead = event.request.method === 'GET' && /technician|jobs|dispatch/i.test(url.pathname);

  if (event.request.mode === 'navigate' && isCoreTechRoute) {
    event.respondWith(networkFirst(event.request));
    return;
  }

  if (event.request.method === 'GET' && (isCoreTechRoute || isApiRead)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: 'New assigned job', body: event.data?.text() };
  }

  const title = payload.title || 'New assigned job';
  const options = {
    body: payload.body || 'A new job has been assigned to your technician queue.',
    icon: '/pwa-icon.svg',
    badge: '/pwa-icon.svg',
    data: { url: payload.url || '/tech/jobs' }
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('message', (event) => {
  if (event.data?.type !== 'SM2_SHOW_JOB_NOTIFICATION') return;
  const title = event.data.title || 'New assigned job';
  const options = {
    body: event.data.body || 'A new job has been assigned to your technician queue.',
    icon: '/pwa-icon.svg',
    badge: '/pwa-icon.svg',
    data: { url: event.data.url || '/tech/jobs' }
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/tech/jobs';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const existing = clients.find((client) => client.url.includes('/tech/'));
      if (existing) {
        existing.navigate(url);
        return existing.focus();
      }
      return self.clients.openWindow(url);
    })
  );
});
