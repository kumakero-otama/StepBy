const GOOGLE_CLIENT_ID = "808129330394-dagp56961vbank89vi7bc50pp4u7mgv8.apps.googleusercontent.com";
let token = "";
let reviews = [];
let selected = null;
let osmMap = null;
let drawnLayers = [];

const $ = (id) => document.getElementById(id);
const apiUrl = (path) => {
  if (/^https?:\/\//i.test(path)) return path;
  const base = String(window.APP_CONFIG?.API_BASE_URL || "https://stepby-api-8-229-191-182.sslip.io").replace(/\/+$/, "");
  return path.startsWith("/api/") || path.startsWith("/auth/") ? `${base}${path}` : path;
};

async function api(path, options = {}) {
  const timeoutMs = Number(options.timeoutMs) || 30000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const requestOptions = { ...options };
    delete requestOptions.timeoutMs;
    const response = await fetch(apiUrl(path), {
      ...requestOptions,
      signal: controller.signal,
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, ...requestOptions.headers },
    });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(body.error || `HTTP ${response.status}`);
    return body;
  } catch (error) {
    if (error?.name === "AbortError") throw new Error("request_timeout");
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

async function googleLogin(response) {
  $("login-status").textContent = "確認しています…";
  try {
    const result = await fetch(apiUrl("/auth/google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: response.credential }),
    });
    const contentType = result.headers.get("content-type") || "";
    const body = contentType.includes("application/json") ? await result.json() : {};
    if (!result.ok) throw new Error(body.error || `認証サーバーへ接続できませんでした（${result.status}）`);
    if (!body.access_token) throw new Error("認証情報を取得できませんでした");
    token = body.access_token;
    $("login").hidden = true;
    $("app").hidden = false;
    await load();
  } catch (error) {
    $("login-status").textContent = `ログインできません: ${error.message}`;
  }
}

function initGoogle() {
  if (!window.google) return setTimeout(initGoogle, 100);
  google.accounts.id.initialize({ client_id: GOOGLE_CLIENT_ID, callback: googleLogin });
  google.accounts.id.renderButton($("google-button"), { theme: "outline", size: "large" });
}

function initMap() {
  if (osmMap) return;
  osmMap = L.map("osm-map").setView([35.68, 139.76], 15);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: "© OpenStreetMap contributors" }).addTo(osmMap);
}

function escapeHtml(value) {
  const element = document.createElement("div");
  element.textContent = String(value);
  return element.innerHTML;
}

async function load(reviewIdToRestore = selected?.review_id || null) {
  const params = new URLSearchParams({
    status: $("status").value,
    source: $("source").value,
    q: $("query").value,
    from: $("from").value,
    to: $("to").value,
  });
  const body = await api(`/api/osm/reviews?${params}`);
  reviews = body.reviews || [];
  $("result-count").textContent = `${reviews.length}件`;
  $("list").innerHTML = reviews.length
    ? reviews.map((review, index) => `<button class="review" data-i="${index}"><b>${review.source_type === "legacy_record" ? "既存" : "新規"}</b> ${new Date(review.source_metadata?.startedAt || review.created_at).toLocaleString("ja-JP")}<br>${escapeHtml(review.username || "ユーザー不明")}<br><small>${review.review_status}${review.notification_status ? ` / 通知:${escapeHtml(review.notification_status)}` : ""}</small></button>`).join("")
    : "<p>該当する記録はありません。</p>";
  document.querySelectorAll(".review").forEach((button) => { button.onclick = () => show(Number(button.dataset.i)); });
  const restoredIndex = reviews.findIndex((review) => review.review_id === reviewIdToRestore);
  if (restoredIndex >= 0) show(restoredIndex);
}

function coordsFromOperations(operations) {
  const coordinates = [];
  (operations || []).forEach((operation) => {
    const element = operation.after || operation.before || {};
    (element.nodes || []).forEach((node) => {
      if (Number.isFinite(+node.lat) && Number.isFinite(+node.lon)) coordinates.push([+node.lat, +node.lon]);
    });
  });
  return coordinates;
}

