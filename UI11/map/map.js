// このファイルは地図画面の位置取得、表示切替、記録操作、関連 API 通信を統括する。
// 地図本体と、後続の表示更新で使う主要 DOM 参照を先に束ねておく。
const map = L.map("map", { zoomControl: true }).setView([35.681236, 139.767125], 13);
const mapLayoutEl = document.getElementById("map-layout");
const mapRowEl = document.querySelector(".map-row");
const appBarSpacerEl = document.querySelector(".app-bar-spacer");
const coordsEl = document.getElementById("coords");
const rawCoordsEl = document.getElementById("raw-coords");
const lastUpdatedEl = document.getElementById("last-updated");
const gpsIndicatorEl = document.getElementById("gps-indicator");
const mapControlsPanelEl = document.getElementById("map-controls-panel");
const mapControlsHandleEl = document.getElementById("map-controls-handle");
const mapControlsHandleLabelEl = document.getElementById("map-controls-handle-label");
const mapControlsHandleIconEl = document.getElementById("map-controls-handle-icon");
const recordActionBtn = document.getElementById("record-action-btn");
const recordActionIconEl = document.getElementById("record-action-icon");
const recordActionTextEl = document.getElementById("record-action-text");
const pauseActionBtn = document.getElementById("pause-action-btn");
const pauseActionIconEl = document.getElementById("pause-action-icon");
const pauseActionTextEl = document.getElementById("pause-action-text");
const toggleShowMapInfoBtn = document.getElementById("toggle-show-map-info");
const toggleCenterCurrentBtn = document.getElementById("toggle-center-current");
const osmLoadingOverlayEl = document.getElementById("osm-loading-overlay");
const recordsLoadingOverlayEl = document.getElementById("records-loading-overlay");
const safetyConfirmModalEl = document.getElementById("safety-confirm-modal");
const safetyConfirmAcceptBtn = document.getElementById("safety-confirm-accept");
const safetyConfirmRejectBtn = document.getElementById("safety-confirm-reject");
const traceConfirmModalEl = document.getElementById("trace-confirm-modal");
const traceConfirmTitleEl = document.getElementById("trace-confirm-title");
const traceConfirmMapEl = document.getElementById("trace-confirm-map");
const traceConfirmOkBtn = document.getElementById("trace-confirm-ok");
const traceConfirmCancelBtn = document.getElementById("trace-confirm-cancel");
const traceTagPanelEl = document.getElementById("trace-tag-panel");
const traceTagSearchEl = document.getElementById("trace-tag-search");
const traceTagSelectedEl = document.getElementById("trace-tag-selected");
const traceTagListEl = document.getElementById("trace-tag-list");
const traceTagErrorEl = document.getElementById("trace-tag-error");
const traceMemoPanelEl = document.getElementById("trace-memo-panel");
const traceMemoInputEl = document.getElementById("trace-memo-input");
const recordToggleCardEls = Array.from(document.querySelectorAll(".record-toggle-card"));
const authTokenApi = window.AuthToken || null;
const clientLogApi = window.ClientLogs || null;
const comparisonStatusEl = document.getElementById("comparison-status");
const comparisonValhallaWayEl = document.getElementById("comparison-valhalla-way");
const comparisonBrowserWayEl = document.getElementById("comparison-browser-way");
const comparisonDistanceEl = document.getElementById("comparison-distance");
const comparisonPriorityEl = document.getElementById("comparison-priority");
const comparisonDurationEl = document.getElementById("comparison-duration");
const comparisonSaveStatusEl = document.getElementById("comparison-save-status");
const comparisonTestButtonEl = document.getElementById("comparison-test-button");
const osmPreviewTestButtonEl = document.getElementById("osm-preview-test-button");
const fittingDetailButtonEl = document.getElementById("fitting-detail-button");
const fittingDetailModalEl = document.getElementById("fitting-detail-modal");
const fittingDetailBodyEl = document.getElementById("fitting-detail-body");
const fittingDetailCloseEl = document.getElementById("fitting-detail-close");
// UI11の通常記録はブラウザ側マッチャーを正として保存する。
// Valhallaは開発用の比較パネルだけで並行実行し、通常記録の確定には使わない。
const browserOsmMatcher = window.StepByOsmMatcher
  ? new window.StepByOsmMatcher.BrowserMatcher({ fetcher: authFetch, radiusMeters: 1000 })
  : null;
let recordUploadQueue = null;
let osmRevertQueue = null;
let lastNetworkPrefetchAt = 0;
let lastMapDataDownloadCenter = null;
let lastOsmDisplayDownloadCenter = null;
const MAP_DATA_REFRESH_DISTANCE_METERS = 650;
const OSM_DISPLAY_RADIUS_KM = 10;
const OSM_DISPLAY_REFRESH_DISTANCE_METERS = 8000;

// 多言語メッセージは画面内のモーダルや操作補助で共通利用する。
const SAFETY_CONFIRM_TEXT = {
  ja: {
    invalidSelection: "この選択は無効です",
  },
  en: {
    invalidSelection: "This choice is invalid.",
  },
  hi: {
    invalidSelection: "यह चयन अमान्य है।",
  },
};

// 認証付き API 呼び出しやクライアントログ送信の薄いラッパーを定義する。
function authFetch(input, init) {
  if (authTokenApi && typeof authTokenApi.authFetch === "function") {
    return authTokenApi.authFetch(input, init);
  }
  return fetch(input, init);
}

function clearAccessToken() {
  if (authTokenApi && typeof authTokenApi.clearAccessToken === "function") {
    authTokenApi.clearAccessToken();
  }
}

function logMapEvent(event, extra) {
  if (!clientLogApi || typeof clientLogApi.logEvent !== "function") {
    return;
  }
  void clientLogApi.logEvent({
    category: (extra && extra.category) || "api",
    event,
    level: (extra && extra.level) || "info",
    path: extra && extra.path ? extra.path : "",
    method: extra && extra.method ? extra.method : "",
    status: extra && Number.isFinite(extra.status) ? extra.status : null,
    message: extra && extra.message ? extra.message : "",
    meta: extra && extra.meta ? extra.meta : null,
  });
}

function bindToggleCards() {
  recordToggleCardEls.forEach((cardEl) => {
    const inputEl = cardEl.querySelector(".record-toggle-input");
    if (!inputEl) {
      return;
    }

    cardEl.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }
      event.preventDefault();
      inputEl.checked = !inputEl.checked;
      inputEl.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });
}

function getCurrentLanguage() {
  const lang = String(document.documentElement && document.documentElement.lang || "").trim().toLowerCase();
  if (!lang) {
    return "ja";
  }
  if (lang.startsWith("en")) {
    return "en";
  }
  if (lang.startsWith("hi")) {
    return "hi";
  }
  return "ja";
}

const TRACE_TAG_TEXT = {
  ja: {
    noSelection: "未選択",
    noMatch: "一致するタグがありません",
    addTagFailed: "タグの追加に失敗しました。時間をおいて再度お試しください。",
    requiredForPro: "タグを追加してください",
    publicScope: "OSM公開対象",
    privateScope: "本人のみ表示",
  },
  en: {
    noSelection: "None selected",
    noMatch: "No matching tags",
    addTagFailed: "Failed to add tag. Please try again later.",
    requiredForPro: "Please add at least one tag.",
    publicScope: "Published to OSM",
    privateScope: "Visible only to you",
  },
  hi: {
    noSelection: "कोई चयन नहीं",
    noMatch: "कोई मिलते-जुलते टैग नहीं",
    addTagFailed: "टैग जोड़ने में विफल। कृपया बाद में फिर प्रयास करें।",
    requiredForPro: "タグを追加してください",
    publicScope: "OSM पर प्रकाशित",
    privateScope: "केवल आपको दिखाई देगा",
  },
};

const TRACE_CONFIRM_TEXT = {
  ja: {
    memoSaveFailed: "メモの保存に失敗しました。メモなしで記録は保存されています。",
  },
  en: {
    memoSaveFailed: "Failed to save the memo. The record was saved without the memo.",
  },
  hi: {
    memoSaveFailed: "मेमो सहेजने में विफल रहा। रिकॉर्ड मेमो के बिना सहेजा गया है।",
  },
};

function getTraceTagText() {
  const language = getCurrentLanguage();
  return TRACE_TAG_TEXT[language] || TRACE_TAG_TEXT.ja;
}

function getTraceConfirmText() {
  const language = getCurrentLanguage();
  return TRACE_CONFIRM_TEXT[language] || TRACE_CONFIRM_TEXT.ja;
}

function getSafetyConfirmText() {
  const language = getCurrentLanguage();
  return SAFETY_CONFIRM_TEXT[language] || SAFETY_CONFIRM_TEXT.ja;
}

// 起動直後に表示する安全確認モーダルの開閉をまとめて扱う。
function hideSafetyConfirmModal() {
  if (!safetyConfirmModalEl) {
    return;
  }
  safetyConfirmModalEl.classList.add("hidden");
  safetyConfirmModalEl.setAttribute("aria-hidden", "true");
}

function showSafetyConfirmModal() {
  if (!safetyConfirmModalEl) {
    return;
  }
  safetyConfirmModalEl.classList.remove("hidden");
  safetyConfirmModalEl.removeAttribute("aria-hidden");
  if (safetyConfirmAcceptBtn) {
    window.setTimeout(() => safetyConfirmAcceptBtn.focus(), 0);
  }
}

const SAFETY_CONFIRM_ACCEPTED_KEY = "safetyConfirmAccepted.v1";

function initSafetyConfirmModal() {
  if (!safetyConfirmModalEl || !safetyConfirmAcceptBtn || !safetyConfirmRejectBtn) {
    return;
  }

  // 同一セッション内で一度「はい」を押したら、画面遷移で戻ってきたときには再表示しない。
  // ブラウザタブ/PWAウィンドウを閉じて再起動するとsessionStorageがクリアされ、再表示される。
  let acceptedThisSession = false;
  try {
    acceptedThisSession = sessionStorage.getItem(SAFETY_CONFIRM_ACCEPTED_KEY) === "1";
  } catch (e) {}

  safetyConfirmAcceptBtn.addEventListener("click", () => {
    try {
      sessionStorage.setItem(SAFETY_CONFIRM_ACCEPTED_KEY, "1");
    } catch (e) {}
    hideSafetyConfirmModal();
  });

  safetyConfirmRejectBtn.addEventListener("click", () => {
    const lang = getCurrentLanguage();
    const targetPath = lang === "en"
      ? "/map/exit_notice_en.html"
      : (lang === "hi" ? "/map/exit_notice_hi.html" : "/map/exit_notice.html");
    window.location.replace(AppPath.toApp(targetPath));
  });

  hideSafetyConfirmModal();

  if (acceptedThisSession) {
    return;
  }

  window.addEventListener("ui2:splash-finished", () => {
    showSafetyConfirmModal();
  }, { once: true });

  if (!document.getElementById("splash")) {
    showSafetyConfirmModal();
  }
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// 記録済み点字ブロックのカード表示で使う文言と描画補助をここからまとめる。
const TACTILE_SESSION_TEXT = {
  ja: {
    title: "点字ブロック記録",
    loading: "読み込み中...",
    sessionId: "session_id",
    tags: "タグ",
    memo: "ひとことメモ",
    memoEdit: "メモを編集",
    memoPrompt: "ひとことメモを入力してください",
    memoSaveFailed: "ひとことメモの保存に失敗しました。",
    selfLabel: "あなた",
    delete: "削除",
    stepByOnly: "StepBy内のみ",
    osmPublished: "OSM公開済み",
    deleteStepBy: "StepByから削除",
    deleteOsm: "OSM公開を取り消して削除",
    deleteOsmConfirm: "この点字ブロックのOSM公開を取り消し、StepByからも削除しますか？",
    deleteConfirm: "本当にこの点字ブロックを削除してよろしいですか？",
    deleteFailed: "点字ブロックの削除に失敗しました。",
    noTags: "タグなし",
    unknownUser: "不明",
    unknownTime: "不明",
    notFound: "記録情報が見つかりませんでした",
    fetchFailed: "記録情報の取得に失敗しました",
  },
  en: {
    title: "Tactile Block Record",
    loading: "Loading...",
    sessionId: "session_id",
    tags: "Tags",
    memo: "Short memo",
    memoEdit: "Edit memo",
    memoPrompt: "Enter a short memo",
    memoSaveFailed: "Failed to save the short memo.",
    selfLabel: "You",
    delete: "Delete",
    stepByOnly: "StepBy only",
    osmPublished: "Published to OSM",
    deleteStepBy: "Delete from StepBy",
    deleteOsm: "Revert OSM publication and delete",
    deleteOsmConfirm: "Revert this tactile block from OSM and delete it from StepBy?",
    deleteConfirm: "Are you sure you want to delete this tactile block?",
    deleteFailed: "Failed to delete the tactile block.",
    noTags: "No tags",
    unknownUser: "Unknown",
    unknownTime: "Unknown",
    notFound: "Record information was not found",
    fetchFailed: "Failed to load record information",
  },
  hi: {
    title: "टैक्टाइल ब्लॉक रिकॉर्ड",
    loading: "लोड हो रहा है...",
    sessionId: "session_id",
    tags: "टैग",
    memo: "छोटा मेमो",
    memoEdit: "मेमो संपादित करें",
    memoPrompt: "छोटा मेमो दर्ज करें",
    memoSaveFailed: "छोटा मेमो सहेजने में विफल रहा।",
    selfLabel: "आप",
    delete: "हटाएं",
    stepByOnly: "केवल StepBy",
    osmPublished: "OSM पर प्रकाशित",
    deleteStepBy: "StepBy से हटाएं",
    deleteOsm: "OSM प्रकाशन वापस लेकर हटाएं",
    deleteOsmConfirm: "क्या इस टैक्टाइल ब्लॉक का OSM प्रकाशन वापस लेकर इसे StepBy से भी हटाना है?",
    deleteConfirm: "क्या आप वाकई इस टैक्टाइल ब्लॉक को हटाना चाहते हैं?",
    deleteFailed: "टैक्टाइल ब्लॉक हटाने में विफल रहा।",
    noTags: "कोई टैग नहीं",
    unknownUser: "अज्ञात",
    unknownTime: "अज्ञात",
    notFound: "रिकॉर्ड जानकारी नहीं मिली",
    fetchFailed: "रिकॉर्ड जानकारी लाने में विफल",
  },
};

function getTactileSessionText() {
  const language = getCurrentLanguage();
  return TACTILE_SESSION_TEXT[language] || TACTILE_SESSION_TEXT.ja;
}

function formatTactileSessionDate(dateRaw) {
  const text = getTactileSessionText();
  const date = new Date(dateRaw);
  if (Number.isNaN(date.getTime())) {
    return text.unknownTime;
  }
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${d} ${hh}:${mm}`;
}

function normalizeAppAssetUrl(url) {
  if (typeof url !== "string" || !url.trim()) {
    return "";
  }
  if (/^https?:\/\//i.test(url) || url.startsWith("data:")) {
    return url;
  }
  return AppPath.toApiAsset(url.startsWith("/") ? url : `/${url}`);
}

function buildTactileSessionTagsHtml(tags) {
  const text = getTactileSessionText();
  if (!Array.isArray(tags) || tags.length < 1) {
    return `<span style="color:#8A9BB0;font-size:11px">${escapeHtml(text.noTags)}</span>`;
  }
  return tags
    .map((tag) => {
      const label = escapeHtml(tag);
      if (!label) {
        return "";
      }
      return `<span style="display:inline-flex;align-items:center;gap:4px;background:rgba(46,158,143,0.12);color:#1a7a6e;padding:4px 9px;border-radius:12px;font-size:11px;font-weight:600;margin:2px 2px 2px 0"><span aria-hidden="true">#</span>${label}</span>`;
    })
    .join("");
}

function buildTactileSessionUsername(sessionInfo, ownerUserId = null) {
  const text = getTactileSessionText();
  const username = sessionInfo && sessionInfo.username ? String(sessionInfo.username) : text.unknownUser;
  const normalizedOwnerUserId = Number(ownerUserId);
  const isOwnRecord = Number.isFinite(normalizedOwnerUserId)
    && Number.isFinite(currentUserId)
    && normalizedOwnerUserId === currentUserId;
  return isOwnRecord ? `${username} (${text.selfLabel})` : username;
}

function isOwnTactileSession(ownerUserId = null) {
  const normalizedOwnerUserId = Number(ownerUserId);
  return Number.isFinite(normalizedOwnerUserId)
    && Number.isFinite(currentUserId)
    && normalizedOwnerUserId === currentUserId;
}

function buildTactileSessionPopupHtml(sessionId, sessionInfo, { loading = false, error = "", ownerUserId = null } = {}) {
  const text = getTactileSessionText();
  if (loading) {
    return `
      <div style="font-family:'Noto Sans JP',sans-serif;min-width:220px;max-width:280px">
        <div style="font-size:12px;font-weight:700;color:#1a3a3a;margin-bottom:8px">${escapeHtml(text.title)}</div>
        <div style="font-size:12px;color:#5A6B7C">${escapeHtml(text.loading)}</div>
      </div>`;
  }

  if (error) {
    return `
      <div style="font-family:'Noto Sans JP',sans-serif;min-width:220px;max-width:280px">
        <div style="font-size:12px;font-weight:700;color:#1a3a3a;margin-bottom:8px">${escapeHtml(text.title)}</div>
        <div style="font-size:11px;color:#8A9BB0;margin-bottom:8px">${escapeHtml(text.sessionId)}: ${escapeHtml(sessionId)}</div>
        <div style="font-size:12px;color:#d64545">${escapeHtml(error)}</div>
      </div>`;
  }

  const username = escapeHtml(buildTactileSessionUsername(sessionInfo, ownerUserId));
  const createdAt = escapeHtml(formatTactileSessionDate(sessionInfo && sessionInfo.createdAt));
  const effectiveSessionId = escapeHtml(sessionInfo && sessionInfo.sessionId ? sessionInfo.sessionId : sessionId);
  const iconUrl = normalizeAppAssetUrl(sessionInfo && sessionInfo.iconUrl);
  const fallbackIconUrl = escapeHtml(window.location.origin + AppPath.toApp("/assets/account_default.png"));
  const iconSrc = escapeHtml(iconUrl || window.location.origin + AppPath.toApp("/assets/account_default.png"));

  return `
    <div style="font-family:'Noto Sans JP',sans-serif;min-width:220px;max-width:280px">
      <div style="font-size:12px;font-weight:700;color:#1a3a3a;margin-bottom:10px">${escapeHtml(text.title)}</div>
      <div style="display:flex;align-items:center;gap:10px;margin-bottom:10px">
        <img src="${iconSrc}" alt="${username}" style="width:44px;height:44px;border-radius:50%;object-fit:cover;border:2px solid rgba(46,158,143,0.18)" onerror="this.onerror=null;this.src='${fallbackIconUrl}'">
        <div style="min-width:0">
          <div style="font-size:14px;font-weight:700;color:#1A2B3C;line-height:1.4">${username}</div>
          <div style="font-size:11px;color:#8A9BB0;margin-top:2px">${escapeHtml(text.sessionId)}: ${effectiveSessionId}</div>
        </div>
      </div>
      <div style="font-size:12px;color:#5A6B7C;margin-bottom:8px">${createdAt}</div>
      <div>
        <div style="font-size:11px;font-weight:700;color:#5A6B7C;margin-bottom:4px">${escapeHtml(text.tags)}</div>
        <div>${buildTactileSessionTagsHtml(sessionInfo && sessionInfo.tags)}</div>
      </div>
    </div>`;
}

