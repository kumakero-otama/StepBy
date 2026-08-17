/* ===========================================================
   StepBy UI1 — Map screen

   Layout follows the original UI1 design: notice banner, brand header with a
   wave separator, the map, then a bottom drawer holding the record actions
   above a collapsible row of layer cards. No bottom navigation bar — this app
   has never had one; the header and the profile page carry navigation.

   Deliberately NOT here: the spoken announcements from the previous build.
   StepBy does not do route guidance, so "there is tactile paving here" on its
   own helps nobody, and the team does not want a speaking layer. It was also
   hard-coded to ja-JP.
   =========================================================== */
(function (w, d) {
  'use strict';

  var cfg = w.APP_CONFIG;
  var api = w.StepByApi;
  var auth = w.StepByAuth;
  var ui = w.StepByUI;
  var i18n = w.StepByI18n;
  var t = w.t;

  /* Leaflet prefixes these with its own auto-detected imagePath, so a relative
     value gets concatenated onto it and 404s once the app is served from a
     sub-path. Pin the folder instead and let Leaflet use its own filenames. */
  L.Icon.Default.imagePath = auth.toApp('/vendor/leaflet/images/');

  var map = L.map('map', {
    zoomControl: false,
    tap: false          /* Leaflet's tap emulation double-fires on iOS 15+ */
  }).setView(cfg.MAP_DEFAULT_CENTER, cfg.MAP_DEFAULT_ZOOM);

  /* Top-left, as in the original design. */
  L.control.zoom({ position: 'topleft' }).addTo(map);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  /* All three overlays are driven by the single "Map information" switch. */
  /* Layer colours, taken from the original UI1 map.js so the overlays keep
     meaning the same thing across UI0/UI1/UI2/UI3:
       blue        OSM tactile paving   (showOsmTactileWaysOnMap)
       green       saved routes         (showAllSessionPathsOnMap)
       yellow-green the route being recorded right now (displayTraceLine) */
  var COLOR = {
    tactile: '#0066ff',
    records: '#00b050',
    recording: '#9acd32'
  };

  var layers = {
    reports: L.layerGroup(),
    tactile: L.layerGroup(),
    records: L.layerGroup()
  };

  var state = {
    isPro: false,
    position: null,
    follow: false,
    watchId: null,
    loadedFor: null,
    reports: [],
    session: null,
    fetching: {}
  };

  /* ---- Drawer ------------------------------------------------------------ */
  var drawer = d.getElementById('drawer');
  var handle = d.getElementById('drawer-handle');
  var handleLabel = d.getElementById('drawer-handle-label');
  var handleChevron = d.getElementById('drawer-chevron');
  var DRAWER_KEY = 'stepby.drawerOpen';

  function setDrawer(open) {
    drawer.setAttribute('data-open', open ? 'true' : 'false');
    handle.setAttribute('aria-expanded', open ? 'true' : 'false');
    handleLabel.setAttribute('data-i18n', open ? 'map.drawerCollapse' : 'map.drawerExpand');
    handleLabel.textContent = t(open ? 'map.drawerCollapse' : 'map.drawerExpand');
    /* A dedicated glyph rather than a CSS rotation: the `rotate` property is
       unreliable on an <svg> that sizes itself from font-size. */
    handleChevron = w.StepByIcons.set(handleChevron, open ? 'chevron-down' : 'chevron-up');
    try { localStorage.setItem(DRAWER_KEY, open ? '1' : '0'); } catch (e) { /* ignore */ }
    /* The map box changed height. */
    setTimeout(function () { map.invalidateSize(); }, 0);
  }

  handle.addEventListener('click', function () {
    setDrawer(drawer.getAttribute('data-open') !== 'true');
  });

  var drawerOpen = true;
  try { drawerOpen = localStorage.getItem(DRAWER_KEY) !== '0'; } catch (e) { /* ignore */ }
  setDrawer(drawerOpen);

  /* ---- Status notice ----------------------------------------------------- */
  var noticeEl = d.getElementById('map-notice');
  var noticeKey = null;

  function showNotice(key) {
    noticeKey = key;
    if (!key) { noticeEl.classList.add('hidden'); noticeEl.textContent = ''; return; }
    noticeEl.textContent = t(key);
    noticeEl.classList.remove('hidden');
  }

  /* ---- Coordinate strip -------------------------------------------------- */
  var coordsEl = d.getElementById('coords');
  var updatedEl = d.getElementById('last-updated');

  function paintCoords() {
    if (!state.position) return;
    coordsEl.textContent = 'Lat ' + state.position.lat.toFixed(5) +
      ', Lng ' + state.position.lng.toFixed(5);
    updatedEl.textContent = new Date().toLocaleTimeString(i18n.locale(), {
      hour: '2-digit', minute: '2-digit', second: '2-digit'
    });
  }

  /* ---- Geolocation ------------------------------------------------------- */
  var meMarker = null;
  var meAccuracy = null;

  function drawMe() {
    if (!state.position) return;
    var latlng = [state.position.lat, state.position.lng];
    if (!meMarker) {
      meMarker = L.circleMarker(latlng, {
        radius: 8, weight: 3, color: '#fff', fillColor: '#2E9E8F', fillOpacity: 1
      }).addTo(map);
      meAccuracy = L.circle(latlng, {
        radius: state.position.accuracy || 0,
        weight: 0, fillColor: '#2E9E8F', fillOpacity: 0.12, interactive: false
      }).addTo(map);
    } else {
      meMarker.setLatLng(latlng);
      meAccuracy.setLatLng(latlng).setRadius(state.position.accuracy || 0);
    }
  }

  function onPosition(pos) {
    showNotice(null);
    state.position = {
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy
    };
    drawMe();
    paintCoords();
    /* Share it so the feed, profile and leaderboard do not each raise their
       own permission prompt. */
    w.StepByGeo.remember(state.position.lat, state.position.lng);
    if (state.follow) map.panTo([state.position.lat, state.position.lng], { animate: true });
    if (state.session && !state.session.paused) recordPoint(state.position);
    maybeLoadOverlays();
  }

  function onPositionError(err) {
    showNotice(err.code === err.PERMISSION_DENIED ? 'map.locationDenied' : 'map.locationUnavailable');
    /* Stop pretending we are following something we cannot see. */
    followInput.checked = false;
    state.follow = false;
  }

  function startWatching() {
    if (!navigator.geolocation || state.watchId !== null) return;
    showNotice('map.locating');
    state.watchId = navigator.geolocation.watchPosition(onPosition, onPositionError, {
      enableHighAccuracy: true,
      maximumAge: 3000,
      timeout: 20000
    });
  }

  function stopWatching() {
    if (state.watchId === null) return;
    navigator.geolocation.clearWatch(state.watchId);
    state.watchId = null;
  }

  /* A manual drag means the user wants to look somewhere else. */
  map.on('dragstart', function () {
    if (!state.follow) return;
    state.follow = false;
    followInput.checked = false;
  });

  /* ---- Overlay data ------------------------------------------------------ */
  function maybeLoadOverlays() {
    var centre = state.position || map.getCenter();
    var key = Number(centre.lat).toFixed(3) + ',' + Number(centre.lng).toFixed(3);
    if (state.loadedFor === key) return;
    state.loadedFor = key;

    var at = { lat: Number(centre.lat), lng: Number(centre.lng) };
    if (!mapInfoInput.checked) return;
    loadReports(at);
    loadTactile(at);
    loadRecords(at);
  }

  async function loadReports(centre) {
    if (state.fetching.reports) state.fetching.reports.abort();
    state.fetching.reports = new AbortController();
    try {
      state.reports = await api.listReports(
        { lat: centre.lat, lng: centre.lng, radiusKm: 5 },
        { signal: state.fetching.reports.signal }
      );
      drawReports();
    } catch (err) {
      if (api.isAbort(err)) return;
      /* An overlay that cannot load must not take the whole map down. */
      ui.toastError(err);
    }
  }

  function popupHtml(item) {
    var label = item.hydrated
      ? item.tags.map(function (tag) { return i18n.tagLabel(tag); }).filter(Boolean).join(', ')
      : '';
    var href = auth.toApp('/detail/') + '?id=' + encodeURIComponent(item.id);
    return '<strong>' + ui.esc(label || t('detail.title')) + '</strong>' +
      (item.notes ? '<br>' + ui.esc(item.notes) : '') +
      '<br><a href="' + ui.esc(href) + '">' + ui.esc(t('map.openReport')) + '</a>';
  }

  function drawReports() {
    layers.reports.clearLayers();
    state.reports.forEach(function (item) {
      if (!isFinite(item.lat) || !isFinite(item.lng)) return;

      var marker = L.marker([item.lat, item.lng], {
        /* Every pin needs a name: without one a screen reader announces
           nothing but "link". */
        alt: t('detail.title'),
        keyboard: true
      }).bindPopup(popupHtml(item)).addTo(layers.reports);

      /* The list endpoint carries no tags or notes, so fetch the detail the
         first time a pin is actually opened rather than firing one request
         per pin on every pan. */
      marker.on('popupopen', async function () {
        if (item.hydrated) return;
        try {
          var full = await api.getReport(item.id);
          if (!full) return;
          Object.assign(item, full);
          marker.setPopupContent(popupHtml(item));
          marker.options.alt = item.tags.map(function (tag) { return i18n.tagLabel(tag); })
            .filter(Boolean).join(', ') || t('detail.title');
        } catch (err) {
          /* Leave the generic popup in place. */
        }
      });
    });
  }

  async function loadTactile(centre) {
    if (state.fetching.tactile) state.fetching.tactile.abort();
    state.fetching.tactile = new AbortController();
    try {
      var res = await api.osmTactileWays({
        centerLat: Number(centre.lat).toFixed(6),
        centerLng: Number(centre.lng).toFixed(6),
        radiusKm: 2
      }, { signal: state.fetching.tactile.signal });
      layers.tactile.clearLayers();
      (res && res.features || []).forEach(function (feature) {
        var geom = feature.geometry || feature;
        if (!geom) return;
        if (geom.type === 'LineString') {
          L.polyline(geom.coordinates.map(function (c) { return [c[1], c[0]]; }), {
            color: COLOR.tactile, weight: 4, opacity: 0.9
          }).addTo(layers.tactile);
        } else if (geom.type === 'Point') {
          L.circleMarker([geom.coordinates[1], geom.coordinates[0]], {
            radius: 4, color: COLOR.tactile, fillColor: COLOR.tactile,
            fillOpacity: 0.95, weight: 1
          }).addTo(layers.tactile);
        }
      });
    } catch (err) {
      if (api.isAbort(err)) return;
      ui.toastError(err);
    }
  }

  async function loadRecords(centre) {
    if (state.fetching.records) state.fetching.records.abort();
    state.fetching.records = new AbortController();
    try {
      var paths = await api.listRecords(
        { lat: centre.lat, lng: centre.lng, radiusKm: 5 },
        { signal: state.fetching.records.signal }
      );
      layers.records.clearLayers();
      paths.filter(visibleToCurrentUser).forEach(drawRecord);
    } catch (err) {
      if (api.isAbort(err)) return;
      ui.toastError(err);
    }
  }

  /**
   * Without PRO you only see routes recorded as plain tactile paving; the
   * detailed categories a professional records are theirs. Same rule as UI2.
   */
  function visibleToCurrentUser(path) {
    if (state.isPro) return true;
    var tags = Array.isArray(path && path.tags) ? path.tags : [];
    if (tags.length !== 1) return false;
    var only = tags[0];
    var label = (only && (only.labelJa || only.label || only.name)) || only;
    return String(label || '').trim() === '点字ブロック';
  }

  /**
   * Coordinates of a saved route. /api/records returns GeoJSON in
   * `geom_geojson`, sometimes as a string. Reading `points`/`shape` instead,
   * as this file first did, silently drew nothing at all.
   */
  function recordCoords(path) {
    var geom = path.geom_geojson || path.geom || path.geometry;
    if (typeof geom === 'string') {
      try { geom = JSON.parse(geom); } catch (e) { return []; }
    }
    if (!geom || geom.type !== 'LineString' || !Array.isArray(geom.coordinates)) return [];
    return geom.coordinates
      .map(function (c) { return [c[1], c[0]]; })
      .filter(function (ll) { return isFinite(ll[0]) && isFinite(ll[1]); });
  }

  function drawRecord(path) {
    var coords = recordCoords(path);
    if (coords.length < 2) return;

    function open() { openRecordSheet(path); }

    L.polyline(coords, { color: COLOR.records, weight: 4, opacity: 0.85, interactive: true })
      .on('click', open).addTo(layers.records);

    /* A second, much wider translucent line purely as a tap target. iOS
       WebKit drops fully transparent paths out of hit-testing, so this is
       drawn at 8% rather than 0 — the same trick, and the same numbers, the
       original build settled on after several passes at widening these. */
    L.polyline(coords, { color: COLOR.records, weight: 30, opacity: 0.08, interactive: true })
      .on('click', open).addTo(layers.records);
  }

  /* ---- Recorded-route detail ---------------------------------------------
     Tapping a green line opens who recorded it, when, its tags and memo —
     and, if it is yours, edit-memo and delete. Same behaviour as the
     original build. */
  var sheet = d.getElementById('record-sheet');
  var sheetName = d.getElementById('record-name');
  var sheetWhen = d.getElementById('record-when');
  var sheetAvatar = d.getElementById('record-avatar');
  var sheetTags = d.getElementById('record-tags');
  var sheetMemo = d.getElementById('record-memo');
  var memoEditBox = d.getElementById('record-memo-edit');
  var memoInput = d.getElementById('record-memo-input');
  var ownerActions = d.getElementById('record-owner-actions');
  var openPath = null;

  function ownsRecord(path) {
    var payload = auth.tokenPayload();
    var me = payload && payload.sub;
    var owner = path.user_id !== undefined ? path.user_id : path.userId;
    return me != null && owner != null && String(me) === String(owner);
  }

  function sessionIdOf(path) {
    return path.id || path.sessionId || path.session_id;
  }

  function renderMemo(text) {
    sheetMemo.textContent = text || t('record.noMemo');
    sheetMemo.classList.toggle('text-muted', !text);
  }

  function ownerLabel(name, mine) {
    return (name || t('profile.guest')) + (mine ? ' (' + t('record.you') + ')' : '');
  }

  async function openRecordSheet(path) {
    openPath = path;
    var mine = ownsRecord(path);

    sheetName.textContent = ownerLabel(path.owner_name, mine);
    sheetWhen.textContent = path.created_at ? i18n.formatDate(path.created_at) : '';
    ui.setAvatar(sheetAvatar, path.owner_avatar_url);

    renderMemo(path.memo);
    memoEditBox.classList.add('hidden');
    ownerActions.classList.toggle('hidden', !mine);
    sheetTags.innerHTML = '<span class="chip chip--muted">' + ui.esc(t('common.loading')) + '</span>';

    sheet.showModal();
    d.getElementById('record-close').focus();

    /* Owner name, icon, tags and memo are authoritative on the session
       endpoint; the list only carries a snapshot. */
    var id = sessionIdOf(path);
    if (!id) { sheetTags.innerHTML = ''; return; }
    try {
      var res = await api.sessionInfo(id);
      var info = res && res.session;
      if (!info || openPath !== path) return;

      if (info.username) sheetName.textContent = ownerLabel(info.username, mine);
      if (info.iconUrl) ui.setAvatar(sheetAvatar, info.iconUrl);

      var tags = Array.isArray(info.tags) ? info.tags : [];
      sheetTags.innerHTML = tags.length
        ? tags.map(function (tag) {
            var label = i18n.tagLabel(tag) || tag.name || '';
            return label ? '<span class="chip">' + ui.esc(label) + '</span>' : '';
          }).join('')
        : '<span class="chip chip--muted">' + ui.esc(t('feed.noTags')) + '</span>';

      path.memo = info.memo || '';
      renderMemo(path.memo);
    } catch (err) {
      if (api.isAbort(err)) return;
      sheetTags.innerHTML = '<span class="chip chip--muted">' + ui.esc(t('error.generic')) + '</span>';
    }
  }

  d.getElementById('record-close').addEventListener('click', function () { sheet.close(); });
  sheet.addEventListener('close', function () { openPath = null; });

  d.getElementById('record-edit-memo').addEventListener('click', function () {
    memoInput.value = (openPath && openPath.memo) || '';
    memoEditBox.classList.remove('hidden');
    memoInput.focus();
  });

  d.getElementById('record-memo-cancel').addEventListener('click', function () {
    memoEditBox.classList.add('hidden');
  });

  d.getElementById('record-memo-save').addEventListener('click', async function () {
    if (!openPath) return;
    var btn = this;
    var text = memoInput.value.trim();
    btn.setAttribute('aria-busy', 'true');
    btn.setAttribute('disabled', '');
    try {
      await api.setSessionMemo({ sessionId: sessionIdOf(openPath), memo: text });
      openPath.memo = text;
      renderMemo(text);
      memoEditBox.classList.add('hidden');
      ui.toast(t('common.saved'), 'success');
    } catch (err) {
      ui.toastError(err);
    } finally {
      btn.removeAttribute('aria-busy');
      btn.removeAttribute('disabled');
    }
  });

  d.getElementById('record-delete').addEventListener('click', async function () {
    if (!openPath) return;
    var target = openPath;
    var ok = await ui.confirmDialog({
      title: t('record.deleteTitle'),
      body: t('record.deleteBody'),
      confirmLabel: t('common.delete'),
      danger: true
    });
    if (!ok) return;
    try {
      await api.deactivateSession({ sessionId: sessionIdOf(target) });
      sheet.close();
      ui.toast(t('record.deleted'), 'success');
      var centre = state.position || map.getCenter();
      loadRecords({ lat: Number(centre.lat), lng: Number(centre.lng) });
    } catch (err) {
      ui.toast(t('record.deleteFailed'), 'error');
    }
  });
  /* ---- Layer cards -------------------------------------------------------
     Two switches instead of four. "Map information" turns on every overlay at
     once — tactile paving, recorded routes and community reports — because
     picking between them was a distinction the team did not want to make on
     the map screen. */
  var mapInfoInput = d.getElementById('layer-map-info');
  var followInput = d.getElementById('layer-follow');

  function applyMapInfo() {
    var on = mapInfoInput.checked;
    Object.keys(layers).forEach(function (name) {
      if (on) layers[name].addTo(map);
      else map.removeLayer(layers[name]);
    });
    if (!on) return;
    var centre = state.position || map.getCenter();
    var at = { lat: Number(centre.lat), lng: Number(centre.lng) };
    loadReports(at);
    loadTactile(at);
    loadRecords(at);
  }

  mapInfoInput.addEventListener('change', applyMapInfo);

  followInput.addEventListener('change', function () {
    state.follow = followInput.checked;
    if (!state.follow) return;
    if (state.position) map.panTo([state.position.lat, state.position.lng]);
    else startWatching();
  });

  /* ---- Recording ---------------------------------------------------------
     Points are buffered locally and flushed to /api/match. A failed flush
     keeps the point in the buffer instead of dropping it, so a tunnel or a
     lift does not punch a hole in the recorded route. */
  var recordBtn = d.getElementById('btn-record');
  var pauseBtn = d.getElementById('btn-pause');
  var pending = [];
  var flushing = false;

  function renderRecordControls() {
    var recording = !!state.session;
    var paused = recording && state.session.paused;

    recordBtn.innerHTML = w.StepByIcons.svg(recording ? 'stop' : 'play') +
      '<span>' + ui.esc(t(recording ? 'map.recordStop' : 'map.recordStart')) + '</span>';
    recordBtn.classList.toggle('is-recording', recording && !paused);
    recordBtn.classList.toggle('is-paused', paused);

    pauseBtn.disabled = !recording;
    pauseBtn.innerHTML = w.StepByIcons.svg(paused ? 'play' : 'pause') +
      '<span>' + ui.esc(t(paused ? 'map.recordResume' : 'map.recordPause')) + '</span>';
  }

  function haversine(a, b) {
    var R = 6371000;
    var toRad = Math.PI / 180;
    var dLat = (b.lat - a.lat) * toRad;
    var dLng = (b.lng - a.lng) * toRad;
    var h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(a.lat * toRad) * Math.cos(b.lat * toRad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  }

  function recordPoint(position) {
    var last = state.session.points[state.session.points.length - 1];
    /* Ignore jitter: GPS noise while standing still would otherwise inflate
       the route and burn through the server's matching quota. */
    if (last && haversine(last, position) < 5) return;

    state.session.points.push({ lat: position.lat, lng: position.lng });
    state.session.line.addLatLng([position.lat, position.lng]);
    pending.push(position);
    flush();
  }

  async function flush() {
    if (flushing || !pending.length || !state.session) return;
    flushing = true;
    var point = pending[0];
    try {
      await api.matchPoint({
        lat: point.lat.toFixed(6),
        lng: point.lng.toFixed(6),
        sessionId: state.session.sessionId,
        sessionUuid: state.session.sessionUuid,
        seq: state.session.points.length,
        record: 1
      });
      pending.shift();
    } catch (err) {
      /* Leave it queued and try again on the next fix. */
    } finally {
      flushing = false;
      if (pending.length) setTimeout(flush, 1500);
    }
  }

  async function startRecording() {
    if (!auth.isSignedIn()) {
      location.href = auth.toApp('/login/');
      return;
    }
    if (!state.position) {
      ui.toast(t('map.locationUnavailable'), 'error');
      startWatching();
      return;
    }
    recordBtn.setAttribute('aria-busy', 'true');
    var uuid = (w.crypto && w.crypto.randomUUID) ? w.crypto.randomUUID() : String(Date.now());
    try {
      var res = await api.startSession({ sessionUuid: uuid, startedAt: new Date().toISOString() });
      state.session = {
        sessionId: res && res.sessionId,
        sessionUuid: uuid,
        paused: false,
        points: [],
        line: L.polyline([], { color: COLOR.recording, weight: 4, opacity: 0.8 }).addTo(map)
      };
      followInput.checked = true;
      state.follow = true;
      recordPoint(state.position);
      renderRecordControls();
    } catch (err) {
      ui.toastError(err);
    } finally {
      recordBtn.removeAttribute('aria-busy');
    }
  }

  /* ---- PRO: tags and note on save ----------------------------------------
     Non-PRO recordings are saved as they are. A PRO recording asks what was
     recorded (at least one tag, as UI2 requires) and an optional note. */
  var proSave = d.getElementById('pro-save');
  var proSaveTags = d.getElementById('pro-save-tags');
  var proSaveMemo = d.getElementById('pro-save-memo');
  var proSaveError = d.getElementById('pro-save-tags-error');
  var tactileTags = null;

  async function askProDetails() {
    proSaveError.classList.add('hidden');
    proSaveMemo.value = '';

    if (!tactileTags) {
      proSaveTags.innerHTML = '<span class="chip chip--muted">' + ui.esc(t('common.loading')) + '</span>';
      try {
        var res = await api.listTactileTags();
        tactileTags = (res && res.tags) || [];
      } catch (err) {
        tactileTags = [];
      }
    }
    proSaveTags.innerHTML = tactileTags.length
      ? tactileTags.map(function (tag) {
          var id = tag.id || tag.tagId;
          return '<label class="chip chip--select">' +
            '<input type="checkbox" value="' + ui.esc(id) + '">' +
            '<span>' + ui.esc(i18n.tagLabel(tag)) + '</span></label>';
        }).join('')
      : '<span class="chip chip--muted">' + ui.esc(t('feed.noTags')) + '</span>';

    return new Promise(function (resolve) {
      function pick() {
        return Array.prototype.slice
          .call(proSaveTags.querySelectorAll('input:checked'))
          .map(function (i) { return i.value; });
      }
      function onOk() {
        if (!pick().length) { proSaveError.classList.remove('hidden'); return; }
        cleanup();
        resolve({ tagIds: pick(), memo: proSaveMemo.value.trim() });
      }
      function onCancel() { cleanup(); resolve(null); }
      function cleanup() {
        okBtn.removeEventListener('click', onOk);
        cancelBtn.removeEventListener('click', onCancel);
        proSave.close();
      }
      var okBtn = d.getElementById('pro-save-ok');
      var cancelBtn = d.getElementById('pro-save-cancel');
      okBtn.addEventListener('click', onOk);
      cancelBtn.addEventListener('click', onCancel);
      proSave.addEventListener('cancel', function (e) { e.preventDefault(); onCancel(); }, { once: true });
      proSave.showModal();
    });
  }

  async function saveProDetails(session, details) {
    if (!details) return;
    if (details.memo) {
      try {
        await api.setSessionMemo({ sessionId: session.sessionId, sessionUuid: session.sessionUuid, memo: details.memo });
      } catch (err) {
        ui.toast(t('pro.memoSaveFailed'), 'error');
      }
    }
    for (var i = 0; i < details.tagIds.length; i++) {
      try {
        await api.addSessionTag({
          sessionId: session.sessionId,
          sessionUuid: session.sessionUuid,
          tagId: details.tagIds[i]
        });
      } catch (err) {
        ui.toast(t('pro.tagSaveFailed'), 'error');
        break;
      }
    }
  }

  async function stopRecording() {
    var session = state.session;
    if (!session) return;

    if (session.points.length < 2) {
      var discard = await ui.confirmDialog({
        title: t('map.discardTitle'),
        body: t('map.discardBody'),
        confirmLabel: t('common.delete'),
        danger: true
      });
      if (!discard) return;
      try { await api.cancelSession({ sessionId: session.sessionId, sessionUuid: session.sessionUuid }); }
      catch (err) { /* the session is worthless either way */ }
      map.removeLayer(session.line);
      state.session = null;
      pending = [];
      renderRecordControls();
      ui.toast(t('map.recordDiscarded'));
      return;
    }

    /* Ask before ending the session, so cancelling leaves it recording. */
    var proDetails = null;
    if (state.isPro) {
      proDetails = await askProDetails();
      if (!proDetails) return;
    }

    recordBtn.setAttribute('aria-busy', 'true');
    try {
      await api.endSession({
        sessionId: session.sessionId,
        sessionUuid: session.sessionUuid,
        endedAt: new Date().toISOString()
      });
      await saveProDetails(session, proDetails);
      ui.toast(t('map.recordSaved'), 'success');
      /* Once saved it is one of "everyone's routes", so it takes that colour. */
      session.line.setStyle({ color: COLOR.records, opacity: 0.85 });
      state.session = null;
      renderRecordControls();
    } catch (err) {
      ui.toastError(err);
    } finally {
      recordBtn.removeAttribute('aria-busy');
    }
  }

  recordBtn.addEventListener('click', function () {
    if (state.session) stopRecording();
    else startRecording();
  });

  pauseBtn.addEventListener('click', function () {
    if (!state.session) return;
    state.session.paused = !state.session.paused;
    renderRecordControls();
  });

  /* Warn before losing an in-progress recording. */
  w.addEventListener('beforeunload', function (event) {
    if (!state.session) return;
    event.preventDefault();
    event.returnValue = '';
  });

  map.on('moveend', function () {
    if (!state.position) maybeLoadOverlays();
  });

  /* ---- Language ---------------------------------------------------------- */
  d.addEventListener('stepby:langchange', function () {
    renderRecordControls();
    drawReports();
    paintCoords();
    setDrawer(drawer.getAttribute('data-open') === 'true');
    if (noticeKey) showNotice(noticeKey);
  });

  /* ---- Go ---------------------------------------------------------------- */
  renderRecordControls();
  applyMapInfo();
  startWatching();

  /* Which routes are visible, and whether saving asks for tags, both depend
     on this — refresh the layer once it is known. */
  ui.fetchIsPro().then(function (isPro) {
    if (isPro === state.isPro) return;
    state.isPro = isPro;
    if (mapInfoInput.checked) {
      var centre = state.position || map.getCenter();
      loadRecords({ lat: Number(centre.lat), lng: Number(centre.lng) });
    }
  });

  d.addEventListener('visibilitychange', function () {
    /* Keep the watch alive while recording, drop it otherwise to save battery. */
    if (d.hidden && !state.session) stopWatching();
    else if (!d.hidden) startWatching();
  });
})(window, document);
