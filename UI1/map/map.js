// ===============================================
// StepBy — map.js
// 既存のロジックをそのまま保持し、新HTMLのIDに合わせたバージョン
// ===============================================

const API_BASE = "https://barrierfree-map.loophole.site";
let userLocationMarker = null;
let accuracyCircle = null;
let currentHeading = 0;
let isCurrentUserPro = localStorage.getItem('UI1_is_pro') === 'true';

const apiFetch = (url, opts) => (window.AuthToken && window.AuthToken.getAccessToken())
    ? window.AuthToken.authFetch(url, opts)
    : fetch(url, opts);
const leafletMap = L.map("map", { zoomControl: true }).setView([35.681236, 139.767125], 13);
window.leafletMap = leafletMap; // Index.htmlからアクセス可能にする

const coordsEl = document.getElementById("coords");
const rawCoordsEl = document.getElementById("raw-coords");
const lastUpdatedEl = document.getElementById("last-updated");
const toggleRecordBtn = document.getElementById("toggle-record");
const toggleShowAllBtn = document.getElementById("toggle-show-all");
const toggleShowOsmBtn = document.getElementById("toggle-show-osm");
const toggleShowRoadInfoBtn = document.getElementById("toggle-show-road-info");
const toggleCenterCurrentBtn = document.getElementById("toggle-center-current");
const osmLoadingOverlayEl = document.getElementById("osm-loading-overlay");
const recordsLoadingOverlayEl = document.getElementById("records-loading-overlay");
const traceConfirmModalEl = document.getElementById("trace-confirm-modal");
const traceConfirmMapEl = document.getElementById("trace-confirm-map");
const traceConfirmMessageEl = document.getElementById("trace-confirm-message");
const traceConfirmOkBtn = document.getElementById("trace-confirm-ok");
const traceConfirmCancelBtn = document.getElementById("trace-confirm-cancel");

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(leafletMap);

const redPinIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});
const bluePinIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

let MIN_REQUEST_INTERVAL_MS = 2000;
let latestLocation = null;
let marker = null;
const trail = [];
const MAX_TRAIL = 100;
let lastDot = null;
let lastSent = null;
let lastRequestTime = 0;
let recordEnabled = false;
let recordedRawPoints = [];
let tracePolyline = null;
let currentSessionId = null;
let currentSessionStartedAt = null;
let traceConfirmMap = null;
let traceConfirmPathLayer = null;
let isHandlingRecordToggle = false;

function decodePolyline(str, precision) {
  let index = 0, lat = 0, lng = 0, coordinates = [],
    shift = 0, result = 0, byte = null, latitude_change, longitude_change,
    factor = Math.pow(10, precision || 6);

  while (index < str.length) {
    byte = null; shift = 0; result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    shift = 0; result = 0;
    do { byte = str.charCodeAt(index++) - 63; result |= (byte & 0x1f) << shift; shift += 5; } while (byte >= 0x20);
    longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += latitude_change; lng += longitude_change;
    coordinates.push([lat / factor, lng / factor]);
  }
  return coordinates;
}

const deviceUuid = getOrCreateDeviceUuid();
let showAllRecords = false;
let allRecordsMarkers = [];
let osmTactileMarkers = [];
let roadInfoMarkers = [];
const pointDetailCache = new Map(); // pointId -> { tags, posts } (cached API detail)
const pointAddressCache = new Map(); // pointId -> "〇〇付近" string
let isZooming = false;
let suppressMapTapUntil = 0;
let osmTactileLoadRequestSeq = 0;
let recordsLoadRequestSeq = 0;
const MAP_TAP_SUPPRESS_AFTER_ZOOM_MS = 400;

function shouldIgnoreMapTap(event) {
  if (isZooming || Date.now() < suppressMapTapUntil) return true;
  const originalEvent = event?.originalEvent;
  if (!originalEvent) return false;
  return originalEvent.type === "dblclick" || originalEvent.type === "wheel" || originalEvent.type === "mousewheel";
}

leafletMap.on("zoomstart", () => {
  isZooming = true;
  suppressMapTapUntil = Date.now() + MAP_TAP_SUPPRESS_AFTER_ZOOM_MS;
});

leafletMap.on("zoomend", () => {
  isZooming = false;
  suppressMapTapUntil = Date.now() + MAP_TAP_SUPPRESS_AFTER_ZOOM_MS;
});

function disableGpsSnapping() {
  const cb = document.getElementById("toggle-center-current");
  const btn = document.getElementById("gps-btn");
  if (cb && cb.checked && btn) {
    btn.click(); // Trigger Index.html's own toggle logic safely
  }
}

leafletMap.on("dragstart", () => { disableGpsSnapping(); });
leafletMap.on("popupopen", () => { disableGpsSnapping(); });

leafletMap.on("click", (event) => {
  if (shouldIgnoreMapTap(event)) return;
  const lat = Number(event?.latlng?.lat);
  const lng = Number(event?.latlng?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const params = new URLSearchParams({ lat: lat.toString(), lng: lng.toString() });
    window.location.assign(`../post_road/Index.html?${params.toString()}`);
    return;
  }
  window.location.assign("../post_road/Index.html");
});

function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function getOrCreateDeviceUuid() {
  const key = "deviceUuid";
  try {
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const created = generateUUID();
    localStorage.setItem(key, created);
    return created;
  } catch { return generateUUID(); }
}

function updateRecordButton() {
  toggleRecordBtn.checked = recordEnabled;
}