function buildTactileSessionCardShell(innerHtml) {
  const closeIconUrl = escapeHtml(AppPath.toApp("/assets/buttons/close.png"));
  return `
    <div class="tactile-session-card-header">
      ${innerHtml}
      <button class="tactile-session-card-close" type="button" data-close-tactile-session-card aria-label="close">
        <img src="${closeIconUrl}" alt="">
      </button>
    </div>`;
}

function buildTactileSessionCardHtml(sessionId, sessionInfo, {
  loading = false,
  error = "",
  ownerUserId = null,
  osmPublished = false,
  osmRecordId = "",
} = {}) {
  const text = getTactileSessionText();
  if (loading) {
    return buildTactileSessionCardShell(`
      <div class="tactile-session-card-avatar" aria-hidden="true"></div>
      <div class="tactile-session-card-meta">
        <div class="tactile-session-card-message">${escapeHtml(text.loading)}</div>
      </div>
    `);
  }

  if (error) {
    return buildTactileSessionCardShell(`
      <div class="tactile-session-card-avatar" aria-hidden="true"></div>
      <div class="tactile-session-card-meta">
        <span class="tactile-session-card-time">${escapeHtml(text.sessionId)}: ${escapeHtml(sessionId)}</span>
        <div class="tactile-session-card-message is-error">${escapeHtml(error)}</div>
      </div>
    `);
  }

  const username = escapeHtml(buildTactileSessionUsername(sessionInfo, ownerUserId));
  const createdAt = escapeHtml(formatTactileSessionDate(sessionInfo && sessionInfo.createdAt));
  const iconUrl = normalizeAppAssetUrl(sessionInfo && sessionInfo.iconUrl);
  const fallbackIconUrl = escapeHtml(AppPath.toApp("/assets/account_default.png"));
  const iconSrc = escapeHtml(iconUrl || AppPath.toApp("/assets/account_default.png"));
  const closeIconUrl = escapeHtml(AppPath.toApp("/assets/buttons/close.png"));
  const memoEditIconUrl = escapeHtml(AppPath.toApp("/assets/buttons/memo_edit.png"));
  const deleteIconUrl = escapeHtml(AppPath.toApp("/assets/buttons/delete.png"));
  const memoValue = sessionInfo && sessionInfo.memo != null ? String(sessionInfo.memo).trim() : "";
  const canEditOwnSession = isOwnTactileSession(ownerUserId);
  const publicationBadge = `<div class="tactile-session-publication-status ${osmPublished ? "is-osm" : "is-stepby"}">${escapeHtml(osmPublished ? text.osmPublished : text.stepByOnly)}</div>`;
  const memoHtml = memoValue
    ? `
    <div class="tactile-session-card-memo">
      <div class="tactile-session-card-memo-head">
        <div class="tactile-session-card-memo-label">${escapeHtml(text.memo)}</div>
      </div>
      <div class="tactile-session-card-memo-body">${escapeHtml(memoValue)}</div>
    </div>`
    : "";
  const actionButtons = canEditOwnSession
    ? `
    <div class="tactile-session-card-actions">
      <button class="tactile-session-card-edit-action" type="button" data-edit-tactile-memo="${escapeHtml(sessionId)}">
        <img src="${memoEditIconUrl}" alt="">
        <span>${escapeHtml(text.memoEdit)}</span>
      </button>
      <button class="tactile-session-card-delete" type="button" ${osmPublished
        ? `data-revert-osm-record="${escapeHtml(osmRecordId || sessionId)}"`
        : `data-deactivate-tactile-session="${escapeHtml(sessionId)}"`}>
        <img src="${deleteIconUrl}" alt="">
        <span>${escapeHtml(osmPublished ? text.deleteOsm : text.deleteStepBy)}</span>
      </button>
    </div>`
    : "";

  return `
    <div class="tactile-session-card-header">
      <img class="tactile-session-card-avatar" src="${iconSrc}" alt="${username}" onerror="this.onerror=null;this.src='${fallbackIconUrl}'">
      <div class="tactile-session-card-meta">
        <span class="tactile-session-card-username">${username}</span>
        <span class="tactile-session-card-time">${createdAt}</span>
      </div>
      <button class="tactile-session-card-close" type="button" data-close-tactile-session-card aria-label="close">
        <img src="${closeIconUrl}" alt="">
      </button>
    </div>
    ${publicationBadge}
    <div class="tactile-session-card-tags">${buildTactileSessionTagsHtml(sessionInfo && sessionInfo.tags)}</div>
    ${memoHtml}
    ${actionButtons}`;
}

function ensureTactileSessionCard() {
  if (!mapRowEl) {
    return tactileSessionCardEl;
  }
  if (!tactileSessionBackdropEl) {
    tactileSessionBackdropEl = document.createElement("div");
    tactileSessionBackdropEl.className = "tactile-session-backdrop hidden";
    tactileSessionBackdropEl.addEventListener("click", () => {
      hideTactileSessionCard();
    });
    tactileSessionBackdropEl.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
    });
    mapRowEl.appendChild(tactileSessionBackdropEl);
  }
  if (tactileSessionCardEl) {
    return tactileSessionCardEl;
  }
  tactileSessionCardEl = document.createElement("section");
  tactileSessionCardEl.className = "tactile-session-card hidden";
  tactileSessionCardEl.setAttribute("aria-live", "polite");
  tactileSessionCardEl.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  tactileSessionCardEl.addEventListener("pointerdown", (event) => {
    event.stopPropagation();
  });
  mapRowEl.appendChild(tactileSessionCardEl);
  return tactileSessionCardEl;
}

function hideTactileSessionCard() {
  tactileSessionCardLatLng = null;
  if (activeTactileSessionPolyline && typeof activeTactileSessionPolyline.setStyle === "function") {
    activeTactileSessionPolyline.setStyle({
      color: activeTactileSessionPolyline.options.stepByBaseColor || "#00b050",
      weight: 4,
      opacity: 0.85,
    });
  }
  activeTactileSessionPolyline = null;
  if (tactileSessionBackdropEl) {
    tactileSessionBackdropEl.classList.add("hidden");
  }
  if (!tactileSessionCardEl) {
    return;
  }
  tactileSessionCardEl.classList.add("hidden");
}

function setActiveTactileSessionPolyline(polyline) {
  if (activeTactileSessionPolyline === polyline) {
    if (polyline && typeof polyline.bringToFront === "function") {
      polyline.bringToFront();
    }
    return;
  }

  if (activeTactileSessionPolyline && typeof activeTactileSessionPolyline.setStyle === "function") {
    activeTactileSessionPolyline.setStyle({
      color: activeTactileSessionPolyline.options.stepByBaseColor || "#00b050",
      weight: 4,
      opacity: 0.85,
    });
  }

  activeTactileSessionPolyline = polyline || null;
  if (activeTactileSessionPolyline && typeof activeTactileSessionPolyline.setStyle === "function") {
    activeTactileSessionPolyline.setStyle({
      color: "#ff7a00",
      weight: 8,
      opacity: 1,
    });
    if (typeof activeTactileSessionPolyline.bringToFront === "function") {
      activeTactileSessionPolyline.bringToFront();
    }
  }
}

function positionTactileSessionCard(latlng) {
  if (!tactileSessionCardEl || tactileSessionCardEl.classList.contains("hidden") || !mapRowEl) {
    return;
  }
  const rowRect = mapRowEl.getBoundingClientRect();
  const cardRect = tactileSessionCardEl.getBoundingClientRect();
  const horizontalInset = 22;
  const bottomInset = 20;
  const cardWidth = Math.min(cardRect.width || rowRect.width - horizontalInset * 2, rowRect.width - horizontalInset * 2);
  const left = Math.max(horizontalInset, (rowRect.width - cardWidth) / 2);
  const top = Math.max(12, rowRect.height - (cardRect.height || 0) - bottomInset);

  tactileSessionCardEl.style.left = `${Math.round(left)}px`;
  tactileSessionCardEl.style.top = `${Math.round(top)}px`;
}

function renderTactileSessionCard(contentHtml, latlng) {
  const card = ensureTactileSessionCard();
  if (!card) {
    return;
  }
  tactileSessionCardLatLng = latlng || null;
  card.innerHTML = contentHtml;
  if (tactileSessionBackdropEl) {
    tactileSessionBackdropEl.classList.remove("hidden");
  }
  card.classList.remove("hidden");
  const closeBtn = card.querySelector("[data-close-tactile-session-card]");
  if (closeBtn) {
    closeBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      hideTactileSessionCard();
    });
  }
  const deleteBtn = card.querySelector("[data-deactivate-tactile-session]");
  if (deleteBtn) {
    deleteBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.currentTarget;
      const targetSessionId = target instanceof HTMLElement
        ? String(target.getAttribute("data-deactivate-tactile-session") || "").trim()
        : "";
      if (!targetSessionId) {
        return;
      }
      void deactivateTactileSession(targetSessionId, target);
    });
  }
  const osmRevertBtn = card.querySelector("[data-revert-osm-record]");
  if (osmRevertBtn) {
    osmRevertBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.currentTarget;
      const recordId = target instanceof HTMLElement
        ? String(target.getAttribute("data-revert-osm-record") || "").trim()
        : "";
      if (!recordId) return;
      void requestOwnedOsmRevert(recordId, target);
    });
  }
  const memoEditBtn = card.querySelector("[data-edit-tactile-memo]");
  if (memoEditBtn) {
    memoEditBtn.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      const target = event.currentTarget;
      const targetSessionId = target instanceof HTMLElement
        ? String(target.getAttribute("data-edit-tactile-memo") || "").trim()
        : "";
      if (!targetSessionId) {
        return;
      }
      void editTactileSessionMemo(targetSessionId, target);
    });
  }
  positionTactileSessionCard(tactileSessionCardLatLng);
}

async function editTactileSessionMemo(sessionId, buttonEl) {
  if (!sessionId) {
    return;
  }
  const text = getTactileSessionText();
  const cached = tactileSessionInfoCache.get(sessionId);
  const sessionInfo = cached && !(cached instanceof Promise) ? cached : null;
  const currentMemo = sessionInfo && sessionInfo.memo != null ? String(sessionInfo.memo) : "";
  const nextMemo = window.prompt(text.memoPrompt, currentMemo);
  if (nextMemo == null || nextMemo === currentMemo) {
    return;
  }

  if (buttonEl instanceof HTMLButtonElement) {
    buttonEl.disabled = true;
  }

  try {
    const res = await authFetch("/api/session/memo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        memo: nextMemo,
      }),
    });
    if (!res.ok) {
      throw new Error(`session memo failed: ${res.status}`);
    }
    if (sessionInfo) {
      const updatedSessionInfo = { ...sessionInfo, memo: nextMemo };
      tactileSessionInfoCache.set(sessionId, updatedSessionInfo);
      renderTactileSessionCard(
        buildTactileSessionCardHtml(sessionId, updatedSessionInfo, {
          ownerUserId: currentUserId,
        }),
        tactileSessionCardLatLng
      );
      return;
    }
    tactileSessionInfoCache.delete(sessionId);
  } catch (err) {
    console.error("[editTactileSessionMemo] Error:", err);
    if (buttonEl instanceof HTMLButtonElement) {
      buttonEl.disabled = false;
    }
    window.alert(text.memoSaveFailed);
  }
}

async function deactivateTactileSession(sessionId, buttonEl) {
  if (!sessionId) {
    return;
  }
  const text = getTactileSessionText();
  if (!window.confirm(text.deleteConfirm)) {
    return;
  }

  if (buttonEl instanceof HTMLButtonElement) {
    buttonEl.disabled = true;
  }

  try {
    const res = await authFetch("/api/session/deactivate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId }),
    });
    if (!res.ok) {
      throw new Error(`session deactivate failed: ${res.status}`);
    }
    tactileSessionInfoCache.delete(sessionId);
    hideTactileSessionCard();
    loadAndShowAllRecords();
  } catch (err) {
    console.error("[deactivateTactileSession] Error:", err);
    if (buttonEl instanceof HTMLButtonElement) {
      buttonEl.disabled = false;
    }
    window.alert(text.deleteFailed);
  }
}

function fetchTactileSessionInfo(sessionId) {
  if (!sessionId) {
    return Promise.reject(new Error("missing_session_id"));
  }
  if (tactileSessionInfoCache.has(sessionId)) {
    const cached = tactileSessionInfoCache.get(sessionId);
    return cached instanceof Promise ? cached : Promise.resolve(cached);
  }

  const params = new URLSearchParams({ sessionId });
  const request = authFetch(`/api/tactile-session-info?${params.toString()}`, { cache: "no-store" })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`tactile-session-info fetch failed: ${res.status}`);
      }
      return res.json();
    })
    .then((payload) => {
      const session = payload && payload.success ? payload.session : null;
      if (!session) {
        throw new Error("session_not_found");
      }
      tactileSessionInfoCache.set(sessionId, session);
      return session;
    })
    .catch((err) => {
      tactileSessionInfoCache.delete(sessionId);
      throw err;
    });

  tactileSessionInfoCache.set(sessionId, request);
  return request;
}

function isNonProVisibleTactileSession(path) {
  if (isCurrentUserPro) {
    return true;
  }
  const tags = Array.isArray(path && path.tags) ? path.tags : [];
  return tags.length === 1 && String(tags[0] || "").trim() === "点字ブロック";
}

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: "&copy; OpenStreetMap contributors",
}).addTo(map);

const redPinIcon = L.divIcon({
  className: "stepby-current-location-icon",
  html: '<span class="stepby-current-location-pin" aria-hidden="true"></span>',
  iconSize: [30, 42],
  iconAnchor: [15, 39],
  popupAnchor: [0, -36],
});
const bluePinIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

let MIN_REQUEST_INTERVAL_MS = 2000; // 2秒間隔
let latestLocation = null; // OSからの最新位置情報を保持する変数
let marker = null;
const trail = [];
const MAX_TRAIL = 100;
let lastDot = null;
let lastSent = null;
let lastRequestTime = 0;
let recordEnabled = false;
let recordPaused = false;
// post_road 等の他画面で録音が継続されていた場合に備え、localStorage から状態を復元する。
// 期限は1時間とし、それより古いものは破棄する（誤動作・取り残し対策）。
(function restoreRecordingStateFromStorage() {
  try {
    const raw = localStorage.getItem("recordingState.v1");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.recordEnabled || !parsed.currentSessionId) return;
    if (Number.isFinite(parsed.savedAt) && Date.now() - parsed.savedAt > 60 * 60 * 1000) {
      localStorage.removeItem("recordingState.v1");
      return;
    }
    recordEnabled = true;
    recordPaused = Boolean(parsed.recordPaused);
    // currentSessionId は後で宣言される変数なので、グローバルに直接代入する。
    window.__restoredRecordingSessionId = parsed.currentSessionId;
  } catch (e) {}
})();
let recordedRawPoints = []; // 記録開始から終了までのrawデータ（全セッション合算）
let recordedSnappedPoints = []; // 記録開始から終了までのsnappedデータ（全セッション合算）
let currentSessionRawPoints = []; // 現在セッションのrawデータ
let currentSessionSnappedPoints = []; // 現在セッションのsnappedデータ
let currentSessionRawStartIndex = 0;
let currentSessionSnappedStartIndex = 0;
let recordingSessionIds = []; // 記録開始から終了までに作成したセッションID一覧
let tracePolyline = null; // trace_attributesの結果を表示する黄緑線
let comparisonRawMarker = null;
let comparisonValhallaMarker = null;
let comparisonBrowserMarker = null;
let comparisonValhallaLine = null;
let comparisonBrowserLine = null;
let comparisonDifferenceLine = null;
let currentSessionId = null;
if (typeof window !== "undefined" && window.__restoredRecordingSessionId) {
  currentSessionId = window.__restoredRecordingSessionId;
  delete window.__restoredRecordingSessionId;
}
let currentSessionStartedAt = null;
let traceConfirmMap = null;
let traceConfirmPathLayer = null;
let isHandlingRecordToggle = false;
let isHandlingPauseToggle = false;
let currentUserId = null;
let latestSnappedLocation = null;
let mapLayoutSyncTimer = null;
let gpsBlinkTimer = null;
const GPS_BLINK_DURATION_MS = 80;
let lastGpsUpdateStamp = "";
let isCurrentUserPro = false;
let traceTagOptions = [];
const selectedTraceTagIds = new Set();

