/* ===========================================================
   StepBy UI1 — Auth token + path helpers

   Cookie-free: a Google ID token is exchanged for an app access token, which
   is then sent as `Authorization: Bearer <token>` on every protected call.
   =========================================================== */
(function (w) {
  'use strict';

  var cfg = w.APP_CONFIG;
  var TOKEN_KEY = 'stepby.accessToken';
  var USER_KEY = 'stepby.user';

  /* ---- Path helpers ------------------------------------------------------ */

  /** Absolute in-app URL, e.g. toApp('/map/') -> '/StepBy/UI4/map/'. */
  function toApp(path) {
    var p = String(path || '');
    if (!p) return cfg.APP_BASE_PATH + '/';
    if (/^https?:\/\//i.test(p)) return p;
    if (p.charAt(0) !== '/') return p;
    return cfg.APP_BASE_PATH + p;
  }

  /** Absolute API URL for /api/* and /auth/* paths. */
  function toApi(path) {
    var p = String(path || '');
    if (!p || /^https?:\/\//i.test(p)) return p;
    if (p.indexOf('/api/') === 0 || p.indexOf('/auth/') === 0) return cfg.API_BASE_URL + p;
    return p;
  }

  /** Absolute URL for a media path returned by the API. */
  function toAsset(path) {
    var p = String(path || '');
    if (!p || /^(https?:|data:|blob:)/i.test(p)) return p;
    if (p.charAt(0) === '/') return cfg.API_BASE_URL + p;
    return p;
  }

  /* ---- Token storage ----------------------------------------------------- */

  function readStore(key) {
    try { return w.localStorage.getItem(key); } catch (e) { return null; }
  }
  function writeStore(key, value) {
    try { w.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }
  function removeStore(key) {
    try { w.localStorage.removeItem(key); } catch (e) { /* private mode */ }
  }

  function getToken() {
    var v = readStore(TOKEN_KEY);
    return v && v.trim() ? v : '';
  }

  function setToken(token) {
    if (!token || typeof token !== 'string') return;
    writeStore(TOKEN_KEY, token);
  }

  function clearSession() {
    removeStore(TOKEN_KEY);
    removeStore(USER_KEY);
  }

  function isSignedIn() { return !!getToken(); }

  /** Decoded JWT payload, or null if absent/unparseable. */
  function tokenPayload() {
    var token = getToken();
    if (!token) return null;
    var parts = token.split('.');
    if (parts.length !== 3) return null;
    try {
      var json = w.atob(parts[1].replace(/-/g, '+').replace(/_/g, '/'));
      /* atob yields Latin-1; re-decode so non-ASCII display names survive. */
      var bytes = Uint8Array.from(json, function (c) { return c.charCodeAt(0); });
      return JSON.parse(new TextDecoder().decode(bytes));
    } catch (e) {
      return null;
    }
  }

  /** True when the token is absent or its exp has passed. */
  function isTokenExpired() {
    var payload = tokenPayload();
    if (!payload || !payload.exp) return !getToken();
    return payload.exp * 1000 <= Date.now();
  }

  /* ---- Cached user profile ---------------------------------------------- */

  function getCachedUser() {
    var raw = readStore(USER_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
  }

  function setCachedUser(user) {
    if (!user) { removeStore(USER_KEY); return; }
    try { writeStore(USER_KEY, JSON.stringify(user)); } catch (e) { /* ignore */ }
  }

  /* ---- Headers ----------------------------------------------------------- */

  function authHeaders(initial) {
    var headers = new Headers(initial || {});
    var token = getToken();
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', 'Bearer ' + token);
    }
    return headers;
  }

  w.StepByAuth = {
    toApp: toApp,
    toApi: toApi,
    toAsset: toAsset,
    getToken: getToken,
    setToken: setToken,
    clearSession: clearSession,
    isSignedIn: isSignedIn,
    isTokenExpired: isTokenExpired,
    tokenPayload: tokenPayload,
    getCachedUser: getCachedUser,
    setCachedUser: setCachedUser,
    authHeaders: authHeaders
  };
})(window);
