// UI10開発環境専用Service Worker。UI0のキャッシュには触れない。
const CACHE_VERSION = "1.32.1-managed-osm-profile";
const APP_BASE_PATH = "/StepBy/UI10";
const API_BASE_URL = "https://stepby-api-8-229-191-182.sslip.io";
// 時刻を含めるとService Worker再起動のたびに別名になり、既存キャッシュを
// 見失って画面遷移が白くなるため、バージョンだけで一意にする。
const CACHE_NAME = `barrierfree-map-v${CACHE_VERSION}-stepby-ui10`;
// 画像（プロフィール画像など）はバージョンが変わっても保持し続けるための専用キャッシュ。
// CACHE_NAMEと違いタイムスタンプを含めず、activateハンドラの古いキャッシュ削除フィルタにも引っかからない名前にする。
const IMAGE_CACHE_NAME = "barrierfree-map-images-ui10-v1";
const API_ORIGIN = new URL(API_BASE_URL).origin;
const API_PATH_PREFIX = new URL(API_BASE_URL).pathname.replace(/\/+$/, "");
const CORE_ASSETS = [
  `${APP_BASE_PATH}/config.js`,
  `${APP_BASE_PATH}/style.css`,
  `${APP_BASE_PATH}/appbar.css`,
  `${APP_BASE_PATH}/version.js`,
  `${APP_BASE_PATH}/map/Index.html`,
  `${APP_BASE_PATH}/map/map.css`,
  `${APP_BASE_PATH}/map/map.js`,
  `${APP_BASE_PATH}/map/osm-browser-matcher.js`,
  `${APP_BASE_PATH}/map/record-flow-policy.js`,
  `${APP_BASE_PATH}/map/async-record-queue.js`,
  `${APP_BASE_PATH}/road-info-queue.js`,
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
  `${APP_BASE_PATH}/admin/database.html`,
  `${APP_BASE_PATH}/admin/database.css`,
  `${APP_BASE_PATH}/admin/database.js`,
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
  // 個別に cache.add する。1ファイルが取得失敗してもインストール全体を止めない（addAllだと止まる）。
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(
        CORE_ASSETS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn("[SW] Failed to precache " + url + ":", err && err.message ? err.message : err);
          })
        )
      )
    )
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
        .filter((key) => key.includes("-stepby-ui10-") && key !== CACHE_NAME)
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

  // API origin の /uploads/ 配下（プロフィール画像など）は stale-while-revalidate でキャッシュ。
  // 専用の IMAGE_CACHE_NAME に保存することで、バージョンアップで他のキャッシュが消えても画像は保持される。
  if (url.origin === API_ORIGIN && url.pathname.startsWith("/uploads/")) {
    event.respondWith(
      caches.open(IMAGE_CACHE_NAME).then((cache) =>
        cache.match(request).then((cached) => {
          const networkFetch = fetch(request)
            .then((response) => {
              if (response && (response.status === 200 || response.type === "opaque")) {
                cache.put(request, response.clone());
              }
              return response;
            })
            .catch((err) => {
              if (cached) return cached;
              throw err;
            });
          return cached || networkFetch;
        })
      )
    );
    return;
  }

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
        .catch(async () => {
          const cached = await caches.match(request, { ignoreSearch: true });
          if (cached) return cached;
          const fallbackPath = url.pathname.includes("/auth/")
            ? `${APP_BASE_PATH}/auth/login.html`
            : `${APP_BASE_PATH}/map/Index.html`;
          const fallback = await caches.match(fallbackPath, { ignoreSearch: true });
          if (fallback) return fallback;
          return new Response(
            "<!doctype html><meta charset=utf-8><meta name=viewport content='width=device-width'><title>StepBy</title><p>画面を読み込めませんでした。通信を確認して再読み込みしてください。</p>",
            { status: 503, headers: { "Content-Type": "text/html; charset=utf-8" } }
          );
        })
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

// メッセージを受け取って処理する。
// - SKIP_WAITING: 新サービスワーカーを即座にアクティブ化する。
// - background-fetch: ページから渡された fetch リクエストをサービスワーカーで実行し、
//   ページが遷移して unload してもリクエストの完了まで生き残らせる（event.waitUntil）。
//   キープアライブの 64KB 制限を超えるリクエスト（画像入りの道情報投稿など）に使う。
//   結果はクライアントへ postMessage で通知し、必要があれば map 側でトーストを出す。
self.addEventListener("message", (event) => {
  if (!event.data || typeof event.data !== "object") return;

  if (event.data.type === "SKIP_WAITING") {
    console.log("[SW] Received SKIP_WAITING message");
    self.skipWaiting();
    return;
  }

  if (event.data.type === "background-fetch") {
    const requestId = event.data.id || "";
    const url = event.data.url || "";
    const init = event.data.init || {};
    if (!url) return;
    event.waitUntil(
      fetch(url, init)
        .then((res) => {
          return self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
            clients.forEach((c) => {
              c.postMessage({
                type: "background-fetch-result",
                id: requestId,
                ok: res.ok,
                status: res.status,
              });
            });
          });
        })
        .catch((err) => {
          return self.clients.matchAll({ includeUncontrolled: true, type: "window" }).then((clients) => {
            clients.forEach((c) => {
              c.postMessage({
                type: "background-fetch-result",
                id: requestId,
                ok: false,
                error: String(err && err.message ? err.message : err),
              });
            });
          });
        })
    );
    return;
  }
});
