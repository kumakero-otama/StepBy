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
const SAFETY_CONFIRM_KEY = "ui2_map_safety_confirmed_v1";

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
  },
  en: {
    noSelection: "None selected",
    noMatch: "No matching tags",
    addTagFailed: "Failed to add tag. Please try again later.",
    requiredForPro: "Please add at least one tag.",
  },
  hi: {
    noSelection: "कोई चयन नहीं",
    noMatch: "कोई मिलते-जुलते टैग नहीं",
    addTagFailed: "टैग जोड़ने में विफल। कृपया बाद में फिर प्रयास करें।",
    requiredForPro: "タグを追加してください",
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

function hasAcceptedSafetyConfirm() {
  try {
    return window.localStorage.getItem(SAFETY_CONFIRM_KEY) === "1";
  } catch {
    return false;
  }
}

function persistSafetyConfirmAcceptance() {
  try {
    window.localStorage.setItem(SAFETY_CONFIRM_KEY, "1");
  } catch {
    // Ignore storage errors and continue for the current session.
  }
}

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

function initSafetyConfirmModal() {
  if (!safetyConfirmModalEl || !safetyConfirmAcceptBtn || !safetyConfirmRejectBtn) {
    return;
  }

  if (hasAcceptedSafetyConfirm()) {
    hideSafetyConfirmModal();
    return;
  }

  showSafetyConfirmModal();

  safetyConfirmAcceptBtn.addEventListener("click", () => {
    persistSafetyConfirmAcceptance();
    hideSafetyConfirmModal();
  });

  safetyConfirmRejectBtn.addEventListener("click", () => {
    const lang = getCurrentLanguage();
    const targetPath = lang === "en"
      ? "/map/exit_notice_en.html"
      : (lang === "hi" ? "/map/exit_notice_hi.html" : "/map/exit_notice.html");
    window.location.replace(AppPath.toApp(targetPath));
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

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

function buildTactileSessionCardHtml(sessionId, sessionInfo, { loading = false, error = "", ownerUserId = null } = {}) {
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
  const memoHtml = memoValue
    ? `
    <div class="tactile-session-card-memo">
      <div class="tactile-session-card-memo-head">
        <div class="tactile-session-card-memo-label">${escapeHtml(text.memo)}</div>
        ${canEditOwnSession ? `
        <button class="tactile-session-card-memo-edit" type="button" data-edit-tactile-memo="${escapeHtml(sessionId)}" aria-label="${escapeHtml(text.memoEdit)}">
          <img src="${memoEditIconUrl}" alt="">
        </button>` : ""}
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
      <button class="tactile-session-card-delete" type="button" data-deactivate-tactile-session="${escapeHtml(sessionId)}">
        <img src="${deleteIconUrl}" alt="">
        <span>${escapeHtml(text.delete)}</span>
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
      color: "#00b050",
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
      color: "#00b050",
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

const redPinIcon = L.icon({
  iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41], // ピンの先端（下部中央）を座標に合わせる
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
let recordedRawPoints = []; // 記録開始から終了までのrawデータ（全セッション合算）
let recordedSnappedPoints = []; // 記録開始から終了までのsnappedデータ（全セッション合算）
let currentSessionRawPoints = []; // 現在セッションのrawデータ
let currentSessionSnappedPoints = []; // 現在セッションのsnappedデータ
let currentSessionRawStartIndex = 0;
let currentSessionSnappedStartIndex = 0;
let recordingSessionIds = []; // 記録開始から終了までに作成したセッションID一覧
let tracePolyline = null; // trace_attributesの結果を表示する黄緑線
let currentSessionId = null;
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
    osmFeatures: cloneSerializable(cachedOsmFeatures) || [],
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
  if (!cached || !cached.mapInfoEnabled) {
    return false;
  }

  if (cached.center && Number.isFinite(cached.center.lat) && Number.isFinite(cached.center.lng)) {
    const nextZoom = Number.isFinite(Number(cached.zoom)) ? Number(cached.zoom) : map.getZoom();
    map.setView([cached.center.lat, cached.center.lng], nextZoom, { animate: false });
  }

  cachedVisibleSessionPaths = Array.isArray(cached.visibleSessionPaths)
    ? cloneSerializable(cached.visibleSessionPaths) || []
    : [];
  cachedOsmFeatures = Array.isArray(cached.osmFeatures)
    ? cloneSerializable(cached.osmFeatures) || []
    : [];
  cachedVisibleRoadInfoPoints = Array.isArray(cached.visibleRoadInfoPoints)
    ? cloneSerializable(cached.visibleRoadInfoPoints) || []
    : [];

  if (shouldShowAppTactile() && cachedVisibleSessionPaths.length > 0) {
    showAllSessionPathsOnMap(cachedVisibleSessionPaths, { preFiltered: true });
  }
  if (shouldShowOsmTactile() && cachedOsmFeatures.length > 0) {
    showOsmTactileWaysOnMap(cachedOsmFeatures);
  }
  if (shouldShowRoadInfo() && cachedVisibleRoadInfoPoints.length > 0) {
    showRoadInfoPointsOnMap(cachedVisibleRoadInfoPoints, { preFiltered: true });
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
  if (!marker) {
    marker = L.marker([cached.lat, cached.lng], { icon: redPinIcon }).addTo(map);
  } else {
    marker.setLatLng([cached.lat, cached.lng]);
  }
  if (isCenterCurrentEnabled()) {
    const currentZoom = map.getZoom();
    map.setView([cached.lat, cached.lng], currentZoom, { animate: false });
  }
  return true;
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

window.addEventListener("pagehide", () => {
  saveMapReturnCache();
});

map.on("click", (event) => {
  if (shouldIgnoreMapTap(event)) {
    return;
  }

  const lat = Number(event?.latlng?.lat);
  const lng = Number(event?.latlng?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lng: lng.toString(),
    });
    saveMapReturnCache();
    window.location.assign(AppPath.toApp(`/post_road/Index.html?${params.toString()}`));
    return;
  }
  saveMapReturnCache();
  window.location.assign(AppPath.toApp("/post_road/Index.html"));
});

initMapControlsPanelGesture();
initSystemUiInsetSync();
window.addEventListener("pageshow", () => {
  scheduleSystemUiInsetStabilize();
  refreshMapDisplaySettings();
  applyMapInfoVisibility();
});

// UUID v4 生成関数
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

function resetRecordingState() {
  recordEnabled = false;
  recordPaused = false;
  currentSessionId = null;
  currentSessionStartedAt = null;
  recordedRawPoints = [];
  recordedSnappedPoints = [];
  clearCurrentSessionPoints();
  recordingSessionIds = [];
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

// trace_attributesでフィッティングしてマップに表示
function processAndDisplayTrace(sessionId = null, sourcePoints = null) {
  const tracePoints = Array.isArray(sourcePoints) && sourcePoints.length > 0
    ? sourcePoints
    : getAllRecordingTracePoints();
  if (tracePoints.length < 2) {
    console.log("[processAndDisplayTrace] Not enough points:", tracePoints.length);
    alert("記録されたポイントが少なすぎます（最低2点必要）");
    return Promise.resolve(null);
  }

  const shape = tracePoints.map((p) => ({ lat: p.lat, lon: p.lng }));
  return requestTraceData(shape, { sessionId, persist: Boolean(sessionId) })
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
      return { id, code, label };
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
    .map((tag) => `<button type="button" class="trace-tag-option" data-tag-id="${tag.id}">${escapeHtml(tag.label)}</button>`)
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
    await fetchTactileTags();
    renderTraceTagUi();
  } catch (err) {
    console.error("[trace_confirm] tactile tags fetch failed:", err);
    traceTagOptions = [];
    renderTraceTagUi();
  }
}

async function saveSessionTags(sessionIds) {
  const uniqueSessionIds = [...new Set((sessionIds || []).filter(Boolean))];
  const selectedTags = traceTagOptions.filter((tag) => selectedTraceTagIds.has(tag.id));
  for (const sessionId of uniqueSessionIds) {
    for (const tag of selectedTags) {
      const res = await authFetch("/api/session-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, tagId: tag.id }),
      });
      if (!res.ok) {
        throw new Error(`session_tag_save_failed:${res.status}`);
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
}

function openTraceConfirmModal(coordinates) {
  return new Promise((resolve) => {
    if (!traceConfirmModalEl || !traceConfirmMapEl || !traceConfirmOkBtn || !traceConfirmCancelBtn) {
      resolve("cancel");
      return;
    }

    const setupAndBind = async () => {
      await prepareTraceTagModal();

      traceConfirmModalEl.classList.remove("hidden");
      traceConfirmMap = L.map(traceConfirmMapEl, { zoomControl: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors",
      }).addTo(traceConfirmMap);

      traceConfirmPathLayer = L.polyline(coordinates, {
        color: "#9acd32",
        weight: 5,
        opacity: 0.9,
      }).addTo(traceConfirmMap);
      traceConfirmMap.fitBounds(traceConfirmPathLayer.getBounds(), { padding: [20, 20] });

      const cleanupAndResolve = (result) => {
        traceConfirmOkBtn.removeEventListener("click", onOk);
        traceConfirmCancelBtn.removeEventListener("click", onCancel);
        closeTraceConfirmModal();
        resolve(result);
      };

      const onOk = () => {
        if (isCurrentUserPro && selectedTraceTagIds.size === 0) {
          setTraceTagError(getTraceTagText().requiredForPro);
          return;
        }
        setTraceTagError("");
        cleanupAndResolve("ok");
      };
      const onCancel = () => cleanupAndResolve("cancel");

      traceConfirmOkBtn.addEventListener("click", onOk);
      traceConfirmCancelBtn.addEventListener("click", onCancel);

      setTimeout(() => {
        if (traceConfirmMap) {
          traceConfirmMap.invalidateSize();
        }
      }, 0);
    };

    setupAndBind().catch((err) => {
      console.error("[trace_confirm] modal setup failed:", err);
      resolve("cancel");
    });
  });
}

async function persistCurrentSessionWithoutConfirmation() {
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

  const persisted = await processAndDisplayTrace(sessionId, tracePoints);
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

  const shape = allTracePoints.map((p) => ({ lat: p.lat, lon: p.lng }));
  let previewData;
  try {
    previewData = await requestTraceData(shape);
  } catch (err) {
    console.error("[Record] preview trace error:", err);
    alert(`保存確認用の経路生成に失敗しました: ${err.message}`);
    await cancelRecordingSessions(allSessionIds);
    return;
  }

  const previewCoords = extractTraceCoordinates(previewData, shape);
  if (!Array.isArray(previewCoords) || previewCoords.length < 2) {
    alert("保存確認用の経路を生成できませんでした。");
    await cancelRecordingSessions(allSessionIds);
    return;
  }

  const decision = await openTraceConfirmModal(previewCoords);
  if (decision === "ok") {
    const memo = traceMemoInputEl ? traceMemoInputEl.value : "";
    const persistResult = await persistCurrentSessionWithoutConfirmation();
    if (!persistResult.success) {
      await cancelRecordingSessions(allSessionIds);
      return;
    }
    if (isCurrentUserPro) {
      try {
        await saveSessionMemo(allSessionIds, memo);
      } catch (err) {
        console.error("[Record] save session memo error:", err);
        alert(getTraceConfirmText().memoSaveFailed);
      }
    }
    if (isCurrentUserPro) {
      try {
        await saveSessionTags(allSessionIds);
      } catch (err) {
        console.error("[Record] save session tags error:", err);
        // セッション本体は保存済みなので、タグ保存失敗時は記録自体を取り消さない。
        alert("タグの保存に失敗しました。タグなしで記録は保存されています。");
      }
    }
    return;
  }

  await cancelRecordingSessions(allSessionIds);
  if (tracePolyline) {
    map.removeLayer(tracePolyline);
    tracePolyline = null;
  }
}

function requestSnappedLocation(latitude, longitude) {
  if (!currentUserId) {
    return;
  }
  const params = new URLSearchParams({
    lat: latitude.toString(),
    lng: longitude.toString(),
    userId: String(currentUserId),
  });
  if (isRecordingActive()) {
    params.set("record", "1");
    if (currentSessionId) {
      params.set("sessionId", currentSessionId);
    }
  }
  
  if (lastSent) {
    params.set("prevLat", lastSent.latitude.toString());
    params.set("prevLng", lastSent.longitude.toString());
  }

  console.log(`[requestSnappedLocation] Requesting: lat=${latitude}, lng=${longitude}`);

  authFetch(`/api/match?${params.toString()}`)
    .then((res) => {
      console.log(`[requestSnappedLocation] Response status: ${res.status}`);
      if (res.status === 204) {
        console.log('[requestSnappedLocation] Received 204 No Content - no update');
        // 変化がなくても現在値を表示更新（時刻などは変わる）
        updateDisplay(latitude, longitude, latitude, longitude, true);
        return null;
      }
      if (!res.ok) {
        throw new Error(`match failed with status ${res.status}`);
      }
      return res.json();
    })
    .then((data) => {
      console.log('[requestSnappedLocation] Response data:', data);
      if (!data) {
        console.log('[requestSnappedLocation] No data received (204 response)');
        return;
      }
      if (typeof data.lat === "number" && typeof data.lng === "number") {
        console.log(`[requestSnappedLocation] Valid snapped coordinates: lat=${data.lat}, lng=${data.lng}`);
        updateDisplay(latitude, longitude, data.lat, data.lng);
        // スナップされた座標を次回の基準点として保存
        lastSent = { latitude: data.lat, longitude: data.lng };
      } else {
        console.warn('[requestSnappedLocation] Invalid data format:', data);
        return;
      }
    })
    .catch((error) => {
      console.error('[requestSnappedLocation] Error:', error);
      // keep current display on failure
    });
}

function handleNewLocation(latitude, longitude) {
  // 位置情報を変数に保存するだけ（書き込み）
  latestLocation = { lat: latitude, lng: longitude };
  saveLastKnownLocation(latitude, longitude);
}

function pollAndSendLocation() {
  if (!latestLocation) return;

  const { lat, lng } = latestLocation;

  // 記録アクティブ時はrawデータをメモリへ保存（全体 + 現在セッション）
  if (isRecordingActive()) {
    recordedRawPoints.push({ lat, lng });
    currentSessionRawPoints.push({ lat, lng });
    console.log(`[Record] Saved raw point: total=${recordedRawPoints.length}, current=${currentSessionRawPoints.length}`);
  }

  // サーバーへ送信（読み取り）
  requestSnappedLocation(lat, lng);
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
  if (!isCenterCurrentEnabled()) {
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
  if (isCenterCurrentEnabled()) {
    const currentZoom = map.getZoom();
    console.log(`[updateDisplay] Moving map to (${snappedLat}, ${snappedLng}) with zoom ${currentZoom}`);
    map.setView([snappedLat, snappedLng], currentZoom, { animate: false });
  }

  if (skipMarker) return;
  
  // マーカーの更新
  if (!marker) {
    console.log('[updateDisplay] Creating new marker');
    marker = L.marker([snappedLat, snappedLng], { icon: redPinIcon }).addTo(map);
  } else {
    console.log('[updateDisplay] Updating existing marker position');
    marker.setLatLng([snappedLat, snappedLng]);
  }

  // ドット（点）だけを表示
  const dotColor = isRecordingActive() ? "#9acd32" : "#111";
  const dot = L.circleMarker([snappedLat, snappedLng], {
    radius: 3,
    color: dotColor,
    fillColor: dotColor,
    fillOpacity: 0.7,
    weight: 0,
  }).addTo(map);
  
  trail.push(dot);
  if (trail.length > MAX_TRAIL) {
    map.removeLayer(trail.shift());
  }
  
  console.log('[updateDisplay] Display update complete');
}

// session_pathsを取得して表示
function loadAndShowAllRecords() {
  refreshMapDisplaySettings();
  const requestSeq = ++recordsLoadRequestSeq;
  setRecordsLoadingVisible(true);
  console.log("[loadAndShowAllRecords] Fetching all session paths...");
  const center = map.getCenter();
  const params = new URLSearchParams({
    centerLat: center.lat.toString(),
    centerLng: center.lng.toString(),
    radiusKm: "10",
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

    const polyline = L.polyline(coordinates, {
      color: "#00b050",
      weight: 4,
      opacity: 0.85,
      interactive: false,
    }).addTo(map);
    const hitPolyline = L.polyline(coordinates, {
      color: "#00b050",
      weight: 12,
      opacity: 0,
      bubblingMouseEvents: false,
    }).addTo(map);
    const sessionId = typeof path.session_id === "string" ? path.session_id : "";
    if (sessionId) {
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
    allRecordsMarkers.push(hitPolyline);
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

function loadAndShowOsmTactileWays() {
  // トグルONの最新リクエストだけを有効にするための採番。
  const requestSeq = ++osmTactileLoadRequestSeq;
  setOsmLoadingVisible(true);
  console.log("[loadAndShowOsmTactileWays] Fetching tactile ways from OSM...");
  const center = map.getCenter();
  const params = new URLSearchParams({
    centerLat: center.lat.toString(),
    centerLng: center.lng.toString(),
    radiusKm: "10",
  });
  authFetch(`/api/osm-tactile-ways?${params.toString()}`)
    .then((res) => {
      if (!res.ok) {
        throw new Error(`osm tactile fetch failed: ${res.status}`);
      }
      return res.json();
    })
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
      alert("OSM点字ブロックデータの取得に失敗しました。");
      clearOsmTactileWaysFromMap();
    })
    .finally(() => {
      if (requestSeq === osmTactileLoadRequestSeq) {
        setOsmLoadingVisible(false);
      }
    });
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

      const polyline = L.polyline(coordinates, {
        color: "#0066ff",
        weight: 4,
        opacity: 0.9,
      }).addTo(map);
      osmTactileMarkers.push(polyline);
      return;
    }

    if (feature.geometry.type === "Point") {
      const [lng, lat] = Array.isArray(feature.geometry.coordinates)
        ? feature.geometry.coordinates
        : [NaN, NaN];
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const point = L.circleMarker([lat, lng], {
        radius: 4,
        color: "#0066ff",
        fillColor: "#0066ff",
        fillOpacity: 0.95,
        weight: 1,
      }).addTo(map);
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

function loadAndShowRoadInfoPoints() {
  refreshMapDisplaySettings();
  const requestSeq = ++roadInfoLoadRequestSeq;
  // 地図中心から10kmの道情報ポイントを取得する。
  console.log("[loadAndShowRoadInfoPoints] Fetching road info points...");
  const center = map.getCenter();
  const params = new URLSearchParams({
    centerLat: center.lat.toString(),
    centerLng: center.lng.toString(),
    radiusKm: "10",
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

  if (shouldShowAppTactile()) {
    loadAndShowAllRecords();
  } else {
    recordsLoadRequestSeq += 1;
    setRecordsLoadingVisible(false);
    clearAllRecordsFromMap();
  }

  if (shouldShowOsmTactile()) {
    loadAndShowOsmTactileWays();
  } else {
    osmTactileLoadRequestSeq += 1;
    setOsmLoadingVisible(false);
    clearOsmTactileWaysFromMap();
  }

  if (shouldShowRoadInfo()) {
    loadAndShowRoadInfoPoints();
  } else {
    roadInfoLoadRequestSeq += 1;
    clearRoadInfoPointsFromMap();
  }
}

// サーバーから設定を取得
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

if ("geolocation" in navigator) {
  const options = { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 };

  function requestPosition(force = false) {
    // 手動リクエスト用
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        handleNewLocation(pos.coords.latitude, pos.coords.longitude, force);
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
        handleNewLocation(pos.coords.latitude, pos.coords.longitude, false);
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
      await loadCurrentUserProStatus();
    } catch (error) {
      logMapEvent("map_gps_bootstrap_partial", {
        category: "auth",
        level: "warn",
        message: error && error.message ? String(error.message) : "map bootstrap failed before gps start",
      });
      if (error && (error.message === "unauthorized" || error.message === "invalid_user")) {
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
            await startRecordingSession();
            updateRecordButton();
            console.log(`[Record] Started recording session=${currentSessionId}`);
          } else {
            // レコードOFF：記録開始以降の全セッションをまとめて確認
            recordEnabled = false;
            recordPaused = false;

            updateRecordButton();
            console.log(
              `[Record] Stop requested. totalRaw=${recordedRawPoints.length}, totalSnapped=${recordedSnappedPoints.length}, activeSession=${currentSessionId || "none"}`
            );
            await handleRecordStopWithConfirmation();
            markTrailDotsAsIdle();
            resetRecordingState();
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
            updateRecordButton();

            const persistResult = await persistCurrentSessionWithoutConfirmation();
            if (!persistResult.success) {
              recordPaused = false;
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
