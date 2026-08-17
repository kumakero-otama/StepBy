/* ===========================================================
   StepBy UI1 — Reports feed

   Replaces four near-identical pages (posts / recent / popular / recommend)
   from the previous build. They had drifted apart: only one of them had the
   tag-rendering fix, so the other three printed "undefined" for string tags.
   One page, one sort control.

   Note on the API: /api/road-info returns only {id, lat, lng, createdBy} for
   a list. Tags, notes and photos live on the detail endpoint, so the cards
   render immediately from the list and then hydrate a bounded number of them
   in the background — never N unbounded requests.
   =========================================================== */
(function (w, d) {
  'use strict';

  var cfg = w.APP_CONFIG;
  var api = w.StepByApi;
  var auth = w.StepByAuth;
  var ui = w.StepByUI;
  var i18n = w.StepByI18n;
  var t = w.t;

  var HYDRATE_LIMIT = 20;   // detail fetches per load
  var HYDRATE_PARALLEL = 4;

  var listEl = d.getElementById('list');
  var countEl = d.getElementById('count-bar');
  var sortEl = d.getElementById('sort');
  var locateBtn = d.getElementById('locate');

  var SORT_KEY = 'stepby.feedSort';
  var state = {
    sort: 'recent',
    centre: { lat: cfg.MAP_DEFAULT_CENTER[0], lng: cfg.MAP_DEFAULT_CENTER[1] },
    located: false,
    items: [],
    controller: null
  };

  /* ---- Geometry ---------------------------------------------------------- */
  function distance(point) {
    if (!isFinite(point.lat) || !isFinite(point.lng)) return Infinity;
    var R = 6371000;
    var toRad = Math.PI / 180;
    var dLat = (point.lat - state.centre.lat) * toRad;
    var dLng = (point.lng - state.centre.lng) * toRad;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(state.centre.lat * toRad) * Math.cos(point.lat * toRad) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  function sortItems(items) {
    var copy = items.slice();
    if (state.sort === 'nearby') {
      copy.sort(function (a, b) { return distance(a) - distance(b); });
    } else if (state.sort === 'popular') {
      copy.sort(function (a, b) { return b.images.length - a.images.length; });
    } else {
      copy.sort(function (a, b) {
        return new Date(b.createdAt || 0) - new Date(a.createdAt || 0);
      });
    }
    return copy;
  }

  /* ---- Load -------------------------------------------------------------- */
  async function load() {
    /* Cancel anything still in flight so a fast re-sort cannot let an older
       response overwrite a newer one. */
    if (state.controller) state.controller.abort();
    state.controller = new AbortController();
    var signal = state.controller.signal;

    ui.skeletonList(listEl, 4);
    countEl.textContent = t('common.loading');

    try {
      state.items = await api.listReportsDetailed({
        lat: state.centre.lat,
        lng: state.centre.lng,
        radiusKm: cfg.FEED_RADIUS_KM
      }, {
        signal: signal,
        limit: HYDRATE_LIMIT,
        parallel: HYDRATE_PARALLEL,
        /* Paint placeholder cards as soon as the list arrives, then fill each
           one in as its detail lands, rather than holding the whole screen
           back for the slowest request. */
        onList: function (items) {
          state.items = items;
          render();
        },
        onItem: patchCard
      });
      if (!signal.aborted) render();
    } catch (err) {
      if (signal.aborted) return;
      countEl.textContent = '';
      ui.errorState(listEl, err, load);
    }
  }

  /* ---- Render ------------------------------------------------------------ */
  function tagChips(item) {
    if (!item.hydrated) {
      return '<span class="skeleton" style="display:inline-block;height:24px;width:120px;border-radius:999px"></span>';
    }
    if (!item.tags.length) {
      return '<span class="chip chip--muted">' + ui.esc(t('feed.noTags')) + '</span>';
    }
    return item.tags.map(function (tag) {
      /* tagLabel copes with a {code,labelJa} object, a bare code string, or
         an unknown tag — the old build assumed one shape and printed
         "undefined" for the others. */
      var label = i18n.tagLabel(tag);
      return label ? '<span class="chip">' + ui.esc(label) + '</span>' : '';
    }).join('');
  }

  function cardInner(item) {
    var thumb = item.images && item.images[0];
    var when = item.createdAt ? i18n.formatRelative(item.createdAt) : '';
    var away = i18n.formatDistance(distance(item));

    return (thumb
      ? '<img class="report-card__thumb" src="' + ui.esc(auth.toAsset(thumb)) + '" alt="" loading="lazy">'
      : '') +
      '<div class="chip-set">' + tagChips(item) + '</div>' +
      (item.notes ? '<p class="card__title" style="margin-top:10px">' + ui.esc(item.notes) + '</p>' : '') +
      '<p class="card__meta">' +
      (item.author && item.author.name ? '<span>' + ui.esc(item.author.name) + '</span>' : '') +
      (when ? '<span>' + ui.esc(when) + '</span>' : '') +
      (away ? '<span>' + ui.esc(away) + '</span>' : '') +
      '</p>';
  }

  function patchCard(item) {
    var el = listEl.querySelector('[data-report-id="' + CSS.escape(item.id) + '"]');
    if (el) el.innerHTML = cardInner(item);
  }

  function render() {
    listEl.removeAttribute('aria-busy');

    if (!state.items.length) {
      countEl.textContent = '';
      ui.emptyState(listEl, {
        icon: 'road',
        title: t('feed.empty'),
        body: state.located ? t('feed.emptyBody') : t('feed.useMyLocation'),
        actionHref: auth.toApp('/post/'),
        actionLabel: t('feed.emptyAction')
      });
      return;
    }

    countEl.textContent = t('feed.count', { n: i18n.formatNumber(state.items.length) });
    listEl.innerHTML = sortItems(state.items).map(function (item) {
      return '<a class="card" data-report-id="' + ui.esc(item.id) + '" href="' +
        ui.esc(auth.toApp('/detail/') + '?id=' + encodeURIComponent(item.id)) + '">' +
        cardInner(item) + '</a>';
    }).join('');
  }

  /* ---- Location ---------------------------------------------------------- */
  function locate() {
    if (!navigator.geolocation) {
      ui.toast(t('map.locationUnavailable'), 'error');
      return;
    }
    locateBtn.setAttribute('aria-busy', 'true');
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        locateBtn.removeAttribute('aria-busy');
        state.centre = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.located = true;
        load();
      },
      function (err) {
        locateBtn.removeAttribute('aria-busy');
        ui.toast(t(err.code === err.PERMISSION_DENIED ? 'map.locationDenied' : 'map.locationUnavailable'), 'error');
        /* "Nearby" without a location is meaningless — fall back visibly. */
        if (state.sort === 'nearby') {
          state.sort = 'recent';
          sortEl.value = 'recent';
          render();
        }
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 }
    );
  }

  /* ---- Wiring ------------------------------------------------------------ */
  try {
    var saved = localStorage.getItem(SORT_KEY);
    if (saved) state.sort = saved;
  } catch (e) { /* private mode */ }
  sortEl.value = state.sort;

  sortEl.addEventListener('change', function () {
    state.sort = sortEl.value;
    try { localStorage.setItem(SORT_KEY, state.sort); } catch (e) { /* ignore */ }
    if (state.sort === 'nearby' && !state.located) locate();
    else render();
  });

  locateBtn.addEventListener('click', locate);

  /* Relative times, tag labels and distances are all language-dependent. */
  d.addEventListener('stepby:langchange', function () {
    if (state.items.length) render();
  });

  load();
  /* Ask for a position in the background; if granted, reload around it. */
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        state.centre = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        state.located = true;
        load();
      },
      function () { /* the default centre still shows something */ },
      { enableHighAccuracy: false, timeout: 8000, maximumAge: 300000 }
    );
  }
})(window, document);
