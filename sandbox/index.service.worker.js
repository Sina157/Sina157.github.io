/** @type {string} */
const CACHE_VERSION = '1741809279|63707753';
/** @type {string} */
const CACHE_PREFIX = 'Sand Box-sw-cache-';
const CACHE_NAME = `${CACHE_PREFIX}${CACHE_VERSION}`;
const OFFLINE_URL = 'index.offline.html';
const ENSURE_CROSSORIGIN_ISOLATION_HEADERS = true;

/** @type {string[]} */
const CACHED_FILES = [
    "index.html",
    "index.js",
    "index.offline.html",
    "index.icon.png",
    "index.apple-touch-icon.png",
    "index.audio.worklet.js",
    "index.audio.position.worklet.js"
];

/** @type {string[]} */
const CACHEABLE_FILES = ["index.wasm", "index.pck"];
const FULL_CACHE = [...CACHED_FILES, ...CACHEABLE_FILES];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(CACHED_FILES)));
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then(keys => {
            return Promise.all(
                keys.filter(key => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );
        }).then(() => {
            return ('navigationPreload' in self.registration) ? self.registration.navigationPreload.enable() : Promise.resolve();
        })
    );
});

/**
 * Ensures that the response has the correct COEP/COOP headers
 * @param {Response} response
 * @returns {Response}
 */
function ensureCrossOriginIsolationHeaders(response) {
    if (response.headers.get('Cross-Origin-Embedder-Policy') === 'require-corp' &&
        response.headers.get('Cross-Origin-Opener-Policy') === 'same-origin') {
        return response;
    }

    const crossOriginIsolatedHeaders = new Headers(response.headers);
    crossOriginIsolatedHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
    crossOriginIsolatedHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');
    
    return new Response(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: crossOriginIsolatedHeaders,
    });
}

/**
 * Calls fetch and cache the result if it is cacheable
 * @param {FetchEvent} event
 * @param {Cache} cache
 * @param {boolean} isCacheable
 * @returns {Response}
 */
async function fetchAndCache(event, cache, isCacheable) {
    let response = await event.preloadResponse || await self.fetch(event.request);

    if (ENSURE_CROSSORIGIN_ISOLATION_HEADERS) {
        response = ensureCrossOriginIsolationHeaders(response);
    }

    if (isCacheable) {
        cache.put(event.request, response.clone());
    }

    return response;
}

self.addEventListener('fetch', (event) => {
    const isNavigate = event.request.mode === 'navigate';
    const url = event.request.url || '';
    const referrer = event.request.referrer || '';
    const base = referrer.slice(0, referrer.lastIndexOf('/') + 1);
    const local = url.startsWith(base) ? url.replace(base, '') : '';
    const isCacheable = FULL_CACHE.includes(local) || (base === referrer && base.endsWith(CACHED_FILES[0]));

    if (isNavigate || isCacheable) {
        event.respondWith((async () => {
            const cache = await caches.open(CACHE_NAME);
            if (isNavigate) {
                const fullCache = await Promise.all(FULL_CACHE.map(name => cache.match(name)));
                const missing = fullCache.some(v => v === undefined);
                if (missing) {
                    try {
                        return await fetchAndCache(event, cache, isCacheable);
                    } catch (e) {
                        console.error('Network error: ', e);
                        return caches.match(OFFLINE_URL);
                    }
                }
            }
            let cached = await cache.match(event.request);
            if (cached) {
                return ENSURE_CROSSORIGIN_ISOLATION_HEADERS ? ensureCrossOriginIsolationHeaders(cached) : cached;
            }
            return await fetchAndCache(event, cache, isCacheable);
        })());
    } else if (ENSURE_CROSSORIGIN_ISOLATION_HEADERS) {
        event.respondWith((async () => {
            let response = await fetch(event.request);
            return ensureCrossOriginIsolationHeaders(response);
        })());
    }
});

self.addEventListener('message', (event) => {
    if (event.origin !== self.origin) return;

    const id = event.source.id || '';
    const msg = event.data || '';
    self.clients.get(id).then(client => {
        if (!client) return;
        switch (msg) {
            case 'claim':
                self.skipWaiting().then(() => self.clients.claim());
                break;
            case 'clear':
                caches.delete(CACHE_NAME);
                break;
            case 'update':
                self.skipWaiting().then(() => self.clients.claim())
                    .then(() => self.clients.matchAll())
                    .then(all => all.forEach(c => c.navigate(c.url)));
                break;
        }
    });
});
