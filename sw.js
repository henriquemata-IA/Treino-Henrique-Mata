/* Treino do Henrique: service worker
   Troque a versão abaixo sempre que publicar mudanças, para o celular pegar a versão nova. */
const CACHE_NAME = 'treino-henrique-v2-2026-10-18';
const CORE_ASSETS = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './icon-512-maskable.png'];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

self.addEventListener('install', function (event) {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(CORE_ASSETS.map(function (url) {
        return cache.add(new Request(url, { cache: 'reload' })).catch(function () { /* segue mesmo se um arquivo falhar */ });
      }));
    })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE_NAME; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

function ehPagina(req, url) {
  return req.mode === 'navigate' || (url.origin === self.location.origin && /\/(index\.html)?$/.test(url.pathname));
}

self.addEventListener('fetch', function (event) {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  /* Página: busca na rede primeiro (pega atualizações), cai no cache se estiver offline */
  if (ehPagina(req, url)) {
    event.respondWith(
      fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(function (res) {
        if (res && res.ok) {
          const copia = res.clone();
          caches.open(CACHE_NAME).then(function (c) { c.put('./index.html', copia); });
        }
        return res;
      }).catch(function () {
        return caches.match('./index.html').then(function (r) { return r || caches.match('./'); });
      })
    );
    return;
  }

  /* Fontes do Google: cache primeiro, para funcionar offline */
  if (FONT_HOSTS.indexOf(url.hostname) !== -1) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        if (cached) return cached;
        return fetch(req).then(function (res) {
          if (res && (res.ok || res.type === 'opaque')) {
            const copia = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(req, copia); });
          }
          return res;
        });
      })
    );
    return;
  }

  /* Demais arquivos do app (ícones, manifest): cache e atualiza em segundo plano */
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(function (cached) {
        const rede = fetch(req).then(function (res) {
          if (res && res.ok) {
            const copia = res.clone();
            caches.open(CACHE_NAME).then(function (c) { c.put(req, copia); });
          }
          return res;
        }).catch(function () { return cached; });
        return cached || rede;
      })
    );
  }
});