function postSessionLifecycle(action, payload) {
  return apiFetch(`${API_BASE}/api/session/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => { if (!res.ok) throw new Error(`session ${action} failed: ${res.status}`); return res.json(); })
    .catch((err) => { console.error(`[Lifecycle] ${action} error:`, err); });
}

function parseIsProStatus(payload) {
  if (!payload || typeof payload !== "object") return null;
  if (typeof payload.isPro === "boolean") return payload.isPro;
  if (typeof payload.is_pro === "boolean") return payload.is_pro;
  if (payload.data && typeof payload.data === "object") {
    if (typeof payload.data.isPro === "boolean") return payload.data.isPro;
    if (typeof payload.data.is_pro === "boolean") return payload.data.is_pro;
  }
  return null;
}

async function loadCurrentUserProStatus() {
  isCurrentUserPro = localStorage.getItem('UI1_is_pro') === 'true';
}

function extractTraceCoordinates(data, rawShape) {
  if (data && Array.isArray(data.edges) && data.edges.length > 0) {
    let allCoords = [];
    data.edges.forEach((edge) => {
      if (!edge || !edge.shape) return;
      const edgeCoords = decodePolyline(edge.shape, 6);
      if (allCoords.length > 0 && edgeCoords.length > 0) {
        const lastPoint = allCoords[allCoords.length - 1];
        const firstPoint = edgeCoords[0];
        if (lastPoint[0] === firstPoint[0] && lastPoint[1] === firstPoint[1]) {
          allCoords = allCoords.concat(edgeCoords.slice(1));
          return;
        }
      }
      allCoords = allCoords.concat(edgeCoords);
    });
    if (allCoords.length > 1) return allCoords;
  }
  if (data && data.shape) {
    const decoded = decodePolyline(data.shape, 6);
    if (decoded.length > 1) return decoded;
  }
  if (data && Array.isArray(data.matched_points) && data.matched_points.length > 1) {
    return data.matched_points
      .map((p) => [Number(p.lat), Number(p.lon)])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
  }
  return rawShape
    .map((p) => [p.lat, p.lon])
    .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
}

function requestTraceData(shape, { sessionId = null, persist = false } = {}) {
  const requestBody = { shape, costing: "pedestrian", shape_match: "map_snap" };
  if (persist && sessionId) { requestBody.sessionId = sessionId; requestBody.source = "valhalla"; }
  return apiFetch(`${API_BASE}/api/trace`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  }).then((res) => { if (!res.ok) throw new Error(`trace failed: ${res.status}`); return res.json(); });
}

function processAndDisplayTrace(sessionId = null) {
  if (recordedRawPoints.length < 2) {
    alert("記録されたポイントが少なすぎます（最低2点必要）");
    return Promise.resolve(null);
  }
  const shape = recordedRawPoints.map((p) => ({ lat: p.lat, lon: p.lng }));
  return requestTraceData(shape, { sessionId, persist: Boolean(sessionId) })
    .then((data) => { const coords = extractTraceCoordinates(data, shape); displayTraceLine(coords); return { data, coords }; })
    .catch((err) => { alert(`トレース処理に失敗しました: ${err.message}`); return null; });
}

function displayTraceLine(coordinates) {
  if (tracePolyline) { leafletMap.removeLayer(tracePolyline); tracePolyline = null; }
  if (coordinates.length > 1) {
    tracePolyline = L.polyline(coordinates, { color: "#9acd32", weight: 4, opacity: 0.8 }).addTo(leafletMap);
  }
}

function closeTraceConfirmModal() {
  if (traceConfirmModalEl) traceConfirmModalEl.classList.add("hidden");
  if (traceConfirmPathLayer && traceConfirmMap) { traceConfirmMap.removeLayer(traceConfirmPathLayer); traceConfirmPathLayer = null; }
  if (traceConfirmMap) { traceConfirmMap.remove(); traceConfirmMap = null; }
}

async function loadTraceTags() {
    const container = document.getElementById("trace-tags-container");
    if (!container) return;
    
    const DEFAULT_TAGS = [
        { value: "audio_signal_sound",    icon: "fa-volume-up",           label: "音が鳴る信号機" },
        { value: "audio_signal_no_sound", icon: "fa-volume-xmark",        label: "音が鳴らない信号機" },
        { value: "push_button_signal",    icon: "fa-hand-pointer",        label: "押しボタン式信号機" },
        { value: "sensor_signal",         icon: "fa-tower-broadcast",     label: "感知式信号機" },
        { value: "timed_signal",          icon: "fa-clock",               label: "時間式信号機" },
        { value: "crosswalk",             icon: "fa-road",                label: "横断歩道" },
        { value: "misplaced_tactile",     icon: "fa-triangle-exclamation",label: "配置が不適切な点字ブロック" },
        { value: "degraded_tactile",      icon: "fa-circle-exclamation",  label: "劣化した点字ブロック" },
        { value: "blocked_tactile",       icon: "fa-ban",                 label: "物が置かれて通れない点字ブロック" },
        { value: "footbridge_stairs",     icon: "fa-stairs",              label: "歩道橋の階段の出入口" },
        { value: "footbridge_elevator",   icon: "fa-elevator",            label: "歩道橋のエレベーターの出入口" },
        { value: "footbridge_slope",      icon: "fa-wheelchair-move",     label: "歩道橋のスロープの出入口" },
        { value: "test",                  icon: "fa-flask",               label: "テスト用" },
    ];
    
    // Function to render tags
    const renderTags = (tagsList) => {
        container.innerHTML = '';
        tagsList.forEach(t => {
            const label = t.labelJa || t.label || t.name || t.value || "タグ";
            const value = t.id || t.value || label;
            const span = document.createElement("span");
            span.className = "tag-chip outline";
            span.style.cursor = "pointer";
            if (t.icon) {
                 span.innerHTML = `<i class="fas ${t.icon}"></i> ${label}`;
            } else {
                 span.textContent = label;
            }
            span.dataset.value = value;
            span.onclick = () => span.classList.toggle("selected");
            container.appendChild(span);
        });
    };

    try {
        const res = await apiFetch(`${API_BASE}/api/post-tags`, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
            const data = await res.json();
            const fromApi = Array.isArray(data) ? data : (Array.isArray(data.tags) ? data.tags : null);
            if (fromApi && fromApi.length > 0) {
                renderTags(fromApi);
                return;
            }
        }
    } catch (e) {
        console.warn("Failed to load tags for trace modal", e);
    }
    
    // Fallback if API fails or returns empty
    renderTags(DEFAULT_TAGS);
}

async function handleTraceTagAdd() {
    const input = document.getElementById("trace-tag-add-input");
    const val = input ? input.value.trim() : "";
    if (!val) return;
    try {
        await apiFetch(`${API_BASE}/api/post-tags`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ label: val })
        });
        const container = document.getElementById("trace-tags-container");
        const span = document.createElement("span");
        span.className = "tag-chip outline selected";
        span.style.cursor = "pointer";
        span.textContent = val;
        span.dataset.value = val;
        span.onclick = () => span.classList.toggle("active");
        container.prepend(span);
        if (input) input.value = '';
    } catch(e) {
        console.error("タグ追加エラー:", e);
        alert("タグの追加に失敗しました");
    }
}

function openTraceConfirmModal(coordinates) {
  return new Promise((resolve) => {
    if (!traceConfirmModalEl || !traceConfirmMapEl || !traceConfirmOkBtn || !traceConfirmCancelBtn) { resolve({result: "cancel"}); return; }
    
    const recordedFeaturesDiv = document.getElementById("trace-recorded-features");
    const traceMemoInput = document.getElementById("trace-memo-input");
    const addTagBtn = document.getElementById("trace-tag-add-btn");
    
    if (addTagBtn && !addTagBtn.hasAttribute("data-listener")) {
        addTagBtn.addEventListener("click", handleTraceTagAdd);
        addTagBtn.setAttribute("data-listener", "true");
        const input = document.getElementById("trace-tag-add-input");
        if (input) {
            input.addEventListener("keydown", (e) => {
                if (e.key === "Enter") { e.preventDefault(); handleTraceTagAdd(); }
            });
        }
    }

    if (recordedFeaturesDiv) {
        if (!isCurrentUserPro) {
            recordedFeaturesDiv.style.display = "none";
        } else {
            recordedFeaturesDiv.style.display = "block";
            recordedFeaturesDiv.classList.remove("hidden");
            loadTraceTags();
        }
    }
    if (traceMemoInput) traceMemoInput.value = "";
    document.querySelectorAll(".tag-chip.selected").forEach(el => {
        el.classList.remove("selected");
        el.style.background = "";
        el.style.color = "";
    });

    const errorEl = document.getElementById("trace-tag-error");
    if (errorEl) { errorEl.classList.add("hidden"); errorEl.textContent = ""; }

    traceConfirmModalEl.classList.remove("hidden");
    traceConfirmMap = L.map(traceConfirmMapEl, { zoomControl: true });
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: "&copy; OpenStreetMap contributors" }).addTo(traceConfirmMap);
    traceConfirmPathLayer = L.polyline(coordinates, { color: "#9acd32", weight: 5, opacity: 0.9 }).addTo(traceConfirmMap);
    traceConfirmMap.fitBounds(traceConfirmPathLayer.getBounds(), { padding: [20, 20] });
    
    const cleanupAndResolve = (resultValue) => { 
        traceConfirmOkBtn.removeEventListener("click", onOk); 
        traceConfirmCancelBtn.removeEventListener("click", onCancel); 
        closeTraceConfirmModal(); 
        
        let memo = "";
        let tags = [];
        if (resultValue === "ok") {
            if (traceMemoInput) memo = traceMemoInput.value.trim();
            document.querySelectorAll("#trace-tags-container .tag-chip.selected").forEach(el => {
                tags.push(el.dataset.value || el.textContent);
            });
        }
        resolve({ result: resultValue, memo, tags }); 
    };
    
    const onOk = () => {
        if (isCurrentUserPro) {
            let selectedTags = document.querySelectorAll("#trace-tags-container .tag-chip.selected");
            if (selectedTags.length === 0) {
                const errorEl = document.getElementById("trace-tag-error");
                if (errorEl) {
                    errorEl.textContent = "※プロアカウントの場合、タグを1つ以上選択してください";
                    errorEl.classList.remove("hidden");
                } else {
                    alert("タグを1つ以上選択してください");
                }
                return;
            }
        }
        cleanupAndResolve("ok");
    };
    const onCancel = () => cleanupAndResolve("cancel");
    traceConfirmOkBtn.addEventListener("click", onOk);
    traceConfirmCancelBtn.addEventListener("click", onCancel);
    setTimeout(() => { if (traceConfirmMap) traceConfirmMap.invalidateSize(); }, 0);
  });
}

async function handleRecordStopWithConfirmation(finishedSessionId) {
  if (!finishedSessionId) return;
  if (recordedRawPoints.length < 2) {
    alert("記録されたポイントが少なすぎます（最低2点必要）");
    await postSessionLifecycle("cancel", { sessionId: finishedSessionId, deviceId: deviceUuid });
    return;
  }
  const shape = recordedRawPoints.map((p) => ({ lat: p.lat, lon: p.lng }));
  let previewData;
  try { previewData = await requestTraceData(shape); } catch (err) {
    alert(`保存確認用の経路生成に失敗しました: ${err.message}`);
    await postSessionLifecycle("cancel", { sessionId: finishedSessionId, deviceId: deviceUuid });
    return;
  }
  const previewCoords = extractTraceCoordinates(previewData, shape);
  if (!Array.isArray(previewCoords) || previewCoords.length < 2) {
    alert("保存確認用の経路を生成できませんでした。");
    await postSessionLifecycle("cancel", { sessionId: finishedSessionId, deviceId: deviceUuid });
    return;
  }
  if (traceConfirmMessageEl) traceConfirmMessageEl.textContent = "セッション全体でフィッティングした経路を黄緑線で表示しています。";
  const decisionData = await openTraceConfirmModal(previewCoords);
    if (decisionData.result === "ok") {
        
        let tags = decisionData.tags || [];
        let memo = decisionData.memo || "";
        
        await postSessionLifecycle("end", { sessionId: finishedSessionId, endedAt: new Date().toISOString() });
        
        if (isCurrentUserPro) {
            try {
                if (tags.length > 0) {
                    await apiFetch(`${API_BASE}/api/session/tags?sessionId=${finishedSessionId}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ tagIds: tags }) });
                }
            } catch(e) { console.error("Tags save error:", e); }
            if (memo) {
                 try {
                     await apiFetch(`${API_BASE}/api/session/memo?sessionId=${finishedSessionId}`, { method: "PUT", headers: {"Content-Type":"application/json"}, body: JSON.stringify({memo: memo}) });
                 } catch(e) { console.error("Memo save error:", e); }
            }
        }
        
        await processAndDisplayTrace(finishedSessionId);
    return;
  }
  await postSessionLifecycle("cancel", { sessionId: finishedSessionId, deviceId: deviceUuid });
  if (tracePolyline) { leafletMap.removeLayer(tracePolyline); tracePolyline = null; }
}

