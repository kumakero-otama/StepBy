(function initAuthTokenClient(globalScope) {
  const ACCESS_TOKEN_KEY = "access_token.v1";
  const DEFAULT_APP_BASE_PATH = "/StepBy/UI2";
  const DEFAULT_API_BASE_URL = "https://barrierfree-map.loophole.site";
  const DEFAULT_AUTH_TIMEOUT_MS = 12000;

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
    if (!trimmed) {
      return "";
    }
    const withLeading = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return withLeading.replace(/\/+$/, "");
  }

  function normalizeBaseUrl(value) {
    return String(value || "").trim().replace(/\/+$/, "");
  }

  function toApp(path) {
    const safePath = String(path || "");
    if (!safePath) {
      return getConfig().appBasePath || "/";
    }
    if (/^https?:\/\//i.test(safePath)) {
      return safePath;
    }
    const { appBasePath } = getConfig();
    if (!safePath.startsWith("/")) {
      return safePath;
    }
    return `${appBasePath}${safePath}`;
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

  function toApiAsset(path) {
    const safePath = String(path || "");
    if (!safePath) {
      return safePath;
    }
    if (/^https?:\/\//i.test(safePath) || safePath.startsWith("data:")) {
      return safePath;
    }
    const { apiBaseUrl } = getConfig();
    if (safePath.startsWith("/")) {
      return `${apiBaseUrl}${safePath}`;
    }
    return safePath;
  }

  function setAccessToken(token) {
    if (!token || typeof token !== "string") {
      return;
    }
    try {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
    } catch {
      // ignore storage errors
    }
  }

  function getAccessToken() {
    try {
      const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
      return token && String(token).trim() ? token : "";
    } catch {
      return "";
    }
  }

  function clearAccessToken() {
    try {
      window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    } catch {
      // ignore storage errors
    }
  }

  function buildAuthHeaders(initialHeaders) {
    const headers = new Headers(initialHeaders || {});
    const token = getAccessToken();
    if (token && !headers.has("Authorization")) {
      headers.set("Authorization", `Bearer ${token}`);
    }
    return headers;
  }

  function createAuthTimeoutError() {
    const error = new Error("auth_request_timeout");
    error.name = "AuthTimeoutError";
    error.code = "auth_timeout";
    return error;
  }

  function isTimeoutError(error) {
    return Boolean(
      error
      && (error.code === "auth_timeout" || error.name === "AuthTimeoutError")
    );
  }

  function isTemporaryError(error) {
    return isTimeoutError(error) || (error instanceof TypeError) || (error && error.name === "TypeError");
  }

  function authFetch(input, init) {
    let target = input;
    if (typeof input === "string") {
      target = toApi(input);
    }
    const options = { ...(init || {}) };
    const timeoutMs = Number(options.timeoutMs);
    delete options.timeoutMs;
    options.headers = buildAuthHeaders(options.headers);
    if (options.credentials == null) {
      options.credentials = "include";
    }

    if (typeof AbortController !== "function") {
      return fetch(target, options);
    }

    const controller = new AbortController();
    const signal = options.signal;
    let timedOut = false;
    let timeoutId = null;

    if (signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }

    const effectiveTimeoutMs = Number.isFinite(timeoutMs) && timeoutMs > 0
      ? timeoutMs
      : DEFAULT_AUTH_TIMEOUT_MS;
    timeoutId = window.setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, effectiveTimeoutMs);

    options.signal = controller.signal;

    return fetch(target, options)
      .catch((error) => {
        if (timedOut) {
          throw createAuthTimeoutError();
        }
        throw error;
      })
      .finally(() => {
        if (timeoutId !== null) {
          window.clearTimeout(timeoutId);
        }
      });
  }

  globalScope.AppPath = {
    toApp,
    toApi,
    toApiAsset,
  };

  globalScope.AuthToken = {
    setAccessToken,
    getAccessToken,
    clearAccessToken,
    buildAuthHeaders,
    authFetch,
    isTimeoutError,
    isTemporaryError,
  };
})(window);
