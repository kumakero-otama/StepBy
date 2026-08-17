/* ===========================================================
   StepBy UI4 — Map display preferences

   The five switches on the settings screen, and the rules the map applies to
   them. Modelled on UI2 (see its otasuke/ screen and map.js), including the
   rule that a "show everyone's" switch overrides the matching "show only
   mine" switch rather than intersecting with it.

   Stored per build. UI0/UI2/UI10 share one `mapDisplaySettings.v1` key across
   the whole github.io origin; keeping UI4 separate means changing a switch
   here does not silently change what another build shows while the two are
   being compared.
   =========================================================== */
(function (w) {
  'use strict';

  var KEY = 'stepby.mapDisplay.v1';

  var DEFAULTS = {
    showOnlyMyTactile: false,
    showAppTactile: true,
    showOsmTactile: true,
    showOnlyMyRoadInfo: false,
    showAllRoadInfo: true
  };

  function read() {
    try {
      var raw = w.localStorage.getItem(KEY);
      if (!raw) return Object.assign({}, DEFAULTS);
      var parsed = JSON.parse(raw);
      var out = {};
      Object.keys(DEFAULTS).forEach(function (k) {
        out[k] = typeof parsed[k] === 'boolean' ? parsed[k] : DEFAULTS[k];
      });
      return out;
    } catch (e) {
      return Object.assign({}, DEFAULTS);
    }
  }

  var current = read();

  function all() { return Object.assign({}, current); }

  function set(key, value) {
    if (!(key in DEFAULTS)) return;
    current[key] = !!value;
    try { w.localStorage.setItem(KEY, JSON.stringify(current)); } catch (e) { /* private mode */ }
    w.document.dispatchEvent(new CustomEvent('stepby:mapprefschange', { detail: all() }));
  }

  /** Re-read from storage — another tab or screen may have changed them. */
  function refresh() {
    current = read();
    return all();
  }

  /* ---- The rules the map asks about -------------------------------------
     Each family has a "mine only" and an "everyone" switch. Showing everyone
     includes your own, so when that is on the narrower switch is ignored. */

  function showTactile() {
    return current.showAppTactile || current.showOnlyMyTactile;
  }
  function onlyMyTactile() {
    return current.showOnlyMyTactile && !current.showAppTactile;
  }
  function showOsm() {
    return current.showOsmTactile;
  }
  function showRoadInfo() {
    return current.showAllRoadInfo || current.showOnlyMyRoadInfo;
  }
  function onlyMyRoadInfo() {
    return current.showOnlyMyRoadInfo && !current.showAllRoadInfo;
  }

  w.StepByMapPrefs = {
    KEY: KEY,
    DEFAULTS: DEFAULTS,
    all: all,
    set: set,
    refresh: refresh,
    showTactile: showTactile,
    onlyMyTactile: onlyMyTactile,
    showOsm: showOsm,
    showRoadInfo: showRoadInfo,
    onlyMyRoadInfo: onlyMyRoadInfo
  };
})(window);
