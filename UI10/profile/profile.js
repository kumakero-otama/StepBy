// このファイルはプロフィール表示に必要なユーザー情報の取得と反映を担当する。
const profileAvatarEl = document.getElementById("profile-avatar");
const profileUsernameEl = document.getElementById("profile-username");
const profileProChipEl = document.getElementById("profile-pro-chip");
const totalTactileEl = document.getElementById("total-tactile-length");
const totalRoadPostsEl = document.getElementById("total-road-posts");
const logoutBtnEl = document.getElementById("profile-logout-btn");
const editBtnEl = document.getElementById("profile-edit-btn");
const osmStatusEl = document.getElementById("osm-connection-status");
const osmConnectBtnEl = document.getElementById("osm-connect-btn");
const osmDisconnectBtnEl = document.getElementById("osm-disconnect-btn");
const PROFILE_CACHE_KEY = "cached_profile_user.v1";
const PROFILE_ICON_CACHE_KEY = "cachedProfileIcon.v1";

// プロフィールアイコン画像本体をbase64データURLとしてlocalStorageに保存する。
// 次回プロフィール画面を開いたとき、ヘッダーのインラインスクリプトがこのキャッシュを参照して
// ネットワークアクセス無しに即時表示できるようにする目的。
function saveCachedProfileIconImage(absoluteUrl) {
  if (!absoluteUrl || typeof absoluteUrl !== "string") return;
  // 既に同じURLでキャッシュ済みなら何もしない
  try {
    const existing = localStorage.getItem(PROFILE_ICON_CACHE_KEY);
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed && parsed.url === absoluteUrl && parsed.dataUrl) return;
    }
  } catch (e) {}
  fetch(absoluteUrl, { credentials: "include" })
    .then((res) => (res && res.ok ? res.blob() : null))
    .then((blob) => {
      if (!blob) return null;
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
    })
    .then((dataUrl) => {
      if (!dataUrl) return;
      try {
        localStorage.setItem(
          PROFILE_ICON_CACHE_KEY,
          JSON.stringify({ url: absoluteUrl, dataUrl })
        );
      } catch (e) {}
    })
    .catch(() => {});
}
const authTokenApi = window.AuthToken || null;
const PROFILE_TEXT = {
  ja: {
    guestEditLocked: "ゲストアカウントではプロフィール編集はできません。",
    osmChecking: "連携状態を確認しています…",
    osmConnected: (name) => `OSMアカウント「${name}」と連携済みです。`,
    osmNotConnected: "OSMアカウントは未連携です。",
    osmNotConfigured: "OSM連携のアプリ登録待ちです。設定後にこのボタンが有効になります。",
    osmFailed: "OSM連携状態を確認できませんでした。",
    osmDisconnectConfirm: "OSMアカウントとの連携を解除しますか？",
    osmDisconnectFailed: "OSM連携を解除できませんでした。",
  },
  en: {
    guestEditLocked: "Profile editing is not available for guest accounts.",
    osmChecking: "Checking connection…",
    osmConnected: (name) => `Connected to OSM account “${name}”.`,
    osmNotConnected: "No OSM account is connected.",
    osmNotConfigured: "Waiting for the OSM application registration. This button will be enabled after configuration.",
    osmFailed: "Could not check the OSM connection.",
    osmDisconnectConfirm: "Disconnect your OSM account?",
    osmDisconnectFailed: "Could not disconnect the OSM account.",
  },
  hi: {
    guestEditLocked: "गेस्ट खाते में प्रोफ़ाइल संपादन उपलब्ध नहीं है।",
    osmChecking: "कनेक्शन की जांच हो रही है…",
    osmConnected: (name) => `OSM खाता “${name}” जुड़ा हुआ है।`,
    osmNotConnected: "कोई OSM खाता जुड़ा नहीं है।",
    osmNotConfigured: "OSM ऐप पंजीकरण की प्रतीक्षा है। सेटिंग के बाद यह बटन सक्रिय होगा।",
    osmFailed: "OSM कनेक्शन की जांच नहीं हो सकी।",
    osmDisconnectConfirm: "OSM खाता कनेक्शन हटाएं?",
    osmDisconnectFailed: "OSM कनेक्शन हटाया नहीं जा सका।",
  },
};

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