function requestSnappedLocation(latitude, longitude) {
  const params = new URLSearchParams({ lat: latitude.toString(), lng: longitude.toString(), deviceUuid: deviceUuid });
  if (recordEnabled) {
    params.set("record", "1");
    if (currentSessionId) params.set("sessionId", currentSessionId);
  }
  if (lastSent) { params.set("prevLat", lastSent.latitude.toString()); params.set("prevLng", lastSent.longitude.toString()); }
  apiFetch(`${API_BASE}/api/match?${params.toString()}`)
    .then((res) => {
      if (res.status === 204) { updateDisplay(latitude, longitude, latitude, longitude, true); return null; }
      if (!res.ok) throw new Error(`match failed with status ${res.status}`);
      return res.json();
    })
    .then((data) => {
      if (!data) return;
      if (typeof data.lat === "number" && typeof data.lng === "number") {
        updateDisplay(latitude, longitude, data.lat, data.lng);
        lastSent = { latitude: data.lat, longitude: data.lng };
      }
    })
    .catch((error) => { console.error('[requestSnappedLocation] Error:', error); })
    .finally(() => { isRequestingMatch = false; });
}

function handleNewLocation(latitude, longitude) {
  latestLocation = { lat: latitude, lng: longitude };
}

let isRequestingMatch = false;

function pollAndSendLocation() {
  if (!latestLocation) return;
  if (isRequestingMatch) return; // Prevent concurrent requests piling up
  const { lat, lng } = latestLocation;

  if (recordEnabled && !window.isRecordingPaused) {
    recordedRawPoints.push({ lat, lng });
  } else if (lastSent) {
    // If not recording, don't spam the API unless we moved > 5 meters
    const p1 = typeof L !== 'undefined' ? L.latLng(lat, lng) : null;
    const p2 = typeof L !== 'undefined' ? L.latLng(lastSent.latitude, lastSent.longitude) : null;
    if (p1 && p2 && p1.distanceTo(p2) < 5) return;
  }

  isRequestingMatch = true;
  requestSnappedLocation(lat, lng);
}

function updateTimestamp() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  lastUpdatedEl.textContent = `Last update: ${hh}:${mm}:${ss}`;
}

function isCenterCurrentEnabled() {
  return toggleCenterCurrentBtn ? toggleCenterCurrentBtn.checked : true;
}

function updateDisplay(rawLat, rawLng, snappedLat, snappedLng, skipMarker = false) {
  if (!Number.isFinite(snappedLat) || !Number.isFinite(snappedLng)) return;
  updateTimestamp();
  coordsEl.textContent = `Lat: ${snappedLat.toFixed(6)}, Lng: ${snappedLng.toFixed(6)}`;
  rawCoordsEl.textContent = `Raw: ${rawLat.toFixed(6)}, ${rawLng.toFixed(6)}`;
  if (skipMarker) return;
  if (!marker) { marker = L.marker([snappedLat, snappedLng], { icon: redPinIcon }).addTo(leafletMap); }
  else { marker.setLatLng([snappedLat, snappedLng]); }
  window.currentMarker = marker; // Index.htmlからアクセス可能にする

  if (isCenterCurrentEnabled()) { leafletMap.setView([snappedLat, snappedLng], leafletMap.getZoom(), { animate: true }); }
  const dotColor = recordEnabled ? "#9acd32" : "#111";
  const dot = L.circleMarker([snappedLat, snappedLng], { radius: 3, color: dotColor, fillColor: dotColor, fillOpacity: 0.7, weight: 0 }).addTo(leafletMap);
  trail.push(dot);
  if (trail.length > MAX_TRAIL) leafletMap.removeLayer(trail.shift());
}

function loadAndShowAllRecords() {
  const requestSeq = ++recordsLoadRequestSeq;
  setRecordsLoadingVisible(true);
  const center = leafletMap.getCenter();
  const params = new URLSearchParams({ centerLat: center.lat.toString(), centerLng: center.lng.toString(), radiusKm: "10" });
  apiFetch(`${API_BASE}/api/records?${params.toString()}`)
    .then((res) => { if (!res.ok) throw new Error(`records fetch failed: ${res.status}`); return res.json(); })
    .then((data) => {
      if (requestSeq !== recordsLoadRequestSeq || !toggleShowAllBtn || !toggleShowAllBtn.checked) return;
      if (data.success && Array.isArray(data.paths)) showAllSessionPathsOnMap(data.paths);
    })
    .catch((err) => { if (requestSeq !== recordsLoadRequestSeq) return; console.warn("軌跡データの取得に失敗:", err.message); })
    .finally(() => { if (requestSeq === recordsLoadRequestSeq) setRecordsLoadingVisible(false); });
}

