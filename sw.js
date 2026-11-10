// Cache dei file dell'app: dopo la prima apertura si apre anche senza internet.
// Quando modifichi i file cambia la versione qui sotto, così il telefono scarica l'aggiornamento.
const CACHE = 'catalogo-v2';
const FILES = ['./', 'index.html', 'firebase-config.js', 'manifest.json', 'icons/icon-192.png', 'icons/icon-512.png'];
const RUNTIME = 'catalogo-lib-v1';

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE && k !== RUNTIME).map(k => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  // Librerie Firebase e font: le tengo in cache per usarle offline. Il database Firestore non passa da qui.
  if (url.hostname === 'www.gstatic.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(caches.open(RUNTIME).then(async c => {
      const hit = await c.match(req);
      if (hit) return hit;
      const res = await fetch(req);
      if (res.ok) c.put(req, res.clone());
      return res;
    }));
    return;
  }
  if (url.origin !== location.origin) return;
  // Pagina: prima la rete (così vedi subito gli aggiornamenti), se manca internet la copia salvata.
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(res => {
      const copy = res.clone(); caches.open(CACHE).then(c => c.put('index.html', copy));
      return res;
    }).catch(() => caches.match('index.html')));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req)));
});
