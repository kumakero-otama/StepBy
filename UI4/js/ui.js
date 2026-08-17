/* ===========================================================
   StepBy UI1 — Shared UI behaviour

   The app bar — logo, title, back button, header actions and the settings
   dropdown — is rendered from here, so renaming a label or changing the menu
   is a one-file edit. In the previous build the same markup was pasted into
   17 pages and drifted apart.
   =========================================================== */
(function (w, d) {
  'use strict';

  var cfg = w.APP_CONFIG;
  var auth = w.StepByAuth;
  var t = function (k, p) { return w.StepByI18n.t(k, p); };
  var icon = function (name) { return w.StepByIcons.svg(name); };

  /* ---- Escaping ---------------------------------------------------------- */

  /** Escape untrusted text for interpolation into an HTML template string. */
  function esc(value) {
    return String(value === undefined || value === null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---- App bar -----------------------------------------------------------
     Declarative: <header data-component="app-bar" data-title-key="map.title"
                          data-back="true" data-actions="settings,profile">   */
  /* Header actions, as in the original design: map, a settings dropdown, and
     profile. There is deliberately no bottom navigation bar — the original
     UI1 has none on any screen, and everything else hangs off the profile
     page. */
  var ACTIONS = {
    map: { href: '/map/', icon: 'map', key: 'nav.map' },
    profile: { href: '/profile/', icon: 'user', key: 'common.profile' },
    help: { href: '/help/', icon: 'circle-question', key: 'common.help' }
  };

  /* UI1 had a page each for appearance and language; they are one screen here,
     so these jump to the right section instead of both landing at the top. */
  var MENU_ITEMS = [
    { href: '/settings/#language', icon: 'language', key: 'settings.language' },
    { href: '/settings/#appearance', icon: 'palette', key: 'settings.appearance' },
    { href: '/help/', icon: 'circle-question', key: 'common.help' }
  ];

  function settingsMenuHtml() {
    return '<details class="menu">' +
      '<summary class="icon-btn" aria-label="' + esc(t('common.settings')) + '" role="button">' +
      icon('gear') + '</summary>' +
      '<div class="menu__panel">' +
      MENU_ITEMS.map(function (item) {
        return '<a class="menu__item" href="' + esc(auth.toApp(item.href)) + '">' +
          icon(item.icon) + '<span>' + esc(t(item.key)) + '</span></a>';
      }).join('') +
      '</div></details>';
  }

  function renderAppBar() {
    var bar = d.querySelector('[data-component="app-bar"]');
    if (!bar) return;

    var titleKey = bar.getAttribute('data-title-key');
    var showBack = bar.getAttribute('data-back') === 'true';
    var showBrand = bar.getAttribute('data-brand') === 'true';
    var actions = (bar.getAttribute('data-actions') || '')
      .split(',').map(function (s) { return s.trim(); }).filter(Boolean);

    var html = '';

    if (showBack) {
      html += '<button type="button" class="icon-btn" data-action="back" aria-label="' +
        esc(t('common.back')) + '">' + icon('arrow-left') + '</button>';
    }

    if (showBrand) {
      var taglineKey = bar.getAttribute('data-tagline-key');
      html += '<span class="app-bar__brand">' +
        '<span class="app-bar__logo" aria-hidden="true">' + icon('shoe-prints') + '</span>' +
        '<span class="app-bar__names">' +
        '<h1>' + esc(t(titleKey || 'app.name')) + '</h1>' +
        (taglineKey ? '<span class="app-bar__tagline">' + esc(t(taglineKey)) + '</span>' : '') +
        '</span></span>';
    } else {
      html += '<h1>' + esc(t(titleKey || 'app.name')) + '</h1>';
    }

    html += '<span class="app-bar__actions">' + actions.map(function (name) {
      if (name === 'settings') return settingsMenuHtml();
      var a = ACTIONS[name];
      if (!a) return '';
      /* Mark the screen you are already on rather than offering it as a
         destination — the original design highlights it the same way. */
      var here = w.location.pathname.indexOf(auth.toApp(a.href)) === 0;
      return '<a class="icon-btn' + (here ? ' icon-btn--current' : '') + '"' +
        ' href="' + esc(auth.toApp(a.href)) + '"' +
        (here ? ' aria-current="page"' : '') +
        ' aria-label="' + esc(t(a.key)) + '">' + icon(a.icon) + '</a>';
    }).join('') + '</span>';

    bar.innerHTML = html;

    var backBtn = bar.querySelector('[data-action="back"]');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        /* history.back() lands outside the app when the screen was opened
           directly (deep link, PWA cold start), so fall back to the map. */
        if (w.history.length > 1 && d.referrer.indexOf(w.location.origin) === 0) w.history.back();
        else w.location.href = auth.toApp('/map/');
      });
    }
  }

  /* ---- Document title ---------------------------------------------------- */
  function applyDocumentTitle() {
    var el = d.querySelector('title[data-i18n]');
    if (!el) return;
    var key = el.getAttribute('data-i18n');
    d.title = key === 'app.name' ? t('app.name') : t(key) + ' — ' + t('app.name');
  }

  /* ---- Toast -------------------------------------------------------------
     Rendered into a polite live region so screen readers announce it. */
  function toastRegion() {
    var region = d.getElementById('toast-region');
    if (!region) {
      region = d.createElement('div');
      region.id = 'toast-region';
      region.className = 'toast-region';
      region.setAttribute('role', 'status');
      region.setAttribute('aria-live', 'polite');
      d.body.appendChild(region);
    }
    return region;
  }

  function toast(message, variant, ms) {
    var el = d.createElement('div');
    el.className = 'toast' + (variant ? ' toast--' + variant : '');
    el.textContent = message;
    toastRegion().appendChild(el);
    w.setTimeout(function () { el.remove(); }, ms || 4000);
  }

  function toastError(err) {
    /* Cancelling our own request is not something to tell the user about. */
    if (w.StepByApi.isAbort(err)) return;
    var key = (err && err.messageKey) || 'error.generic';
    toast(t(key), 'error');
  }

  /* ---- Confirm dialog (native <dialog>, focus-trapped by the platform) --- */
  function confirmDialog(opts) {
    return new Promise(function (resolve) {
      var dlg = d.createElement('dialog');
      dlg.className = 'sheet';
      dlg.innerHTML =
        '<h2></h2><p></p>' +
        '<div class="sheet__actions">' +
        '<button type="button" class="btn btn--secondary" value="cancel"></button>' +
        '<button type="button" class="btn ' + (opts.danger ? 'btn--danger' : 'btn--primary') + '" value="ok"></button>' +
        '</div>';
      dlg.querySelector('h2').textContent = opts.title || '';
      dlg.querySelector('p').textContent = opts.body || '';
      var cancelBtn = dlg.querySelector('[value="cancel"]');
      var okBtn = dlg.querySelector('[value="ok"]');
      cancelBtn.textContent = opts.cancelLabel || t('common.cancel');
      okBtn.textContent = opts.confirmLabel || t('common.save');

      function done(result) {
        dlg.close();
        dlg.remove();
        resolve(result);
      }
      cancelBtn.addEventListener('click', function () { done(false); });
      okBtn.addEventListener('click', function () { done(true); });
      dlg.addEventListener('cancel', function (e) { e.preventDefault(); done(false); });

      d.body.appendChild(dlg);
      dlg.showModal();
      okBtn.focus();
    });
  }

  /* ---- Skeleton / empty helpers ------------------------------------------ */
  function skeletonList(container, count) {
    var n = count || 3;
    var html = '';
    for (var i = 0; i < n; i++) {
      html += '<div class="card" aria-hidden="true">' +
        '<div class="skeleton" style="height:14px;width:60%"></div>' +
        '<div class="skeleton" style="height:12px;width:85%;margin-top:10px"></div>' +
        '<div class="skeleton" style="height:12px;width:40%;margin-top:8px"></div>' +
        '</div>';
    }
    container.innerHTML = html;
    container.setAttribute('aria-busy', 'true');
  }

  function emptyState(container, opts) {
    container.removeAttribute('aria-busy');
    container.innerHTML =
      '<div class="empty-state">' +
      icon(opts.icon || 'inbox') +
      '<h2>' + esc(opts.title) + '</h2>' +
      '<p>' + esc(opts.body || '') + '</p>' +
      (opts.actionHref
        ? '<p style="margin-top:16px"><a class="btn btn--primary" href="' + esc(opts.actionHref) + '">' + esc(opts.actionLabel) + '</a></p>'
        : '') +
      '</div>';
  }

  function errorState(container, err, onRetry) {
    container.removeAttribute('aria-busy');
    container.innerHTML =
      '<div class="empty-state">' +
      icon('triangle-exclamation') +
      '<h2>' + esc(t((err && err.messageKey) || 'error.generic')) + '</h2>' +
      '<p><button type="button" class="btn btn--secondary" data-action="retry">' + esc(t('common.retry')) + '</button></p>' +
      '</div>';
    var btn = container.querySelector('[data-action="retry"]');
    if (btn && onRetry) btn.addEventListener('click', onRetry);
  }

  /* ---- Avatars -------------------------------------------------------------
     The app icon is not a stand-in for a person. Missing and broken avatars
     both fall back to a neutral portrait glyph, as the original build did. */
  var AVATAR_FALLBACK = 'assets/avatar-placeholder.svg';

  function avatarUrl() { return auth.toApp('/' + AVATAR_FALLBACK); }

  /** Point an <img> at a user icon, with the placeholder for empty or broken. */
  function setAvatar(img, url) {
    if (!img) return;
    var fallback = avatarUrl();
    img.onerror = function () {
      img.onerror = null;
      img.src = fallback;
    };
    img.src = url ? auth.toAsset(url) : fallback;
  }

  /* ---- Image downscaling (before upload) --------------------------------- */
  function resizeImage(file, maxDim, quality) {
    return new Promise(function (resolve, reject) {
      if (!file) { reject(new Error('no file')); return; }
      var url = URL.createObjectURL(file);
      var img = new Image();
      img.onload = function () {
        var wpx = img.naturalWidth;
        var hpx = img.naturalHeight;
        var limit = maxDim || 1024;
        if (wpx > limit || hpx > limit) {
          if (wpx >= hpx) { hpx = Math.round(hpx * limit / wpx); wpx = limit; }
          else { wpx = Math.round(wpx * limit / hpx); hpx = limit; }
        }
        var canvas = d.createElement('canvas');
        canvas.width = wpx;
        canvas.height = hpx;
        canvas.getContext('2d').drawImage(img, 0, 0, wpx, hpx);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/jpeg', quality || 0.72));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        reject(new Error('decode failed'));
      };
      img.src = url;
    });
  }

  /* ---- PRO status ----------------------------------------------------------
     Read once per page and cached on the user record, so the profile chip and
     the map's save flow agree without each fetching it again. */
  function readIsPro(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (typeof payload.isPro === 'boolean') return payload.isPro;
    if (typeof payload.is_pro === 'boolean') return payload.is_pro;
    if (payload.data && typeof payload.data === 'object') {
      if (typeof payload.data.isPro === 'boolean') return payload.data.isPro;
      if (typeof payload.data.is_pro === 'boolean') return payload.data.is_pro;
    }
    return null;
  }

  function fetchIsPro() {
    if (!auth.isSignedIn()) return Promise.resolve(false);
    return w.StepByApi.getProStatus()
      .then(function (res) {
        var value = readIsPro(res);
        if (typeof value !== 'boolean') return false;
        var user = auth.getCachedUser();
        if (user) auth.setCachedUser(Object.assign({}, user, { isPro: value }));
        return value;
      })
      .catch(function () { return false; });
  }

  /* ---- Service worker ----------------------------------------------------- */
  function registerServiceWorker() {
    if (!('serviceWorker' in navigator)) return;
    if (location.protocol !== 'https:' && location.hostname !== 'localhost') return;
    w.addEventListener('load', function () {
      navigator.serviceWorker
        .register(auth.toApp('/sw.js'), { scope: auth.toApp('/') })
        .catch(function (err) { if (w.console) console.warn('[sw]', err); });
    });
  }

  /* ---- Boot --------------------------------------------------------------- */
  function boot() {
    renderAppBar();
    applyDocumentTitle();
    registerServiceWorker();
  }

  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot);
  else boot();

  /* Re-render everything this module owns when the language changes. Pages
     add their own listener for their dynamic content. */
  d.addEventListener('stepby:langchange', function () {
    w.StepByI18n.applyTo(d);
    renderAppBar();
    applyDocumentTitle();
  });

  w.StepByUI = {
    esc: esc,
    applyDocumentTitle: applyDocumentTitle,
    toast: toast,
    toastError: toastError,
    confirmDialog: confirmDialog,
    skeletonList: skeletonList,
    emptyState: emptyState,
    errorState: errorState,
    resizeImage: resizeImage,
    setAvatar: setAvatar,
    avatarUrl: avatarUrl,
    readIsPro: readIsPro,
    fetchIsPro: fetchIsPro,
    renderAppBar: renderAppBar,
    version: cfg.VERSION
  };
})(window, document);