function showAllSessionPathsOnMap(paths) {
  clearAllRecordsFromMap();
  paths.forEach((path) => {
    let geom;
    try { geom = typeof path.geom_geojson === "string" ? JSON.parse(path.geom_geojson) : path.geom_geojson; } catch { return; }
    if (!geom || geom.type !== "LineString" || !Array.isArray(geom.coordinates)) return;
    const coordinates = geom.coordinates.map(([lng, lat]) => [lat, lng]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (coordinates.length < 2) return;
    const polyline = L.polyline(coordinates, { color: "#00b050", weight: 4, opacity: 0.85, interactive: false }).addTo(leafletMap);
    const hitPolyline = L.polyline(coordinates, { color: "#00b050", weight: 20, opacity: 0.01, interactive: true }).addTo(leafletMap);
    
    // Click interaction for detail modal
    hitPolyline.on("click", (e) => {
        L.DomEvent.stopPropagation(e);
        openTraceDetailModal(path);
    });
    
    allRecordsMarkers.push(polyline);
    allRecordsMarkers.push(hitPolyline);
  });
}

function openTraceDetailModal(path) {
    const modal = document.getElementById("trace-detail-modal");
    if (!modal) return;
    
    disableGpsSnapping();

    const userEl = document.getElementById("trace-detail-user");
    const timeEl = document.getElementById("trace-detail-time");
    if (userEl) userEl.textContent = path.owner_name || "ユーザー";
    const avatarContainer = document.querySelector('#trace-detail-modal .fa-user').parentElement;
    if (avatarContainer) {
        avatarContainer.innerHTML = '';
        const avatarUrl = path.owner_avatar_url || path.avatarUrl || path.avatar_url || null;
        if (avatarUrl) {
            const img = document.createElement('img');
            let _url = avatarUrl;
            img.src = ((_url.startsWith('http') || _url.startsWith('data:')) ? _url : (((window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) ? window.APP_CONFIG.API_BASE_URL : 'https://barrierfree-map.loophole.site') + _url));
            img.style.width = '100%';
            img.style.height = '100%';
            img.style.objectFit = 'cover';
            img.onerror = () => { avatarContainer.innerHTML = '<i class="fas fa-user" style="color:#ccc;"></i>'; };
            avatarContainer.appendChild(img);
        } else {
            avatarContainer.innerHTML = '<i class="fas fa-user" style="color:#ccc;"></i>';
        }
    }
    if (timeEl) timeEl.textContent = path.created_at ? new Date(path.created_at).toLocaleString('ja-JP', {year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit'}) : new Date().toLocaleString('ja-JP');

    const tagsContainer = document.getElementById("trace-detail-tags");
    const memoContainer = document.getElementById("trace-detail-memo-container");
    const memoEl = document.getElementById("trace-detail-memo");
    
    if (tagsContainer) {
        tagsContainer.innerHTML = '<span style="color:#888;font-size:12px;"><i class="fas fa-spinner fa-spin"></i> 読み込み中...</span>';
        tagsContainer.style.display = "flex";
    }
    if (memoContainer) memoContainer.style.display = "none";
    
    const sessionId = path.id || path.sessionId || path.session_id;
    if (sessionId) {
        apiFetch(`${API_BASE}/api/tactile-session-info?sessionId=${sessionId}`)
            .then(res => res.ok ? res.json() : null)
            .then(payload => {
                const sessionInfo = payload && payload.success ? payload.session : null;
                
                if (tagsContainer) {
                    const rawTags = sessionInfo && Array.isArray(sessionInfo.tags) ? sessionInfo.tags : (Array.isArray(path.tags) ? path.tags : []);
                    if (rawTags.length > 0) {
                        const tagsHtml = rawTags.map(t => `<span class="tag-chip outline" style="background:rgba(255,160,0,0.1); color:#8A4000; padding:4px 8px; border-radius:12px; font-size:12px; border: 1px solid #8A4000;"><i class="fas fa-tag"></i> ${t.name || t}</span>`).join("");
                        tagsContainer.innerHTML = tagsHtml;
                        tagsContainer.style.display = "flex";
                    } else {
                        tagsContainer.innerHTML = "";
                        tagsContainer.style.display = "none";
                    }
                }
                if (memoContainer && memoEl) {
                    const sessionMemo = sessionInfo && sessionInfo.memo ? sessionInfo.memo : path.memo;
                    if (sessionMemo) {
                        memoEl.textContent = sessionMemo;
                        memoContainer.style.display = "block";
                        path.memo = sessionMemo;
                    } else {
                        memoContainer.style.display = "none";
                    }
                }
            })
            .catch(err => {
                console.error("Failed to fetch session info", err);
                if (tagsContainer) { tagsContainer.innerHTML = ""; tagsContainer.style.display = "none"; }
            });
    }

    const actionsEl = document.getElementById("trace-detail-actions");
    if (actionsEl) {
        if (localStorage.getItem("UI1_is_pro") === "true") {
            actionsEl.style.display = "flex";
            actionsEl.classList.remove("hidden");
        } else {
            actionsEl.style.display = "none";
        }
    }
    
    const closeBtn = document.getElementById("trace-detail-close-btn");
    if (closeBtn) closeBtn.onclick = () => modal.classList.add("hidden");

    modal.onclick = (e) => {
        if (e.target === modal) modal.classList.add("hidden");
    };

    const deleteBtn = document.getElementById("trace-delete-btn");
    if (deleteBtn) {
        // Clone to remove old event listeners
        const newDeleteBtn = deleteBtn.cloneNode(true);
        deleteBtn.parentNode.replaceChild(newDeleteBtn, deleteBtn);
        newDeleteBtn.onclick = async () => {
            if (confirm("本当にこの点字ブロック記録を削除しますか？")) {
                newDeleteBtn.disabled = true;
                newDeleteBtn.style.opacity = "0.5";
                try {
                    const sessionId = path.id || path.sessionId || path.session_id;
                    const res = await apiFetch(`${API_BASE}/api/session/deactivate`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ sessionId: sessionId }),
                    });
                    if (!res.ok) {
                         throw new Error(`Delete failed: ${res.status}`);
                    }
                    modal.classList.add("hidden");
                    // Reload the map strictly through the main function
                    loadAndShowAllRecords();
                } catch(e) {
                    console.error("Trace delete error", e);
                    alert("削除に失敗しました。ご自身の記録ではない可能性があります。");
                    newDeleteBtn.disabled = false;
                    newDeleteBtn.style.opacity = "1";
                }
            }
        };
    }

    const editBtn = document.getElementById("trace-edit-memo-btn");
    if (editBtn) {
        editBtn.onclick = () => {
            const nextMemo = prompt("メモを編集:", path.memo || "");
            if (nextMemo !== null) {
                if (memoEl) memoEl.textContent = nextMemo;
                if (memoContainer) memoContainer.style.display = nextMemo ? "block" : "none";
                path.memo = nextMemo;
            }
        };
    }

    modal.classList.remove("hidden");
}

function clearAllRecordsFromMap() { allRecordsMarkers.forEach((m) => leafletMap.removeLayer(m)); allRecordsMarkers = []; }
function setRecordsLoadingVisible(v) { if (!recordsLoadingOverlayEl) return; v ? recordsLoadingOverlayEl.classList.remove("hidden") : recordsLoadingOverlayEl.classList.add("hidden"); }

