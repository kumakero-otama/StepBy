// このファイルはアクセストークンの保持、更新、認証付き fetch の共通処理を提供する。
(function initAuthTokenClient(globalScope) {
  const ACCESS_TOKEN_KEY = "access_token.v1";
  const DEFAULT_APP_BASE_PATH = "/StepBy/UI2";
  const DEFAULT_API_BASE_URL = "https://barrierfree-map.loophole.site";
  const DEFAULT_AUTH_TIMEOUT_MS = 12000;
  const REQUEST_ID_STORAGE_KEY = "client_log_request_id.v1";
  const SESSION_ID_STORAGE_KEY = "client_log_session_id.v1";
  const CLIENT_LOG_DB_NAME = "stepby_client_logs_v1";
  const CLIENT_LOG_STORE_NAME = "pending_logs";
  const CLIENT_LOG_BATCH_SIZE = 50;
  const CLIENT_LOG_MAX_STORED = 500;
  const CLIENT_LOG_FLUSH_INTERVAL_MS = 30000;
  const CLIENT_LOG_STARTUP_FLUSH_DELAY_MS = 3000;
  const TEMPORARY_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

  let flushPromise = null;
  let clientLogUploadDisabled = false;
  const fallbackPendingLogs = [];

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
      return false;
    }
    let stored = false;
    try {
      window.localStorage.setItem(ACCESS_TOKEN_KEY, token);
      stored = window.localStorage.getItem(ACCESS_TOKEN_KEY) === token;
    } catch (error) {
      void logEvent({
        category: "storage",
        event: "token_save_failed",
        level: "error",
        message: error && error.message ? String(error.message) : "token_storage_failed",
      });
      return false;
    }
    void logEvent({
      category: "storage",
      event: stored ? "token_saved" : "token_save_failed",
      level: stored ? "info" : "error",
      message: stored ? "Access token saved" : "Failed to verify access token storage",
      meta: {
        hasAccessToken: stored,
        tokenLength: token.length,
      },
    });
    return stored;
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
    void logEvent({
      category: "storage",
      event: "token_cleared",
      level: "info",
      message: "Access token cleared",
    });
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

  function shouldRetryRequest(method, error, responseStatus) {
    if (String(method || "GET").toUpperCase() !== "GET") {
      return false;
    }
    if (typeof responseStatus === "number") {
      return TEMPORARY_HTTP_STATUS.has(responseStatus);
    }
    return isTemporaryError(error);
  }

  function resolveTimeoutMs(target, explicitTimeoutMs) {
    if (Number.isFinite(explicitTimeoutMs) && explicitTimeoutMs > 0) {
      return explicitTimeoutMs;
    }
    const path = typeof target === "string" ? target : "";
    if (/\/api\/(match|trace|osm-tactile-ways)/.test(path)) {
      return 25000;
    }
    if (/\/api\/(config|pro-status)/.test(path)) {
      return 15000;
    }
    if (/\/auth\//.test(path)) {
      return 12000;
    }
    return DEFAULT_AUTH_TIMEOUT_MS;
  }

  function safeNowIso() {
    return new Date().toISOString();
  }

  function safeRandomId(length) {
    const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
    let value = "";
    for (let index = 0; index < length; index += 1) {
      value += alphabet[Math.floor(Math.random() * alphabet.length)];
    }
    return value;
  }

  function createRequestId(prefix) {
    const normalizedPrefix = prefix && typeof prefix === "string" ? prefix : "req";
    return `${normalizedPrefix}_${Date.now()}_${safeRandomId(8)}`;
  }

  function createLogId() {
    return `clog_${Date.now()}_${safeRandomId(6)}`;
  }

  function getCurrentRequestId() {
    try {
      const value = window.sessionStorage.getItem(REQUEST_ID_STORAGE_KEY);
      return value && String(value).trim() ? value : "";
    } catch {
      return "";
    }
  }

  function setCurrentRequestId(requestId) {
    if (!requestId || typeof requestId !== "string") {
      return "";
    }
    try {
      window.sessionStorage.setItem(REQUEST_ID_STORAGE_KEY, requestId);
    } catch {
      // ignore storage errors
    }
    return requestId;
  }

  function clearCurrentRequestId() {
    try {
      window.sessionStorage.removeItem(REQUEST_ID_STORAGE_KEY);
    } catch {
      // ignore storage errors
    }
  }

  function getOrCreateClientSessionId() {
    try {
      const existing = window.sessionStorage.getItem(SESSION_ID_STORAGE_KEY);
      if (existing && String(existing).trim()) {
        return existing;
      }
      const created = `sess_${Date.now()}_${safeRandomId(8)}`;
      window.sessionStorage.setItem(SESSION_ID_STORAGE_KEY, created);
      return created;
    } catch {
      return `sess_${Date.now()}_${safeRandomId(8)}`;
    }
  }

  function getQueryDebugFlags() {
    try {
      const params = new URLSearchParams(window.location.search || "");
      return {
        network: params.get("debug_network") === "1",
        auth: params.get("debug_auth") === "1",
      };
    } catch {
      return { network: false, auth: false };
    }
  }

  function getStoredDebugFlags() {
    try {
      return {
        network: window.localStorage.getItem("debug_network") === "1",
        auth: window.localStorage.getItem("debug_auth") === "1",
      };
    } catch {
      return { network: false, auth: false };
    }
  }

  function getDebugFlags() {
    const queryFlags = getQueryDebugFlags();
    const storedFlags = getStoredDebugFlags();
    return {
      network: queryFlags.network || storedFlags.network,
      auth: queryFlags.auth || storedFlags.auth,
    };
  }

  function shouldConsoleDebug(category) {
    const flags = getDebugFlags();
    if (flags.network) {
      return true;
    }
    return category === "auth" && flags.auth;
  }

  function safeConsoleLog(level, payload) {
    if (!shouldConsoleDebug(payload && payload.category)) {
      return;
    }
    const logger = level === "error"
      ? console.error
      : (level === "warn" ? console.warn : console.log);
    logger("[ClientLog]", payload);
  }

  function sanitizeMeta(meta) {
    if (!meta || typeof meta !== "object") {
      return null;
    }
    const clone = {};
    Object.entries(meta).forEach(([key, value]) => {
      if (value == null) {
        clone[key] = value;
        return;
      }
      if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
        clone[key] = value;
        return;
      }
      if (Array.isArray(value)) {
        clone[key] = value.slice(0, 20);
        return;
      }
      clone[key] = String(value);
    });
    return clone;
  }

  function normalizePath(target) {
    const value = typeof target === "string" ? target : "";
    if (!value) {
      return "";
    }
    const { apiBaseUrl } = getConfig();
    if (value.startsWith(apiBaseUrl)) {
      return value.slice(apiBaseUrl.length) || "/";
    }
    return value;
  }

  function categorizePath(path) {
    if (String(path || "").startsWith("/auth/")) {
      return "auth";
    }
    if (String(path || "").startsWith("/api/")) {
      return "api";
    }
    return "network";
  }

  function createLogRecord(entry) {
    const flags = getDebugFlags();
    return {
      logId: entry && entry.logId ? String(entry.logId) : createLogId(),
      createdAt: entry && entry.createdAt ? String(entry.createdAt) : safeNowIso(),
      event: entry && entry.event ? String(entry.event) : "unknown_event",
      category: entry && entry.category ? String(entry.category) : "network",
      level: entry && entry.level ? String(entry.level) : "info",
      path: entry && entry.path ? String(entry.path) : "",
      method: entry && entry.method ? String(entry.method).toUpperCase() : "",
      status: entry && Number.isFinite(entry.status) ? Number(entry.status) : null,
      message: entry && entry.message ? String(entry.message) : "",
      requestId: entry && entry.requestId ? String(entry.requestId) : (getCurrentRequestId() || ""),
      sessionId: getOrCreateClientSessionId(),
      screen: `${window.location.pathname}${window.location.search || ""}`,
      meta: sanitizeMeta({
        ...(entry && entry.meta ? entry.meta : {}),
        hasAccessToken: getAccessToken() ? true : false,
        debugNetwork: flags.network,
        debugAuth: flags.auth,
      }),
    };
  }

  function openClientLogDb() {
    if (!("indexedDB" in window)) {
      return Promise.resolve(null);
    }
    return new Promise((resolve) => {
      try {
        const request = window.indexedDB.open(CLIENT_LOG_DB_NAME, 1);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(CLIENT_LOG_STORE_NAME)) {
            db.createObjectStore(CLIENT_LOG_STORE_NAME, { keyPath: "logId" });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }

  async function putPendingLog(record) {
    const db = await openClientLogDb();
    if (!db) {
      fallbackPendingLogs.push(record);
      while (fallbackPendingLogs.length > CLIENT_LOG_MAX_STORED) {
        fallbackPendingLogs.shift();
      }
      return;
    }
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(CLIENT_LOG_STORE_NAME, "readwrite");
        tx.objectStore(CLIENT_LOG_STORE_NAME).put(record);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
    await trimPendingLogs();
  }

  async function getPendingLogs(limit) {
    const db = await openClientLogDb();
    if (!db) {
      return fallbackPendingLogs.slice(0, limit);
    }
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(CLIENT_LOG_STORE_NAME, "readonly");
        const request = tx.objectStore(CLIENT_LOG_STORE_NAME).getAll();
        request.onsuccess = () => {
          const rows = Array.isArray(request.result) ? request.result : [];
          rows.sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
          resolve(typeof limit === "number" && limit > 0 ? rows.slice(0, limit) : rows);
        };
        request.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }

  async function deletePendingLogs(logIds) {
    const normalized = Array.isArray(logIds) ? logIds.filter(Boolean) : [];
    if (!normalized.length) {
      return;
    }
    const db = await openClientLogDb();
    if (!db) {
      const remaining = fallbackPendingLogs.filter((record) => !normalized.includes(record.logId));
      fallbackPendingLogs.length = 0;
      fallbackPendingLogs.push(...remaining);
      return;
    }
    await new Promise((resolve) => {
      try {
        const tx = db.transaction(CLIENT_LOG_STORE_NAME, "readwrite");
        const store = tx.objectStore(CLIENT_LOG_STORE_NAME);
        normalized.forEach((logId) => {
          store.delete(logId);
        });
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  async function trimPendingLogs() {
    const allLogs = await getPendingLogs();
    if (allLogs.length <= CLIENT_LOG_MAX_STORED) {
      return;
    }
    const excess = allLogs.slice(0, allLogs.length - CLIENT_LOG_MAX_STORED).map((record) => record.logId);
    await deletePendingLogs(excess);
  }

  async function logEvent(entry) {
    const record = createLogRecord(entry || {});
    safeConsoleLog(record.level, record);
    await putPendingLog(record);
    return record;
  }

  async function sendClientLogBatch(records, reason) {
    if (!Array.isArray(records) || !records.length) {
      return true;
    }
    if (clientLogUploadDisabled) {
      return false;
    }
    const payload = {
      client: {
        appVersion: typeof globalScope.FRONTEND_VERSION === "string" ? globalScope.FRONTEND_VERSION : undefined,
        userAgent: String(window.navigator && window.navigator.userAgent || ""),
        platform: "web",
      },
      session: {
        requestId: getCurrentRequestId() || undefined,
        sessionId: getOrCreateClientSessionId(),
        reason: reason || "scheduled",
      },
      logs: records.map((record) => ({
        logId: record.logId,
        createdAt: record.createdAt,
        event: record.event,
        category: record.category,
        level: record.level,
        path: record.path || undefined,
        method: record.method || undefined,
        status: typeof record.status === "number" ? record.status : null,
        message: record.message || undefined,
        meta: record.meta || undefined,
      })),
    };
    const response = await fetch(toApi("/api/client-logs"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (response.status === 413 && records.length > 1) {
      const midpoint = Math.ceil(records.length / 2);
      const firstHalf = records.slice(0, midpoint);
      const secondHalf = records.slice(midpoint);
      const firstResult = await sendClientLogBatch(firstHalf, `${reason || "batch"}:split1`);
      const secondResult = await sendClientLogBatch(secondHalf, `${reason || "batch"}:split2`);
      return firstResult && secondResult;
    }
    if (response.status === 429 || response.status >= 500) {
      return false;
    }
    if (response.status === 404 || response.status === 405) {
      clientLogUploadDisabled = true;
      return false;
    }
    if (response.status === 400) {
      await deletePendingLogs(records.map((record) => record.logId));
      return false;
    }
    if (response.status === 413) {
      await deletePendingLogs(records.map((record) => record.logId));
      return false;
    }
    let payloadJson = null;
    try {
      payloadJson = await response.json();
    } catch {
      payloadJson = null;
    }
    if (response.status === 207 && payloadJson && typeof payloadJson === "object") {
      const acceptedIds = [];
      const duplicateIds = [];
      if (Array.isArray(payloadJson.accepted)) {
        acceptedIds.push(...payloadJson.accepted);
      }
      if (Array.isArray(payloadJson.duplicate)) {
        duplicateIds.push(...payloadJson.duplicate);
      }
      await deletePendingLogs([...acceptedIds, ...duplicateIds]);
      return false;
    }
    if (response.ok) {
      await deletePendingLogs(records.map((record) => record.logId));
      return true;
    }
    return false;
  }

  async function flushPendingLogs(reason) {
    if (clientLogUploadDisabled) {
      return false;
    }
    if (flushPromise) {
      return flushPromise;
    }
    flushPromise = (async () => {
      try {
        const pending = await getPendingLogs(CLIENT_LOG_BATCH_SIZE);
        if (!pending.length) {
          return true;
        }
        return await sendClientLogBatch(pending, reason);
      } catch {
        return false;
      } finally {
        flushPromise = null;
      }
    })();
    return flushPromise;
  }

  function scheduleFlush(reason, delayMs) {
    const effectiveDelay = Number.isFinite(delayMs) && delayMs >= 0 ? delayMs : 0;
    window.setTimeout(() => {
      void flushPendingLogs(reason);
    }, effectiveDelay);
  }

  async function executeFetchAttempt(target, options, meta) {
    const controller = typeof AbortController === "function" ? new AbortController() : null;
    const signal = options.signal;
    let timedOut = false;
    let timeoutId = null;

    if (controller && signal) {
      if (signal.aborted) {
        controller.abort();
      } else {
        signal.addEventListener("abort", () => controller.abort(), { once: true });
      }
    }

    if (controller) {
      timeoutId = window.setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, meta.timeoutMs);
      options.signal = controller.signal;
    }

    const startedAt = Date.now();
    try {
      const response = await fetch(target, options);
      const durationMs = Date.now() - startedAt;
      await logEvent({
        category: meta.category,
        event: response.ok ? `${meta.category}_request_success` : `${meta.category}_request_response`,
        level: response.ok ? "info" : "warn",
        path: meta.path,
        method: meta.method,
        status: response.status,
        requestId: meta.requestId,
        message: `HTTP ${response.status}`,
        meta: {
          durationMs,
          attempt: meta.attempt,
          hasAuthorization: meta.hasAuthorization,
          hasCookie: options.credentials === "include",
        },
      });
      if (meta.path === "/auth/me") {
        await logEvent({
          category: "auth",
          event: response.status === 401 ? "auth_me_401" : (response.ok ? "auth_me_success" : "auth_me_response"),
          level: response.ok ? "info" : "warn",
          path: meta.path,
          method: meta.method,
          status: response.status,
          requestId: meta.requestId,
        });
      }
      return response;
    } catch (error) {
      const durationMs = Date.now() - startedAt;
      const normalizedError = timedOut ? createAuthTimeoutError() : error;
      await logEvent({
        category: meta.category,
        event: timedOut ? "api_request_timeout" : "api_request_network_error",
        level: "error",
        path: meta.path,
        method: meta.method,
        requestId: meta.requestId,
        message: normalizedError && normalizedError.message ? String(normalizedError.message) : "request_failed",
        meta: {
          durationMs,
          attempt: meta.attempt,
          timeout: timedOut,
          hasAuthorization: meta.hasAuthorization,
        },
      });
      throw normalizedError;
    } finally {
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    }
  }

  async function authFetch(input, init) {
    let target = input;
    if (typeof input === "string") {
      target = toApi(input);
    }
    const options = { ...(init || {}) };
    const timeoutMs = Number(options.timeoutMs);
    const explicitRequestId = typeof options.requestId === "string" ? options.requestId : "";
    delete options.timeoutMs;
    delete options.requestId;
    options.headers = buildAuthHeaders(options.headers);
    if (options.credentials == null) {
      options.credentials = "include";
    }
    const method = String(options.method || "GET").toUpperCase();
    const path = normalizePath(typeof target === "string" ? target : "");
    const category = categorizePath(path);
    const requestId = explicitRequestId || getCurrentRequestId() || createRequestId("req");
    if (!getCurrentRequestId()) {
      setCurrentRequestId(requestId);
    }
    options.headers.set("X-Request-Id", requestId);
    const effectiveTimeoutMs = resolveTimeoutMs(path, timeoutMs);
    const hasAuthorization = options.headers.has("Authorization");

    if (path === "/auth/me") {
      await logEvent({
        category: "auth",
        event: "auth_me_start",
        level: "info",
        path,
        method,
        requestId,
        meta: {
          hasAuthorization,
        },
      });
    }

    await logEvent({
      category,
      event: `${category}_request_start`,
      level: "info",
      path,
      method,
      requestId,
      message: "Request started",
      meta: {
        timeoutMs: effectiveTimeoutMs,
        hasAuthorization,
        hasCookie: options.credentials === "include",
      },
    });

    let attempt = 0;
    while (attempt < 2) {
      attempt += 1;
      try {
        const response = await executeFetchAttempt(target, { ...options }, {
          attempt,
          category,
          method,
          path,
          requestId,
          timeoutMs: effectiveTimeoutMs,
          hasAuthorization,
        });
        if (attempt === 1 && shouldRetryRequest(method, null, response.status)) {
          await logEvent({
            category,
            event: `${category}_request_retry`,
            level: "warn",
            path,
            method,
            status: response.status,
            requestId,
            message: `Retrying after HTTP ${response.status}`,
            meta: { attempt },
          });
          continue;
        }
        return response;
      } catch (error) {
        if (attempt === 1 && shouldRetryRequest(method, error, null)) {
          await logEvent({
            category,
            event: `${category}_request_retry`,
            level: "warn",
            path,
            method,
            requestId,
            message: error && error.message ? String(error.message) : "retrying_after_error",
            meta: { attempt },
          });
          continue;
        }
        throw error;
      }
    }
    throw new Error("request_exhausted");
  }

  function markNavigation(reason, targetPath) {
    void logEvent({
      category: "navigation",
      event: "navigation_start",
      level: "info",
      path: targetPath || "",
      method: "NAVIGATE",
      message: reason || "navigation",
    });
  }

  function initClientLogLifecycle() {
    void logEvent({
      category: "navigation",
      event: "page_init",
      level: "info",
      path: `${window.location.pathname}${window.location.search || ""}`,
      method: "LOAD",
      message: "Page initialized",
    });
    scheduleFlush("startup", CLIENT_LOG_STARTUP_FLUSH_DELAY_MS);
    window.setInterval(() => {
      void flushPendingLogs("interval");
    }, CLIENT_LOG_FLUSH_INTERVAL_MS);
    window.addEventListener("online", () => {
      void logEvent({
        category: "network",
        event: "network_online",
        level: "info",
        message: "Browser reported online",
      });
      void flushPendingLogs("online");
    });
  }

  globalScope.AppPath = {
    toApp,
    toApi,
    toApiAsset,
  };

  globalScope.ClientLogs = {
    createRequestId,
    getCurrentRequestId,
    setCurrentRequestId,
    clearCurrentRequestId,
    flushPendingLogs,
    getDebugFlags,
    logEvent,
    markNavigation,
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

  initClientLogLifecycle();
})(window);
