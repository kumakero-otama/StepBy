/* ===========================================================
   StepBy UI1 — Shared location resolver

   Several endpoints (/api/road-info, /api/records) reject a request that has
   no bounding circle — even with mine=1 they answer 400 invalid_radius. So
   every screen that lists data needs a centre, and every screen used to be
   free to invent its own. This is the one place that decides.

   Resolution order:
     1. a position already obtained this session (cached, so five screens do
        not each raise their own permission prompt)
     2. the device's current position, if permission is already granted or the
        user grants it
     3. APP_CONFIG.MAP_DEFAULT_CENTER

   Never rejects: a screen that cannot get a location should still render
   something rather than an error.
   =========================================================== */
(function (w) {
  'use strict';

  var cfg = w.APP_CONFIG;
  var CACHE_KEY = 'stepby.lastCentre';
  var inFlight = null;
  var cached = null;

  function fallback() {
    return {
      lat: cfg.MAP_DEFAULT_CENTER[0],
      lng: cfg.MAP_DEFAULT_CENTER[1],
      radiusKm: cfg.FEED_RADIUS_KM,
      precise: false
    };
  }

  function readStored() {
    try {
      var raw = w.sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var value = JSON.parse(raw);
      return isFinite(value.lat) && isFinite(value.lng) ? value : null;
    } catch (e) {
      return null;
    }
  }

  function store(value) {
    try { w.sessionStorage.setItem(CACHE_KEY, JSON.stringify(value)); } catch (e) { /* private mode */ }
  }

  /**
   * @param {object} [opts] { timeout, radiusKm, force }
   * @returns {Promise<{lat:number,lng:number,radiusKm:number,precise:boolean}>}
   */
  function centre(opts) {
    var options = opts || {};
    var radiusKm = options.radiusKm || cfg.FEED_RADIUS_KM;

    if (!options.force) {
      if (cached) return Promise.resolve(Object.assign({}, cached, { radiusKm: radiusKm }));
      var stored = readStored();
      if (stored) {
        cached = stored;
        return Promise.resolve(Object.assign({}, stored, { radiusKm: radiusKm }));
      }
      if (inFlight) return inFlight.then(function (v) { return Object.assign({}, v, { radiusKm: radiusKm }); });
    }

    if (!w.navigator.geolocation) return Promise.resolve(fallback());

    inFlight = new Promise(function (resolve) {
      var settled = false;
      function finish(value) {
        if (settled) return;
        settled = true;
        inFlight = null;
        resolve(value);
      }

      /* Belt and braces: some Android WebViews never call either callback. */
      var guard = w.setTimeout(function () { finish(fallback()); }, (options.timeout || 8000) + 1000);

      w.navigator.geolocation.getCurrentPosition(
        function (pos) {
          w.clearTimeout(guard);
          var value = {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            radiusKm: radiusKm,
            precise: true
          };
          cached = value;
          store(value);
          finish(value);
        },
        function () {
          w.clearTimeout(guard);
          finish(fallback());
        },
        { enableHighAccuracy: false, timeout: options.timeout || 8000, maximumAge: 300000 }
      );
    });

    return inFlight.then(function (v) { return Object.assign({}, v, { radiusKm: radiusKm }); });
  }

  /** Record a position obtained elsewhere (the map's watchPosition). */
  function remember(lat, lng) {
    if (!isFinite(lat) || !isFinite(lng)) return;
    cached = { lat: lat, lng: lng, radiusKm: cfg.FEED_RADIUS_KM, precise: true };
    store(cached);
  }

  w.StepByGeo = { centre: centre, remember: remember, fallback: fallback };
})(window);