function loadAndShowOsmTactileWays() {
  const requestSeq = ++osmTactileLoadRequestSeq;
  setOsmLoadingVisible(true);
  console.log("[OSM] Loading tactile paving data...");
  const bounds = leafletMap.getBounds();
  const south = bounds.getSouth().toFixed(6);
  const west = bounds.getWest().toFixed(6);
  const north = bounds.getNorth().toFixed(6);
  const east = bounds.getEast().toFixed(6);
  const bbox = `${south},${west},${north},${east}`;
  console.log("[OSM] bbox:", bbox);
  const query = `[out:json][timeout:25];(way["tactile_paving"](${bbox});node["tactile_paving"](${bbox}););out geom;`;
  fetch("https://overpass-api.de/api/interpreter", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "data=" + encodeURIComponent(query),
  })
    .then((res) => {
      console.log("[OSM] Overpass response status:", res.status);
      if (!res.ok) throw new Error(`overpass fetch failed: ${res.status}`);
      return res.json();
    })
    .then((data) => {
      if (requestSeq !== osmTactileLoadRequestSeq || !toggleShowOsmBtn || !toggleShowOsmBtn.checked) return;
      console.log("[OSM] Got elements:", data && data.elements ? data.elements.length : 0);
      if (!data || !Array.isArray(data.elements)) throw new Error("invalid overpass payload");
      const features = [];
      data.elements.forEach((el) => {
        if (el.type === "way" && Array.isArray(el.geometry) && el.geometry.length >= 2) {
          features.push({
            geometry: {
              type: "LineString",
              coordinates: el.geometry.map((p) => [p.lon, p.lat]),
            },
            properties: el.tags || {},
          });
        } else if (el.type === "node" && typeof el.lat === "number" && typeof el.lon === "number") {
          features.push({
            geometry: { type: "Point", coordinates: [el.lon, el.lat] },
            properties: el.tags || {},
          });
        }
      });
      console.log("[OSM] Displaying", features.length, "features");
      showOsmTactileWaysOnMap(features);
    })
    .catch((err) => {
      if (requestSeq !== osmTactileLoadRequestSeq) return;
      console.error("[OSM] Overpass error:", err);

      // Removed blocking alert to avoid white screen lockup
      const errMsg = document.createElement("div");
      errMsg.textContent = "⚠️ 点字ブロックデータの取得に失敗しました。しばらく待ってから再試行してください。";
      errMsg.style.cssText = "position:fixed;top:60px;left:50%;transform:translateX(-50%);background:#e74c3c;color:#fff;padding:10px 20px;border-radius:20px;z-index:9999;font-size:12px;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:opacity 0.3s;text-align:center;width:max-content;max-width:90%;";
      document.body.appendChild(errMsg);
      setTimeout(() => {
        errMsg.style.opacity = "0";
        setTimeout(() => errMsg.remove(), 300);
      }, 4000);

      if (toggleShowOsmBtn) {
        toggleShowOsmBtn.checked = false;
        toggleShowOsmBtn.dispatchEvent(new window.Event('change'));
      }
      clearOsmTactileWaysFromMap();
    })
    .finally(() => { if (requestSeq === osmTactileLoadRequestSeq) setOsmLoadingVisible(false); });
}