// Valhallaの6桁精度ポリラインをデコードする関数
function decodePolyline(str, precision) {
  let index = 0,
    lat = 0,
    lng = 0,
    coordinates = [],
    shift = 0,
    result = 0,
    byte = null,
    latitude_change,
    longitude_change,
    factor = Math.pow(10, precision || 6);

  while (index < str.length) {
    byte = null;
    shift = 0;
    result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    latitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

    shift = 0;
    result = 0;

    do {
      byte = str.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    longitude_change = ((result & 1) ? ~(result >> 1) : (result >> 1));

    lat += latitude_change;
    lng += longitude_change;

    coordinates.push([lat / factor, lng / factor]);
  }

  return coordinates;
}

let allRecordsMarkers = [];
let osmTactileMarkers = [];
// 復帰直後はマップ表示位置の自動中央追従を抑止するフラグ。
// applyCachedLocation または restoreMapReturnCache で mapReturnCache の位置を復元した直後に true にし、
// ユーザーが地図に触れる（ドラッグ／ズーム）まで auto-center を抑止する。
let suppressAutoCenterAfterReturn = false;
let roadInfoMarkers = [];
let cachedVisibleSessionPaths = [];
let cachedOsmFeatures = [];
let cachedVisibleRoadInfoPoints = [];
const tactileSessionInfoCache = new Map();
let tactileSessionBackdropEl = null;
let tactileSessionCardEl = null;
let tactileSessionCardLatLng = null;
let activeTactileSessionPolyline = null;
let isZooming = false;
let suppressMapTapUntil = 0;
let osmTactileLoadRequestSeq = 0;
let recordsLoadRequestSeq = 0;
let roadInfoLoadRequestSeq = 0;
const MAP_TAP_SUPPRESS_AFTER_ZOOM_MS = 400;
const MAP_DISPLAY_SETTINGS_KEY = "mapDisplaySettings.v1";
const MAP_CONTROLS_COLLAPSED_KEY = "mapControlsCollapsed.v1";
const MAP_INFO_VISIBILITY_KEY = "mapInfoVisibility.v1";
const CENTER_CURRENT_KEY = "centerCurrentEnabled.v1";
const LAST_LOCATION_CACHE_KEY = "lastKnownLocation.v1";
const MAP_RETURN_CACHE_KEY = "mapReturnCache.v1";
const MAP_RETURN_CACHE_MAX_AGE_MS = 5 * 60 * 1000;
// 地図表示のトグル状態はローカル保存して再訪時に復元する。
const DEFAULT_MAP_DISPLAY_SETTINGS = {
  showAppTactile: true,
  showOsmTactile: true,
  showAllRoadInfo: true,
  showOnlyMyTactile: false,
  showOnlyMyRoadInfo: false,
};

function loadMapDisplaySettings() {
  try {
    const raw = localStorage.getItem(MAP_DISPLAY_SETTINGS_KEY);
    if (!raw) {
      return { ...DEFAULT_MAP_DISPLAY_SETTINGS };
    }
    const parsed = JSON.parse(raw);
    return {
      showAppTactile: Boolean(parsed && parsed.showAppTactile),
      showOsmTactile: Boolean(parsed && parsed.showOsmTactile),
      showAllRoadInfo: Boolean(parsed && parsed.showAllRoadInfo),
      showOnlyMyTactile: Boolean(parsed && parsed.showOnlyMyTactile),
      showOnlyMyRoadInfo: Boolean(parsed && parsed.showOnlyMyRoadInfo),
    };
  } catch (err) {
    console.warn("[Settings] Failed to parse map display settings. Use defaults.", err);
    return { ...DEFAULT_MAP_DISPLAY_SETTINGS };
  }
}

const mapDisplaySettings = loadMapDisplaySettings();

function refreshMapDisplaySettings() {
  const latest = loadMapDisplaySettings();
  mapDisplaySettings.showAppTactile = Boolean(latest.showAppTactile);
  mapDisplaySettings.showOsmTactile = Boolean(latest.showOsmTactile);
  mapDisplaySettings.showAllRoadInfo = Boolean(latest.showAllRoadInfo);
  mapDisplaySettings.showOnlyMyTactile = Boolean(latest.showOnlyMyTactile);
  mapDisplaySettings.showOnlyMyRoadInfo = Boolean(latest.showOnlyMyRoadInfo);
}

function loadMapControlsCollapsed() {
  try {
    return localStorage.getItem(MAP_CONTROLS_COLLAPSED_KEY) === "1";
  } catch {
    return false;
  }
}

function saveMapControlsCollapsed(collapsed) {
  try {
    localStorage.setItem(MAP_CONTROLS_COLLAPSED_KEY, collapsed ? "1" : "0");
  } catch {
    // ignore storage failure
  }
}

function loadMapInfoVisibility() {
  try {
    const raw = localStorage.getItem(MAP_INFO_VISIBILITY_KEY);
    if (raw === "1") {
      return true;
    }
    if (raw === "0") {
      return false;
    }
  } catch {
    // ignore storage failure
  }
  return false;
}

function saveMapInfoVisibility(visible) {
  try {
    localStorage.setItem(MAP_INFO_VISIBILITY_KEY, visible ? "1" : "0");
  } catch {
    // ignore storage failure
  }
}

function loadCenterCurrentEnabled() {
  try {
    const raw = localStorage.getItem(CENTER_CURRENT_KEY);
    if (raw === "1") {
      return true;
    }
    if (raw === "0") {
      return false;
    }
  } catch {
    // ignore storage failure
  }
  return true;
}

function saveCenterCurrentEnabled(enabled) {
  try {
    localStorage.setItem(CENTER_CURRENT_KEY, enabled ? "1" : "0");
  } catch {
    // ignore storage failure
  }
}

function cloneSerializable(value) {
  if (value == null) {
    return value;
  }
  try {
    return JSON.parse(JSON.stringify(value));
  } catch {
    return null;
  }
}

function getVisibleTactilePaths(paths) {
  if (!Array.isArray(paths)) {
    return [];
  }
  return paths.filter((path) => {
    if (!isNonProVisibleTactileSession(path)) {
      return false;
    }
    if (!shouldShowOnlyMyTactile()) {
      return true;
    }
    const ownerUserId = Number(path && path.user_id);
    return Number.isFinite(ownerUserId) && Number.isFinite(currentUserId) && ownerUserId === currentUserId;
  });
}

function getVisibleRoadInfoPoints(points) {
  if (!Array.isArray(points)) {
    return [];
  }
  return points.filter((point) => {
    if (String(point && point.status || "").toLowerCase() === "inactive") {
      return false;
    }
    if (!shouldShowOnlyMyRoadInfo()) {
      return true;
    }
    const createdBy = Number(point && point.createdBy);
    return Number.isFinite(createdBy) && Number.isFinite(currentUserId) && createdBy === currentUserId;
  });
}

function buildMapReturnCachePayload() {
  const center = typeof map?.getCenter === "function" ? map.getCenter() : null;
  const zoom = typeof map?.getZoom === "function" ? map.getZoom() : NaN;
  const payload = {
    savedAt: Date.now(),
    mapInfoEnabled: isMapInfoEnabled(),
    centerCurrentEnabled: isCenterCurrentEnabled(),
    mapDisplaySettings: { ...mapDisplaySettings },
    center: center && Number.isFinite(center.lat) && Number.isFinite(center.lng)
      ? { lat: center.lat, lng: center.lng }
      : null,
    zoom: Number.isFinite(zoom) ? zoom : null,
    visibleSessionPaths: cloneSerializable(cachedVisibleSessionPaths) || [],
    visibleRoadInfoPoints: cloneSerializable(cachedVisibleRoadInfoPoints) || [],
  };
  return payload;
}

function saveMapReturnCache() {
  try {
    sessionStorage.setItem(MAP_RETURN_CACHE_KEY, JSON.stringify(buildMapReturnCachePayload()));
  } catch {
    // ignore storage failure
  }
}

function loadMapReturnCache() {
  try {
    const raw = sessionStorage.getItem(MAP_RETURN_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const savedAt = Number(parsed && parsed.savedAt);
    if (!Number.isFinite(savedAt) || (Date.now() - savedAt) > MAP_RETURN_CACHE_MAX_AGE_MS) {
      sessionStorage.removeItem(MAP_RETURN_CACHE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function applyPersistedHomeToggleState() {
  if (toggleShowMapInfoBtn) {
    toggleShowMapInfoBtn.checked = loadMapInfoVisibility();
  }
  if (toggleCenterCurrentBtn) {
    toggleCenterCurrentBtn.checked = loadCenterCurrentEnabled();
  }
}

function restoreMapReturnCache() {
  const cached = loadMapReturnCache();
  if (!cached) {
    return false;
  }

  // 地図位置とズームは地図情報表示の状態に関わらず常に復元し、
  // 他画面から戻ったときに表示位置がリセットされないようにする。
  if (!isCenterCurrentEnabled() && cached.center && Number.isFinite(cached.center.lat) && Number.isFinite(cached.center.lng)) {
    const nextZoom = Number.isFinite(Number(cached.zoom)) ? Number(cached.zoom) : map.getZoom();
    map.setView([cached.center.lat, cached.center.lng], nextZoom, { animate: false });
    suppressAutoCenterAfterReturn = true;
  }

  // 取得済みデータの復元は、地図情報表示ONで保存されていたときのみ行う。
  if (cached.mapInfoEnabled) {
    cachedVisibleSessionPaths = Array.isArray(cached.visibleSessionPaths)
      ? cloneSerializable(cached.visibleSessionPaths) || []
      : [];
    // 表示専用OSM点字ブロックはブラウザストレージへ保存せず、画面ごとに読み直す。
    cachedOsmFeatures = [];
    cachedVisibleRoadInfoPoints = Array.isArray(cached.visibleRoadInfoPoints)
      ? cloneSerializable(cached.visibleRoadInfoPoints) || []
      : [];

    if (shouldShowAppTactile() && cachedVisibleSessionPaths.length > 0) {
      showAllSessionPathsOnMap(cachedVisibleSessionPaths, { preFiltered: true });
    }
    if (shouldShowRoadInfo() && cachedVisibleRoadInfoPoints.length > 0) {
      showRoadInfoPointsOnMap(cachedVisibleRoadInfoPoints, { preFiltered: true });
    }
  }

  return true;
}

function saveLastKnownLocation(lat, lng) {
  try {
    localStorage.setItem(
      LAST_LOCATION_CACHE_KEY,
      JSON.stringify({
        lat,
        lng,
        savedAt: Date.now(),
      })
    );
  } catch {
    // ignore storage failure
  }
}

function loadLastKnownLocation() {
  try {
    const raw = localStorage.getItem(LAST_LOCATION_CACHE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    const lat = Number(parsed && parsed.lat);
    const lng = Number(parsed && parsed.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return null;
    }
    return { lat, lng };
  } catch {
    return null;
  }
}

function applyCachedLocation(cached) {
  if (!cached || !Number.isFinite(cached.lat) || !Number.isFinite(cached.lng)) {
    return false;
  }
  latestLocation = { lat: cached.lat, lng: cached.lng };
  latestSnappedLocation = { lat: cached.lat, lng: cached.lng };
  updateTimestamp();
  if (coordsEl) {
    coordsEl.textContent = `Lat: ${cached.lat.toFixed(6)}, Lng: ${cached.lng.toFixed(6)}`;
  }
  if (rawCoordsEl) {
    rawCoordsEl.textContent = `Raw: ${cached.lat.toFixed(6)}, ${cached.lng.toFixed(6)}`;
  }
  updateCurrentLocationMarker(cached.lat, cached.lng);
  if (isCenterCurrentEnabled()) {
    // 追従ONでは保存済みの地図中心より現在地を必ず優先する。
    suppressAutoCenterAfterReturn = false;
    const currentZoom = map.getZoom();
    map.setView([cached.lat, cached.lng], currentZoom, { animate: false });
  }
  return true;
}

function updateCurrentLocationMarker(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  if (!marker) {
    marker = L.marker([lat, lng], { icon: redPinIcon }).addTo(map);
  } else {
    marker.setLatLng([lat, lng]);
  }
}

function setMapControlsCollapsed(collapsed) {
  if (!mapLayoutEl || !mapControlsPanelEl || !mapControlsHandleEl) {
    return;
  }
  mapControlsPanelEl.classList.toggle("collapsed", collapsed);
  mapLayoutEl.classList.toggle("panel-collapsed", collapsed);
  mapControlsHandleEl.setAttribute("aria-expanded", collapsed ? "false" : "true");
  if (mapControlsHandleIconEl) {
    mapControlsHandleIconEl.src = collapsed
      ? "../assets/displays/up_66gray.png"
      : "../assets/displays/down_66gray.png";
  }
  if (mapControlsHandleLabelEl) {
    const lang = getCurrentLanguage();
    if (lang === "en") {
      mapControlsHandleLabelEl.textContent = collapsed ? "Open menu" : "Close menu";
    } else if (lang === "hi") {
      mapControlsHandleLabelEl.textContent = collapsed ? "मेनू खोलें" : "मेनू बंद करें";
    } else {
      mapControlsHandleLabelEl.textContent = collapsed ? "メニューを開く" : "メニューを閉じる";
    }
  }
  saveMapControlsCollapsed(collapsed);
  requestAnimationFrame(() => {
    map.invalidateSize();
    recenterToLatestLocation();
  });
  if (mapLayoutSyncTimer) {
    clearTimeout(mapLayoutSyncTimer);
  }
  mapLayoutSyncTimer = setTimeout(() => {
    map.invalidateSize();
    recenterToLatestLocation();
  }, 280);
}

function initMapControlsPanelGesture() {
  if (!mapControlsPanelEl || !mapControlsHandleEl) {
    return;
  }

  mapControlsHandleEl.addEventListener("click", () => {
    const collapsed = mapControlsPanelEl.classList.contains("collapsed");
    setMapControlsCollapsed(!collapsed);
  });

  mapControlsPanelEl.addEventListener("transitionend", (event) => {
    if (event.propertyName !== "grid-template-rows") {
      return;
    }
    map.invalidateSize();
    recenterToLatestLocation();
  });

  setMapControlsCollapsed(loadMapControlsCollapsed());
}

function isMapInfoEnabled() {
  return Boolean(toggleShowMapInfoBtn && toggleShowMapInfoBtn.checked);
}

function shouldShowAppTactile() {
  return isMapInfoEnabled() && (mapDisplaySettings.showAppTactile || mapDisplaySettings.showOnlyMyTactile);
}

function shouldShowOsmTactile() {
  return isMapInfoEnabled() && mapDisplaySettings.showOsmTactile;
}

function shouldShowRoadInfo() {
  return isMapInfoEnabled() && (mapDisplaySettings.showAllRoadInfo || mapDisplaySettings.showOnlyMyRoadInfo);
}

function shouldShowOnlyMyTactile() {
  // 「全体表示」がONのときは「自分のみ」は無効化して常に全件表示する。
  return Boolean(mapDisplaySettings.showOnlyMyTactile) && !Boolean(mapDisplaySettings.showAppTactile);
}

function shouldShowOnlyMyRoadInfo() {
  // 「全ての道情報」がONのときは「自分のみ」は無効化して常に全件表示する。
  return Boolean(mapDisplaySettings.showOnlyMyRoadInfo) && !Boolean(mapDisplaySettings.showAllRoadInfo);
}

function shouldIgnoreMapTap(event) {
  if (isZooming || Date.now() < suppressMapTapUntil) {
    return true;
  }

  const originalEvent = event?.originalEvent;
  if (!originalEvent) {
    return false;
  }

  // Double click zoom/wheel zoom should not trigger navigation.
  return originalEvent.type === "dblclick" || originalEvent.type === "wheel" || originalEvent.type === "mousewheel";
}

function measureVisibleViewportHeight() {
  if (window.visualViewport && Number.isFinite(window.visualViewport.height) && window.visualViewport.height > 0) {
    return Number(window.visualViewport.height);
  }
  const fallback = Number(window.innerHeight);
  if (!Number.isFinite(fallback) || fallback <= 0) {
    return 0;
  }
  return fallback;
}

function measureAppBarSpacerHeight() {
  if (appBarSpacerEl) {
    const rect = appBarSpacerEl.getBoundingClientRect();
    if (Number.isFinite(rect.height) && rect.height > 0) {
      return rect.height;
    }
  }
  return 56;
}

function applyLayoutViewportMetrics() {
  const viewportHeight = measureVisibleViewportHeight();
  const spacerHeight = measureAppBarSpacerHeight();
  if (viewportHeight > 0) {
    const layoutHeight = Math.max(220, Math.round(viewportHeight - spacerHeight));
    document.documentElement.style.setProperty("--map-layout-height", `${layoutHeight}px`);
  }
  document.documentElement.style.setProperty("--system-ui-bottom", "0px");
  requestAnimationFrame(() => {
    map.invalidateSize();
    recenterToLatestLocation();
  });
}

function scheduleSystemUiInsetStabilize() {
  applyLayoutViewportMetrics();
  window.setTimeout(applyLayoutViewportMetrics, 120);
  window.setTimeout(applyLayoutViewportMetrics, 360);
  window.setTimeout(applyLayoutViewportMetrics, 900);
}

function initSystemUiInsetSync() {
  scheduleSystemUiInsetStabilize();
  window.addEventListener("resize", scheduleSystemUiInsetStabilize);
  window.addEventListener("orientationchange", scheduleSystemUiInsetStabilize);
  window.addEventListener("focus", scheduleSystemUiInsetStabilize);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) {
      scheduleSystemUiInsetStabilize();
    }
  });
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", scheduleSystemUiInsetStabilize);
    window.visualViewport.addEventListener("scroll", scheduleSystemUiInsetStabilize);
  }
}

map.on("zoomstart", () => {
  isZooming = true;
  suppressMapTapUntil = Date.now() + MAP_TAP_SUPPRESS_AFTER_ZOOM_MS;
});

map.on("zoomend", () => {
  isZooming = false;
  suppressMapTapUntil = Date.now() + MAP_TAP_SUPPRESS_AFTER_ZOOM_MS;
  if (tactileSessionCardLatLng) {
    positionTactileSessionCard(tactileSessionCardLatLng);
  }
});

map.on("move", () => {
  if (tactileSessionCardLatLng) {
    positionTactileSessionCard(tactileSessionCardLatLng);
  }
});

// ユーザーが地図に触れたら、復帰直後の自動中央追従抑止を解除する。
map.on("dragstart zoomstart", () => {
  suppressAutoCenterAfterReturn = false;
});

window.addEventListener("pagehide", () => {
  saveMapReturnCache();
});

// 地図タップ時の小さなポップアップに表示する文言（言語別）
const MAP_TAP_POPUP_TEXT = {
  ja: { lat: "緯度", lng: "経度", postRoad: "→ 道情報の投稿" },
  en: { lat: "Lat", lng: "Lng", postRoad: "→ Post road info" },
  hi: { lat: "अक्षांश", lng: "देशांतर", postRoad: "→ सड़क जानकारी पोस्ट" },
};

function getMapTapPopupText() {
  const language = getCurrentLanguage();
  return MAP_TAP_POPUP_TEXT[language] || MAP_TAP_POPUP_TEXT.ja;
}

// 地図タップ時：直接画面遷移せず、緯度経度と「道情報の投稿」ボタンを持つ
// 小さなポップアップを開く。ボタン押下で /post_road/Index.html へ遷移する。
map.on("click", (event) => {
  if (shouldIgnoreMapTap(event)) {
    return;
  }

  const lat = Number(event?.latlng?.lat);
  const lng = Number(event?.latlng?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return;
  }

  const text = getMapTapPopupText();
  const html = `
    <div class="map-tap-popup">
      <div class="map-tap-popup-coords">
        <div>${escapeHtml(text.lat)}: ${lat.toFixed(6)}</div>
        <div>${escapeHtml(text.lng)}: ${lng.toFixed(6)}</div>
      </div>
      <button
        type="button"
        class="map-tap-popup-btn"
        data-map-tap-post-road
        data-lat="${lat}"
        data-lng="${lng}"
      >${escapeHtml(text.postRoad)}</button>
    </div>
  `;

  L.popup({ closeOnClick: true, autoClose: true, autoPan: false })
    .setLatLng([lat, lng])
    .setContent(html)
    .openOn(map);
});

// ポップアップ内の「道情報の投稿」ボタン押下を委譲で受け取る。
document.addEventListener("click", (e) => {
  const target = e && e.target && typeof e.target.closest === "function"
    ? e.target.closest("[data-map-tap-post-road]")
    : null;
  if (!target) return;
  const lat = target.getAttribute("data-lat");
  const lng = target.getAttribute("data-lng");
  if (!lat || !lng) return;
  const params = new URLSearchParams({ lat, lng });
  saveMapReturnCache();
  window.location.assign(AppPath.toApp(`/post_road/Index.html?${params.toString()}`));
});

initMapControlsPanelGesture();
initSystemUiInsetSync();
window.addEventListener("pageshow", () => {
  scheduleSystemUiInsetStabilize();
  refreshMapDisplaySettings();
  applyMapInfoVisibility();
});

// UUID v4 生成関数
// 記録セッションの管理と軌跡生成に使う内部ユーティリティ群。
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

async function loadCurrentUserId() {
  try {
    const res = await authFetch("/auth/me", { cache: "no-store" });
    if (res.status === 401 || res.status === 403) {
      logMapEvent("map_auth_required", {
        category: "auth",
        level: "warn",
        path: "/auth/me",
        method: "GET",
        status: res.status,
        message: "Map bootstrap detected unauthorized session",
      });
      clearAccessToken();
      window.location.replace(AppPath.toApp("/auth/login.html"));
      throw new Error("unauthorized");
    }
    if (!res.ok) {
      logMapEvent("map_user_id_load_deferred", {
        category: "auth",
        level: "warn",
        path: "/auth/me",
        method: "GET",
        status: res.status,
        message: "Map bootstrap could not confirm user id, continuing without it",
      });
      currentUserId = null;
      return;
    }
    const payload = await res.json();
    const userId = payload && payload.user ? Number(payload.user.userId) : NaN;
    if (!Number.isFinite(userId) || userId <= 0) {
      clearAccessToken();
      window.location.replace(AppPath.toApp("/auth/login.html"));
      throw new Error("invalid_user");
    }
    currentUserId = userId;
  } catch (error) {
    const isTemporaryError = window.AuthToken && typeof window.AuthToken.isTemporaryError === "function"
      ? window.AuthToken.isTemporaryError(error)
      : false;
    if (isTemporaryError) {
      logMapEvent("map_user_id_load_deferred", {
        category: "auth",
        level: "warn",
        path: "/auth/me",
        method: "GET",
        message: error && error.message ? String(error.message) : "temporary auth error",
      });
      currentUserId = null;
      return;
    }
    throw error;
  }
}

async function requireOsmConnectionBeforeMapUse() {
  // OSM edits use the StepBy-managed account on the server.
  // Individual users authenticate to StepBy with Google only.
  return true;
}

function updateRecordButton() {
  if (recordActionBtn) {
    recordActionBtn.setAttribute("aria-pressed", recordEnabled ? "true" : "false");
    recordActionBtn.classList.toggle("is-recording", recordEnabled);
    const startLabel = recordActionBtn.dataset.startLabel || "記録";
    const stopLabel = recordActionBtn.dataset.stopLabel || "記録終了";
    const currentLabel = recordEnabled ? stopLabel : startLabel;
    recordActionBtn.setAttribute("aria-label", currentLabel);
    if (recordActionTextEl) {
      recordActionTextEl.textContent = currentLabel;
    }
  }
  if (recordActionIconEl) {
    recordActionIconEl.classList.toggle("record-action-icon-circle", !recordEnabled);
    recordActionIconEl.classList.toggle("record-action-icon-square", recordEnabled);
  }
  if (pauseActionBtn) {
    pauseActionBtn.disabled = !recordEnabled;
    pauseActionBtn.setAttribute("aria-disabled", recordEnabled ? "false" : "true");
    pauseActionBtn.setAttribute("aria-pressed", recordPaused ? "true" : "false");
    const pauseLabel = pauseActionBtn.dataset.pauseLabel || "一時停止";
    const resumeLabel = pauseActionBtn.dataset.resumeLabel || "記録再開";
    const nextLabel = recordPaused ? resumeLabel : pauseLabel;
    pauseActionBtn.setAttribute("aria-label", nextLabel);
    if (pauseActionTextEl) {
      pauseActionTextEl.textContent = nextLabel;
    }
  }
  if (pauseActionIconEl) {
    pauseActionIconEl.classList.toggle("play-icon", recordPaused);
    if (recordPaused) {
      pauseActionIconEl.innerHTML = '<span class="play-triangle"></span>';
    } else {
      pauseActionIconEl.innerHTML = '<span class="pause-bar"></span><span class="pause-bar"></span>';
    }
  }
}

function isRecordingActive() {
  return Boolean(recordEnabled && !recordPaused && currentSessionId);
}

function getTraceSourcePoints(snappedPoints, rawPoints) {
  const sourcePoints = snappedPoints.length >= 2 ? snappedPoints : rawPoints;
  return sourcePoints.filter(
    (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng)
  );
}

function getCurrentSessionTracePoints() {
  return getTraceSourcePoints(currentSessionSnappedPoints, currentSessionRawPoints);
}

function getAllRecordingTracePoints() {
  return getTraceSourcePoints(recordedSnappedPoints, recordedRawPoints);
}

function clearCurrentSessionPoints() {
  currentSessionRawPoints = [];
  currentSessionSnappedPoints = [];
  currentSessionRawStartIndex = recordedRawPoints.length;
  currentSessionSnappedStartIndex = recordedSnappedPoints.length;
}

function rollbackCurrentSessionPointsFromRecording() {
  recordedRawPoints = recordedRawPoints.slice(0, currentSessionRawStartIndex);
  recordedSnappedPoints = recordedSnappedPoints.slice(0, currentSessionSnappedStartIndex);
  clearCurrentSessionPoints();
}

// 記録状態を localStorage に永続化する。post_road 等の他画面が記録継続のために参照する。
const RECORDING_STATE_KEY = "recordingState.v1";
function saveRecordingStateToStorage() {
  try {
    if (recordEnabled && currentSessionId) {
      localStorage.setItem(RECORDING_STATE_KEY, JSON.stringify({
        recordEnabled: true,
        recordPaused: Boolean(recordPaused),
        currentSessionId,
        savedAt: Date.now(),
      }));
    } else {
      localStorage.removeItem(RECORDING_STATE_KEY);
    }
  } catch (e) {}
}

function resetRecordingState() {
  recordEnabled = false;
  recordPaused = false;
  currentSessionId = null;
  currentSessionStartedAt = null;
  recordedRawPoints = [];
  recordedSnappedPoints = [];
  clearCurrentSessionPoints();
  recordingSessionIds = [];
  saveRecordingStateToStorage();
}

function markTrailDotsAsIdle() {
  trail.forEach((dot) => {
    dot.setStyle({ color: "#111", fillColor: "#111" });
  });
}

function appendUniquePoint(points, lat, lng) {
  const last = points[points.length - 1];
  if (!last || last.lat !== lat || last.lng !== lng) {
    points.push({ lat, lng });
  }
}

async function startRecordingSession() {
  currentSessionId = generateUUID();
  currentSessionStartedAt = new Date().toISOString();
  clearCurrentSessionPoints();
  recordingSessionIds.push(currentSessionId);
  await postSessionLifecycle("start", {
    sessionId: currentSessionId,
    startedAt: currentSessionStartedAt,
  });
  console.log(`[Record] Started recording session=${currentSessionId}`);
  saveRecordingStateToStorage();
}

async function cancelRecordingSessions(sessionIds) {
  const uniqueSessionIds = [...new Set(sessionIds.filter(Boolean))];
  for (const sessionId of uniqueSessionIds) {
    try {
      await postSessionLifecycle("cancel", { sessionId });
    } catch (err) {
      console.error(`[Record] Failed to cancel session=${sessionId}:`, err);
    }
  }
}

function postSessionLifecycle(action, payload) {
  return authFetch(`/api/session/${action}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then((res) => {
      if (!res.ok) {
        throw new Error(`session ${action} failed: ${res.status}`);
      }
      return res.json();
    })
    .catch((err) => {
      console.error(`[Session] ${action} error:`, err);
    });
}

function extractTraceCoordinates(data, rawShape) {
  if (data && Array.isArray(data.edges) && data.edges.length > 0) {
    let allCoords = [];
    data.edges.forEach((edge) => {
      if (!edge || !edge.shape) {
        return;
      }
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
    if (allCoords.length > 1) {
      return allCoords;
    }
  }

  if (data && data.shape) {
    const decoded = decodePolyline(data.shape, 6);
    if (decoded.length > 1) {
      return decoded;
    }
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
  const requestBody = {
    shape,
    costing: "pedestrian",
    shape_match: "map_snap",
  };
  if (persist && sessionId) {
    requestBody.sessionId = sessionId;
    requestBody.source = "valhalla";
  }

  return authFetch("/api/trace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
  }).then((res) => {
    if (!res.ok) {
      throw new Error(`trace failed: ${res.status}`);
    }
    return res.json();
  });
}

function requestBrowserTraceData(osmPreview, sessionId, rawPoints) {
  const coordinates = osmPreview.segments.flatMap((segment, segmentIndex) =>
    segment.coordinates.slice(segmentIndex > 0 ? 1 : 0).map(([lng, lat]) => ({ lat, lon: lng })));
  return authFetch("/api/trace", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      source: "browser",
      route_confirmed: osmPreview.routeConfirmed === true,
      raw_points: (rawPoints || []).map((point) => ({
        lat: Number(point.lat),
        lon: Number(point.lng),
        accuracy: Number.isFinite(Number(point.accuracy)) ? Number(point.accuracy) : null,
      })),
      matched_points: coordinates,
      matched_samples: (osmPreview.matchedSamples || []).map((sample) => ({
        lat: Number(sample.lat),
        lon: Number(sample.lon),
        way_id: Number(sample.wayId),
        confidence: Number.isFinite(Number(sample.distance)) ? 1 / (1 + Math.max(0, Number(sample.distance))) : null,
      })),
      way_segments: osmPreview.segments.map((segment) => ({
        way_id: segment.wayId,
        way_version: segment.wayVersion,
        node_ids: segment.nodes,
        full_coordinates: segment.fullCoordinates,
        segment_from: segment.from,
        segment_to: segment.to,
        original_tags: segment.tags || {},
        relations: segment.relations || [],
        side: segment.side || null,
        planned_tags: isIndependentOsmWalkway(segment)
          ? { tactile_paving: "yes" }
          : { [`sidewalk:${segment.side}:tactile_paving`]: "yes" },
      })),
      edges: osmPreview.segments.map((segment) => ({ way_id: segment.wayId })),
    }),
  }).then(async (res) => {
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(payload.error || `browser trace failed: ${res.status}`);
    return payload;
  });
}

// trace_attributesでフィッティングしてマップに表示
function processAndDisplayTrace(sessionId = null, sourcePoints = null, osmPreview = null) {
  const tracePoints = Array.isArray(sourcePoints) && sourcePoints.length > 0
    ? sourcePoints
    : getAllRecordingTracePoints();
  if (tracePoints.length < 2) {
    console.log("[processAndDisplayTrace] Not enough points:", tracePoints.length);
    alert("記録されたポイントが少なすぎます（最低2点必要）");
    return Promise.resolve(null);
  }

  const shape = tracePoints.map((p) => ({ lat: p.lat, lon: p.lng }));
  const traceRequest = sessionId && osmPreview
    ? requestBrowserTraceData(osmPreview, sessionId, tracePoints)
    : requestTraceData(shape, { sessionId, persist: Boolean(sessionId) });
  return traceRequest
    .then((data) => {
      const coords = extractTraceCoordinates(data, shape);
      displayTraceLine(coords);
      return { data, coords };
    })
    .catch((err) => {
      console.error("[processAndDisplayTrace] Error:", err);
      alert(`トレース処理に失敗しました: ${err.message}`);
      return null;
    });
}

// 黄緑の線を表示
function displayTraceLine(coordinates) {
  // 前回の線を削除
  if (tracePolyline) {
    map.removeLayer(tracePolyline);
    tracePolyline = null;
  }
  
  if (coordinates.length > 1) {
    tracePolyline = L.polyline(coordinates, {
      color: "#9acd32",  // 黄緑色
      weight: 4,
      opacity: 0.8,
    }).addTo(map);
    console.log(`[displayTraceLine] Displayed trace with ${coordinates.length} points`);
  }
}

function normalizeTactileTags(rawTags) {
  return (Array.isArray(rawTags) ? rawTags : [])
    .map((tag, index) => {
      if (!tag || typeof tag !== "object") {
        return null;
      }
      const idNum = Number(tag.id ?? tag.tagId ?? tag.tag_id);
      const id = Number.isInteger(idNum) && idNum > 0 ? idNum : null;
      const code = String(tag.code ?? tag.tagCode ?? tag.tag_code ?? `tag_${index}`).trim();
      const label = String(tag.labelJa ?? tag.label_ja ?? tag.label ?? "").trim();
      if (!id || !code || !label) {
        return null;
      }
      return {
        id, code, label,
        osmExportable: Boolean(tag.osmExportable ?? tag.osm_exportable),
        displayColor: String(tag.displayColor ?? tag.display_color ?? "red"),
        systemDefined: Boolean(tag.systemDefined ?? tag.system_defined),
      };
    })
    .filter(Boolean);
}

function parseIsProStatus(payload) {
  if (!payload || typeof payload !== "object") {
    return null;
  }
  if (typeof payload.isPro === "boolean") {
    return payload.isPro;
  }
  if (typeof payload.is_pro === "boolean") {
    return payload.is_pro;
  }
  if (payload.data && typeof payload.data === "object") {
    if (typeof payload.data.isPro === "boolean") {
      return payload.data.isPro;
    }
    if (typeof payload.data.is_pro === "boolean") {
      return payload.data.is_pro;
    }
  }
  return null;
}

async function loadCurrentUserProStatus() {
  isCurrentUserPro = false;
  try {
    const res = await authFetch("/api/pro-status", { cache: "no-store" });
    if (!res.ok) {
      return;
    }
    const payload = await res.json().catch(() => null);
    const parsed = parseIsProStatus(payload);
    if (typeof parsed === "boolean") {
      isCurrentUserPro = parsed;
    }
  } catch {
    isCurrentUserPro = false;
  }
  document.documentElement.classList.toggle("is-pro-mode", isCurrentUserPro);
  const badge = document.getElementById("map-pro-badge");
  if (badge) badge.hidden = !isCurrentUserPro;
}

function getSelectedTraceTags() {
  return traceTagOptions.filter((tag) => selectedTraceTagIds.has(tag.id));
}

function isCurrentRecordingOsmEligible() {
  return !isCurrentUserPro || getSelectedTraceTags().some((tag) => tag.osmExportable);
}

function setTraceTagError(message) {
  if (!traceTagErrorEl) {
    return;
  }
  const text = String(message || "").trim();
  traceTagErrorEl.textContent = text;
  traceTagErrorEl.classList.toggle("hidden", !text);
}

function getVisibleTraceTags() {
  const query = traceTagSearchEl ? traceTagSearchEl.value.trim().toLowerCase() : "";
  if (!query) {
    return traceTagOptions.slice();
  }
  return traceTagOptions.filter((tag) => tag.label.toLowerCase().includes(query));
}

function renderTraceTagSelected() {
  if (!traceTagSelectedEl) {
    return;
  }
  const text = getTraceTagText();
  const selectedTags = traceTagOptions.filter((tag) => selectedTraceTagIds.has(tag.id));
  if (selectedTags.length === 0) {
    traceTagSelectedEl.innerHTML = `<div class="trace-tag-selected-empty">${escapeHtml(text.noSelection)}</div>`;
    return;
  }
  traceTagSelectedEl.innerHTML = selectedTags
    .map((tag) => `<button type="button" class="trace-tag-item" data-remove-tag-id="${tag.id}">${escapeHtml(tag.label)} ×</button>`)
    .join("");
}

function renderTraceTagList() {
  if (!traceTagListEl) {
    return;
  }
  const text = getTraceTagText();
  const visibleTags = getVisibleTraceTags();
  if (visibleTags.length === 0) {
    traceTagListEl.innerHTML = `<div class="trace-tag-list-empty">${escapeHtml(text.noMatch)}</div>`;
    return;
  }
  traceTagListEl.innerHTML = visibleTags
    .map((tag) => `<button type="button" class="trace-tag-option" data-tag-id="${tag.id}">${escapeHtml(tag.label)} <small>${escapeHtml(tag.osmExportable ? text.publicScope : text.privateScope)}</small></button>`)
    .join("");
}

function renderTraceTagUi() {
  renderTraceTagSelected();
  renderTraceTagList();
}

async function fetchTactileTags() {
  const res = await authFetch("/api/tactile-tags?activeOnly=1", { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`tactile_tags_fetch_failed:${res.status}`);
  }
  const payload = await res.json().catch(() => ({}));
  traceTagOptions = normalizeTactileTags(payload && payload.tags);
}

function buildTagCode(labelJa) {
  const base = String(labelJa || "")
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  const seed = Date.now().toString(36);
  return `user_${base || "tag"}_${seed}`.slice(0, 64);
}

async function createTactileTag(labelJa) {
  const body = {
    code: buildTagCode(labelJa),
    labelJa,
    sortOrder: 0,
    isActive: true,
  };
  const res = await authFetch("/api/tactile-tags", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    throw new Error(`create_tactile_tag_failed:${res.status}`);
  }
  const payload = await res.json().catch(() => ({}));
  const normalized = normalizeTactileTags(payload && payload.tag ? [payload.tag] : []);
  if (normalized.length === 0) {
    throw new Error("invalid_created_tactile_tag");
  }
  const tag = normalized[0];
  const existingIndex = traceTagOptions.findIndex((item) => item.id === tag.id);
  if (existingIndex >= 0) {
    traceTagOptions[existingIndex] = tag;
  } else {
    traceTagOptions.push(tag);
  }
  selectedTraceTagIds.add(tag.id);
}

function initTraceTagUiEvents() {
  if (traceTagSearchEl) {
    traceTagSearchEl.addEventListener("input", () => {
      setTraceTagError("");
      renderTraceTagList();
    });
    traceTagSearchEl.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") {
        return;
      }
      event.preventDefault();
      const raw = traceTagSearchEl.value.trim();
      if (!raw) {
        return;
      }
      const existing = traceTagOptions.find((tag) => tag.label === raw);
      if (existing) {
        selectedTraceTagIds.add(existing.id);
        traceTagSearchEl.value = "";
        setTraceTagError("");
        renderTraceTagUi();
        return;
      }
      try {
        await createTactileTag(raw);
        traceTagSearchEl.value = "";
        setTraceTagError("");
        renderTraceTagUi();
      } catch (err) {
        console.warn("[trace_confirm] create tactile tag failed:", err);
        setTraceTagError(getTraceTagText().addTagFailed);
      }
    });
  }

  if (traceTagListEl) {
    traceTagListEl.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest("[data-tag-id]") : null;
      if (!target) {
        return;
      }
      const tagId = Number(target.getAttribute("data-tag-id"));
      if (!Number.isInteger(tagId)) {
        return;
      }
      if (selectedTraceTagIds.has(tagId)) {
        selectedTraceTagIds.delete(tagId);
      } else {
        selectedTraceTagIds.add(tagId);
      }
      setTraceTagError("");
      renderTraceTagUi();
    });
  }

  if (traceTagSelectedEl) {
    traceTagSelectedEl.addEventListener("click", (event) => {
      const target = event.target instanceof HTMLElement ? event.target.closest("[data-remove-tag-id]") : null;
      if (!target) {
        return;
      }
      const tagId = Number(target.getAttribute("data-remove-tag-id"));
      if (!Number.isInteger(tagId)) {
        return;
      }
      selectedTraceTagIds.delete(tagId);
      setTraceTagError("");
      renderTraceTagUi();
    });
  }
}

async function prepareTraceTagModal() {
  if (!traceTagPanelEl) {
    return;
  }
  selectedTraceTagIds.clear();
  setTraceTagError("");
  if (traceTagSearchEl) {
    traceTagSearchEl.value = "";
  }
  if (!isCurrentUserPro) {
    traceTagPanelEl.classList.add("hidden");
    if (traceMemoPanelEl) {
      traceMemoPanelEl.classList.add("hidden");
    }
    if (traceMemoInputEl) {
      traceMemoInputEl.value = "";
    }
    return;
  }
  traceTagPanelEl.classList.remove("hidden");
  if (traceMemoPanelEl) {
    traceMemoPanelEl.classList.remove("hidden");
  }
  if (traceMemoInputEl) {
    traceMemoInputEl.value = "";
  }
  try {
    await Promise.race([
      fetchTactileTags(),
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("tactile_tags_fetch_timeout")), 10000);
      }),
    ]);
    renderTraceTagUi();
  } catch (err) {
    console.error("[trace_confirm] tactile tags fetch failed:", err);
    traceTagOptions = [];
    renderTraceTagUi();
    setTraceTagError(getTraceTagText().loadFailed || "タグを読み込めませんでした。キャンセルして、もう一度お試しください。");
  }
}

async function saveSessionTags(sessionIds, fixedTagIds = null) {
  const uniqueSessionIds = [...new Set((sessionIds || []).filter(Boolean))];
  const selectedTags = Array.isArray(fixedTagIds)
    ? [...new Set(fixedTagIds.map(Number).filter(Number.isFinite))].map((id) => ({ id }))
    : traceTagOptions.filter((tag) => selectedTraceTagIds.has(tag.id));
  for (const sessionId of uniqueSessionIds) {
    for (const tag of selectedTags) {
      const res = await authFetch("/api/session-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, tagId: tag.id }),
      });
      if (!res.ok) {
        const error = new Error(`session_tag_save_failed:${res.status}`);
        error.retryable = res.status >= 500 || res.status === 408 || res.status === 429;
        throw error;
      }
    }
  }
}

async function saveSessionMemo(sessionIds, memo) {
  const uniqueSessionIds = [...new Set((sessionIds || []).filter(Boolean))];
  for (const sessionId of uniqueSessionIds) {
    const res = await authFetch("/api/session/memo", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sessionId,
        memo,
      }),
    });
    if (!res.ok) {
      throw new Error(`session_memo_save_failed:${res.status}`);
    }
  }
}

function closeTraceConfirmModal() {
  if (traceConfirmModalEl) {
    traceConfirmModalEl.classList.add("hidden");
  }
  if (traceConfirmPathLayer && traceConfirmMap) {
    traceConfirmMap.removeLayer(traceConfirmPathLayer);
    traceConfirmPathLayer = null;
  }
  if (traceConfirmMap) {
    traceConfirmMap.remove();
    traceConfirmMap = null;
  }
  traceConfirmModalEl?.classList.remove("is-preparing");
}

function showTraceConfirmPreparing() {
  if (!traceConfirmModalEl) return;
  closeTraceConfirmModal();
  if (traceConfirmTitleEl) traceConfirmTitleEl.textContent = "経路を確認しています…";
  traceConfirmOkBtn.disabled = true;
  traceConfirmCancelBtn.disabled = true;
  traceConfirmModalEl.classList.add("is-preparing");
  traceConfirmModalEl.classList.remove("hidden");
}

function isIndependentOsmWalkway(segment) {
  const tags = segment && segment.tags || {};
  return ["footway", "path", "pedestrian", "steps", "corridor"].includes(String(tags.highway || "").toLowerCase()) ||
    String(tags.footway || "").toLowerCase() === "sidewalk";
}

async function saveOsmSplitDraft(osmPreview, recordId) {
  const response = await authFetch("/api/osm/split-plan", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      summary: "StepByによる点字ブロック記録",
      segments: osmPreview.segments.map((segment) => ({
        wayId: segment.wayId,
        wayVersion: segment.wayVersion,
        tags: segment.tags,
        nodes: segment.nodes,
        fullCoordinates: segment.fullCoordinates,
        relations: segment.relations || [],
        side: segment.side || null,
        from: segment.from,
        to: segment.to,
      })),
      recordId,
      clientContext: { ui: "UI11", previewOnly: false, osmWriteRequested: false, authorization: "administrator_review_required", automaticDraft: true },
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || `HTTP ${response.status}`);
    error.code = result.error || `HTTP_${response.status}`;
    error.status = response.status;
    error.retryable = response.status >= 500 || response.status === 408 || response.status === 429;
    throw error;
  }
  return result;
}

function openTraceConfirmModal(coordinates, osmPreview = null) {
  return new Promise((resolve) => {
    if (!traceConfirmModalEl || !traceConfirmMapEl || !traceConfirmOkBtn || !traceConfirmCancelBtn) {
      resolve("cancel");
      return;
    }

    const setupAndBind = async () => {
      // 通信を伴うPROタグ取得より先に確認画面を表示する。タグAPIが遅延しても、
      // 記録停止後に画面が何も出ず、記録ボタンだけが無効に見える状態にしない。
      traceConfirmModalEl.classList.remove("hidden");
      traceConfirmModalEl.classList.remove("is-preparing");
      if (traceConfirmTitleEl) traceConfirmTitleEl.textContent = "この経路で保存しますか";
      traceConfirmCancelBtn.disabled = false;
      traceConfirmMap = L.map(traceConfirmMapEl, { zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(traceConfirmMap);

      traceConfirmPathLayer = L.polyline(coordinates, {
        color: "#68747d",
        weight: 4,
        opacity: 0.65,
      }).addTo(traceConfirmMap);
      traceConfirmMap.fitBounds(traceConfirmPathLayer.getBounds(), { padding: [20, 20] });

      const cleanupAndResolve = (result) => {
        traceConfirmOkBtn.removeEventListener("click", onOk);
        traceConfirmCancelBtn.removeEventListener("click", onCancel);
        closeTraceConfirmModal();
        resolve(result);
      };

      const onOk = () => {
        if (traceConfirmOkBtn.disabled) {
          return;
        }
        if (isCurrentUserPro && selectedTraceTagIds.size === 0) {
          setTraceTagError(getTraceTagText().requiredForPro);
          return;
        }
        setTraceTagError("");
        const osmEligible = isCurrentRecordingOsmEligible();
        cleanupAndResolve({ action: "ok", osmEligible });
      };
      const onCancel = () => cleanupAndResolve({ action: "cancel" });

      traceConfirmOkBtn.addEventListener("click", onOk);
      traceConfirmCancelBtn.addEventListener("click", onCancel);

      // PROモードではタグの読み込み完了まで保存を待つ。キャンセル操作は常に可能。
      traceConfirmOkBtn.disabled = Boolean(isCurrentUserPro);
      try {
        await prepareTraceTagModal();
      } finally {
        traceConfirmOkBtn.disabled = false;
      }

      setTimeout(() => {
        if (traceConfirmMap) {
          traceConfirmMap.invalidateSize();
        }
      }, 0);
    };

    setupAndBind().catch((err) => {
      console.error("[trace_confirm] modal setup failed:", err);
      closeTraceConfirmModal();
      resolve("cancel");
    });
  });
}

async function persistCurrentSessionWithoutConfirmation(osmPreview = null) {
  if (!currentSessionId) {
    return { success: true, skipped: true };
  }
  const sessionId = currentSessionId;
  const tracePoints = getCurrentSessionTracePoints();
  if (tracePoints.length < 2) {
    await postSessionLifecycle("cancel", { sessionId });
    rollbackCurrentSessionPointsFromRecording();
    return { success: true, canceled: true };
  }

  const persisted = await processAndDisplayTrace(sessionId, tracePoints, osmPreview);
  if (!persisted) {
    await postSessionLifecycle("cancel", { sessionId });
    rollbackCurrentSessionPointsFromRecording();
    return { success: false };
  }
  await postSessionLifecycle("end", {
    sessionId,
    endedAt: new Date().toISOString(),
  });
  return { success: true, ended: true };
}

async function processQueuedRecording(payload, context) {
  if (Number.isFinite(Number(payload.ownerUserId))) {
    if (!Number.isFinite(Number(currentUserId))) {
      const error = new Error("record_owner_not_loaded");
      error.retryable = true;
      throw error;
    }
    if (Number(payload.ownerUserId) !== Number(currentUserId)) {
      const error = new Error("record_owner_changed");
      error.retryable = false;
      throw error;
    }
  }
  const completed = new Set(context.job.completedStages || []);
  const runStage = async (name, operation) => {
    if (completed.has(name)) return;
    await operation();
    completed.add(name);
    await context.checkpoint(name);
  };
  await runStage("session_started", async () => {
    const response = await authFetch("/api/session/start", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: payload.sessionId, startedAt: payload.startedAt }),
    });
    if (!response.ok) throw new Error(`queued_session_start_failed:${response.status}`);
  });
  await runStage("trace_saved", async () => {
    await requestBrowserTraceData(payload.osmPreview, payload.sessionId, payload.rawPoints);
  });
  await runStage("session_ended", async () => {
    const response = await authFetch("/api/session/end", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sessionId: payload.sessionId, endedAt: payload.endedAt }),
    });
    if (!response.ok) throw new Error(`queued_session_end_failed:${response.status}`);
  });
  if (payload.isPro) {
    await runStage("memo_saved", () => saveSessionMemo(payload.sessionIds, payload.memo || ""));
    await runStage("tags_saved", () => saveSessionTags(payload.sessionIds, payload.tagIds || []));
  }
  if (payload.osmEligible) {
    try {
      await runStage("osm_draft_saved", () => saveOsmSplitDraft(payload.osmPreview, payload.sessionId));
    } catch (error) {
      const safeSkipReasons = new Set([
        "non_walkway_way_not_eligible",
        "tactile_no_to_yes_required",
        "tactile_tag_already_present",
        "record_is_stepby_only",
      ]);
      if (!safeSkipReasons.has(String(error && (error.code || error.message)))) throw error;
      payload.osmPublicationSkipped = true;
      payload.osmPublicationSkipReason = String(error.code || error.message);
      completed.add("osm_draft_skipped_safely");
      await context.checkpoint("osm_draft_skipped_safely");
      return;
    }
    await runStage("osm_review_queued", async () => {});
  } else {
    await runStage("osm_draft_skipped_stepby_only", async () => {});
  }
}

function refreshVisibleMapDataAfterOsmChange() {
  loadAndShowAllRecords(map.getCenter());
  if (shouldShowOsmTactile()) {
    loadAndShowOsmTactileWays(lastOsmDisplayDownloadCenter || map.getCenter());
  }
}

function initRecordUploadQueue() {
  if (!window.StepByRecordQueue) return;
  recordUploadQueue = new window.StepByRecordQueue.RecordQueue({
    handler: processQueuedRecording,
    onChange(event) {
      if (event.type === "queued" || event.type === "sending") {
        showMapToast("記録を保存しています…", 2400);
      } else if (event.type === "completed") {
        showMapToast("記録しました。", 2800);
      } else if (event.type === "retry") {
        showMapToast("通信が不安定です。記録は端末に保存されています。", 4400);
      } else if (event.type === "blocked") {
        showMapToast("記録は端末に保存されています。", 4000);
      }
    },
  });
  window.addEventListener("online", () => void recordUploadQueue.flush());
  window.addEventListener("pageshow", () => void recordUploadQueue.flush());
  void recordUploadQueue.flush();
}

async function processQueuedOsmRevert(payload, context) {
  const completed = new Set(context.job.completedStages || []);
  if (!completed.has("osm_reverted")) {
    const response = await authFetch(`/api/osm/records/${encodeURIComponent(payload.recordId)}/revert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorization: "owned_green_line_delete" }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(result.error || `osm_revert_failed:${response.status}`);
      error.retryable = response.status >= 500 || response.status === 408 || response.status === 429;
      throw error;
    }
    await context.checkpoint("osm_reverted");
  }
  if (!completed.has("osm_network_refreshed") && browserOsmMatcher && typeof browserOsmMatcher.refreshAfterOsmChange === "function") {
    await browserOsmMatcher.refreshAfterOsmChange([]);
    await context.checkpoint("osm_network_refreshed");
  }
}

function initOsmRevertQueue() {
  if (!window.StepByRecordQueue) return;
  osmRevertQueue = new window.StepByRecordQueue.RecordQueue({
    storage: window.StepByRecordQueue.createIndexedDbStorage("stepby-ui11-osm-revert-queue-v1", "jobs"),
    handler: processQueuedOsmRevert,
    onChange(event) {
      if (event.type === "queued" || event.type === "sending") {
        showMapToast("削除しています…", 2400);
      } else if (event.type === "completed") {
        showMapToast("削除しました。", 2800);
        refreshVisibleMapDataAfterOsmChange();
      } else if (event.type === "retry") {
        showMapToast("通信が不安定です。削除はあとで自動的に続けます。", 4400);
      } else if (event.type === "blocked") {
        showMapToast("削除できませんでした。もう一度お試しください。", 4000);
      }
    },
  });
  window.addEventListener("online", () => void osmRevertQueue.flush());
  window.addEventListener("pageshow", () => void osmRevertQueue.flush());
  void osmRevertQueue.flush();
}

async function handleRecordStopWithConfirmation() {
  const activeSessionId = currentSessionId;
  const allSessionIds = [...recordingSessionIds];
  if (activeSessionId && !allSessionIds.includes(activeSessionId)) {
    allSessionIds.push(activeSessionId);
  }

  const allTracePoints = getAllRecordingTracePoints();
  if (allTracePoints.length < 2) {
    alert("記録されたポイントが少なすぎます（最低2点必要）");
    await cancelRecordingSessions(allSessionIds);
    if (tracePolyline) {
      map.removeLayer(tracePolyline);
      tracePolyline = null;
    }
    return;
  }

  // OSM取得と経路確定の開始時点で表示し、処理中の無反応状態をなくす。
  showTraceConfirmPreparing();

  let osmPreview = null;
  if (browserOsmMatcher) {
    try {
      // 軌跡の開始・途中・終了をすべて道路網で覆ってから経路を確定する。
      // 保存直前はブラウザ・サーバー双方のキャッシュを使わず、最新のOSM Wayで確定する。
      // 別端末や管理処理による直前のOSM変更を、古いWayとして送信しないため。
      await Promise.race([
        browserOsmMatcher.ensureTraceCoverage(allTracePoints, 450, { force: true }),
        new Promise((_, reject) => {
          window.setTimeout(() => reject(new Error("trace_coverage_timeout")), 12000);
        }),
      ]);
    } catch (error) {
      console.warn("[BrowserMatcher] trace network refresh failed; cached network will be used", error);
    }
    const browserRoute = browserOsmMatcher.finalize(allTracePoints);
    if (browserRoute) {
      osmPreview = window.StepByOsmMatcher.buildOsmChangePreview(browserRoute);
      console.log("[BrowserMatcher] connected final route", {
        wayIds: browserRoute.wayIds,
        startWayId: browserRoute.start.wayId,
        startFraction: browserRoute.start.fraction,
        endWayId: browserRoute.end.wayId,
        endFraction: browserRoute.end.fraction,
      });
    } else {
      console.warn("[BrowserMatcher] could not build a connected final route");
    }
  }

  if (!osmPreview) {
    closeTraceConfirmModal();
    alert("ブラウザ側でOSM Way上の連続した経路を確定できませんでした。記録は保存されていません。");
    await cancelRecordingSessions(allSessionIds);
    return;
  }
  const previewCoords = osmPreview.segments.flatMap((segment, index) =>
    segment.coordinates.slice(index > 0 ? 1 : 0).map(([lng, lat]) => [lat, lng]));
  if (!Array.isArray(previewCoords) || previewCoords.length < 2) {
    closeTraceConfirmModal();
    alert("保存確認用の経路を生成できませんでした。");
    await cancelRecordingSessions(allSessionIds);
    return;
  }

  const decision = await openTraceConfirmModal(previewCoords, osmPreview);
  if (decision && decision.action === "ok") {
    if (!recordUploadQueue || !activeSessionId) {
      alert("端末内の送信待ちキューを利用できないため、記録を確定できませんでした。");
      return;
    }
    const payload = {
      id: `record:${activeSessionId}`,
      sessionId: activeSessionId,
      sessionIds: allSessionIds,
      startedAt: currentSessionStartedAt || new Date().toISOString(),
      endedAt: new Date().toISOString(),
      rawPoints: allTracePoints.map((point) => ({ lat: point.lat, lng: point.lng, accuracy: point.accuracy == null ? null : point.accuracy })),
      ownerUserId: currentUserId,
      osmPreview,
      isPro: Boolean(isCurrentUserPro),
      memo: traceMemoInputEl ? traceMemoInputEl.value : "",
      tagIds: Array.from(selectedTraceTagIds),
      osmEligible: Boolean(decision.osmEligible),
    };
    try {
      await recordUploadQueue.enqueue(payload);
    } catch (error) {
      console.error("[RecordQueue] enqueue failed", error);
      alert("端末に記録を保管できませんでした。空き容量を確認して、もう一度確定してください。");
      return;
    }
    displayTraceLine(previewCoords);
    return;
  }

  await cancelRecordingSessions(allSessionIds);
  if (tracePolyline) {
    map.removeLayer(tracePolyline);
    tracePolyline = null;
  }
}

function setComparisonStatus(label, state) {
  if (!comparisonStatusEl) return;
  comparisonStatusEl.textContent = label;
  comparisonStatusEl.dataset.state = state;
}

function removeComparisonLayer(layer) {
  if (layer && map.hasLayer(layer)) map.removeLayer(layer);
}

function renderFittingComparison(raw, valhalla, browser, durations) {
  removeComparisonLayer(comparisonRawMarker);
  removeComparisonLayer(comparisonValhallaMarker);
  removeComparisonLayer(comparisonBrowserMarker);
  removeComparisonLayer(comparisonValhallaLine);
  removeComparisonLayer(comparisonBrowserLine);
  removeComparisonLayer(comparisonDifferenceLine);
  comparisonRawMarker = L.circleMarker([raw.lat, raw.lng], { radius: 6, color: "#fff", weight: 2, fillColor: "#68747d", fillOpacity: 1 }).addTo(map);
  comparisonValhallaMarker = valhalla ? L.circleMarker([valhalla.lat, valhalla.lng], { radius: 7, color: "#fff", weight: 2, fillColor: "#2474d2", fillOpacity: .9 }).addTo(map) : null;
  comparisonBrowserMarker = browser ? L.circleMarker([browser.lat, browser.lng], { radius: 4, color: "#fff", weight: 1, fillColor: "#1b9b68", fillOpacity: 1 }).addTo(map) : null;
  comparisonValhallaLine = valhalla ? L.polyline([[raw.lat, raw.lng], [valhalla.lat, valhalla.lng]], { color: "#2474d2", weight: 5, opacity: .9 }).addTo(map) : null;
  comparisonBrowserLine = browser ? L.polyline([[raw.lat, raw.lng], [browser.lat, browser.lng]], { color: "#1b9b68", weight: 5, opacity: .9 }).addTo(map) : null;
  comparisonDifferenceLine = valhalla && browser ? L.polyline([[valhalla.lat, valhalla.lng], [browser.lat, browser.lng]], { color: "#d84b43", weight: 3, dashArray: "7 6", opacity: .95 }).addTo(map) : null;
  const resultDistance = valhalla && browser && window.StepByOsmMatcher
    ? window.StepByOsmMatcher.distanceMeters({ lat: valhalla.lat, lng: valhalla.lng }, { lat: browser.lat, lng: browser.lng }) : null;
  if (comparisonValhallaWayEl) comparisonValhallaWayEl.textContent = valhalla && valhalla.wayId ? String(valhalla.wayId) : "取得不可";
  if (comparisonBrowserWayEl) comparisonBrowserWayEl.textContent = browser && browser.wayId ? String(browser.wayId) : "取得不可";
  if (comparisonDistanceEl) comparisonDistanceEl.textContent = Number.isFinite(resultDistance) ? `${resultDistance.toFixed(2)} m` : "—";
  if (comparisonPriorityEl) comparisonPriorityEl.textContent = browser ? `${browser.priority === "pedestrian" ? "歩道優先" : "道路"}・${browser.connectedToPrevious === false ? "非連続" : "連続"}` : "—";
  if (comparisonDurationEl) comparisonDurationEl.textContent = `V ${durations.valhalla} ms / B ${durations.browser} ms`;
  setComparisonStatus(valhalla && browser ? "比較完了" : "一部取得失敗", valhalla && browser ? "success" : "error");
  return resultDistance;
}

async function saveFittingComparison(payload) {
  if (comparisonSaveStatusEl) comparisonSaveStatusEl.textContent = "保存中…";
  try {
    const response = await authFetch("/api/fitting-comparisons", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!response.ok) throw new Error(`history save failed with status ${response.status}`);
    const result = await response.json();
    if (comparisonSaveStatusEl) comparisonSaveStatusEl.textContent = `保存済み #${result.id}`;
  } catch (error) {
    if (comparisonSaveStatusEl) comparisonSaveStatusEl.textContent = "保存失敗";
    console.error("[FittingComparison] history save failed", error);
  }
}

// 一般利用の現在地フィッティングはブラウザ版だけで完結する。
function requestSnappedLocation(latitude, longitude, accuracy = null) {
  if (!currentUserId) {
    setComparisonStatus("ログイン待ち", "waiting");
    return;
  }
  console.log(`[requestSnappedLocation] Browser fitting: lat=${latitude}, lng=${longitude}`);
  const browserStartedAt = performance.now();
  const browserPromise = browserOsmMatcher
    ? browserOsmMatcher.match(latitude, longitude).then((match) => ({ match, duration: Math.round(performance.now() - browserStartedAt), error: null })).catch((error) => ({ match: null, duration: Math.round(performance.now() - browserStartedAt), error }))
    : Promise.resolve({ match: null, duration: 0, error: new Error("browser matcher unavailable") });
  return browserPromise
    .then((browserResult) => {
      const browser = browserResult.match;
      if (browser) {
        updateDisplay(latitude, longitude, browser.lat, browser.lng);
        lastSent = { latitude: browser.lat, longitude: browser.lng };
      } else {
        // 一時的にフィッティングできなくても、直前のフィッティング済みピンを維持する。
        updateDisplay(latitude, longitude, latitude, longitude, true);
      }
      return browser;
    })
    .catch((error) => {
      console.error('[requestSnappedLocation] Browser fitting error:', error);
      updateDisplay(latitude, longitude, latitude, longitude, true);
      return null;
    });
}

if (comparisonTestButtonEl) {
  comparisonTestButtonEl.addEventListener("click", async () => {
    comparisonTestButtonEl.disabled = true;
    try {
      map.setView([35.681236, 139.767125], 19, { animate: false });
      await requestSnappedLocation(35.681236, 139.767125, null, { compareValhalla: true });
    } finally {
      comparisonTestButtonEl.disabled = false;
    }
  });
}

if (osmPreviewTestButtonEl) {
  osmPreviewTestButtonEl.addEventListener("click", async () => {
    if (!browserOsmMatcher || !window.StepByOsmMatcher) {
      if (comparisonSaveStatusEl) comparisonSaveStatusEl.textContent = "プレビュー失敗：ブラウザ版マッチャー未読込";
      return;
    }
    osmPreviewTestButtonEl.disabled = true;
    osmPreviewTestButtonEl.textContent = "プレビュー生成中…";
    try {
      await browserOsmMatcher.ensureNetwork(35.681236, 139.767125);
      const testWay = (browserOsmMatcher.network || []).find((way) =>
        way.priority !== "pedestrian" && Array.isArray(way.coordinates) && way.coordinates.length >= 2);
      if (!testWay) throw new Error("左右判定の試験に使える道路Wayが見つかりませんでした");
      const [aLng, aLat] = testWay.coordinates[0];
      const [bLng, bLat] = testWay.coordinates[1];
      const length = Math.hypot(bLng - aLng, bLat - aLat) || 1;
      const leftOffsetDegrees = 3 / 111320;
      const pointAt = (fraction) => ({
        lat: aLat + (bLat - aLat) * fraction + ((bLng - aLng) / length) * leftOffsetDegrees,
        lng: aLng + (bLng - aLng) * fraction - ((bLat - aLat) / length) * leftOffsetDegrees,
      });
      const points = [pointAt(0.2), pointAt(0.5), pointAt(0.8)];
      const route = {
        ways: [testWay],
        rawPoints: points,
        start: { wayId: testWay.id, segmentIndex: 0, fraction: 0.2, lat: aLat + (bLat - aLat) * 0.2, lng: aLng + (bLng - aLng) * 0.2 },
        end: { wayId: testWay.id, segmentIndex: 0, fraction: 0.8, lat: aLat + (bLat - aLat) * 0.8, lng: aLng + (bLng - aLng) * 0.8 },
      };
      const preview = window.StepByOsmMatcher.buildOsmChangePreview(route);
      if (!preview) throw new Error("道路Wayの変更予定を作成できませんでした");
      const previewCoordinates = preview.segments.flatMap((segment) =>
        segment.coordinates.map(([lng, lat]) => [lat, lng]));
      await openTraceConfirmModal(previewCoordinates, preview);
    } catch (error) {
      if (comparisonSaveStatusEl) comparisonSaveStatusEl.textContent = `プレビュー失敗：${error.message}`;
      alert(`OSM dry-runプレビューを生成できませんでした: ${error.message}`);
    } finally {
      osmPreviewTestButtonEl.disabled = false;
      osmPreviewTestButtonEl.textContent = "東京駅付近でOSM dry-runプレビュー";
    }
  });
}

async function openLatestFittingDetails() {
  if (!fittingDetailModalEl || !fittingDetailBodyEl) return;
  fittingDetailModalEl.classList.remove("hidden");
  fittingDetailBodyEl.innerHTML = "<p>最新記録を読み込み中…</p>";
  try {
    const response = await authFetch("/api/fitting-details/latest", { cache: "no-store" });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `HTTP ${response.status}`);
    const osm = result.osm || { status: "not_created" };
    const statusLabels = {
      not_created: "変更案なし",
      draft: "dry-run変更案あり",
      merged: "OSM送信済み",
      revert_draft: "取消変更案あり（未送信）",
      reverted: "取消済み",
      failed: "送信失敗",
      conflict: "競合のため停止",
    };
    const osmStatus = statusLabels[osm.status] || osm.status;
    const osmIds = [
      osm.mergePlanId ? `<span><strong>変更案ID：</strong>${escapeHtml(osm.mergePlanId)}</span>` : "",
      osm.mergeChangesetId ? `<span><strong>送信changeset：</strong>${escapeHtml(osm.mergeChangesetId)}</span>` : "",
      osm.revertPlanId ? `<span><strong>取消案ID：</strong>${escapeHtml(osm.revertPlanId)}</span>` : "",
      osm.revertChangesetId ? `<span><strong>取消changeset：</strong>${escapeHtml(osm.revertChangesetId)}</span>` : "",
    ].filter(Boolean).join("<br>");
    const revertButton = osm.status === "merged"
      ? `<button type="button" class="fitting-detail-revert-button" data-record-id="${escapeHtml(result.session.session_id)}">この記録の取消変更案を作る</button>`
      : "";
    const rows = result.points.map((p) => `<tr><td>${p.n}</td><td>${Number(p.raw_lat).toFixed(7)}, ${Number(p.raw_lng).toFixed(7)}</td><td>${p.matched_lat == null ? "—" : `${Number(p.matched_lat).toFixed(7)}, ${Number(p.matched_lng).toFixed(7)}`}</td><td>${p.accuracy == null ? "未取得" : `${Number(p.accuracy).toFixed(1)} m`}</td><td>${p.distance_m == null ? "—" : `${Number(p.distance_m).toFixed(2)} m`}</td><td>${p.way_id || "—"}</td></tr>`).join("");
    fittingDetailBodyEl.innerHTML = `<section class="fitting-detail-osm-status" data-status="${escapeHtml(osm.status)}"><strong>OSM状態：</strong>${escapeHtml(osmStatus)}${osmIds ? `<br>${osmIds}` : ""}${revertButton}</section><p><strong>セッション：</strong>${escapeHtml(result.session.session_id)}<br><strong>GPS点：</strong>${result.points.length}点</p><div class="fitting-detail-table-wrap"><table><thead><tr><th>#</th><th>GPS生座標</th><th>フィッティング後</th><th>accuracy</th><th>移動距離</th><th>Way ID</th></tr></thead><tbody>${rows}</tbody></table></div>`;
    const revertButtonEl = fittingDetailBodyEl.querySelector(".fitting-detail-revert-button");
    if (revertButtonEl) {
      revertButtonEl.addEventListener("click", async () => {
        revertButtonEl.disabled = true;
        revertButtonEl.textContent = "取消変更案を作成中…";
        try {
          const revertResponse = await authFetch(`/api/osm/records/${encodeURIComponent(revertButtonEl.dataset.recordId)}/revert-plan`, { method: "POST" });
          const revertResult = await revertResponse.json();
          if (!revertResponse.ok) throw new Error(revertResult.error || `HTTP ${revertResponse.status}`);
          await openLatestFittingDetails();
        } catch (revertError) {
          revertButtonEl.disabled = false;
          revertButtonEl.textContent = `作成失敗：${revertError.message}`;
        }
      });
    }
  } catch (error) {
    fittingDetailBodyEl.innerHTML = `<p>読込み失敗：${error.message}</p>`;
  }
}
if (fittingDetailButtonEl) fittingDetailButtonEl.addEventListener("click", openLatestFittingDetails);
if (fittingDetailCloseEl) fittingDetailCloseEl.addEventListener("click", () => fittingDetailModalEl.classList.add("hidden"));

