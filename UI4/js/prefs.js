/* ===========================================================
   StepBy UI1 — User preferences (language, theme, text size)

   MUST be loaded synchronously in <head>, before any stylesheet-dependent
   paint. It writes the theme / text-size / lang attributes onto <html> so the
   first frame is already correct — no flash of the wrong theme.
   =========================================================== */
(function (w, d) {
  'use strict';

  var KEYS = {
    lang: 'stepby.lang',
    theme: 'stepby.theme',      // 'system' | 'light' | 'dark'
    textSize: 'stepby.textSize' // 'm' | 's' | 'l' | 'xl'
  };

  function read(key, fallback) {
    try {
      var v = w.localStorage.getItem(key);
      return v === null || v === '' ? fallback : v;
    } catch (e) {
      return fallback;
    }
  }

  function write(key, value) {
    try { w.localStorage.setItem(key, value); } catch (e) { /* private mode */ }
  }

  var cfg = w.APP_CONFIG || {};
  var supported = (cfg.LANGS || [{ code: 'en' }]).map(function (l) { return l.code; });
  var fallbackLang = cfg.DEFAULT_LANG || supported[0] || 'en';

  /* First run: honour the device language if we support it. */
  function detectLang() {
    var stored = read(KEYS.lang, null);
    if (stored && supported.indexOf(stored) !== -1) return stored;
    var nav = (w.navigator.languages || [w.navigator.language || ''])
      .map(function (t) { return String(t).toLowerCase().split('-')[0]; });
    for (var i = 0; i < nav.length; i++) {
      if (supported.indexOf(nav[i]) !== -1) return nav[i];
    }
    return fallbackLang;
  }

  var state = {
    lang: detectLang(),
    theme: read(KEYS.theme, 'system'),
    textSize: read(KEYS.textSize, 'm')
  };

  function applyTheme() {
    if (state.theme === 'light' || state.theme === 'dark') {
      d.documentElement.setAttribute('data-theme', state.theme);
    } else {
      d.documentElement.removeAttribute('data-theme');
    }
  }

  function applyTextSize() {
    if (state.textSize && state.textSize !== 'm') {
      d.documentElement.setAttribute('data-text-size', state.textSize);
    } else {
      d.documentElement.removeAttribute('data-text-size');
    }
  }

  function applyLang() {
    /* The lang attribute must match the text actually on screen — assistive
       tech picks its speech synthesiser from it. */
    d.documentElement.setAttribute('lang', state.lang);
    d.documentElement.setAttribute('dir', 'ltr');
  }

  applyTheme();
  applyTextSize();
  applyLang();

  /* Pages ship with English copy inline. Only hide the body when we actually
     have to swap strings, and never for longer than one frame in practice. */
  if (state.lang !== 'en') {
    d.documentElement.classList.add('i18n-booting');
    w.setTimeout(function () {
      d.documentElement.classList.remove('i18n-booting');
    }, 400);
  }

  w.StepByPrefs = {
    KEYS: KEYS,
    get lang() { return state.lang; },
    get theme() { return state.theme; },
    get textSize() { return state.textSize; },

    setLang: function (code) {
      if (supported.indexOf(code) === -1 || code === state.lang) return false;
      state.lang = code;
      write(KEYS.lang, code);
      applyLang();
      /* Everything that renders text listens for this and re-renders in
         place. No reload, so scroll position and form state survive. */
      d.dispatchEvent(new CustomEvent('stepby:langchange', { detail: { lang: code } }));
      return true;
    },
    setTheme: function (value) {
      state.theme = value;
      write(KEYS.theme, value);
      applyTheme();
    },
    setTextSize: function (value) {
      state.textSize = value;
      write(KEYS.textSize, value);
      applyTextSize();
    }
  };
})(window, document);
