const CACHE_VERSION = "v1";
const SHELL_CACHE = `anicards-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `anicards-static-${CACHE_VERSION}`;
const STATIC_CACHE_MAX_ENTRIES = 80;
const STATIC_CACHE_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7;
const STATIC_CACHE_METADATA_URL = `${self.location.origin}/__sw-static-cache-metadata__`;
const OFFLINE_URL = "/offline";
const OFFLINE_RESPONSE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Offline | AniCards</title>
    <meta name="robots" content="noindex,nofollow" />
    <style>
      :root {
        color-scheme: dark;
        font-family: Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #0c0a10;
        color: #f5efe4;
      }

      * {
        box-sizing: border-box;
      }

      body {
        margin: 0;
        min-height: 100vh;
        background:
          radial-gradient(circle at top, rgba(201, 168, 76, 0.14), transparent 40%),
          linear-gradient(180deg, #15111b 0%, #0c0a10 100%);
      }

      main {
        display: grid;
        min-height: 100vh;
        place-items: center;
        padding: 24px;
      }

      section {
        width: min(100%, 880px);
        border: 1px solid rgba(201, 168, 76, 0.2);
        background: rgba(20, 17, 26, 0.92);
        box-shadow: 0 18px 60px rgba(0, 0, 0, 0.35);
        padding: 32px;
      }

      p {
        margin: 0;
        line-height: 1.7;
        color: rgba(245, 239, 228, 0.8);
      }

      .eyebrow {
        color: #c9a84c;
        font-size: 0.75rem;
        font-weight: 700;
        letter-spacing: 0.28em;
        margin-bottom: 12px;
        text-transform: uppercase;
      }

      h1 {
        font-size: clamp(2.25rem, 4vw, 3.5rem);
        letter-spacing: 0.06em;
        margin: 0 0 16px;
        text-transform: uppercase;
      }

      .grid {
        display: grid;
        gap: 16px;
        grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
        margin-top: 28px;
      }

      .cell {
        border: 1px solid rgba(201, 168, 76, 0.14);
        background: rgba(255, 255, 255, 0.03);
        padding: 18px;
      }

      .cell h2 {
        font-size: 1rem;
        letter-spacing: 0.16em;
        margin: 0 0 10px;
        text-transform: uppercase;
      }

      .actions {
        display: flex;
        flex-wrap: wrap;
        gap: 12px;
        margin-top: 28px;
      }

      a {
        border: 1px solid rgba(201, 168, 76, 0.26);
        color: #f5efe4;
        display: inline-flex;
        gap: 8px;
        padding: 12px 18px;
        text-decoration: none;
      }

      a:first-of-type {
        background: linear-gradient(135deg, #c9a84c, #a67d1f);
        border-color: transparent;
        color: #130f17;
        font-weight: 700;
      }
    </style>
  </head>
  <body>
    <main>
      <section>
        <p class="eyebrow">Offline shell</p>
        <h1>You&rsquo;re offline</h1>
        <p>
          Cached public pages and the install shell are still here, but fresh
          AniList lookups, new card renders, and live profile data need a
          connection.
        </p>

        <div class="grid">
          <article class="cell">
            <h2>What still works</h2>
            <p>
              Previously cached public pages, the shared navigation shell, and
              install metadata remain available for quick return visits.
            </p>
          </article>
          <article class="cell">
            <h2>What needs the network</h2>
            <p>
              User searches, AniList sync, and new stat card generation will
              resume automatically once you reconnect.
            </p>
          </article>
        </div>

        <div class="actions">
          <a href="/">Back home</a>
          <a href="/search">Search when reconnected</a>
        </div>
      </section>
    </main>
  </body>
</html>`;
const PRECACHE_RETRY_LIMIT = 1;
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
        PRECACHE_URLS.map((url) => precacheUrl(cache, url)),
      );
    })(),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type !== "SKIP_WAITING") {
    return;
  }

  if (event.origin && event.origin !== self.location.origin) {
    return;
  }

  globalThis.skipWaiting();
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

    return new Response(OFFLINE_RESPONSE_HTML, {
      status: 200,
      statusText: "OK",
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "text/html; charset=utf-8",
      },
    });
  }
}

async function precacheUrl(cache, url) {
  const attempts = url === OFFLINE_URL ? PRECACHE_RETRY_LIMIT + 1 : 1;

  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        cache: "reload",
      });

      if (!response.ok) {
        continue;
      }

      await cache.put(url, response.clone());
      return true;
    } catch {
      // Retry shell precache misses rather than failing the entire install.
    }
  }

  return false;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(STATIC_CACHE);
  const cachedResponse = await cache.match(request);
  const networkResponsePromise = fetch(request)
    .then(async (response) => {
      if (response.ok) {
        await cache.put(request, response.clone());
        await trimStaticCache(cache, request.url);
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

async function trimStaticCache(cache, latestRequestUrl) {
  const cacheMetadata = await readStaticCacheMetadata(cache);
  const now = Date.now();

  cacheMetadata.set(latestRequestUrl, now);

  const expiredEntries = [...cacheMetadata.entries()].filter(
    ([, cachedAt]) => now - cachedAt >= STATIC_CACHE_MAX_AGE_MS,
  );

  await Promise.all(
    expiredEntries.map(async ([url]) => {
      cacheMetadata.delete(url);
      await cache.delete(url);
    }),
  );

  const overflowCount = Math.max(
    cacheMetadata.size - STATIC_CACHE_MAX_ENTRIES,
    0,
  );

  if (overflowCount > 0) {
    const oldestEntries = [...cacheMetadata.entries()]
      .sort((leftEntry, rightEntry) => leftEntry[1] - rightEntry[1])
      .slice(0, overflowCount);

    await Promise.all(
      oldestEntries.map(async ([url]) => {
        cacheMetadata.delete(url);
        await cache.delete(url);
      }),
    );
  }

  await writeStaticCacheMetadata(cache, cacheMetadata);
}

async function readStaticCacheMetadata(cache) {
  const metadataResponse = await cache.match(STATIC_CACHE_METADATA_URL);

  if (!metadataResponse) {
    return new Map();
  }

  try {
    const metadata = await metadataResponse.json();

    if (!Array.isArray(metadata.entries)) {
      return new Map();
    }

    return new Map(
      metadata.entries.filter(
        (entry) =>
          Array.isArray(entry) &&
          typeof entry[0] === "string" &&
          Number.isFinite(entry[1]),
      ),
    );
  } catch {
    return new Map();
  }
}

async function writeStaticCacheMetadata(cache, metadata) {
  await cache.put(
    STATIC_CACHE_METADATA_URL,
    new Response(
      JSON.stringify({
        entries: [...metadata.entries()],
      }),
      {
        headers: {
          "Cache-Control": "no-store",
          "Content-Type": "application/json; charset=utf-8",
        },
      },
    ),
  );
}