function showOsmTactileWaysOnMap(features) {
  clearOsmTactileWaysFromMap();
  features.forEach((feature) => {
    if (!feature || !feature.geometry || typeof feature.geometry.type !== "string") return;
    if (feature.geometry.type === "LineString") {
      if (!Array.isArray(feature.geometry.coordinates)) return;
      const coordinates = feature.geometry.coordinates.map(([lng, lat]) => [lat, lng]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
      if (coordinates.length < 2) return;
      osmTactileMarkers.push(L.polyline(coordinates, { color: "#0066ff", weight: 4, opacity: 0.9 }).addTo(leafletMap));
      return;
    }
    if (feature.geometry.type === "Point") {
      const [lng, lat] = Array.isArray(feature.geometry.coordinates) ? feature.geometry.coordinates : [NaN, NaN];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      osmTactileMarkers.push(L.circleMarker([lat, lng], { radius: 4, color: "#0066ff", fillColor: "#0066ff", fillOpacity: 0.95, weight: 1 }).addTo(leafletMap));
    }
  });
}

function clearOsmTactileWaysFromMap() { osmTactileMarkers.forEach((m) => leafletMap.removeLayer(m)); osmTactileMarkers = []; }
function setOsmLoadingVisible(v) { if (!osmLoadingOverlayEl) return; v ? osmLoadingOverlayEl.classList.remove("hidden") : osmLoadingOverlayEl.classList.add("hidden"); }

function loadAndShowRoadInfoPoints() {
  const center = leafletMap.getCenter();
  const params = new URLSearchParams({ centerLat: center.lat.toString(), centerLng: center.lng.toString(), radiusKm: "5" });
  apiFetch(`${API_BASE}/api/road-info?${params.toString()}`)
    .then((res) => { if (!res.ok) throw new Error(`road-info fetch failed: ${res.status}`); return res.json(); })
    .then((data) => {
      if (!data || !Array.isArray(data.points)) throw new Error("invalid road-info payload");
      showRoadInfoPointsOnMap(data.points);
      // Background: pre-warm detail + address cache for all pins
      prewarmPointCaches(data.points);
    })
    .catch((err) => {
      console.warn("道情報データの取得に失敗:", err.message);
      if (toggleShowRoadInfoBtn) toggleShowRoadInfoBtn.checked = false;
      clearRoadInfoPointsFromMap();
    });
}

// Nominatim reverse geocode → "〇〇付近" string, cached
function fetchAddress(pointId, lat, lng) {
  if (pointAddressCache.has(pointId)) {
    const val = pointAddressCache.get(pointId);
    return val instanceof Promise ? val : Promise.resolve(val);
  }
  const promise = fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&accept-language=ja`, { headers: { 'User-Agent': 'StepBy-BarrierFree-App-v2' } })
    .then(r => r.json())
    .then(data => {
      const addr = data.address || {};
      const state = addr.prefecture || addr.province || addr.state || addr.county || "";
      const city = addr.city || addr.town || addr.village || addr.municipality || "";
      const ward = addr.suburb || addr.ward || addr.city_district || "";
      const neighbourhood = addr.neighbourhood || addr.quarter || addr.hamlet || "";
      let area = "";
      if (state) area += state;
      if (city) area += city;
      if (ward && ward !== city) area += ward;
      if (neighbourhood && neighbourhood !== ward && neighbourhood !== city) area += neighbourhood;
      const label = area ? `${area}付近` : "この場所付近";
      pointAddressCache.set(pointId, label);
      return label;
    })
    .catch(() => {
      const label = "この場所付近";
      pointAddressCache.set(pointId, label);
      return label;
    });
  pointAddressCache.set(pointId, promise);
  return promise;
}

function getCachedAddressSync(pointId) {
  const val = pointAddressCache.get(pointId);
  return typeof val === 'string' ? val : '道の情報';
}

// Fetch + cache a single point's detail
function fetchPointDetail(pointId) {
  if (pointDetailCache.has(pointId)) {
    const val = pointDetailCache.get(pointId);
    return val instanceof Promise ? val : Promise.resolve(val);
  }
  const promise = apiFetch(`${API_BASE}/api/road-info?pointId=${pointId}&t=${Date.now()}`)
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(data => {
      if (!data || !data.point) throw new Error("no data");
      pointDetailCache.set(pointId, data.point);
      return data.point;
    })
    .catch(err => {
      pointDetailCache.delete(pointId); // Allow retry on next click
      throw err;
    });
  pointDetailCache.set(pointId, promise);
  return promise;
}

// Pre-warm caches for uncached pins only, using requestIdleCallback so we never block tile loading
let _prewarmQueue = [];
let _prewarmRunning = false;

function prewarmPointCaches(points) {
  // Only queue pins that aren't already cached
  const uncached = points.filter(p => {
    const id = Number(p.id);
    return !pointDetailCache.has(id) || !pointAddressCache.has(id);
  });
  if (uncached.length === 0) return;

  // Add to queue (avoid duplicates)
  const queued = new Set(_prewarmQueue.map(p => p.id));
  for (const p of uncached) {
    if (!queued.has(p.id)) _prewarmQueue.push(p);
  }
  if (!_prewarmRunning) _runPrewarm();
}

function _runPrewarm() {
  if (_prewarmQueue.length === 0) { _prewarmRunning = false; return; }
  _prewarmRunning = true;

  const scheduleNext = () => {
    if (_prewarmQueue.length === 0) { _prewarmRunning = false; return; }
    setTimeout(() => {
      const idle = typeof requestIdleCallback !== "undefined" ? requestIdleCallback : (fn) => setTimeout(fn, 0);
      idle(() => _runPrewarm(), { timeout: 2000 });
    }, 1000); // Respect 1 second rate limit for Nominatim
  };

  const point = _prewarmQueue.shift();
  const pointId = Number(point.id);
  const lat = Number(point.lat);
  const lng = Number(point.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) { scheduleNext(); return; }

  const tasks = [];
  if (!pointAddressCache.has(pointId)) tasks.push(fetchAddress(pointId, lat, lng).catch(() => { }));
  if (tasks.length === 0) { scheduleNext(); return; }

  Promise.all(tasks).finally(scheduleNext);
}

// Resolve possibly relative photo URL to absolute
function resolvePhotoUrl(url) {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return API_BASE + (url.startsWith("/") ? "" : "/") + url;
}

function showRoadInfoPointsOnMap(points) {
  clearRoadInfoPointsFromMap();

  const tagIconMap = {
    "音響信号機": "fa-volume-up",
    "点字ブロック": "fa-braille",
    "感知式信号機": "fa-traffic-light",
    "スロープ": "fa-wheelchair",
    "横断歩道": "fa-road",
    "エレベーター": "fa-elevator",
    "手すり": "fa-hand-holding-heart",
    "注意箇所": "fa-triangle-exclamation",
  };

  function tagsHtml(tags) {
    if (!Array.isArray(tags) || tags.length === 0)
      return `<span style="color:#8A9BB0;font-size:11px">タグなし</span>`;
    return tags.map(t => {
      if (!t) return "";
      let label = "";
      if (typeof t === "string") {
        label = t;
      } else if (typeof t === "object") {
        label = t.labelJa || t.label || t.code || "";
      }
      if (!label) return "";
      const icon = tagIconMap[label] || "fa-tag";
      return `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(46,158,143,0.12);color:#1a7a6e;padding:4px 9px;border-radius:12px;font-size:11px;font-weight:600;margin:2px 2px 2px 0"><i class="fas ${icon}" style="font-size:9px"></i>${label}</span>`;
    }).join("");
  }

  points.forEach((point) => {
    const lat = Number(point && point.lat);
    const lng = Number(point && point.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;

    const pointId = Number(point.id);
    let initialTags = Array.isArray(point.tags) ? [...point.tags] : [];
    if (Array.isArray(point.posts)) {
      point.posts.forEach(post => {
        if (Array.isArray(post.tags)) {
          initialTags.push(...post.tags);
        }
      });
    }

    // Deduplicate tags for initial view
    const uniqueInitTags = [];
    const seenInitLabels = new Set();
    initialTags.forEach(t => {
      let label = "";
      if (typeof t === "string") label = t;
      else if (typeof t === "object" && t !== null) label = t.labelJa || t.label || t.code || "";

      if (label && !seenInitLabels.has(label)) {
        seenInitLabels.add(label);
        uniqueInitTags.push(t);
      }
    });

    let currentAddress = getCachedAddressSync(pointId);
    let currentTags = tagsHtml(initialTags);
    let currentMedia = "";

    const buildHtml = () => `
      <div style="font-family:'Noto Sans JP',sans-serif;min-width:210px;max-width:260px">
        <div style="font-size:12px;font-weight:700;color:#1a3a3a;margin-bottom:7px;display:flex;align-items:center;gap:6px">
          <i class="fas fa-map-marker-alt" style="color:#2E9E8F"></i>
          <span>${currentAddress}</span>
        </div>
        <div style="margin-bottom:8px;min-height:18px">${currentTags}</div>
        <div>${currentMedia}</div>
        <a href="../road_info_detail/Index.html?pointId=${pointId}"
          style="display:block;background:linear-gradient(135deg,#2E9E8F,#3BB49F);color:#fff;text-align:center;padding:9px 12px;border-radius:10px;font-size:12px;font-weight:700;text-decoration:none;margin-top:6px"
          onclick="event.stopPropagation()">
          <i class="fas fa-arrow-right"></i> 詳細・コメントを見る
        </a>
      </div>`;

    const pin = L.marker([lat, lng], { icon: bluePinIcon })
      .bindPopup(buildHtml(), { maxWidth: 270, closeButton: true, className: "stepby-popup" })
      .addTo(leafletMap);

    let detailLoaded = false;

    // When popup opens, fire detail + address fetch
    pin.on("popupopen", () => {
      // Fetch address asynchronously via proxy to bypass CORS
      fetchAddress(pointId, lat, lng).then(label => {
        if (currentAddress === '道の情報' && label) {
          currentAddress = label;
          const popup = pin.getPopup();
          if (popup) { popup.setContent(buildHtml()); popup.update(); }
        }
      }).catch(() => { });

      // Already fetched detail before? Skip.
      if (detailLoaded) return;
      detailLoaded = true;

      fetchPointDetail(pointId)
        .then(p => {
          try {
            console.log(`[Popup] fetchPointDetail received for ${pointId}:`, p);

            // Build Tags HTML
            let allTags = Array.isArray(p.tags) ? [...p.tags] : [];
            if (Array.isArray(p.posts)) {
              p.posts.forEach(post => {
                if (Array.isArray(post.tags)) {
                  allTags.push(...post.tags);
                }
              });
            }

            const uniqueTags = [];
            const seenLabels = new Set();
            allTags.forEach(t => {
              let label = "";
              if (typeof t === "string") label = t;
              else if (typeof t === "object" && t !== null) label = t.labelJa || t.label || t.code || "";
              if (label && !seenLabels.has(label)) {
                seenLabels.add(label);
                uniqueTags.push(t);
              }
            });

            if (uniqueTags.length > 0) {
              currentTags = tagsHtml(uniqueTags);
            }

            // Build Photo HTML
            const posts = Array.isArray(p.posts) ? p.posts : [];
            let html = "";
            let photoUrl = null;
            for (const post of posts) {
              if (Array.isArray(post.media) && post.media.length > 0 && post.media[0] && post.media[0].url) {
                photoUrl = post.media[0].url;
                if (typeof photoUrl === "string" && !photoUrl.startsWith("http")) {
                  photoUrl = API_BASE + (photoUrl.startsWith("/") ? "" : "/") + photoUrl;
                }
                break;
              }
            }
            if (photoUrl) {
              html += `<img src="${photoUrl}" alt="投稿写真" style="width:100%;max-height:130px;object-fit:cover;border-radius:8px;margin-bottom:6px;display:block">`;
            }

            // Build Latest Comment HTML
            const validPosts = posts.filter(post => post && typeof post.body === "string" && post.body.trim());
            if (validPosts.length > 0) {
              const latest = validPosts[0];
              const date = latest.createdAt ? new Date(latest.createdAt).toLocaleDateString("ja-JP") : "";
              const body = latest.body.length > 55 ? latest.body.slice(0, 55) + "…" : latest.body;
              html += `<div style="background:#F0F9F7;border-left:3px solid #2E9E8F;border-radius:0 8px 8px 0;padding:7px 10px;margin-bottom:4px">
                <div style="font-size:10px;color:#8A9BB0;margin-bottom:2px"><i class="fas fa-comment" style="font-size:9px"></i> ${date}</div>
                <div style="font-size:12px;color:#2a3a3a;line-height:1.4">${body}</div>
              </div>`;
              if (posts.length > 1) {
                html += `<div style="font-size:10px;color:#2E9E8F;text-align:right">他 ${posts.length - 1} 件</div>`;
              }
            } else if (!photoUrl) {
              html = `<div style="color:#aaa;font-size:11px;text-align:center;padding:4px 0">写真はありません</div>`;
            }

            currentMedia = html;

            const popup = pin.getPopup();
            if (popup) {
              popup.setContent(buildHtml());
              popup.update();
            }
          } catch (e) {
            console.error("Render error:", e);
            currentMedia = `<div style="color:red;font-size:10px;">Render Error: ${e.message}</div>`;
            const popup = pin.getPopup();
            if (popup) { popup.setContent(buildHtml()); popup.update(); }
          }
        })
        .catch(err => {
          console.error("Popup Detail Fetch Error:", err);
          if (detailLoaded) {
            currentMedia = `<div style="color:#c0392b;font-size:11px;padding:4px 0"><i class="fas fa-exclamation-circle"></i> 通信エラー (${err.message})</div>`;
            const popup = pin.getPopup();
            if (popup) { popup.setContent(buildHtml()); popup.update(); }
          }
        });
    });

    roadInfoMarkers.push(pin);
  });
}