function handleNewLocation(latitude, longitude, accuracy = null) {
  // 位置情報を変数に保存するだけ（書き込み）
  latestLocation = { lat: latitude, lng: longitude, accuracy: Number.isFinite(accuracy) ? accuracy : null };
  saveLastKnownLocation(latitude, longitude);
  // 初回だけ生座標を仮表示する。以後のGPS通知では直前のフィッティング済み
  // 座標を維持し、生座標と道路上を往復してピンがちらつく状態を防ぐ。
  if (!marker) {
    updateCurrentLocationMarker(latitude, longitude);
  }
  if (browserOsmMatcher && Date.now() - lastNetworkPrefetchAt >= 5000) {
    lastNetworkPrefetchAt = Date.now();
    browserOsmMatcher.prefetchForLocation(latitude, longitude).catch((error) => {
      console.warn("[BrowserMatcher] moving network prefetch deferred:", error && error.message ? error.message : error);
    });
  }
  const currentPoint = { lat: latitude, lng: longitude };
  const movedFromMapDataCenter = !lastMapDataDownloadCenter || (
    window.StepByOsmMatcher &&
    window.StepByOsmMatcher.distanceMeters(lastMapDataDownloadCenter, currentPoint) >= MAP_DATA_REFRESH_DISTANCE_METERS
  );
  if (movedFromMapDataCenter) {
    lastMapDataDownloadCenter = currentPoint;
    if (shouldShowAppTactile()) loadAndShowAllRecords(currentPoint);
    if (shouldShowRoadInfo()) loadAndShowRoadInfoPoints(currentPoint);
  }
  const movedFromOsmDisplayCenter = !lastOsmDisplayDownloadCenter || (
    window.StepByOsmMatcher &&
    window.StepByOsmMatcher.distanceMeters(lastOsmDisplayDownloadCenter, currentPoint) >= OSM_DISPLAY_REFRESH_DISTANCE_METERS
  );
  if (movedFromOsmDisplayCenter && shouldShowOsmTactile()) {
    lastOsmDisplayDownloadCenter = currentPoint;
    loadAndShowOsmTactileWays(currentPoint);
  }
}

