/*
 * Minimálny service worker. Dve stratégie, každá pre to, čo jej sedí:
 *
 *  - kostra aplikácie: cache-first, lebo jej súbory majú hash v názve a
 *    pri novom nasadení sa aj tak zmení ich cesta,
 *  - predpoveď z Open-Meteo: network-first s odloženou kópiou, aby sa po
 *    strate signálu ukázala posledná známa predpoveď namiesto chyby.
 *
 * Údaje sa nikdy nepodstrčia potichu ako čerstvé – kópia sa použije len
 * vtedy, keď sieť zlyhá.
 */
const SHELL_CACHE = 'meteogram-shell-v1';
const DATA_CACHE = 'meteogram-data-v1';
const SHELL_FILES = ['/', '/index.html', '/manifest.webmanifest', '/icon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll(SHELL_FILES)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== SHELL_CACHE && key !== DATA_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  if (url.hostname.endsWith('open-meteo.com')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(DATA_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match('/index.html'));
    }),
  );
});
