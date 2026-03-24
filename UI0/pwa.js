(() => {
  const ACCESS_TOKEN_KEY = "access_token.v1";
  const PROFILE_CACHE_KEY = "cached_profile_user.v1";
  const DEFAULT_APP_BASE_PATH = "/StepBy/UI0";
  const DEFAULT_API_BASE_URL = "https://barrierfree-map.loophole.site";

  function normalizeBasePath(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) {
      return "";
    }
    const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withLeading.replace(/\/+$/, "");
  }

  function normalizeBaseUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function getConfig() {
    const cfg = window.APP_CONFIG || {};
    return {
      appBasePath: normalizeBasePath(
        typeof cfg.APP_BASE_PATH === "string" ? cfg.APP_BASE_PATH : DEFAULT_APP_BASE_PATH
      ),
      apiBaseUrl: normalizeBaseUrl(
        typeof cfg.API_BASE_URL === "string" ? cfg.API_BASE_URL : DEFAULT_API_BASE_URL
      ),
    };
  }

  function toApi(path) {
    const safePath = String(path || "");
    if (!safePath) {
      return safePath;
    }
    if (/^https?:\/\//i.test(safePath)) {
      return safePath;
    }
    const { apiBaseUrl } = getConfig();
    if (safePath.startsWith("/api/") || safePath.startsWith("/auth/")) {
      return `${apiBaseUrl}${safePath}`;
    }
    return safePath;
  }

  function getAccessToken() {
    try {
      const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
      return token && String(token).trim() ? token : "";
    } catch {
      return "";
    }
  }

  function getProfileCacheStorage() {
    try {
      if (window.localStorage) {
        return window.localStorage;
      }
    } catch {
      // ignore storage access errors
    }
    try {
      if (window.sessionStorage) {
        return window.sessionStorage;
      }
    } catch {
      // ignore storage access errors
    }
    return null;
  }

  function loadCachedProfileUser() {
    try {
      const storage = getProfileCacheStorage();
      if (!storage) {
        return null;
      }
      const raw = storage.getItem(PROFILE_CACHE_KEY);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveCachedProfileUserIsPro(isPro) {
    try {
      const storage = getProfileCacheStorage();
      if (!storage) {
        return;
      }
      const existing = loadCachedProfileUser();
      if (!existing || typeof existing !== "object") {
        return;
      }
      storage.setItem(PROFILE_CACHE_KEY, JSON.stringify({
        ...existing,
        isPro,
      }));
    } catch {
      // ignore storage errors
    }
  }

  function authFetch(input, init) {
    const authTokenApi = window.AuthToken || null;
    if (authTokenApi && typeof authTokenApi.authFetch === "function") {
      return authTokenApi.authFetch(input, init);
    }

    const options = { ...(init || {}) };
    options.headers = new Headers(options.headers || {});
    if (!options.headers.has("Authorization")) {
      const token = getAccessToken();
      if (token) {
        options.headers.set("Authorization", `Bearer ${token}`);
      }
    }
    if (options.credentials == null) {
      options.credentials = "include";
    }

    const target = typeof input === "string" ? toApi(input) : input;
    return fetch(target, options);
  }

  function parseIsPro(payload) {
    if (!payload || typeof payload !== "object") {
      return null;
    }
    if (typeof payload.isPro === "boolean") {
      return payload.isPro;
    }
    if (typeof payload.is_pro === "boolean") {
      return payload.is_pro;
    }
    if (payload.data && typeof payload.data === "object") {
      if (typeof payload.data.isPro === "boolean") {
        return payload.data.isPro;
      }
      if (typeof payload.data.is_pro === "boolean") {
        return payload.data.is_pro;
      }
    }
    return null;
  }

  async function applyGlobalProBadge() {
    const titleEl = document.querySelector(".app-bar .app-bar-title");
    if (!titleEl) {
      return;
    }

    let badgeEl = titleEl.querySelector(".pro-badge");
    if (!badgeEl) {
      badgeEl = document.createElement("span");
      badgeEl.className = "pro-badge";
      badgeEl.textContent = "PRO";
      titleEl.appendChild(badgeEl);
    }
    badgeEl.style.display = "none";

    const cachedUser = loadCachedProfileUser();
    if (cachedUser && typeof cachedUser.isPro === "boolean") {
      badgeEl.style.display = cachedUser.isPro ? "inline-flex" : "none";
    }

    try {
      const res = await authFetch("/api/pro-status", { cache: "no-store" });
      if (!res.ok) {
        badgeEl.style.display = "none";
        return;
      }
      const payload = await res.json().catch(() => null);
      const isPro = parseIsPro(payload);
      if (typeof isPro === "boolean") {
        saveCachedProfileUserIsPro(isPro);
      }
      badgeEl.style.display = isPro === true ? "inline-flex" : "none";
    } catch {
      if (!(cachedUser && typeof cachedUser.isPro === "boolean")) {
        badgeEl.style.display = "none";
      }
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", applyGlobalProBadge);
  } else {
    applyGlobalProBadge();
  }

  if ("serviceWorker" in navigator) {
    const { appBasePath } = getConfig();
    const swPath = `${appBasePath}/sw.js`;

    let refreshing = false;

    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (refreshing) {
        return;
      }
      refreshing = true;
      console.log("[PWA] New service worker activated, reloading...");
      window.location.reload();
    });

    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register(swPath)
        .then((registration) => {
          console.log("[PWA] Service Worker registered");

          setInterval(() => {
            console.log("[PWA] Checking for updates...");
            registration.update().catch(() => {
              // ignore update errors
            });
          }, 60 * 60 * 1000);

          registration.update().catch(() => {
            // ignore update errors
          });

          if (registration.waiting) {
            console.log("[PWA] New service worker waiting, activating automatically...");
            registration.waiting.postMessage({ type: "SKIP_WAITING" });
          }

          registration.addEventListener("updatefound", () => {
            const newWorker = registration.installing;
            console.log("[PWA] New service worker found");

            newWorker.addEventListener("statechange", () => {
              if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
                console.log("[PWA] New service worker installed, activating automatically...");
                newWorker.postMessage({ type: "SKIP_WAITING" });
              }
            });
          });
        })
        .catch(() => {
          // ignore registration errors
        });
    });

    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) {
        navigator.serviceWorker.ready.then((registration) => {
          registration.update().catch(() => {
            // ignore update errors
          });
        });
      }
    });
  }
})();
