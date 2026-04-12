const profileAvatarEl = document.getElementById("profile-avatar");
const profileUsernameEl = document.getElementById("profile-username");
const profileProChipEl = document.getElementById("profile-pro-chip");
const totalTactileEl = document.getElementById("total-tactile-length");
const totalRoadPostsEl = document.getElementById("total-road-posts");
const logoutBtnEl = document.getElementById("profile-logout-btn");
const editBtnEl = document.getElementById("profile-edit-btn");
const PROFILE_CACHE_KEY = "cached_profile_user.v1";
const authTokenApi = window.AuthToken || null;
const PROFILE_TEXT = {
  ja: {
    guestEditLocked: "ゲストアカウントではプロフィール編集はできません。",
  },
  en: {
    guestEditLocked: "Profile editing is not available for guest accounts.",
  },
  hi: {
    guestEditLocked: "गेस्ट खाते में प्रोफ़ाइल संपादन उपलब्ध नहीं है।",
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

loadProfile();
void syncProfileProChip();
