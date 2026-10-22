// Офлайн-кэш: приложение открывается и без интернета (ИИ, конечно, нет).
const VERSION = 'planka-v6';
const SHELL = [
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/app.js',
  'js/ai.js',
  'js/covers.js',
  'js/db.js',
  'js/docx.js',
  'js/header.js',
  'js/share.js',
  'js/store.js',
  'js/themes.js',
  'js/ui.js',
  'js/views/archive.js',
  'js/views/month.js',
  'js/views/onboarding.js',
  'js/views/project.js',
  'js/views/projects.js',
  'js/views/ritual.js',
  'js/views/settings.js',
  'js/views/today.js',
  'img/onboarding.webp',
  'icons/icon-192.png',
  'icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  // cache: 'reload' — берём свежие файлы с сервера, а не из кэша браузера.
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => ![VERSION, 'planka-img', 'planka-fonts'].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const { request } = e;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.hostname.includes('openrouter.ai')) return;

  // Настройки модели — сначала сеть, чтобы обновлялись без новой версии.
  if (url.origin === location.origin && url.pathname.endsWith('/config.json')) {
    e.respondWith(fetch(request).then((r) => {
      const copy = r.clone();
      caches.open(VERSION).then((c) => c.put(request, copy));
      return r;
    }).catch(() => caches.match(request)));
    return;
  }

  // Фото тем с Unsplash — один раз скачали, дальше берём из кэша.
  if (url.hostname === 'images.unsplash.com') {
    e.respondWith(caches.open('planka-img').then(async (c) => {
      const hit = await c.match(request);
      if (hit) return hit;
      const r = await fetch(request);
      if (r.ok || r.type === 'opaque') c.put(request, r.clone());
      return r;
    }));
    return;
  }

  // Шрифты Google — кэш с фоновым обновлением.
  if (url.hostname.endsWith('googleapis.com') || url.hostname.endsWith('gstatic.com')) {
    e.respondWith(caches.open('planka-fonts').then(async (c) => {
      const hit = await c.match(request);
      const net = fetch(request).then((r) => {
        if (r.ok || r.type === 'opaque') c.put(request, r.clone());
        return r;
      }).catch(() => hit);
      return hit || net;
    }));
    return;
  }

  if (url.origin === location.origin) {
    e.respondWith(caches.match(request, { ignoreSearch: true }).then((hit) => hit || fetch(request).then((r) => {
      if (r.ok) {
        const copy = r.clone();
        caches.open(VERSION).then((c) => c.put(request, copy));
      }
      return r;
    }).catch(() => caches.match('index.html'))));
  }
});
