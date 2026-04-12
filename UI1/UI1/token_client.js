// UI1 token_client.js — UI0のauth/token_client.jsをUI1用に移植
(function initAuthTokenClient(globalScope) {
  const ACCESS_TOKEN_KEY = "access_token.v1";
  const DEFAULT_APP_BASE_PATH = "/StepBy/UI1";
  const DEFAULT_API_BASE_URL = "https://barrierfree-map.loophole.site";

  function getConfig() {
    const config = globalScope.APP_CONFIG || {};
    return {
      appBasePath: normalizeBasePath(
        typeof config.APP_BASE_PATH === "string" ? config.APP_BASE_PATH : DEFAULT_APP_BASE_PATH
      ),
      apiBaseUrl: normalizeBaseUrl(
        typeof config.API_BASE_URL === "string" ? config.API_BASE_URL : DEFAULT_API_BASE_URL
      ),
    };
  }

  function normalizeBasePath(value) {
    const trimmed = String(value || "").trim();
    if (!trimmed) return "";
    const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withLeading.replace(/\/+$/, "");
  }

  function normalizeBaseUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function toApp(path) {
    const safePath = String(path || "");
    if (!safePath) return getConfig().appBasePath || "/";
    if (/^https?:\/\//i.test(safePath)) return safePath;
    const { appBasePath } = getConfig();
    if (!safePath.startsWith("/")) return safePath;
    return `${appBasePath}${safePath}`;
  }

  function toApi(path) {
    const safePath = String(path || "");
    if (!safePath) return safePath;
    if (/^https?:\/\//i.test(safePath)) return safePath;
    const { apiBaseUrl } = getConfig();
    if (safePath.startsWith("/api/") || safePath.startsWith("/auth/")) {
      return `${apiBaseUrl}${safePath}`;
    }
    return safePath;
  }

  function toApiAsset(path) {
    const safePath = String(path || "");
    if (!safePath) return safePath;
    if (/^https?:\/\//i.test(safePath) || safePath.startsWith("data:")) return safePath;
    const { apiBaseUrl } = getConfig();
    if (safePath.startsWith("/")) return `${apiBaseUrl}${safePath}`;
    return safePath;
  }

  function setAccessToken(token) {
    if (!token || typeof token !== "string") return;
    try { window.localStorage.setItem(ACCESS_TOKEN_KEY, token); } catch {}
  }

  function getAccessToken() {
    try {
      const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
      return token && String(token).trim() ? token : "";
    } catch { return ""; }
  }

  function clearAccessToken() {
    try { window.localStorage.removeItem(ACCESS_TOKEN_KEY); } catch {}
  }

  function buildAuthHeaders(initialHeaders) {
    const headers = new Headers(initialHeaders || {});
    const token = getAccessToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  }

  function authFetch(input, init) {
    let target = input;
    if (typeof input === "string") target = toApi(input);
    const options = { ...(init || {}) };
    options.headers = buildAuthHeaders(options.headers);
    return fetch(target, options);
  }

  globalScope.AppPath = { toApp, toApi, toApiAsset };
  globalScope.AuthToken = { setAccessToken, getAccessToken, clearAccessToken, buildAuthHeaders, authFetch };
})(window);