function pollAndSendLocation() {
  if (!latestLocation) return;

  const { lat, lng, accuracy } = latestLocation;

  // 記録アクティブ時はrawデータをメモリへ保存（全体 + 現在セッション）
  if (isRecordingActive()) {
    recordedRawPoints.push({ lat, lng, accuracy });
    currentSessionRawPoints.push({ lat, lng, accuracy });
    console.log(`[Record] Saved raw point: total=${recordedRawPoints.length}, current=${currentSessionRawPoints.length}`);
  }

  // サーバーへ送信（読み取り）
  requestSnappedLocation(lat, lng, accuracy);
}

function updateTimestamp() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  const currentStamp = `${hh}:${mm}:${ss}`;
  const hasChanged = lastGpsUpdateStamp !== currentStamp;
  lastGpsUpdateStamp = currentStamp;
  if (lastUpdatedEl) {
    lastUpdatedEl.textContent = `Last update: ${currentStamp}`;
  }
  if (hasChanged && gpsIndicatorEl) {
    gpsIndicatorEl.classList.add("is-blinking");
    if (gpsBlinkTimer !== null) {
      clearTimeout(gpsBlinkTimer);
    }
    gpsBlinkTimer = setTimeout(() => {
      gpsIndicatorEl.classList.remove("is-blinking");
      gpsBlinkTimer = null;
    }, GPS_BLINK_DURATION_MS);
  }
}

