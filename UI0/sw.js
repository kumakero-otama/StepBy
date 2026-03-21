const CACHE_VERSION = "1.18.0"; // このバージョンはpackage.jsonから自動生成されます
const APP_BASE_PATH = "/StepBy/UI0";
const API_BASE_URL = "https://barrierfree-map.loophole.site";
const CACHE_NAME = `barrierfree-map-v${CACHE_VERSION}-stepby-ui0-${Date.now()}`;
const API_ORIGIN = new URL(API_BASE_URL).origin;
const API_PATH_PREFIX = new URL(API_BASE_URL).pathname.replace(/\/+$/, "");
const CORE_ASSETS = [
  `${APP_BASE_PATH}/`,
  `${APP_BASE_PATH}/config.js`,
  `${APP_BASE_PATH}/home/Index.html`,
  `${APP_BASE_PATH}/style.css`,
  `${APP_BASE_PATH}/appbar.css`,
  `${APP_BASE_PATH}/home/app.js`,
  `${APP_BASE_PATH}/version.js`,
  `${APP_BASE_PATH}/analog/Index.html`,
  `${APP_BASE_PATH}/analog/analog.css`,
  `${APP_BASE_PATH}/analog/analog.js`,
  `${APP_BASE_PATH}/map/Index.html`,
  `${APP_BASE_PATH}/map/map.css`,
  `${APP_BASE_PATH}/map/map.js`,
  `${APP_BASE_PATH}/manifest.webmanifest`,
  `${APP_BASE_PATH}/assets/icon.svg`,
  `${APP_BASE_PATH}/assets/otamap_logo.png`,
  `${APP_BASE_PATH}/assets/StepBy_icon_192.png`,
  `${APP_BASE_PATH}/assets/StepBy_icon_512.png`,
  `${APP_BASE_PATH}/auth/login.html`,
  `${APP_BASE_PATH}/auth/signup.html`,
  `${APP_BASE_PATH}/auth/auth.css`,
  `${APP_BASE_PATH}/auth/auth.js`,
  `${APP_BASE_PATH}/auth/token_client.js`,
  `${APP_BASE_PATH}/profile/Index.html`,
  `${APP_BASE_PATH}/profile/profile.css`,
  `${APP_BASE_PATH}/profile/profile.js`,
  `${APP_BASE_PATH}/profile/edit.html`,
  `${APP_BASE_PATH}/profile/edit.css`,
  `${APP_BASE_PATH}/profile/edit.js`,
  `${APP_BASE_PATH}/pwa.js`,
];

self.addEventListener("install", (event) => {
  console.log("[SW] Installing new service worker...");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS))
  );
  // 新しいService Workerをすぐにアクティブにする
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("[SW] Activating new service worker...");
  event.waitUntil(
    caches.keys().then((keys) => {
      // 古いキャッシュをすべて削除
      const deletePromises = keys
        .filter((key) => key.startsWith("barrierfree-map-v") && key !== CACHE_NAME)
        .map((key) => {
          console.log("[SW] Deleting old cache:", key);
          return caches.delete(key);
        });
      return Promise.all(deletePromises);
    }).then(() => {
      // 既存のクライアントをすべて制御下に置く
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") {
    return;
  }
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }
  if (url.origin === API_ORIGIN) {
    if (
      url.pathname.startsWith(`${API_PATH_PREFIX}/api/`) ||
      url.pathname.startsWith(`${API_PATH_PREFIX}/auth/`)
    ) {
      return;
    }
  }
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/")) {
    return;
  }
  if (!url.pathname.startsWith(APP_BASE_PATH)) {
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      return fetch(request).then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        return response;
      });
    })
  );
});

// メッセージを受け取ってskipWaitingを実行
self.addEventListener("message", (event) => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    console.log("[SW] Received SKIP_WAITING message");
    self.skipWaiting();
  }
});
