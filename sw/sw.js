// Service worker écrit à la main. CONFIG est ajouté en tête du fichier à la compilation (plugin-pwa.ts) :
// { cache, prefixe, base, fichiers, exclu }. Il ne touche jamais aux données (IndexedDB).
/* global CONFIG */

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CONFIG.cache).then((c) => c.addAll(CONFIG.fichiers)));
});

self.addEventListener('activate', (e) => {
  // Ne supprime que les anciens caches de CE mode (préfixe), jamais ceux de l'app voisine.
  e.waitUntil(
    caches
      .keys()
      .then((noms) =>
        Promise.all(
          noms.filter((n) => n.startsWith(CONFIG.prefixe) && n !== CONFIG.cache).map((n) => caches.delete(n)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

// Activation de la nouvelle version uniquement à la demande de l'utilisateur (bandeau).
self.addEventListener('message', (e) => {
  if (e.data === 'ACTIVER') self.skipWaiting();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (CONFIG.exclu && url.pathname.startsWith(CONFIG.exclu)) return;
  const cible = e.request.mode === 'navigate' ? `${CONFIG.base}index.html` : e.request;
  e.respondWith(
    caches.open(CONFIG.cache).then((c) => c.match(cible)).then((r) => r ?? fetch(e.request)),
  );
});