function clearRoadInfoPointsFromMap() { roadInfoMarkers.forEach((m) => leafletMap.removeLayer(m)); roadInfoMarkers = []; }

function loadConfig() {
  return apiFetch(`${API_BASE}/api/config`)
    .then((res) => { if (!res.ok) throw new Error("config fetch failed"); return res.json(); })
    .then((config) => { if (typeof config.clientMinIntervalMs === "number") MIN_REQUEST_INTERVAL_MS = config.clientMinIntervalMs; })
    .catch(() => { });
}

if ("geolocation" in navigator) {
  const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

  function requestPosition(force = false) {
    navigator.geolocation.getCurrentPosition(
      (pos) => handleNewLocation(pos.coords.latitude, pos.coords.longitude, force),
      (err) => { coordsEl.textContent = "Lat: unavailable, Lng: unavailable"; lastUpdatedEl.textContent = "Last update: error"; },
      options
    );
  }

  let watchId = null;
  function startWatching() {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = navigator.geolocation.watchPosition(
      (pos) => handleNewLocation(pos.coords.latitude, pos.coords.longitude, false),
      (err) => console.error("[Geolocation] watchPosition error:", err),
      options
    );
  }

  coordsEl.textContent = "Lat: locating..., Lng: locating...";

  loadConfig().then(() => {
    startWatching();
    setInterval(pollAndSendLocation, 4000);
    updateRecordButton();

    if (toggleRecordBtn) {
      toggleRecordBtn.addEventListener("change", async () => {
        if (isHandlingRecordToggle) { updateRecordButton(); return; }
        isHandlingRecordToggle = true;
        toggleRecordBtn.disabled = true;
        const nextEnabled = toggleRecordBtn.checked;
        try {
          if (nextEnabled) {
            if (tracePolyline) { leafletMap.removeLayer(tracePolyline); tracePolyline = null; }
            recordedRawPoints = [];
            currentSessionId = generateUUID();
            currentSessionStartedAt = new Date().toISOString();
            await postSessionLifecycle("start", { sessionId: currentSessionId, deviceId: deviceUuid, startedAt: currentSessionStartedAt });
            recordEnabled = true;
            updateRecordButton();
          } else {
            const finishedSessionId = currentSessionId;
            recordEnabled = false;
            trail.forEach((dot) => dot.setStyle({ color: "#111", fillColor: "#111" }));
            updateRecordButton();
            currentSessionId = null;
            currentSessionStartedAt = null;
            await handleRecordStopWithConfirmation(finishedSessionId);
          }
        } finally {
          isHandlingRecordToggle = false;
          toggleRecordBtn.disabled = false;
        }
      });
    }

    if (toggleShowAllBtn) {
      toggleShowAllBtn.addEventListener("change", () => {
        showAllRecords = toggleShowAllBtn.checked;
        if (showAllRecords) loadAndShowAllRecords();
        else { recordsLoadRequestSeq += 1; setRecordsLoadingVisible(false); clearAllRecordsFromMap(); }
      });
    }

    if (toggleCenterCurrentBtn) {
      toggleCenterCurrentBtn.addEventListener("change", () => {
        console.log(`[toggleCenterCurrent] centerCurrentLocation=${toggleCenterCurrentBtn.checked}`);
      });
    }
  });
} else {
  coordsEl.textContent = "Lat: unavailable, Lng: unavailable";
  lastUpdatedEl.textContent = "Last update: --:--:--";
}

// ===== OSM + Road Info — registered independently (no backend dependency) =====
if (toggleShowOsmBtn) {
  toggleShowOsmBtn.addEventListener("change", () => {
    if (toggleShowOsmBtn.checked) loadAndShowOsmTactileWays();
    else { osmTactileLoadRequestSeq += 1; setOsmLoadingVisible(false); clearOsmTactileWaysFromMap(); }
  });
}

if (toggleShowRoadInfoBtn) {
  toggleShowRoadInfoBtn.addEventListener("change", () => {
    if (toggleShowRoadInfoBtn.checked) loadAndShowRoadInfoPoints();
    else clearRoadInfoPointsFromMap();
  });
}

// Reload road-info pins and records when user pans the map
let mapMoveTimeout = null;
let lastMapMoveFetchCenter = null;
leafletMap.on("moveend", () => {
  if (mapMoveTimeout) clearTimeout(mapMoveTimeout);
  mapMoveTimeout = setTimeout(() => {
    const center = leafletMap.getCenter();
    if (lastMapMoveFetchCenter && center.distanceTo(lastMapMoveFetchCenter) < 200) {
      return; // Moved less than 200m, no need to refetch
    }
    lastMapMoveFetchCenter = center;

    if (toggleShowRoadInfoBtn && toggleShowRoadInfoBtn.checked) loadAndShowRoadInfoPoints();
    if (toggleShowAllBtn && toggleShowAllBtn.checked) loadAndShowAllRecords();
    if (toggleShowOsmBtn && toggleShowOsmBtn.checked) loadAndShowOsmTactileWays();
  }, 600); // debounce 600ms so we don't flood APIs while panning
});

// ===============================================
// 場所検索 (Nominatim Geocoding)
// ===============================================
let searchMarker = null;
const mapSearchInput = document.getElementById("map-search-input");

if (mapSearchInput) {
  mapSearchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const query = mapSearchInput.value.trim();
      if (!query) return;
      searchLocation(query);
    }
  });
}

