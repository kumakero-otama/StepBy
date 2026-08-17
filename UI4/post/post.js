/* ===========================================================
   StepBy UI1 — Create / edit a road report

   One screen for both, keyed off ?id=. The old build had post_road/ and
   edit_post/ as separate 20 KB copies that had already diverged.
   =========================================================== */
(function (w, d) {
  'use strict';

  var cfg = w.APP_CONFIG;
  var api = w.StepByApi;
  var auth = w.StepByAuth;
  var ui = w.StepByUI;
  var i18n = w.StepByI18n;
  var t = w.t;

  var MAX_PHOTOS = 4;
  var params = new URLSearchParams(location.search);
  var editingId = params.get('id');

  var form = d.getElementById('report-form');
  var tagSet = d.getElementById('tag-set');
  var tagsError = d.getElementById('tags-error');
  var notesEl = d.getElementById('notes');
  var grid = d.getElementById('photo-grid');
  var addPhotoBtn = d.getElementById('add-photo');
  var fileInput = d.getElementById('photo-input');
  var submitBtn = d.getElementById('submit');

  var state = {
    latlng: null,
    tags: [],          // catalogue from the API
    selected: new Set(),
    photos: []         // data URLs
  };

  if (!auth.isSignedIn()) {
    location.replace(auth.toApp('/login/'));
    return;
  }

  /* ---- Map picker -------------------------------------------------------- */
  /* Leaflet prefixes these with its own auto-detected imagePath, so a relative
     value gets concatenated onto it and 404s once the app is served from a
     sub-path. Pin the folder instead and let Leaflet use its own filenames. */
  L.Icon.Default.imagePath = auth.toApp('/vendor/leaflet/images/');

  var map = L.map('pick-map', { zoomControl: true, tap: false })
    .setView(cfg.MAP_DEFAULT_CENTER, cfg.MAP_DEFAULT_ZOOM);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }).addTo(map);

  var pin = L.marker(cfg.MAP_DEFAULT_CENTER, { draggable: true, keyboard: true })
    .addTo(map);
  pin.on('dragend', function () {
    var p = pin.getLatLng();
    state.latlng = { lat: p.lat, lng: p.lng };
  });
  map.on('click', function (event) {
    pin.setLatLng(event.latlng);
    state.latlng = { lat: event.latlng.lat, lng: event.latlng.lng };
  });

  function setLocation(lat, lng, zoom) {
    state.latlng = { lat: lat, lng: lng };
    pin.setLatLng([lat, lng]);
    map.setView([lat, lng], zoom || 18);
    /* Leaflet mis-measures a container that was laid out after init. */
    setTimeout(function () { map.invalidateSize(); }, 0);
  }

  d.getElementById('use-current').addEventListener('click', function () {
    if (!navigator.geolocation) { ui.toast(t('map.locationUnavailable'), 'error'); return; }
    var btn = this;
    btn.setAttribute('aria-busy', 'true');
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        btn.removeAttribute('aria-busy');
        setLocation(pos.coords.latitude, pos.coords.longitude);
      },
      function (err) {
        btn.removeAttribute('aria-busy');
        ui.toast(t(err.code === err.PERMISSION_DENIED ? 'map.locationDenied' : 'map.locationUnavailable'), 'error');
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  });

  /* ---- Tags -------------------------------------------------------------- */
  function renderTags() {
    tagSet.innerHTML = state.tags.map(function (tag) {
      var id = tag.tagId || tag.id || tag.code;
      var checked = state.selected.has(String(id)) ? ' checked' : '';
      return '<label class="chip chip--select">' +
        '<input type="checkbox" value="' + ui.esc(id) + '"' + checked + '>' +
        '<span>' + ui.esc(i18n.tagLabel(tag)) + '</span>' +
        '</label>';
    }).join('');
  }

  tagSet.addEventListener('change', function (event) {
    if (event.target.type !== 'checkbox') return;
    var id = String(event.target.value);
    if (event.target.checked) state.selected.add(id);
    else state.selected.delete(id);
    if (state.selected.size) tagsError.classList.add('hidden');
  });

  async function loadTags() {
    tagSet.innerHTML = '<span class="chip chip--muted">' + ui.esc(t('common.loading')) + '</span>';
    try {
      var res = await api.listPostTags();
      state.tags = (res && res.tags) || [];
      renderTags();
    } catch (err) {
      ui.errorState(tagSet, err, loadTags);
    }
  }

  /* ---- Photos ------------------------------------------------------------ */
  function renderPhotos() {
    var items = state.photos.map(function (src, index) {
      return '<div class="photo-item">' +
        '<img src="' + ui.esc(src) + '" alt="">' +
        '<button type="button" data-remove="' + index + '" aria-label="' + ui.esc(t('post.removePhoto')) + '">' +
        w.StepByIcons.svg('xmark') + '</button>' +
        '</div>';
    }).join('');

    grid.innerHTML = items;
    if (state.photos.length < MAX_PHOTOS) grid.appendChild(addPhotoBtn);
    w.StepByIcons.hydrate(grid);
    addPhotoBtn = d.getElementById('add-photo') || addPhotoBtn;
  }

  grid.addEventListener('click', function (event) {
    var btn = event.target.closest('[data-remove]');
    if (!btn) return;
    state.photos.splice(Number(btn.getAttribute('data-remove')), 1);
    renderPhotos();
    addPhotoBtn.focus();
  });

  addPhotoBtn.addEventListener('click', function () { fileInput.click(); });

  fileInput.addEventListener('change', async function () {
    var files = Array.from(fileInput.files || []);
    fileInput.value = '';
    for (var i = 0; i < files.length; i++) {
      if (state.photos.length >= MAX_PHOTOS) {
        ui.toast(t('post.photoLimit', { n: MAX_PHOTOS }), 'error');
        break;
      }
      try {
        /* Downscale in the browser: full-size phone photos routinely blow
           past the server's per-image limit and time the upload out. */
        state.photos.push(await ui.resizeImage(files[i], 1280, 0.72));
      } catch (err) {
        ui.toast(t('error.generic'), 'error');
      }
    }
    renderPhotos();
  });

  /* ---- Submit ------------------------------------------------------------ */
  form.addEventListener('submit', async function (event) {
    event.preventDefault();

    if (!state.selected.size) {
      tagsError.classList.remove('hidden');
      tagsError.scrollIntoView({ block: 'center', behavior: 'smooth' });
      tagSet.querySelector('input') && tagSet.querySelector('input').focus();
      return;
    }
    if (!state.latlng) {
      ui.toast(t('map.locationUnavailable'), 'error');
      return;
    }

    submitBtn.setAttribute('aria-busy', 'true');
    submitBtn.setAttribute('disabled', '');

    var payload = {
      lat: state.latlng.lat,
      lng: state.latlng.lng,
      detail: notesEl.value.trim(),
      tagIds: Array.from(state.selected),
      images: state.photos
    };
    if (editingId) payload.pointId = editingId;

    try {
      var res = await api.createReport(payload);
      ui.toast(t('post.success'), 'success');
      var id = (res && (res.pointId || res.id)) || editingId;
      setTimeout(function () {
        location.replace(id ? auth.toApp('/detail/') + '?id=' + encodeURIComponent(id) : auth.toApp('/feed/'));
      }, 700);
    } catch (err) {
      ui.toastError(err);
      submitBtn.removeAttribute('aria-busy');
      submitBtn.removeAttribute('disabled');
    }
  });

  /* ---- Edit mode --------------------------------------------------------- */
  async function loadExisting() {
    var bar = d.querySelector('[data-component="app-bar"]');
    bar.setAttribute('data-title-key', 'post.titleEdit');
    d.querySelector('title').setAttribute('data-i18n', 'post.titleEdit');
    submitBtn.querySelector('span:last-child').setAttribute('data-i18n', 'post.submitEdit');

    try {
      var res = await api.getReport(editingId);
      var point = (res && (res.point || res)) || {};
      if (isFinite(point.lat) && isFinite(point.lng)) setLocation(point.lat, point.lng);
      notesEl.value = point.detail || '';
      (point.tags || []).forEach(function (tag) {
        state.selected.add(String(tag.tagId || tag.id || tag.code || tag));
      });
      renderTags();
      i18n.applyTo(d);
      ui.applyDocumentTitle();
    } catch (err) {
      ui.toastError(err);
    }
  }

  /* ---- Language ---------------------------------------------------------- */
  d.addEventListener('stepby:langchange', function () {
    renderTags();
    renderPhotos();
  });

  /* ---- Go ---------------------------------------------------------------- */
  renderPhotos();
  loadTags().then(function () {
    if (editingId) loadExisting();
  });

  /* Start at the user's position for a new report so the pin is not sitting
     in a default city they have never been to. */
  if (!editingId && navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      function (pos) { setLocation(pos.coords.latitude, pos.coords.longitude); },
      function () { /* the picker still works; the user can pan */ },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 }
    );
  }
  setTimeout(function () { map.invalidateSize(); }, 200);
})(window, document);
