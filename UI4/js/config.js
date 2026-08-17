/* ===========================================================
   StepBy UI1 — Runtime configuration
   Loaded first on every page. No dependencies.
   =========================================================== */
(function (w) {
  'use strict';

  /* Where is this build served from?
     Derived from the URL of this very script (<base>/js/config.js) rather
     than hard-coded, so the same files work at /StepBy/UI4/ on Pages, at the
     domain root, and on a local dev server with no edit and no "works on
     production only" path bugs. */
  function detectBasePath() {
    var script = document.currentScript;
    var src = script && script.src;
    if (!src) return '';
    var path = new URL(src, w.location.href).pathname;   // /StepBy/UI4/js/config.js
    return path.replace(/\/js\/config\.js.*$/, '');       // /StepBy/UI4
  }

  var DEFAULTS = {
    /* Path this build is served from. Used to build absolute in-app links and
       the service worker scope. Trailing slash is stripped. */
    APP_BASE_PATH: detectBasePath(),
    /* Backend origin. All /api/* and /auth/* calls are prefixed with this. */
    API_BASE_URL: 'https://barrierfree-map.tail5de5e1.ts.net',
    /* Google Identity Services client id — the same one UI0/UI1 use, so the
       github.io origin is already in the Authorized JavaScript origins list. */
    GOOGLE_CLIENT_ID: '808129330394-dagp56961vbank89vi7bc50pp4u7mgv8.apps.googleusercontent.com',
    /* Bumped on every release; also used as the service worker cache key. */
    VERSION: '2.0.0',
    /* Supported UI languages, in menu order. Adding a third language means
       adding a dictionary in i18n/dict.js and one entry here. */
    LANGS: [
      { code: 'en', label: 'English', native: 'English' },
      { code: 'hi', label: 'Hindi', native: 'हिन्दी' },
      { code: 'ja', label: 'Japanese', native: '日本語' }
    ],
    DEFAULT_LANG: 'en',
    /* Map defaults, used until a real position is available. */
    MAP_DEFAULT_CENTER: [35.6810, 139.7670],
    MAP_DEFAULT_ZOOM: 15,
    /* Feed query defaults. */
    FEED_RADIUS_KM: 25,
    REQUEST_TIMEOUT_MS: 12000
  };

  var current = w.APP_CONFIG || {};
  var cfg = {};
  Object.keys(DEFAULTS).forEach(function (k) {
    cfg[k] = Object.prototype.hasOwnProperty.call(current, k) ? current[k] : DEFAULTS[k];
  });
  cfg.APP_BASE_PATH = String(cfg.APP_BASE_PATH || '').replace(/\/+$/, '');
  cfg.API_BASE_URL = String(cfg.API_BASE_URL || '').replace(/\/+$/, '');

  w.APP_CONFIG = cfg;
})(window);