function searchLocation(query) {
  // ひらがな・カタカナが含まれれば日本語クエリ → 日本に限定
  const hasHiragana = /[\u3040-\u309F]/.test(query);  // ひらがな
  const hasKatakana = /[\u30A0-\u30FF]/.test(query);  // カタカナ
  const isJapaneseQuery = hasHiragana || hasKatakana;

  let countryParam = '';
  let viewboxParam = '';

  if (isJapaneseQuery) {
    // 日本語クエリ → 日本国内に限定（中国の動物園などを除外）
    countryParam = '&countrycodes=jp';
  } else {
    // 英語など → 現在の地図表示範囲を優先（世界対応）
    if (typeof leafletMap !== 'undefined' && leafletMap) {
      try {
        const bounds = leafletMap.getBounds();
        const sw = bounds.getSouthWest();
        const ne = bounds.getNorthEast();
        const latPad = Math.abs(ne.lat - sw.lat) * 1.5;
        const lngPad = Math.abs(ne.lng - sw.lng) * 1.5;
        viewboxParam = '&viewbox=' + (sw.lng - lngPad) + ',' + (sw.lat - latPad) + ',' + (ne.lng + lngPad) + ',' + (ne.lat + latPad) + '&bounded=0';
      } catch(e) { /* ignore */ }
    }
  }

  const url = 'https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(query) + '&limit=5&accept-language=ja' + countryParam + viewboxParam;

  fetch(url, { headers: { 'User-Agent': 'StepBy-BarrierFreeMap/1.0' } })
    .then(function(res) {
      if (!res.ok) throw new Error('Search failed: ' + res.status);
      return res.json();
    })
    .then(function(results) {
      if (!results || results.length === 0) {
        alert('「' + query + '」の検索結果が見つかりませんでした');
        return;
      }
      const place = results[0];
      const lat = parseFloat(place.lat);
      const lon = parseFloat(place.lon);
      disableGpsSnapping();
      if (searchMarker) leafletMap.removeLayer(searchMarker);
      leafletMap.flyTo([lat, lon], 15, { duration: 1.5 });
      searchMarker = L.marker([lat, lon])
        .addTo(leafletMap)
        .bindPopup('<strong>' + place.display_name.split(',')[0] + '</strong><br><small>' + place.display_name + '</small>')
        .openPopup();
      if (mapSearchInput) mapSearchInput.blur();
      console.log('[Search] Found:', place.display_name, lat, lon);
    })
    .catch(function(err) {
      console.error('[Search] Error:', err);
      alert('検索エラー: ' + err.message);
    });
}


// ===============================================
// VOICE NAVIGATION (Web Speech API)
// ===============================================

const voiceNavBtn = document.getElementById('voice-nav-btn');
const voiceToastEl = document.getElementById('voice-toast');

let voiceEnabled = false;
let voiceToastTimer = null;
const announcedSpots = new Set();   // track already-announced spot IDs
const ANNOUNCE_RADIUS_M = 30;       // announce spots within 30m

// --- Core speak function ---
function speak(text, priority = false) {
  if (!voiceEnabled) return;
  if (!window.speechSynthesis) return;

  if (priority) window.speechSynthesis.cancel();

  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = 'ja-JP';
  utter.rate = 1.05;
  utter.pitch = 1.0;
  window.speechSynthesis.speak(utter);

  showToast(text);
}

// --- Toast display ---
function showToast(text) {
  if (!voiceToastEl) return;
  voiceToastEl.textContent = '🔊 ' + text;
  voiceToastEl.classList.add('show');
  clearTimeout(voiceToastTimer);
  voiceToastTimer = setTimeout(() => voiceToastEl.classList.remove('show'), 4000);
}

// --- Haversine distance (metres) ---
function distanceMetre(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// --- Announce nearby road-info spots ---
function checkNearbySpots(userLat, userLng) {
  if (!voiceEnabled) return;

  roadInfoMarkers.forEach(pin => {
    if (!pin.getLatLng) return;
    const { lat, lng } = pin.getLatLng();
    const dist = distanceMetre(userLat, userLng, lat, lng);
    if (dist > ANNOUNCE_RADIUS_M) return;

    // Use lat+lng as a cheap unique key
    const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
    if (announcedSpots.has(key)) return;
    announcedSpots.add(key);

    // Build a friendly message using popup content
    const popup = pin.getPopup();
    let msg = `${Math.round(dist)}メートル先にスポットがあります`;
    if (popup) {
      const tmp = document.createElement('div');
      tmp.innerHTML = popup.getContent();
      // Grab tag pill text
      const pills = tmp.querySelectorAll('span[style*="background"]');
      const tags = Array.from(pills).map(p => p.textContent.trim()).filter(Boolean);
      if (tags.length) msg = `${Math.round(dist)}メートル先に${tags.join('、')}があります`;
    }
    speak(msg);
  });
}

// --- Announce nearby tactile paving ---
let lastTactileAnnounce = 0;
function checkNearbyTactile(userLat, userLng) {
  if (!voiceEnabled) return;
  if (Date.now() - lastTactileAnnounce < 20000) return; // at most every 20s

  for (const layer of osmTactileMarkers) {
    if (!layer.getLatLng && !layer.getBounds) continue;
    let dist = Infinity;
    if (layer.getLatLng) {
      const ll = layer.getLatLng();
      dist = distanceMetre(userLat, userLng, ll.lat, ll.lng);
    } else if (layer.getCenter) {
      const c = layer.getCenter();
      dist = distanceMetre(userLat, userLng, c.lat, c.lng);
    }
    if (dist < ANNOUNCE_RADIUS_M) {
      lastTactileAnnounce = Date.now();
      speak('点字ブロックがあります');
      break;
    }
  }
}

// --- Hook into existing location updates ---
const _origUpdateDisplay = updateDisplay;
window.updateDisplay = function (rawLat, rawLng, snappedLat, snappedLng, skipMarker = false) {
  _origUpdateDisplay(rawLat, rawLng, snappedLat, snappedLng, skipMarker);
  if (voiceEnabled && Number.isFinite(snappedLat)) {
    checkNearbySpots(snappedLat, snappedLng);
    checkNearbyTactile(snappedLat, snappedLng);
  }
};

// --- Button toggle ---
if (voiceNavBtn) {
  voiceNavBtn.addEventListener('click', () => {
    voiceEnabled = !voiceEnabled;
    voiceNavBtn.classList.toggle('active', voiceEnabled);
    voiceNavBtn.querySelector('i').className = voiceEnabled
      ? 'fas fa-volume-high'
      : 'fas fa-volume-xmark';
    voiceNavBtn.title = voiceEnabled ? '音声ナビON' : '音声ナビOFF';

    if (voiceEnabled) {
      announcedSpots.clear();
      speak('音声ナビを開始します。近くにスポットや点字ブロックがあるとお知らせします。', true);
    } else {
      window.speechSynthesis.cancel();
      if (voiceToastEl) voiceToastEl.classList.remove('show');
    }
  });
}













// FAB Post Button: Pin Drop Mode Logic
(function() {
    let pinDropMode = false;
    const fabPost = document.getElementById("fab-post-btn");
    const fabText = document.getElementById("fab-post-text");
    const centerPinOverlay = document.getElementById("center-pin-overlay");

    if (fabPost && centerPinOverlay && typeof leafletMap !== 'undefined') {
        fabPost.addEventListener("click", (e) => {
            e.preventDefault();
            if (!pinDropMode) {
                // Enter Pin Drop Mode
                pinDropMode = true;
                centerPinOverlay.style.display = "flex";
                fabText.textContent = "ここで決定";
                fabPost.style.background = "linear-gradient(135deg, #DE3B40, #FF5252)";
                fabPost.innerHTML = `<i class="fas fa-check"></i><span style="font-family: 'Noto Sans JP', sans-serif;">ここで決定</span>`;
            } else {
                // Confirm Location & Redirect
                const center = leafletMap.getCenter();
                window.location.assign(`../post_road/Index.html?lat=${center.lat}&lng=${center.lng}`);
            }
        });
    }
})();
