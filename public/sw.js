const CACHE_NAME = "ezza-companion-cache-v1";
const STATIC_FALLBACK_URL = "/";

// URL prefixes to intercept and handle with custom caching strategies
const NETWORK_FIRST_APIS = [
  "/api/glossary",
  "/api/daily-proverb",
  "/api/preset/verses",
  "/api/preset/lessons"
];

// Installs the Service Worker
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("[Service Worker] Pre-caching offline fallback shell");
      return cache.addAll([
        STATIC_FALLBACK_URL,
        "/index.html",
      ]).catch((err) => {
        console.warn("[Service Worker] Pre-cache warning (safe to ignore in development):", err);
      });
    })
  );
  // Force active state directly
  self.skipWaiting();
});

// Activates the Service Worker and cleans up obsolete caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log("[Service Worker] Destroying obsolete cache:", name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Intercepts and caches fetching events
self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);

  // Avoid intercepting non-GET requests or Live-voice WebSocket/different origins
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }

  // Check if it's one of the Ezza learning content APIs (Network-First, fallback to Cache)
  const isTargetApi = NETWORK_FIRST_APIS.some((apiPath) => requestUrl.pathname.startsWith(apiPath));

  if (isTargetApi) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // If response is valid, clone and write to cache
          if (networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          console.log("[Service Worker] Offline fallback triggered for API:", requestUrl.pathname);
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Return dummy structural JSON if neither network nor cache is available, to prevent app crashing
            return new Response(JSON.stringify([]), {
              headers: { "Content-Type": "application/json" }
            });
          });
        })
    );
    return;
  }

  // For all other static files & client pages (Stale-While-Revalidate)
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch fresh copy in the background and update cache silently
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(event.request, networkResponse);
              });
            }
          })
          .catch(() => {
            // Silently swallow background fetch failure in offline state
          });

        return cachedResponse;
      }

      // If cache miss, fetch on-demand and store it
      return fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse.status === 200 && !requestUrl.pathname.includes("/api/")) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If total network failure on navigation page requests, fallback to / index shell
          if (event.request.mode === "navigate") {
            return caches.match(STATIC_FALLBACK_URL);
          }
        });
    })
  );
});
