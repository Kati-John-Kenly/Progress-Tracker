const buildId = 'mvt2sq44';
const cacheName = `progress-app-${buildId}`;
const precacheUrls = JSON.parse('["/","/index.html","/manifest.webmanifest","/pwa-icon.png","/favicon.png","/assets/index-olevn9-T.js","/assets/pdf-Dl_GWeXh.js","/assets/xlsx-CuSbHU4R.js","/assets/index-BpqtvVA8.css","/assets/pdf.worker.min-CjEcRF4W.mjs"]');

globalThis.addEventListener('install', (event) => {
    event.waitUntil(
        globalThis.caches.open(cacheName)
            .then((cache) => cache.addAll(precacheUrls))
            .then(() => {
                if (!globalThis.registration.active) {
                    return globalThis.skipWaiting();
                }
                return undefined;
            }),
    );
});

globalThis.addEventListener('activate', (event) => {
    event.waitUntil(Promise.all([
        globalThis.clients.claim(),
        globalThis.caches.keys().then((cacheNames) => Promise.all(
            cacheNames
                .filter((name) => name.startsWith('progress-app-') && name !== cacheName)
                .map((name) => globalThis.caches.delete(name)),
        )),
    ]));
});

globalThis.addEventListener('message', (event) => {
    if (event.data?.type === 'SKIP_WAITING'
        && (event.data.buildId === undefined || event.data.buildId === buildId)) {
        event.waitUntil(globalThis.skipWaiting());
    }
});

globalThis.addEventListener('fetch', (event) => {
    const request = event.request;
    if (request.method !== 'GET' || new URL(request.url).origin !== globalThis.location.origin) return;

    if (request.mode === 'navigate') {
        event.respondWith(
            globalThis.fetch(request)
                .then((response) => response.ok
                    ? response
                    : globalThis.caches.match('/index.html'))
                .catch(() => globalThis.caches.match('/index.html')),
        );
        return;
    }

    if (precacheUrls.includes(new URL(request.url).pathname)) {
        event.respondWith(
            globalThis.caches.match(request)
                .then((cachedResponse) => cachedResponse || globalThis.fetch(request)),
        );
    }
});
