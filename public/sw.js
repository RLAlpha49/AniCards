const CACHE_VERSION = "v1";
const SHELL_CACHE = `anicards-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `anicards-static-${CACHE_VERSION}`;
const OFFLINE_URL = "/offline";
const IS_LOCAL_DEVELOPMENT_HOST =
  self.location.hostname === "localhost" ||
  self.location.hostname.endsWith(".localhost") ||
  self.location.hostname === "127.0.0.1";
const SAFE_SHELL_PATHS = new Set([
  "/",
  "/contact",
  "/examples",
  OFFLINE_URL,
  "/projects",
  "/search",
]);
const PRECACHE_URLS = [
  ...SAFE_SHELL_PATHS,
  "/favicon.ico",
  "/manifest.webmanifest",
  "/pwa/apple-touch-icon.svg",
  "/pwa/icon-any.svg",
  "/pwa/icon-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);

      await Promise.allSettled(
        PRECACHE_URLS.map(async (url) => {
          const response = await fetch(url, {
            cache: "reload",
          });

          if (!response.ok) {
            return;
          }

          await cache.put(url, response.clone());
        }),
      );

      await globalThis.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const cacheKeys = await caches.keys();

      await Promise.all(
        cacheKeys
          .filter((key) => key !== SHELL_CACHE && key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      );

      await globalThis.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") {
    return;
  }

  const requestUrl = new URL(request.url);

  if (requestUrl.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(handleNavigationRequest(request, requestUrl));
    return;
  }

  if (shouldCacheStaticAsset(request, requestUrl)) {
    event.respondWith(staleWhileRevalidate(request));
  }
});

async function handleNavigationRequest(request, requestUrl) {
  try {
    const response = await fetch(request);

    if (response.ok && canCacheShellPath(requestUrl)) {
      const cache = await caches.open(SHELL_CACHE);
      await cache.put(requestUrl.pathname, response.clone());
    }

    return response;
  } catch {
    const cache = await caches.open(SHELL_CACHE);

    if (canCacheShellPath(requestUrl)) {
      const cachedPage = await cache.match(requestUrl.pathname);

      if (cachedPage) {
        return cachedPage;
      }
    }

    const offlinePage = await cache.match(OFFLINE_URL);

    if (offlinePage) {
      return offlinePage;
    }

    return new Response("Offline", {
      status: 503,
      statusText: "Offline",
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
      },
    });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  const networkResponsePromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
      }

      return response;
    })
    .catch(() => undefined);

  if (cachedResponse) {
    void networkResponsePromise;
    return cachedResponse;
  }

  const networkResponse = await networkResponsePromise;

  if (networkResponse) {
    return networkResponse;
  }

  return new Response(null, {
    status: 504,
    statusText: "Gateway Timeout",
  });
}

function canCacheShellPath(requestUrl) {
  return SAFE_SHELL_PATHS.has(requestUrl.pathname) && !requestUrl.search;
}

function shouldCacheStaticAsset(request, requestUrl) {
  return (
    request.destination === "style" ||
    (!IS_LOCAL_DEVELOPMENT_HOST && request.destination === "script") ||
    request.destination === "font" ||
    request.destination === "image" ||
    request.destination === "manifest" ||
    requestUrl.pathname === "/favicon.ico"
  );
}
