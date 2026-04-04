const usernameInputEl = document.getElementById("profile-username-input");
const iconPreviewEl = document.getElementById("profile-icon-preview");
const cameraInputEl = document.getElementById("profile-icon-camera-input");
const uploadInputEl = document.getElementById("profile-icon-upload-input");
const proToggleInputEl = document.getElementById("profile-pro-toggle-input");
const proHelpBtnEl = document.getElementById("profile-pro-help-btn");
const proHelpModalEl = document.getElementById("pro-help-modal");
const proHelpCloseBtnEl = document.getElementById("pro-help-close-btn");
const backBtnEl = document.getElementById("profile-edit-back-btn");
const saveBtnEl = document.getElementById("profile-edit-save-btn");
const saveToastEl = document.getElementById("profile-save-toast");
const PROFILE_CACHE_KEY = "cached_profile_user.v1";
const authTokenApi = window.AuthToken || null;
const PROFILE_EDIT_TEXT = {
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

function getProfileEditText() {
  const language = getCurrentLanguage();
  return PROFILE_EDIT_TEXT[language] || PROFILE_EDIT_TEXT.ja;
}

function getProfileCacheStorage() {
  try {
    if (window.localStorage) {
      return window.localStorage;
    }
  } catch {
    // ignore storage access errors
  }
  try {
    if (window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {
    // ignore storage access errors
  }
  return null;
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

let selectedIconDataUrl = null;
let saving = false;

function setProHelpModalOpen(open) {
  if (!proHelpModalEl) {
    return;
  }
  proHelpModalEl.classList.toggle("hidden", !open);
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
    const storage = getProfileCacheStorage();
    if (!storage) {
      return;
    }
    storage.setItem(PROFILE_CACHE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore storage errors
  }
}

function loadCachedProfileUser() {
  try {
    const storage = getProfileCacheStorage();
    if (!storage) {
      return null;
    }
    const raw = storage.getItem(PROFILE_CACHE_KEY);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function applyCachedProfileUser(user) {
  if (!user) {
    return;
  }
  const username = user.username || "";
  const iconUrl = user.iconUrl == null
    ? AppPath.toApp("/assets/account_default.png")
    : AppPath.toApiAsset(user.iconUrl);

  if (usernameInputEl && username) {
    usernameInputEl.value = username;
  }
  if (iconPreviewEl) {
    iconPreviewEl.src = iconUrl;
    iconPreviewEl.alt = `${username || "ユーザー"}のアイコン`;
  }
  if (proToggleInputEl && typeof user.isPro === "boolean") {
    proToggleInputEl.checked = user.isPro;
  }
}

function showSaveToast() {
  if (!saveToastEl) {
    return;
  }
  saveToastEl.classList.add("show");
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("file_read_error"));
    reader.readAsDataURL(file);
  });
}

async function applySelectedIcon(file) {
  if (!file) {
    return;
  }
  const dataUrl = await readFileAsDataUrl(file);
  selectedIconDataUrl = dataUrl;
  if (iconPreviewEl) {
    iconPreviewEl.src = dataUrl;
  }
}

async function loadCurrentProfile() {
  const cached = loadCachedProfileUser();
  if (cached) {
    applyCachedProfileUser(cached);
  }
  try {
    const res = await authFetch("/auth/me", {
      cache: "no-store",
    });
    if (!res.ok) {
      clearAccessToken();
      window.location.replace(AppPath.toApp("/auth/login.html"));
      return;
    }
    const payload = await res.json();
    const user = payload && payload.user ? payload.user : null;
    if (!user) {
      clearAccessToken();
      window.location.replace(AppPath.toApp("/auth/login.html"));
      return;
    }
    if (user.isGuest === true || user.is_guest === true) {
      window.alert(getProfileEditText().guestEditLocked);
      window.location.replace(AppPath.toApp("/profile/Index.html"));
      return;
    }
    const username = user.username || "";
    const iconUrl = user.iconUrl == null
      ? AppPath.toApp("/assets/account_default.png")
      : AppPath.toApiAsset(user.iconUrl);

    if (usernameInputEl) {
      usernameInputEl.value = username;
    }
    if (iconPreviewEl) {
      iconPreviewEl.src = iconUrl;
      iconPreviewEl.alt = `${username || "ユーザー"}のアイコン`;
    }
    saveCachedProfileUser(user);
    await loadCurrentProStatus(user);
  } catch {
    clearAccessToken();
    window.location.replace(AppPath.toApp("/auth/login.html"));
  }
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

async function loadCurrentProStatus(user) {
  if (!proToggleInputEl) {
    return;
  }
  // 取得前はOFF基準にして、API結果で最終状態を上書きする。
  proToggleInputEl.checked = false;
  proToggleInputEl.disabled = true;
  try {
    const res = await authFetch("/api/pro-status", { cache: "no-store" });
    if (res.status === 401) {
      clearAccessToken();
      window.location.replace(AppPath.toApp("/auth/login.html"));
      return;
    }
    if (!res.ok) {
      return;
    }
    const payload = await res.json().catch(() => null);
    const isPro = parseIsPro(payload);
    if (typeof isPro === "boolean") {
      proToggleInputEl.checked = isPro;
      if (user && typeof user === "object") {
        saveCachedProfileUser({ ...user, isPro });
      }
    }
  } finally {
    proToggleInputEl.disabled = false;
  }
}

async function saveProStatus() {
  if (!proToggleInputEl) {
    return;
  }
  const res = await authFetch("/api/pro-status", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ isPro: Boolean(proToggleInputEl.checked) }),
  });
  if (!res.ok) {
    let reason = `status_${res.status}`;
    try {
      const payload = await res.json();
      if (payload && payload.error) {
        reason = payload.error;
      }
    } catch {
      // ignore json parse error
    }
    throw new Error(`pro_status_update_failed:${reason}`);
  }
}

async function saveProfile() {
  if (saving) {
    return;
  }
  const username = (usernameInputEl && usernameInputEl.value ? usernameInputEl.value : "").trim();
  if (!username) {
    window.alert("ユーザー名を入力してください。");
    return;
  }

  const body = { username };
  if (selectedIconDataUrl) {
    body.icon_data_url = selectedIconDataUrl;
  }

  try {
    saving = true;
    if (saveBtnEl) {
      saveBtnEl.disabled = true;
    }
    const res = await authFetch("/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      let reason = `status_${res.status}`;
      try {
        const payload = await res.json();
        if (payload && payload.error) {
          reason = payload.error;
        }
      } catch {
        // ignore json parse error
      }
      throw new Error(reason);
    }
    const payload = await res.json().catch(() => ({}));
    if (payload && payload.user) {
      saveCachedProfileUser({
        ...payload.user,
        isPro: proToggleInputEl ? Boolean(proToggleInputEl.checked) : null,
      });
    }
    if (proToggleInputEl) {
      await saveProStatus();
    }
    showSaveToast();
    window.setTimeout(() => {
      window.location.replace(AppPath.toApp("/profile/Index.html"));
    }, 2000);
  } catch (err) {
    saving = false;
    if (saveBtnEl) {
      saveBtnEl.disabled = false;
    }
    window.alert(`プロフィールの保存に失敗しました: ${err.message}`);
  }
}

if (cameraInputEl) {
  cameraInputEl.addEventListener("change", () => applySelectedIcon(cameraInputEl.files && cameraInputEl.files[0]));
}

if (uploadInputEl) {
  uploadInputEl.addEventListener("change", () => applySelectedIcon(uploadInputEl.files && uploadInputEl.files[0]));
}

if (backBtnEl) {
  backBtnEl.addEventListener("click", () => {
    window.location.replace(AppPath.toApp("/profile/Index.html"));
  });
}

if (saveBtnEl) {
  saveBtnEl.addEventListener("click", saveProfile);
}

if (proHelpBtnEl) {
  proHelpBtnEl.addEventListener("click", () => {
    setProHelpModalOpen(true);
  });
}

if (proHelpCloseBtnEl) {
  proHelpCloseBtnEl.addEventListener("click", () => {
    setProHelpModalOpen(false);
  });
}

if (proHelpModalEl) {
  proHelpModalEl.addEventListener("click", (event) => {
    if (event.target === proHelpModalEl) {
      setProHelpModalOpen(false);
    }
  });
}

loadCurrentProfile();