function getProfileText() {
  const language = getCurrentLanguage();
  return PROFILE_TEXT[language] || PROFILE_TEXT.ja;
}

function getProfileCacheStorage() {
  return getProfileCacheStorages()[0] || null;
}

function getProfileCacheStorages() {
  const storages = [];
  try {
    if (window.localStorage) {
      storages.push(window.localStorage);
    }
  } catch {
    // ignore storage access errors
  }
  try {
    if (window.sessionStorage && !storages.includes(window.sessionStorage)) {
      storages.push(window.sessionStorage);
    }
  } catch {
    // ignore storage access errors
  }
  return storages;
}

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

function getAccessToken() {
  if (authTokenApi && typeof authTokenApi.getAccessToken === "function") {
    return authTokenApi.getAccessToken();
  }
  return "";
}

function isTemporaryAuthError(error) {
  if (authTokenApi && typeof authTokenApi.isTemporaryError === "function") {
    return authTokenApi.isTemporaryError(error);
  }
  return Boolean(
    error && (
      error.code === "auth_timeout"
      || error.name === "AuthTimeoutError"
      || error.name === "TypeError"
    )
  );
}

function formatMetersFromKm(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) {
    return "0";
  }
  return Math.round(num * 1000).toLocaleString("ja-JP");
}