function setLocationLinks(coordinates) {
  const googleLink = $("google-aerial-link");
  const osmLink = $("osm-location-link");
  if (!coordinates.length) {
    [googleLink, osmLink].forEach((link) => { link.removeAttribute("href"); link.classList.add("disabled"); link.setAttribute("aria-disabled", "true"); });
    return;
  }
  const bounds = L.latLngBounds(coordinates);
  const center = bounds.getCenter();
  const latitude = center.lat.toFixed(7);
  const longitude = center.lng.toFixed(7);
  const googleParams = new URLSearchParams({ api: "1", map_action: "map", center: `${latitude},${longitude}`, zoom: "20", basemap: "satellite" });
  googleLink.href = `https://www.google.com/maps/@?${googleParams}`;
  osmLink.href = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=19/${latitude}/${longitude}`;
  [googleLink, osmLink].forEach((link) => { link.classList.remove("disabled"); link.removeAttribute("aria-disabled"); });
}

function show(index) {
  selected = reviews[index];
  document.querySelectorAll(".review").forEach((button, buttonIndex) => button.classList.toggle("active", index === buttonIndex));
  initMap();
  drawnLayers.forEach((layer) => osmMap.removeLayer(layer));
  drawnLayers = [];
  let path = [];
  try {
    const geometry = JSON.parse(selected.path_geojson || "null");
    path = (geometry?.coordinates || []).map((point) => [point[1], point[0]]);
  } catch {}
  const raw = (selected.raw_points || []).map((point) => [+point.lat, +point.lng]).filter((point) => point.every(Number.isFinite));
  const operations = coordsFromOperations(selected.elements);
  if (path.length) drawnLayers.push(L.polyline(path, { color: "#16a085", weight: 6 }).addTo(osmMap));
  if (raw.length) drawnLayers.push(L.polyline(raw, { color: "#e74c3c", weight: 3, dashArray: "5 6" }).addTo(osmMap));
  if (operations.length) drawnLayers.push(L.polyline(operations, { color: "#ffd400", weight: 4 }).addTo(osmMap));
  const all = [...path, ...raw, ...operations];
  if (all.length) osmMap.fitBounds(all, { padding: [30, 30] });
  setLocationLinks(all);

  const legacy = selected.source_type === "legacy_record";
  const classification = selected.source_metadata?.classification || "";
  const recordedAt = escapeHtml(new Date(selected.source_metadata?.startedAt || selected.created_at).toLocaleString("ja-JP"));
  $("decision-bar").innerHTML = `<p><strong>${legacy ? "既存記録" : "新規記録"}</strong><br>${escapeHtml(selected.username || "不明")}・${recordedAt}</p><div class="primary-actions"><button class="approve" id="approve" ${!all.length ? "disabled" : ""}>${legacy ? "OSMへ公開する" : "OSM公開を承認"}</button><button class="reject" id="reject">${legacy ? "OSMへ公開しない" : "却下"}</button></div>`;
  $("detail").innerHTML = `<h2>詳細・任意項目</h2><p>記録者: ${escapeHtml(selected.username || "不明")}<br>記録日時: ${recordedAt}<br>記録ID: ${escapeHtml(selected.record_id)}<br>状態: ${escapeHtml(selected.review_status)}${classification ? `<br>自動分類: ${escapeHtml(classification)}` : ""}<br>accuracy: ${legacy ? "旧記録のため未保存" : "GPS生座標を参照"}</p>${!all.length ? '<p class="error">表示できる経路がありません。公開せず保留して調査してください。</p>' : ""}${selected.last_error ? `<p class="error">直近の送信失敗: ${escapeHtml(selected.last_error)}</p>` : ""}<details><summary>OSM変更予定</summary><pre>${escapeHtml(JSON.stringify(selected.elements, null, 2))}</pre></details><label>管理者メモ（任意）<textarea id="note"></textarea></label><label>却下理由（任意）<textarea id="reason"></textarea></label><div class="secondary-actions"><button class="refit" id="refit" ${selected.review_status === "merged" ? "disabled" : ""}>最新OSMで再マップマッチング</button><button id="hold">保留</button><button id="save-note">メモ保存</button><button id="retry-email">通知再送</button></div>`;
  $("note").value = selected.admin_note || "";
  $("reason").value = selected.rejection_reason || "";
  $("approve").onclick = () => act("approve");
  $("reject").onclick = () => act("reject");
  $("refit").onclick = () => act("refit");
  $("hold").onclick = () => act("hold");
  $("save-note").onclick = () => act("memo");
  $("retry-email").onclick = () => act("retry-notification");
}

function setBusy(busy, message = "処理しています…") {
  const overlay = $("loading-overlay");
  if (overlay) overlay.hidden = !busy;
  if ($("loading-message")) $("loading-message").textContent = message;
  document.querySelectorAll("button,input,select,textarea").forEach((element) => { element.disabled = busy; });
}

function actionErrorMessage(code) {
  if (code === "zero_length_tactile_segment" || code === "legacy_route_not_confirmed") return "現在のOSM道路上に、公開できる長さの経路を安全に確定できませんでした。この記録は保留して地図を確認してください。";
  if (code === "osm_version_conflict") return "公開直前にOSM側の道路が再度更新されました。変更は送信されていません。少し待ってから、もう一度お試しください。";
  if (code === "osm_data_temporarily_unavailable" || code === "osm_change_api_failed") return "最新のOSM道路情報を一時的に取得できませんでした。変更は送信されていません。少し待ってから、もう一度お試しください。";
  if (code === "merged_review_cannot_be_refitted") return "OSM公開済みの記録は再マップマッチングできません。";
  if (code === "request_timeout") return "処理の確認に時間がかかっています。画面操作を再開しました。一覧を更新して状態を確認してください。";
  return code;
}

async function act(action) {
  if (!selected) return;
  const selectedReviewId = selected.review_id;
  const legacy = selected.source_type === "legacy_record";
  const reason = $("reason").value.trim() || (legacy ? "管理者判断によりOSMへ公開しない" : "");
  const note = $("note").value.trim();
  if (action === "reject" && !reason) return alert("却下理由を入力してください。");
  if (action === "approve" && !confirm("この記録をOSMへ公開しますか？")) return;
  const busyMessage = action === "refit"
    ? "保存済みの生GPSを、最新のOSM道路情報で再マップマッチングしています…"
    : action === "approve" ? "最新のOSM情報を確認して公開しています。通常は1分以内に完了します…" : "保存しています…";
  setBusy(true, busyMessage);
  try {
    const body = await api(`/api/osm/reviews/${selectedReviewId}/${action}`, { method: "POST", body: JSON.stringify({ reason, note }), timeoutMs: action === "refit" ? 95000 : 75000 });
    const message = body.osmSent ? "OSMへ公開しました。"
      : body.alreadyPresent ? "同じ点字ブロック情報がOSMに既にあることを確認しました。StepByの地図にも反映します。"
      : action === "retry-notification" ? "通知を再送しました。"
      : action === "hold" ? "保留しました。"
      : action === "memo" ? "メモを保存しました。"
      : action === "refit" ? "最新のOSM道路情報で経路と変更予定を更新しました。OSMにはまだ送信していません。"
      : action === "approve" ? "承認しました。安全条件を確認できなかったため、OSMには送信していません。"
      : "公開しない記録として保存しました。";
    alert(message);
    await load(selectedReviewId);
  } catch (error) {
    alert(`処理できません: ${actionErrorMessage(error.message)}`);
  } finally {
    setBusy(false);
    if (selected?.review_status === "merged" && $("refit")) $("refit").disabled = true;
  }
}

$("reload").onclick = () => load();
$("status").onchange = () => load(null);
$("source").onchange = () => load(null);
$("query").onkeydown = (event) => { if (event.key === "Enter") load(null); };
$("retry-notifications").onclick = async () => {
  try {
    const result = await api("/api/osm/review-notifications/retry", { method: "POST", body: "{}" });
    alert(`${result.attempted}件を確認し、${result.sent}件送信しました。`);
    await load();
  } catch (error) {
    alert(`通知を再試行できません: ${error.message}`);
  }
};
window.addEventListener("load", initGoogle);