function isCenterCurrentEnabled() {
  // DOM上の現在値を都度参照して、内部状態とのズレを防ぐ
  return toggleCenterCurrentBtn ? toggleCenterCurrentBtn.checked : true;
}

function recenterToLatestLocation() {
  if (!isCenterCurrentEnabled() || suppressAutoCenterAfterReturn) {
    return;
  }
  const currentZoom = map.getZoom();
  if (latestSnappedLocation) {
    map.setView([latestSnappedLocation.lat, latestSnappedLocation.lng], currentZoom, { animate: false });
    return;
  }
  if (marker) {
    const pos = marker.getLatLng();
    if (pos && Number.isFinite(pos.lat) && Number.isFinite(pos.lng)) {
      map.setView([pos.lat, pos.lng], currentZoom, { animate: false });
      return;
    }
  }
  if (latestLocation && Number.isFinite(latestLocation.lat) && Number.isFinite(latestLocation.lng)) {
    map.setView([latestLocation.lat, latestLocation.lng], currentZoom, { animate: false });
  }
}

function updateDisplay(rawLat, rawLng, snappedLat, snappedLng, skipMarker = false) {
  console.log(`[updateDisplay] Updating display: raw=(${rawLat}, ${rawLng}), snapped=(${snappedLat}, ${snappedLng})`);
  
  // 座標の妥当性チェック
  if (!Number.isFinite(snappedLat) || !Number.isFinite(snappedLng)) {
    console.error('[updateDisplay] Invalid snapped coordinates:', snappedLat, snappedLng);
    return;
  }
  
  // 地図の再描画に合わせて時刻を更新
  updateTimestamp();

  if (coordsEl) {
    coordsEl.textContent = `Lat: ${snappedLat.toFixed(6)}, Lng: ${snappedLng.toFixed(6)}`;
  }
  if (rawCoordsEl) {
    rawCoordsEl.textContent = `Raw: ${rawLat.toFixed(6)}, ${rawLng.toFixed(6)}`;
  }
  latestSnappedLocation = { lat: snappedLat, lng: snappedLng };
  if (isRecordingActive()) {
    appendUniquePoint(recordedSnappedPoints, snappedLat, snappedLng);
    appendUniquePoint(currentSessionSnappedPoints, snappedLat, snappedLng);
    console.log(
      `[Record] Saved snapped point: total=${recordedSnappedPoints.length}, current=${currentSessionSnappedPoints.length}`
    );
  }

  // 「現在地の中央表示」がONのときのみ地図の表示位置を更新
  if (isCenterCurrentEnabled() && !suppressAutoCenterAfterReturn) {
    const currentZoom = map.getZoom();
    console.log(`[updateDisplay] Moving map to (${snappedLat}, ${snappedLng}) with zoom ${currentZoom}`);
    map.setView([snappedLat, snappedLng], currentZoom, { animate: false });
  }

  if (skipMarker) return;
  
  updateCurrentLocationMarker(snappedLat, snappedLng);

  // 記録中のみ軌跡のドットを表示する。記録していないときは現在地の黒い点を出さず、
  // 残っている古い軌跡があれば消去する。
  if (isRecordingActive()) {
    const dot = L.circleMarker([snappedLat, snappedLng], {
      radius: 3,
      color: "#9acd32",
      fillColor: "#9acd32",
      fillOpacity: 0.7,
      weight: 0,
    }).addTo(map);
    trail.push(dot);
    if (trail.length > MAX_TRAIL) {
      map.removeLayer(trail.shift());
    }
  } else if (trail.length > 0) {
    while (trail.length > 0) {
      const old = trail.shift();
      if (old) {
        map.removeLayer(old);
      }
    }
  }
  
  console.log('[updateDisplay] Display update complete');
}

