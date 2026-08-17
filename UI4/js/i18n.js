/* ===========================================================
   StepBy UI1 — i18n runtime

   Markup contract
   ---------------
   <h1 data-i18n="map.title">Map</h1>
       -> replaces textContent
   <input data-i18n-attr="placeholder:post.notesPlaceholder">
       -> sets one or more attributes; comma-separated "attr:key" pairs
   <span data-i18n="feed.count" data-i18n-n="12">12 reports</span>
       -> data-i18n-* become interpolation params ({n} here)

   The English string is written inline in the HTML as well, so an English
   user sees the final copy on the very first paint and a missing key degrades
   to readable English instead of a raw key.
   =========================================================== */
(function (w, d) {
  'use strict';

  var cfg = w.APP_CONFIG || {};
  var prefs = w.StepByPrefs;
  var dicts = w.STEPBY_DICT || {};
  var fallbackLang = cfg.DEFAULT_LANG || 'en';

  function dict() { return dicts[prefs.lang] || dicts[fallbackLang] || {}; }

  function interpolate(str, params) {
    if (!params) return str;
    return str.replace(/\{(\w+)\}/g, function (match, name) {
      return Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match;
    });
  }

  /**
   * Translate a key. Falls back to the default language, then to the key
   * itself so a missing string is visible in testing rather than blank.
   */
  function t(key, params) {
    var table = dict();
    var value = table[key];
    if (value === undefined) {
      var base = dicts[fallbackLang] || {};
      value = base[key];
    }
    if (value === undefined) {
      if (w.console && console.warn) console.warn('[i18n] missing key:', key);
      return key;
    }
    return interpolate(value, params);
  }

  /** Collect data-i18n-* attributes as interpolation params. */
  function paramsFrom(el) {
    var params = null;
    for (var i = 0; i < el.attributes.length; i++) {
      var attr = el.attributes[i];
      if (attr.name.indexOf('data-i18n-') !== 0) continue;
      var name = attr.name.slice('data-i18n-'.length);
      if (name === 'attr') continue;
      params = params || {};
      params[name] = attr.value;
    }
    return params;
  }

  /** Apply translations to a subtree. Safe to call repeatedly. */
  function applyTo(root) {
    var scope = root || d;

    var nodes = scope.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      el.textContent = t(el.getAttribute('data-i18n'), paramsFrom(el));
    }

    var attrNodes = scope.querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrNodes.length; j++) {
      var node = attrNodes[j];
      var params = paramsFrom(node);
      node.getAttribute('data-i18n-attr').split(',').forEach(function (pair) {
        var parts = pair.split(':');
        if (parts.length !== 2) return;
        var attrName = parts[0].trim();
        var key = parts[1].trim();
        if (!attrName || !key) return;
        this.setAttribute(attrName, t(key, params));
      }, node);
    }
  }

  /* ---- Locale-aware formatting ------------------------------------------ */

  /* BCP-47 tag for Intl. Kept as an explicit map rather than passing the bare
     language code, because the region changes number grouping and date order
     (en-IN vs en-US) as much as the language does. */
  var LOCALES = { en: 'en-IN', hi: 'hi-IN', ja: 'ja-JP' };

  function locale() { return LOCALES[prefs.lang] || 'en-IN'; }

  function formatNumber(n) {
    try { return new Intl.NumberFormat(locale()).format(n); }
    catch (e) { return String(n); }
  }

  function formatDate(value) {
    var date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '';
    try {
      return new Intl.DateTimeFormat(locale(), { dateStyle: 'medium' }).format(date);
    } catch (e) {
      return date.toISOString().slice(0, 10);
    }
  }

  /** "3 min ago" style label, translated. */
  function formatRelative(value) {
    var date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) return '';
    var diffMs = Date.now() - date.getTime();
    var mins = Math.floor(diffMs / 60000);
    if (mins < 1) return t('common.justNow');
    if (mins < 60) return t('common.minutesAgo', { n: formatNumber(mins) });
    var hours = Math.floor(mins / 60);
    if (hours < 24) return t('common.hoursAgo', { n: formatNumber(hours) });
    var days = Math.floor(hours / 24);
    if (days <= 7) return t('common.daysAgo', { n: formatNumber(days) });
    return formatDate(date);
  }

  function formatDistance(metres) {
    if (!isFinite(metres)) return '';
    if (metres < 1000) return t('common.distanceM', { n: formatNumber(Math.round(metres)) });
    return t('common.distanceKm', { n: formatNumber(Math.round(metres / 100) / 10) });
  }

  /**
   * Resolve a backend tag to a display label.
   * Tags carry a stable `code`; the dictionary is keyed by it. Anything the
   * dictionary does not know falls back to whatever label the API sent, so a
   * newly added tag still renders instead of disappearing.
   */
  function known(code) {
    if (!code) return false;
    var key = 'tag.' + code;
    return dict()[key] !== undefined || (dicts[fallbackLang] || {})[key] !== undefined;
  }

  function tagLabel(tag) {
    if (!tag) return '';
    if (typeof tag === 'string') {
      return known(tag) ? t('tag.' + tag) : tag;
    }

    /* The two endpoints put the code in different fields:
         GET /api/post-tags -> { id: 'audible_signal', label: '...' }
         GET /api/road-info -> { id: '18', code: 'tag_4', labelJa: '...' }
       so `code` wins, and `id` is only treated as a code when it is not a
       bare database number. */
    if (known(tag.code)) return t('tag.' + tag.code);
    if (!/^\d+$/.test(String(tag.id || '')) && known(tag.id)) return t('tag.' + tag.id);

    return tag.label || tag.labelEn || tag.labelJa || tag.name || '';
  }

  function init() {
    applyTo(d);
    d.documentElement.classList.remove('i18n-booting');
  }

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  w.StepByI18n = {
    t: t,
    applyTo: applyTo,
    locale: locale,
    formatNumber: formatNumber,
    formatDate: formatDate,
    formatRelative: formatRelative,
    formatDistance: formatDistance,
    tagLabel: tagLabel
  };
  w.t = t;
})(window, document);