function parseIsPro(payload) {
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

function setProfileProChipVisible(visible) {
  if (!profileProChipEl) {
    return;
  }
  profileProChipEl.classList.toggle("hidden", !visible);
}

function saveCachedProfileUser(user) {
  if (!user || typeof user !== "object") {
    return;
  }
  const existing = loadCachedProfileUser();
  const normalized = {
    userId: Number(user.userId || user.user_id || 0) || null,
    username: user.username == null ? null : String(user.username),
    iconUrl: user.iconUrl || user.icon_url || null,
    isGuest: Boolean(user.isGuest || user.is_guest),
    isPro: typeof user.isPro === "boolean" ? user.isPro : (typeof user.is_pro === "boolean" ? user.is_pro : existing && typeof existing.isPro === "boolean" ? existing.isPro : null),
    totalTactileLength: Number(user.totalTactileLength || user.total_tactile_length || 0) || 0,
    totalRoadPosts: Number(user.totalRoadPosts || user.total_road_posts || 0) || 0,
    totalHearts: Number(user.totalHearts || user.total_hearts || 0) || 0,
  };
  try {
    const storages = getProfileCacheStorages();
    if (!storages.length) {
      return;
    }
    const serialized = JSON.stringify(normalized);
    storages.forEach((storage) => {
      storage.setItem(PROFILE_CACHE_KEY, serialized);
    });
  } catch {
    // ignore storage errors
  }
}

function loadCachedProfileUser() {
  try {
    for (const storage of getProfileCacheStorages()) {
      const raw = storage.getItem(PROFILE_CACHE_KEY);
      if (!raw) {
        continue;
      }
      return JSON.parse(raw);
    }
    return null;
  } catch {
    return null;
  }
}

function clearCachedProfileUser() {
  try {
    getProfileCacheStorages().forEach((storage) => {
      storage.removeItem(PROFILE_CACHE_KEY);
      storage.removeItem(PROFILE_ICON_CACHE_KEY);
    });
  } catch {
    // ignore storage errors
  }
}

function redirectToLogin() {
  clearAccessToken();
  clearCachedProfileUser();
  window.location.replace(AppPath.toApp("/auth/login.html"));
}

async function syncProfileProChip() {
  const cached = loadCachedProfileUser();
  if (cached && typeof cached.isPro === "boolean") {
    setProfileProChipVisible(cached.isPro);
  }
  try {
    const res = await authFetch("/api/pro-status", { cache: "no-store" });
    if (!res.ok) {
      setProfileProChipVisible(false);
      return;
    }
    const payload = await res.json().catch(() => null);
    const isPro = parseIsPro(payload);
    if (typeof isPro === "boolean") {
      saveCachedProfileUser({ ...(cached || {}), isPro });
    }
    setProfileProChipVisible(isPro === true);
  } catch {
    if (!(cached && typeof cached.isPro === "boolean")) {
      setProfileProChipVisible(false);
    }
  }
}

function applyProfileUser(user) {
  if (!user) {
    return;
  }
  const username = user.username || "username";
  const iconUrl = user.iconUrl == null
    ? AppPath.toApp("/assets/account_default.png")
    : AppPath.toApiAsset(user.iconUrl);
  const totalTactile = user.totalTactileLength || 0;
  const totalRoadPosts = user.totalRoadPosts || 0;
  const totalHearts = user.totalHearts || 0;

  if (profileAvatarEl) {
    profileAvatarEl.src = iconUrl;
    profileAvatarEl.alt = `${username}のアイコン`;
    // ネットワーク経由で読み込めた画像をbase64でlocalStorageに保存し、次回からは即時表示できるようにする。
    if (user.iconUrl != null) {
      saveCachedProfileIconImage(iconUrl);
    }
  }
  if (profileUsernameEl) {
    profileUsernameEl.textContent = username;
  }
  if (totalTactileEl) {
    totalTactileEl.textContent = `${formatMetersFromKm(totalTactile)}m`;
  }
  if (totalRoadPostsEl) {
    totalRoadPostsEl.textContent = `${Number(totalRoadPosts || 0)}件`;
  }
  applyProfileEditAvailability(Boolean(user.isGuest || user.is_guest));
}

function applyProfileEditAvailability(isGuest) {
  if (!editBtnEl) {
    return;
  }
  editBtnEl.disabled = isGuest;
  editBtnEl.classList.toggle("is-disabled", isGuest);
  if (isGuest) {
    editBtnEl.setAttribute("aria-disabled", "true");
    editBtnEl.title = getProfileText().guestEditLocked;
  } else {
    editBtnEl.removeAttribute("aria-disabled");
    editBtnEl.removeAttribute("title");
  }
}

function setOsmStatus(message, state) {
  if (!osmStatusEl) return;
  osmStatusEl.textContent = message;
  osmStatusEl.classList.toggle("is-connected", state === "connected");
  osmStatusEl.classList.toggle("is-error", state === "error");
}

async function loadOsmConnection() {
  if (!osmStatusEl || !osmConnectBtnEl || !osmDisconnectBtnEl) return;
  const text = getProfileText();
  setOsmStatus(text.osmChecking, "checking");
  osmConnectBtnEl.disabled = true;
  osmDisconnectBtnEl.classList.add("hidden");
  try {
    const response = await authFetch("/auth/osm/status", { cache: "no-store" });
    if (response.status === 401) return redirectToLogin();
    if (!response.ok) throw new Error("osm_status_failed");
    const payload = await response.json();
    if (!payload.configured) {
      setOsmStatus(text.osmNotConfigured, "error");
      return;
    }
    if (payload.connected && payload.connection) {
      setOsmStatus(text.osmConnected(payload.connection.displayName || "OSM"), "connected");
      osmConnectBtnEl.classList.add("hidden");
      osmDisconnectBtnEl.classList.remove("hidden");
      return;
    }
    setOsmStatus(text.osmNotConnected, "idle");
    osmConnectBtnEl.classList.remove("hidden");
    osmConnectBtnEl.disabled = false;
  } catch {
    setOsmStatus(text.osmFailed, "error");
  }
}

async function startOsmConnection() {
  if (!osmConnectBtnEl) return;
  osmConnectBtnEl.disabled = true;
  const popupFeatures = "popup=yes,width=520,height=720,resizable=yes,scrollbars=yes";
  const popup = window.open("about:blank", "stepby-osm-oauth", popupFeatures);
  const mode = popup ? "popup" : "redirect";
  if (popup) {
    popup.document.title = "OpenStreetMap連携";
    popup.document.body.textContent = "OpenStreetMapの認証画面を準備しています…";
  }
  try {
    const returnUrl = window.location.origin + AppPath.toApp("/profile/Index.html");
    const response = await authFetch(`/auth/osm/start?mode=${mode}&return_url=${encodeURIComponent(returnUrl)}`, { method: "POST" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.authorizationUrl) throw new Error(payload.error || "osm_start_failed");
    if (popup) {
      popup.location.replace(payload.authorizationUrl);
    } else {
      window.location.assign(payload.authorizationUrl);
    }
  } catch {
    if (popup && !popup.closed) popup.close();
    setOsmStatus(getProfileText().osmFailed, "error");
    osmConnectBtnEl.disabled = false;
  }
}

async function disconnectOsmConnection() {
  const text = getProfileText();
  if (!window.confirm(text.osmDisconnectConfirm)) return;
  if (osmDisconnectBtnEl) osmDisconnectBtnEl.disabled = true;
  try {
    const response = await authFetch("/auth/osm/disconnect", { method: "POST" });
    if (!response.ok) throw new Error("osm_disconnect_failed");
    await loadOsmConnection();
  } catch {
    window.alert(text.osmDisconnectFailed);
  } finally {
    if (osmDisconnectBtnEl) osmDisconnectBtnEl.disabled = false;
  }
}

async function loadProfile() {
  const cached = loadCachedProfileUser();
  if (cached) {
    applyProfileUser(cached);
  }
  try {
    const res = await authFetch("/auth/me", {
      cache: "no-store",
    });
    if (res.status === 401 || res.status === 403) {
      redirectToLogin();
      return;
    }
    if (!res.ok) {
      return;
    }
    const payload = await res.json();
    const user = payload && payload.user ? payload.user : null;
    if (!user) {
      redirectToLogin();
      return;
    }
    applyProfileUser(user);
    saveCachedProfileUser(user);
  } catch (error) {
    if (isTemporaryAuthError(error) && (cached || getAccessToken())) {
      console.warn("[profile] auth check temporarily failed", error);
      return;
    }
    redirectToLogin();
  }
}

async function logout() {
  try {
    const res = await authFetch("/auth/logout", {
      method: "POST",
    });
    if (!res.ok) {
      throw new Error("logout_failed");
    }
  } catch {
    // Always redirect so the user can recover by logging in again.
  }
  clearAccessToken();
  clearCachedProfileUser();
  window.location.replace(AppPath.toApp("/auth/login.html"));
}

if (logoutBtnEl) {
  logoutBtnEl.addEventListener("click", () => {
    const ok = window.confirm("ログアウトしてもよろしいですか？");
    if (!ok) {
      return;
    }
    logout();
  });
}

if (editBtnEl) {
  editBtnEl.addEventListener("click", () => {
    if (editBtnEl.disabled) {
      window.alert(getProfileText().guestEditLocked);
      return;
    }
    window.location.href = AppPath.toApp("/profile/edit.html");
  });
}

if (osmConnectBtnEl) osmConnectBtnEl.addEventListener("click", startOsmConnection);
if (osmDisconnectBtnEl) osmDisconnectBtnEl.addEventListener("click", disconnectOsmConnection);
window.addEventListener("message", (event) => {
  let apiOrigin = "";
  try { apiOrigin = new URL((window.APP_CONFIG && window.APP_CONFIG.API_BASE_URL) || "").origin; } catch {}
  if (!apiOrigin || event.origin !== apiOrigin || !event.data || event.data.type !== "stepby-osm-oauth-result") return;
  void loadOsmConnection();
});

loadProfile();
void syncProfileProChip();
void loadOsmConnection();