// session_pathsを取得して表示
// 地図上に重ねる各種データレイヤーの取得と再描画を担当する。
function loadAndShowAllRecords(centerOverride = null) {
  refreshMapDisplaySettings();
  const requestSeq = ++recordsLoadRequestSeq;
  setRecordsLoadingVisible(true);
  console.log("[loadAndShowAllRecords] Fetching all session paths...");
  const center = centerOverride || map.getCenter();
  const params = new URLSearchParams({
    centerLat: center.lat.toString(),
    centerLng: center.lng.toString(),
    radiusKm: String(OSM_DISPLAY_RADIUS_KM),
  });
  if (shouldShowOnlyMyTactile()) {
    params.set("mine", "1");
  }
  authFetch(`/api/records?${params.toString()}`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`records fetch failed: ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      if (requestSeq !== recordsLoadRequestSeq || !shouldShowAppTactile()) {
        return;
      }
      console.log(`[loadAndShowAllRecords] Loaded ${data.count} paths`);
      if (data.success && Array.isArray(data.paths)) {
        const visiblePaths = getVisibleTactilePaths(data.paths);
        cachedVisibleSessionPaths = cloneSerializable(visiblePaths) || [];
        saveMapReturnCache();
        showAllSessionPathsOnMap(visiblePaths, { preFiltered: true });
      }
    })
    .catch((err) => {
      if (requestSeq !== recordsLoadRequestSeq) {
        return;
      }
      console.error("[loadAndShowAllRecords] Error:", err);
      alert("軌跡データの取得に失敗しました。");
    })
    .finally(() => {
      if (requestSeq === recordsLoadRequestSeq) {
        setRecordsLoadingVisible(false);
      }
    });
}

// session_pathsの全軌跡を地図上に表示
function showAllSessionPathsOnMap(paths, { preFiltered = false } = {}) {
  clearAllRecordsFromMap();
  hideTactileSessionCard();
  const visiblePaths = preFiltered ? paths : getVisibleTactilePaths(paths);

  console.log(`[showAllSessionPathsOnMap] Showing ${visiblePaths.length}/${paths.length} paths`);

  visiblePaths.forEach((path) => {
    let geom;
    try {
      geom = typeof path.geom_geojson === "string"
        ? JSON.parse(path.geom_geojson)
        : path.geom_geojson;
    } catch (err) {
      console.warn("[showAllSessionPathsOnMap] invalid geom_geojson:", err);
      return;
    }
    if (!geom || geom.type !== "LineString" || !Array.isArray(geom.coordinates)) {
      return;
    }

    const coordinates = geom.coordinates
      .map(([lng, lat]) => [lat, lng])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (coordinates.length < 2) {
      return;
    }

    const recordColor = path.record_class === "pro_private" ? "#d92d20" : "#00b050";
    const polyline = L.polyline(coordinates, {
      color: recordColor,
      weight: 4,
      opacity: 0.85,
      interactive: false,
    }).addTo(map);
    polyline.options.stepByBaseColor = recordColor;
    // OSM送信済みの記録はOSM表示レイヤーだけでクリックを受け、保存経路との
    // 二重判定（わずかな位置差）を避ける。
    const osmManaged = path.osm_status === "merged" || path.osm_status === "revert_draft";
    const hitPolyline = osmManaged ? null : L.polyline(coordinates, {
      color: recordColor,
      // 従来の透明な12px判定に対して4倍。見た目は4pxのままにする。
      weight: 48,
      opacity: 0,
      bubblingMouseEvents: false,
    }).addTo(map);
    const sessionId = typeof path.session_id === "string" ? path.session_id : "";
    if (sessionId && hitPolyline) {
      hitPolyline.on("click", (event) => {
        L.DomEvent.stop(event);
        setActiveTactileSessionPolyline(polyline);
        const ownerUserId = Number(path && path.user_id);
        renderTactileSessionCard(
          buildTactileSessionCardHtml(sessionId, null, { loading: true, ownerUserId }),
          event.latlng
        );

        fetchTactileSessionInfo(sessionId)
          .then((sessionInfo) => {
            renderTactileSessionCard(
              buildTactileSessionCardHtml(sessionId, sessionInfo, { ownerUserId }),
              event.latlng
            );
          })
          .catch((err) => {
            const text = getTactileSessionText();
            const message = err && err.message === "session_not_found"
              ? text.notFound
              : text.fetchFailed;
            renderTactileSessionCard(
              buildTactileSessionCardHtml(sessionId, null, { error: message, ownerUserId }),
              event.latlng
            );
          });
      });
    }
    allRecordsMarkers.push(polyline);
    if (hitPolyline) allRecordsMarkers.push(hitPolyline);
  });

  console.log(`[showAllSessionPathsOnMap] Displayed ${allRecordsMarkers.length} polylines`);
}

// 全レコードを地図から削除
function clearAllRecordsFromMap() {
  console.log(`[clearAllRecordsFromMap] Removing ${allRecordsMarkers.length} displayed paths`);
  activeTactileSessionPolyline = null;
  allRecordsMarkers.forEach((marker) => {
    map.removeLayer(marker);
  });
  allRecordsMarkers = [];
}

// アプリ点字ブロック取得中に中央ローディングを表示する。
function setRecordsLoadingVisible(visible) {
  if (!recordsLoadingOverlayEl) {
    return;
  }
  if (visible) {
    recordsLoadingOverlayEl.classList.remove("hidden");
    return;
  }
  recordsLoadingOverlayEl.classList.add("hidden");
}

function loadAndShowOsmTactileWays(centerOverride = null) {
  // トグルONの最新リクエストだけを有効にするための採番。
  const requestSeq = ++osmTactileLoadRequestSeq;
  setOsmLoadingVisible(true);
  console.log("[loadAndShowOsmTactileWays] Fetching tactile ways from OSM...");
  const center = centerOverride || map.getCenter();
  const params = new URLSearchParams({
    centerLat: center.lat.toString(),
    centerLng: center.lng.toString(),
    radiusKm: "1",
  });
  fetchOsmTactileDisplay(center.lat, center.lng, OSM_DISPLAY_RADIUS_KM)
    .then((data) => {
      if (requestSeq !== osmTactileLoadRequestSeq || !shouldShowOsmTactile()) {
        return;
      }
      if (!data || !Array.isArray(data.features)) {
        throw new Error("invalid osm tactile payload");
      }
      console.log(`[loadAndShowOsmTactileWays] Loaded ${data.features.length} ways`);
      cachedOsmFeatures = cloneSerializable(data.features) || [];
      saveMapReturnCache();
      showOsmTactileWaysOnMap(data.features);
    })
    .catch((err) => {
      if (requestSeq !== osmTactileLoadRequestSeq) {
        return;
      }
      console.error("[loadAndShowOsmTactileWays] Error:", err);
      alert("OSM点字ブロックデータの取得に失敗しました。しばらく待ってから再度お試しください。");
      clearOsmTactileWaysFromMap();
    })
    .finally(() => {
      if (requestSeq === osmTactileLoadRequestSeq) {
        setOsmLoadingVisible(false);
      }
    });
}

function overpassTactileFeature(element) {
  const tags = element && element.tags && typeof element.tags === "object" ? element.tags : {};
  const stepbyRecorded = Object.entries(tags).some(([key, value]) => /stepby/i.test(`${key}:${value}`));
  const properties = {
    osm_type: element.type,
    matched_tag_key: "tactile_paving",
    matched_tag_value: tags.tactile_paving || "",
    osm_changeset_id: element.changeset == null ? null : Number(element.changeset),
    stepby_recorded: stepbyRecorded,
  };
  if (element.type === "way" && Array.isArray(element.geometry)) {
    const coordinates = element.geometry.map((point) => [Number(point.lon), Number(point.lat)])
      .filter(([lng, lat]) => Number.isFinite(lng) && Number.isFinite(lat));
    return coordinates.length >= 2 ? { type: "Feature", properties: { ...properties, osm_way_id: element.id }, geometry: { type: "LineString", coordinates } } : null;
  }
  if (element.type === "node" && Number.isFinite(Number(element.lat)) && Number.isFinite(Number(element.lon))) {
    return { type: "Feature", properties: { ...properties, osm_node_id: element.id }, geometry: { type: "Point", coordinates: [Number(element.lon), Number(element.lat)] } };
  }
  return null;
}

async function fetchOsmTactileDisplay(centerLat, centerLng, radiusKm) {
  const radiusMeters = radiusKm * 1000;
  const latDelta = radiusMeters / 111320;
  const lngDelta = radiusMeters / (111320 * Math.max(0.2, Math.cos(centerLat * Math.PI / 180)));
  const bbox = [centerLat - latDelta, centerLng - lngDelta, centerLat + latDelta, centerLng + lngDelta]
    .map((value) => value.toFixed(7)).join(",");
  const query = `[out:json][timeout:30];(way["tactile_paving"~"^(yes|both|contrasted)$"](${bbox});node["tactile_paving"~"^(yes|both|contrasted)$"](${bbox}););out meta geom;`;
  // クラウドIPがOverpassの混雑制限を受ける場合に備え、APIプロキシと端末からの
  // 読取専用リクエストを並行し、最初に成功した結果を採用する。
  const hosts = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter",
  ];
  const params = new URLSearchParams({ centerLat: String(centerLat), centerLng: String(centerLng), radiusKm: String(radiusKm) });
  const apiAttempt = (async () => {
      // 10km検索はOverpass混雑時に複数の読取先を順番に試すため、API側の
      // フォールバックが完了する時間を確保する。個々のブラウザ直読は30秒で打ち切る。
      const apiResponse = await authFetch(`/api/osm-tactile-ways?${params}`, { signal: AbortSignal.timeout(100000) });
      if (!apiResponse.ok) throw new Error(`api_status_${apiResponse.status}`);
      return apiResponse.json();
    })();
  try {
    // StepBy記録ID・投稿者・本人だけの削除権限を付与できるサーバー応答を優先する。
    const apiResult = await apiAttempt;
    if (apiResult && Array.isArray(apiResult.features)) return apiResult;
  } catch (error) {
    console.warn("[OSM tactile display] StepBy API unavailable; using read-only Overpass fallback", error && error.message);
  }
  const attempts = hosts.map(async (endpoint) => {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8" },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(30000),
      });
      if (!response.ok) throw new Error(`overpass_status_${response.status}`);
      const payload = await response.json();
      const features = (Array.isArray(payload.elements) ? payload.elements : [])
        .map(overpassTactileFeature).filter(Boolean);
      return { success: true, features, count: features.length, source: "browser_overpass" };
    });
  try {
    const nonEmptyAttempts = attempts.map((attempt) => attempt.then((result) => {
      if (!result || !Array.isArray(result.features) || result.features.length === 0) throw new Error("empty_osm_tactile_result");
      return result;
    }));
    try {
      return await Promise.any(nonEmptyAttempts);
    } catch {
      const settled = await Promise.allSettled(attempts);
      const emptySuccess = settled.find((result) => result.status === "fulfilled" && result.value && Array.isArray(result.value.features));
      if (emptySuccess) return emptySuccess.value;
      throw new Error("all_osm_tactile_reads_failed");
    }
  } catch (error) {
    console.warn("[OSM tactile display] all read endpoints failed", error && error.message);
    throw new Error("all_overpass_hosts_failed");
  }
}

async function requestOwnedOsmRevert(recordId, button) {
  const text = getTactileSessionText();
  if (!window.confirm(text.deleteOsmConfirm)) return;
  if (!osmRevertQueue) {
    showMapToast("削除処理を開始できませんでした。ページを再読み込みしてください。", 4200);
    return;
  }
  if (button instanceof HTMLButtonElement) button.disabled = true;
  try {
    await osmRevertQueue.enqueue({ id: `osm-revert:${recordId}`, recordId });
    hideTactileSessionCard();
  } catch (error) {
    if (button instanceof HTMLButtonElement) button.disabled = false;
    showMapToast("削除要求を端末に保存できませんでした。", 4200);
  }
}

function bindStepByOsmRecordCard(layer, feature, displayPolyline) {
  const properties = feature && feature.properties || {};
  const recordId = String(properties.stepby_record_id || properties.stepby_owned_record_id || "");
  const ownerUserId = Number(properties.stepby_owner_user_id);
  if (!properties.stepby_recorded || !recordId) return;
  layer.on("click", (event) => {
    if (event.originalEvent) L.DomEvent.stop(event.originalEvent);
    setActiveTactileSessionPolyline(displayPolyline);
    renderTactileSessionCard(
      buildTactileSessionCardHtml(recordId, null, { loading: true, ownerUserId }),
      event.latlng
    );
    fetchTactileSessionInfo(recordId)
      .then((sessionInfo) => {
        renderTactileSessionCard(
          buildTactileSessionCardHtml(recordId, sessionInfo, {
            ownerUserId: Number.isFinite(ownerUserId) ? ownerUserId : sessionInfo.ownerUserId,
            osmPublished: true,
            osmRecordId: properties.stepby_can_revert ? recordId : "",
          }),
          event.latlng
        );
      })
      .catch((error) => {
        const text = getTactileSessionText();
        renderTactileSessionCard(
          buildTactileSessionCardHtml(recordId, null, {
            error: error && error.message === "session_not_found" ? text.notFound : text.fetchFailed,
            ownerUserId,
          }),
          event.latlng
        );
      });
  });
}

// Leaflet/SVGでは完全透明な短い線の端が端末によって判定されにくいことがある。
// 太い線に加え、線上の各頂点と区間中央へ円形判定を置くことで、見える線を
// 中心とした同じ幅のタップ領域を確実に作る。
function createCenteredPolylineHitTarget(coordinates, color) {
  const hitLayers = [L.polyline(coordinates, {
    color,
    weight: 48,
    opacity: 0.001,
    lineCap: "round",
    lineJoin: "round",
    bubblingMouseEvents: false,
  })];
  const points = [];
  coordinates.forEach((point, index) => {
    points.push(point);
    if (index === 0) return;
    const previous = coordinates[index - 1];
    points.push([(previous[0] + point[0]) / 2, (previous[1] + point[1]) / 2]);
  });
  points.forEach((point) => {
    hitLayers.push(L.circleMarker(point, {
      radius: 24,
      stroke: false,
      fillColor: color,
      fillOpacity: 0.001,
      bubblingMouseEvents: false,
    }));
  });
  return L.featureGroup(hitLayers).addTo(map);
}

function showOsmTactileWaysOnMap(features) {
  clearOsmTactileWaysFromMap();

  features.forEach((feature) => {
    if (!feature || !feature.geometry || typeof feature.geometry.type !== "string") {
      return;
    }
    if (feature.geometry.type === "LineString") {
      if (!Array.isArray(feature.geometry.coordinates)) {
        return;
      }
      const coordinates = feature.geometry.coordinates
        .map(([lng, lat]) => [lat, lng])
        .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));

      if (coordinates.length < 2) {
        return;
      }

      const osmColor = feature.properties && feature.properties.stepby_recorded ? "#00b050" : "#0066ff";
      const isStepByRecord = Boolean(feature.properties &&
        feature.properties.stepby_recorded &&
        (feature.properties.stepby_record_id || feature.properties.stepby_owned_record_id));
      const polyline = L.polyline(coordinates, {
        color: osmColor,
        weight: 4,
        opacity: 0.9,
        // StepByの緑線は投稿者に関係なく、透明な専用レイヤーで詳細を開く。
        interactive: !isStepByRecord,
      }).addTo(map);
      polyline.options.stepByBaseColor = osmColor;
      osmTactileMarkers.push(polyline);
      if (isStepByRecord) {
        const hitTarget = createCenteredPolylineHitTarget(coordinates, osmColor);
        bindStepByOsmRecordCard(hitTarget, feature, polyline);
        osmTactileMarkers.push(hitTarget);
      }
      return;
    }

    if (feature.geometry.type === "Point") {
      const [lng, lat] = Array.isArray(feature.geometry.coordinates)
        ? feature.geometry.coordinates
        : [NaN, NaN];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const osmColor = feature.properties && feature.properties.stepby_recorded ? "#00b050" : "#0066ff";
      const point = L.circleMarker([lat, lng], {
        radius: 4,
        color: osmColor,
        fillColor: osmColor,
        fillOpacity: 0.95,
        weight: 1,
      }).addTo(map);
      bindStepByOsmRecordCard(point, feature, point);
      osmTactileMarkers.push(point);
    }
  });

  console.log(`[showOsmTactileWaysOnMap] Displayed ${osmTactileMarkers.length} polylines`);
}

function clearOsmTactileWaysFromMap() {
  console.log(`[clearOsmTactileWaysFromMap] Removing ${osmTactileMarkers.length} displayed ways`);
  osmTactileMarkers.forEach((marker) => {
    map.removeLayer(marker);
  });
  osmTactileMarkers = [];
}

// OSM取得中にだけ中央ローディング表示を切り替える。
function setOsmLoadingVisible(visible) {
  if (!osmLoadingOverlayEl) {
    return;
  }
  if (visible) {
    osmLoadingOverlayEl.classList.remove("hidden");
    return;
  }
  osmLoadingOverlayEl.classList.add("hidden");
}

function loadAndShowRoadInfoPoints(centerOverride = null) {
  refreshMapDisplaySettings();
  const requestSeq = ++roadInfoLoadRequestSeq;
  // 地図中心から1kmの道情報ポイントを取得する。
  console.log("[loadAndShowRoadInfoPoints] Fetching road info points...");
  const center = centerOverride || map.getCenter();
  const params = new URLSearchParams({
    centerLat: center.lat.toString(),
    centerLng: center.lng.toString(),
    radiusKm: "1",
  });
  if (shouldShowOnlyMyRoadInfo()) {
    params.set("mine", "1");
  }
  authFetch(`/api/road-info?${params.toString()}`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`road-info fetch failed: ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      if (requestSeq !== roadInfoLoadRequestSeq || !shouldShowRoadInfo()) {
        return;
      }
      if (!data || !Array.isArray(data.points)) {
        throw new Error("invalid road-info payload");
      }
      const visiblePoints = getVisibleRoadInfoPoints(data.points);
      cachedVisibleRoadInfoPoints = cloneSerializable(visiblePoints) || [];
      saveMapReturnCache();
      showRoadInfoPointsOnMap(visiblePoints, { preFiltered: true });
    })
    .catch((err) => {
      if (requestSeq !== roadInfoLoadRequestSeq) {
        return;
      }
      console.error("[loadAndShowRoadInfoPoints] Error:", err);
      alert("道情報データの取得に失敗しました。");
      clearRoadInfoPointsFromMap();
    });
}

function showRoadInfoPointsOnMap(points, { preFiltered = false } = {}) {
  // 既存ピンを消してから最新結果だけを表示する。
  clearRoadInfoPointsFromMap();
  const visiblePoints = preFiltered ? points : getVisibleRoadInfoPoints(points);

  visiblePoints.forEach((point) => {
    const lat = Number(point && point.lat);
    const lng = Number(point && point.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return;
    }

    const pin = L.marker([lat, lng], {
      icon: bluePinIcon,
    }).addTo(map);
    pin.on("click", () => {
      const pointId = Number(point.id);
      if (!Number.isInteger(pointId) || pointId <= 0) {
        return;
      }
      saveMapReturnCache();
      window.location.assign(AppPath.toApp(`/road_info_detail/Index.html?pointId=${pointId}`));
    });
    roadInfoMarkers.push(pin);
  });

  console.log(`[showRoadInfoPointsOnMap] Displayed ${roadInfoMarkers.length}/${points.length} points`);
}

function clearRoadInfoPointsFromMap() {
  // 道情報ピンレイヤーをすべて破棄する。
  console.log(`[clearRoadInfoPointsFromMap] Removing ${roadInfoMarkers.length} points`);
  roadInfoMarkers.forEach((marker) => {
    map.removeLayer(marker);
  });
  roadInfoMarkers = [];
}

function applyMapInfoVisibility() {
  refreshMapDisplaySettings();
  if (!isMapInfoEnabled()) {
    recordsLoadRequestSeq += 1;
    osmTactileLoadRequestSeq += 1;
    roadInfoLoadRequestSeq += 1;
    setRecordsLoadingVisible(false);
    setOsmLoadingVisible(false);
    clearAllRecordsFromMap();
    clearOsmTactileWaysFromMap();
    clearRoadInfoPointsFromMap();
    return;
  }

  // 既にキャッシュがあれば再フェッチせずキャッシュから表示する。
  // 他画面からマップ画面に戻ったときに毎回APIを叩かないようにする目的。
  // キャッシュが無い場合（初回起動・キャッシュ期限切れ等）のみAPIから読み込む。
  if (shouldShowAppTactile()) {
    if (cachedVisibleSessionPaths.length > 0) {
      showAllSessionPathsOnMap(cachedVisibleSessionPaths, { preFiltered: true });
    } else {
      loadAndShowAllRecords();
    }
  } else {
    recordsLoadRequestSeq += 1;
    setRecordsLoadingVisible(false);
    clearAllRecordsFromMap();
  }

  if (shouldShowOsmTactile()) {
    if (cachedOsmFeatures.length > 0) {
      showOsmTactileWaysOnMap(cachedOsmFeatures);
    } else {
      loadAndShowOsmTactileWays();
    }
  } else {
    osmTactileLoadRequestSeq += 1;
    setOsmLoadingVisible(false);
    clearOsmTactileWaysFromMap();
  }

  if (shouldShowRoadInfo()) {
    if (cachedVisibleRoadInfoPoints.length > 0) {
      showRoadInfoPointsOnMap(cachedVisibleRoadInfoPoints, { preFiltered: true });
    } else {
      loadAndShowRoadInfoPoints();
    }
  } else {
    roadInfoLoadRequestSeq += 1;
    clearRoadInfoPointsFromMap();
  }
}

// サーバーから設定を取得
// 依存設定の読込後に、初期レイヤーと現在地追跡を起動する。
function loadConfig() {
  return authFetch("/api/config")
    .then((res) => {
      if (!res.ok) {
        throw new Error("config fetch failed");
      }
      return res.json();
    })
    .then((config) => {
      if (typeof config.clientMinIntervalMs === "number") {
        MIN_REQUEST_INTERVAL_MS = config.clientMinIntervalMs;
        console.log(`[Config] Client min interval set to: ${MIN_REQUEST_INTERVAL_MS}ms`);
      }
    })
    .catch((err) => {
      console.warn("[Config] Failed to load config, using default:", err);
    });
}

initTraceTagUiEvents();
initSafetyConfirmModal();
initRecordUploadQueue();
initOsmRevertQueue();

if ("geolocation" in navigator) {
  const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

  function requestPosition(force = false) {
    // 手動リクエスト用
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleNewLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (err) => {
        console.error("[Geolocation] getCurrentPosition error:", err);
        if (coordsEl) {
          coordsEl.textContent = "Lat: unavailable, Lng: unavailable";
        }
        if (lastUpdatedEl) {
          lastUpdatedEl.textContent = "Last update: error";
        }
      },
      options
    );
  }

  let watchId = null;

  function startWatching() {
    if (watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
    }
    watchId = navigator.geolocation.watchPosition(
      (pos) => {
        // OSから位置情報が届くたびに処理
        handleNewLocation(pos.coords.latitude, pos.coords.longitude, pos.coords.accuracy);
      },
      (err) => {
        console.error("[Geolocation] watchPosition error:", err);
      },
      options
    );
  }

  // 起動時はまずローカルキャッシュの位置を表示し、無ければ従来どおりGPS待ち表示にする。
  const cachedLocation = loadLastKnownLocation();
  const hasCachedLocation = applyCachedLocation(cachedLocation);
  if (!hasCachedLocation) {
    if (coordsEl) {
      coordsEl.textContent = "Lat: locating..., Lng: locating...";
    }
    if (rawCoordsEl) {
      rawCoordsEl.textContent = "Raw: locating..., locating...";
    }
  }

  // 設定を読み込んでから位置情報取得を開始
  loadConfig().then(async () => {
    logMapEvent("map_gps_bootstrap_start", {
      category: "navigation",
      path: window.location.pathname,
      method: "LOAD",
      message: "Starting GPS bootstrap after config load",
    });
    try {
      await loadCurrentUserId();
      await requireOsmConnectionBeforeMapUse();
      await loadCurrentUserProStatus();
    } catch (error) {
      logMapEvent("map_gps_bootstrap_partial", {
        category: "auth",
        level: "warn",
        message: error && error.message ? String(error.message) : "map bootstrap failed before gps start",
      });
      if (error && (error.message === "unauthorized" || error.message === "invalid_user" || error.message === "osm_required")) {
        return;
      }
    }
    // 監視を開始
    startWatching();
    logMapEvent("gps_watch_start", {
      category: "navigation",
      path: window.location.pathname,
      method: "WATCH",
      message: "Geolocation watch started",
    });
    
    // 2秒おきに最新の位置情報を読み取って送信する（ポーリング）
    setInterval(pollAndSendLocation, 2000);

    updateRecordButton();
    applyPersistedHomeToggleState();
    restoreMapReturnCache();
    
    // レコードボタンのイベントハンドラー
    if (recordActionBtn) {
      recordActionBtn.addEventListener("click", async () => {
        if (isHandlingRecordToggle || isHandlingPauseToggle) {
          updateRecordButton();
          return;
        }
        isHandlingRecordToggle = true;
        recordActionBtn.disabled = true;
        if (pauseActionBtn) {
          pauseActionBtn.disabled = true;
        }

        const nextEnabled = !recordEnabled;
        try {
          if (nextEnabled) {
            // レコードON：前回の黄緑線を削除し、新しいセッション開始
            if (tracePolyline) {
              map.removeLayer(tracePolyline);
              tracePolyline = null;
            }
            resetRecordingState();
            recordEnabled = true;
            recordPaused = false;
            saveRecordingStateToStorage();
            await startRecordingSession();
            updateRecordButton();
            console.log(`[Record] Started recording session=${currentSessionId}`);
          } else {
            // レコードOFF：記録開始以降の全セッションをまとめて確認
            recordEnabled = false;
            recordPaused = false;
            saveRecordingStateToStorage();

            updateRecordButton();
            console.log(
              `[Record] Stop requested. totalRaw=${recordedRawPoints.length}, totalSnapped=${recordedSnappedPoints.length}, activeSession=${currentSessionId || "none"}`
            );
            try {
              await handleRecordStopWithConfirmation();
              markTrailDotsAsIdle();
              resetRecordingState();
            } catch (error) {
              // 予期しない通信・地図処理エラーで確認画面を開けなかった場合は、
              // 記録内容を消さず記録中へ戻し、もう一度停止操作を試せるようにする。
              console.error("[Record] Failed to open or finish confirmation:", error);
              closeTraceConfirmModal();
              recordEnabled = true;
              recordPaused = false;
              saveRecordingStateToStorage();
              alert("確認画面を開けませんでした。記録は保持されています。もう一度、記録終了を押してください。");
            }
          }
        } finally {
          isHandlingRecordToggle = false;
          recordActionBtn.disabled = false;
          if (pauseActionBtn) {
            pauseActionBtn.disabled = false;
          }
          updateRecordButton();
        }
      });
    }
    if (pauseActionBtn) {
      pauseActionBtn.addEventListener("click", async () => {
        if (!recordEnabled || isHandlingRecordToggle || isHandlingPauseToggle) {
          return;
        }
        isHandlingPauseToggle = true;
        pauseActionBtn.disabled = true;
        if (recordActionBtn) {
          recordActionBtn.disabled = true;
        }
        try {
          if (!recordPaused) {
            const pausedSessionId = currentSessionId;
            // 表示だけ先に切り替えて、体感遅延をなくす。
            recordPaused = true;
            saveRecordingStateToStorage();
            updateRecordButton();

            const persistResult = await persistCurrentSessionWithoutConfirmation();
            if (!persistResult.success) {
              recordPaused = false;
              saveRecordingStateToStorage();
              updateRecordButton();
              alert("一時停止時の保存に失敗しました。通信状況を確認してもう一度お試しください。");
              return;
            }
            currentSessionId = null;
            currentSessionStartedAt = null;
            clearCurrentSessionPoints();
            markTrailDotsAsIdle();
            console.log(`[Pause] Paused. session=${pausedSessionId || "none"}`);
          } else {
            await startRecordingSession();
            recordPaused = false;
            console.log(`[Pause] Resumed with session=${currentSessionId}`);
          }
        } finally {
          isHandlingPauseToggle = false;
          pauseActionBtn.disabled = false;
          if (recordActionBtn) {
            recordActionBtn.disabled = false;
          }
          updateRecordButton();
        }
      });
    }
    
    bindToggleCards();

    if (toggleShowMapInfoBtn) {
      toggleShowMapInfoBtn.addEventListener("change", () => {
        console.log(`[toggleShowMapInfo] showMapInfo=${toggleShowMapInfoBtn.checked}`);
        saveMapInfoVisibility(toggleShowMapInfoBtn.checked);
        if (toggleShowMapInfoBtn.checked) {
          // ユーザーが明示的にONに切り替えたタイミングは、現在の地図中心位置を基準に
          // 再フェッチさせる（画面遷移復帰時のキャッシュ表示と区別する目的）。
          cachedVisibleSessionPaths = [];
          cachedOsmFeatures = [];
          cachedVisibleRoadInfoPoints = [];
        }
        applyMapInfoVisibility();
        saveMapReturnCache();
      });
    }
    // 初期化中にユーザーが先にトグルを変更した場合でも表示状態を同期する。
    applyMapInfoVisibility();

    // 現在地の中央表示トグル（ログのみ）
    if (toggleCenterCurrentBtn) {
      toggleCenterCurrentBtn.addEventListener("change", () => {
        console.log(`[toggleCenterCurrent] centerCurrentLocation=${toggleCenterCurrentBtn.checked}`);
        saveCenterCurrentEnabled(toggleCenterCurrentBtn.checked);
        // ユーザーが明示的にトグルを切り替えたら、復帰直後の自動中央追従抑止を解除する。
        suppressAutoCenterAfterReturn = false;
        recenterToLatestLocation();
        saveMapReturnCache();
      });
    }
    
  });

} else {
  const cachedLocation = loadLastKnownLocation();
  const hasCachedLocation = applyCachedLocation(cachedLocation);
  if (!hasCachedLocation) {
    if (coordsEl) {
      coordsEl.textContent = "Lat: unavailable, Lng: unavailable";
    }
    if (rawCoordsEl) {
      rawCoordsEl.textContent = "Raw: unavailable, unavailable";
    }
    if (lastUpdatedEl) {
      lastUpdatedEl.textContent = "Last update: --:--:--";
    }
  }
}

// ===== 共通トーストと道情報投稿完了通知 =====
let mapToastTimer = null;
function showMapToast(message, durationMs = 2800) {
  const toastEl = document.getElementById("map-toast");
  if (!toastEl) return;
  const textEl = toastEl.querySelector(".map-toast-text");
  if (textEl) textEl.textContent = String(message || "");
  if (mapToastTimer) clearTimeout(mapToastTimer);
  toastEl.classList.remove("hidden");
  requestAnimationFrame(() => toastEl.classList.add("visible"));
  mapToastTimer = setTimeout(() => {
    toastEl.classList.remove("visible");
    setTimeout(() => toastEl.classList.add("hidden"), 300);
    mapToastTimer = null;
  }, durationMs);
}

// post_road からの遷移直後にトーストを表示する。
// post_road 側で投稿リクエストを keepalive で送信し、sessionStorage にフラグを置く設計。
// 戻るで遷移したときはbfcacheから復元されるためIIFEは再実行されない。pageshow（persistedありなし両方）で毎回チェックする。
function showRoadInfoPostToastIfNeeded() {
  let flag = null;
  try { flag = sessionStorage.getItem("roadInfoPostJustSubmitted.v1"); } catch (e) {}
  if (!flag) return;
  try { sessionStorage.removeItem("roadInfoPostJustSubmitted.v1"); } catch (e) {}
  const lang = getCurrentLanguage();
  const messages = {
    ja: "道情報を受け付けました。保存処理は裏で続けています。",
    en: "Road information queued. Saving continues in the background.",
    hi: "सड़क की जानकारी कतार में है। सहेजना पृष्ठभूमि में जारी है।",
  };
  showMapToast(messages[lang] || messages.ja);
}

window.addEventListener("stepby:road-info-queue", (event) => {
  const status = event && event.detail && event.detail.status;
  if (status === "completed") showMapToast("道情報の保存が完了しました。", 3000);
  if (status === "retry") showMapToast("道情報は端末に保管中です。通信回復後に自動で再送します。", 4200);
});

// 初回ロードと bfcache 復元の両方で動くよう、pageshow と DOMContentLoaded 両方にフックする。
showRoadInfoPostToastIfNeeded();
window.addEventListener("pageshow", () => {
  showRoadInfoPostToastIfNeeded();
});
