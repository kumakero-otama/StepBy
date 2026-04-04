const GOOGLE_CLIENT_ID = "808129330394-dagp56961vbank89vi7bc50pp4u7mgv8.apps.googleusercontent.com";
const googleStatusElement = document.getElementById("google-auth-status");
const guestLoginButton = document.getElementById("guest-login-button");
const signupPage = window.location.pathname.endsWith("/auth/signup.html");
const signupProfilePage = window.location.pathname.endsWith("/auth/signup_profile.html");
const PENDING_SIGNUP_ID_TOKEN_KEY = "pending_google_signup_id_token";
const PROFILE_CACHE_KEY = "cached_profile_user.v1";
const authTokenApi = window.AuthToken || null;
const AUTH_TEXT = {
  ja: {
    guestChecking: "ゲストログインを確認中です...",
    guestSuccess: "ゲストログイン成功。地図画面へ移動します...",
    guestAlreadyAuthenticated: "すでにログイン済みです。地図画面へ移動します...",
    guestFailed: "ゲストログインに失敗しました",
    guestResponseMissing: "ゲストログインのレスポンスが不正です",
    guestNetworkError: "ネットワークエラーでゲストログインに失敗しました。",
    guestEditLocked: "ゲストアカウントではプロフィール編集はできません。",
  },
  en: {
    guestChecking: "Checking guest login...",
    guestSuccess: "Guest login successful. Redirecting to the map...",
    guestAlreadyAuthenticated: "You are already signed in. Redirecting to the map...",
    guestFailed: "Guest login failed",
    guestResponseMissing: "The guest login response was invalid",
    guestNetworkError: "Guest login failed due to a network error.",
    guestEditLocked: "Profile editing is not available for guest accounts.",
  },
  hi: {
    guestChecking: "गेस्ट लॉगिन की पुष्टि की जा रही है...",
    guestSuccess: "गेस्ट लॉगिन सफल हुआ। मानचित्र स्क्रीन पर जा रहे हैं...",
    guestAlreadyAuthenticated: "आप पहले से लॉग इन हैं। मानचित्र स्क्रीन पर जा रहे हैं...",
    guestFailed: "गेस्ट लॉगिन विफल रहा",
    guestResponseMissing: "गेस्ट लॉगिन का रिस्पॉन्स अमान्य था",
    guestNetworkError: "नेटवर्क त्रुटि के कारण गेस्ट लॉगिन विफल रहा।",
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

function getAuthText() {
  const language = getCurrentLanguage();
  return AUTH_TEXT[language] || AUTH_TEXT.ja;
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

function isStandaloneDisplayMode() {
  if (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) {
    return true;
  }
  if (window.navigator && window.navigator.standalone === true) {
    return true;
  }
  return false;
}

function measureStandaloneBottomInset() {
  if (!isStandaloneDisplayMode()) {
    return 0;
  }
  const userAgent = String(window.navigator && window.navigator.userAgent || "").toLowerCase();
  if (userAgent.includes("android")) {
    return 34;
  }
  return 0;
}

function applyLoginViewportMetrics() {
  const viewportHeight = measureVisibleViewportHeight();
  const standaloneBottomInset = measureStandaloneBottomInset();
  if (viewportHeight > 0) {
    const adjustedHeight = Math.max(320, Math.round(viewportHeight - standaloneBottomInset));
    document.documentElement.style.setProperty("--login-visible-height", `${adjustedHeight}px`);
  }
  document.documentElement.style.setProperty("--login-safe-bottom", "env(safe-area-inset-bottom)");
  document.documentElement.style.setProperty("--login-system-ui-bottom", `${standaloneBottomInset}px`);
}

function initLoginViewportMetrics() {
  if (signupProfilePage) {
    return;
  }
  applyLoginViewportMetrics();
  window.setTimeout(applyLoginViewportMetrics, 120);
  window.setTimeout(applyLoginViewportMetrics, 360);
  window.addEventListener("resize", applyLoginViewportMetrics);
  if (window.visualViewport) {
    window.visualViewport.addEventListener("resize", applyLoginViewportMetrics);
  }
}

function setGoogleStatus(message) {
  if (!googleStatusElement) {
    return;
  }
  googleStatusElement.textContent = message;
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMarkdownInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_m, label, url) => {
    const safeLabel = escapeHtml(label);
    const safeUrl = escapeHtml(url);
    return `<a href="${safeUrl}" target="_blank" rel="noopener noreferrer">${safeLabel}</a>`;
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  html = html.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  html = html.replace(/_([^_]+)_/g, "<em>$1</em>");
  html = html.replace(/`([^`]+)`/g, "<code>$1</code>");
  return html;
}

function renderMarkdownToHtml(markdown) {
  const lines = String(markdown || "").replace(/\r\n/g, "\n").split("\n");
  const parts = [];
  let inUnorderedList = false;
  let inOrderedList = false;
  let inBlockquote = false;

  const closeBlocks = () => {
    if (inBlockquote) {
      parts.push("</blockquote>");
      inBlockquote = false;
    }
    if (inUnorderedList) {
      parts.push("</ul>");
      inUnorderedList = false;
    }
    if (inOrderedList) {
      parts.push("</ol>");
      inOrderedList = false;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (!line) {
      closeBlocks();
      continue;
    }

    const headingMatch = line.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      closeBlocks();
      const level = headingMatch[1].length;
      const text = renderMarkdownInline(headingMatch[2]);
      parts.push(`<h${level}>${text}</h${level}>`);
      continue;
    }

    if (line === "---" || line === "***") {
      closeBlocks();
      parts.push("<hr>");
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (inOrderedList) {
        parts.push("</ol>");
        inOrderedList = false;
      }
      if (!inUnorderedList) {
        parts.push("<ul>");
        inUnorderedList = true;
      }
      parts.push(`<li>${renderMarkdownInline(ulMatch[1])}</li>`);
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (inUnorderedList) {
        parts.push("</ul>");
        inUnorderedList = false;
      }
      if (!inOrderedList) {
        parts.push("<ol>");
        inOrderedList = true;
      }
      parts.push(`<li>${renderMarkdownInline(olMatch[1])}</li>`);
      continue;
    }

    const quoteMatch = line.match(/^>\s?(.+)$/);
    if (quoteMatch) {
      if (!inBlockquote) {
        closeBlocks();
        parts.push("<blockquote>");
        inBlockquote = true;
      }
      parts.push(`<p>${renderMarkdownInline(quoteMatch[1])}</p>`);
      continue;
    }

    closeBlocks();
    parts.push(`<p>${renderMarkdownInline(line)}</p>`);
  }

  closeBlocks();
  return parts.join("");
}

function setPendingSignupIdToken(idToken) {
  if (!idToken || typeof idToken !== "string") {
    return;
  }
  try {
    window.sessionStorage.setItem(PENDING_SIGNUP_ID_TOKEN_KEY, idToken);
  } catch {
    // Ignore storage errors.
  }
}

function getPendingSignupIdToken() {
  try {
    const token = window.sessionStorage.getItem(PENDING_SIGNUP_ID_TOKEN_KEY);
    return token && String(token).trim() ? token : "";
  } catch {
    return "";
  }
}

function clearPendingSignupIdToken() {
  try {
    window.sessionStorage.removeItem(PENDING_SIGNUP_ID_TOKEN_KEY);
  } catch {
    // Ignore storage errors.
  }
}

function setAccessToken(token) {
  if (authTokenApi && typeof authTokenApi.setAccessToken === "function") {
    authTokenApi.setAccessToken(token);
  }
}

function clearAccessToken() {
  if (authTokenApi && typeof authTokenApi.clearAccessToken === "function") {
    authTokenApi.clearAccessToken();
  }
}

function authFetch(input, init) {
  if (authTokenApi && typeof authTokenApi.authFetch === "function") {
    return authTokenApi.authFetch(input, init);
  }
  return fetch(input, init);
}

async function redirectIfAlreadyAuthenticated() {
  if (signupPage || signupProfilePage) {
    return false;
  }
  if (!authTokenApi || typeof authTokenApi.getAccessToken !== "function") {
    return false;
  }
  const token = authTokenApi.getAccessToken();
  if (!token) {
    return false;
  }
  try {
    const res = await authFetch("/auth/me");
    if (!res.ok) {
      if (res.status === 401 || res.status === 403) {
        clearAccessToken();
      }
      return false;
    }
    const payload = await res.json();
    if (payload && payload.authenticated) {
      window.location.replace(AppPath.toApp("/map/Index.html"));
      return true;
    }
    return false;
  } catch {
    return false;
  }
}

function cacheProfileUser(user) {
  if (!user || typeof user !== "object") {
    return;
  }
  const normalized = {
    userId: Number(user.userId || user.user_id || 0) || null,
    username: user.username == null ? null : String(user.username),
    iconUrl: user.iconUrl || user.icon_url || null,
    isGuest: Boolean(user.isGuest || user.is_guest),
    totalTactileLength: Number(user.totalTactileLength || user.total_tactile_length || 0) || 0,
    totalRoadPosts: Number(user.totalRoadPosts || user.total_road_posts || 0) || 0,
    totalHearts: Number(user.totalHearts || user.total_hearts || 0) || 0,
  };
  try {
    window.sessionStorage.setItem(PROFILE_CACHE_KEY, JSON.stringify(normalized));
  } catch {
    // Ignore storage errors.
  }
}

async function loginWithGoogle(idToken) {
  try {
    const res = await fetch(AppPath.toApi("/auth/google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id_token: idToken }),
    });

    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMessage = payload.error || "google_auth_failed";
      if (errorMessage === "account_not_found") {
        setPendingSignupIdToken(idToken);
        setGoogleStatus("未登録のGoogleアカウントです。サインアップ画面へ移動します...");
        window.location.href = AppPath.toApp("/auth/signup_profile.html");
        return false;
      }
      if (errorMessage === "invalid_token") {
        setGoogleStatus(
          "Googleトークン検証に失敗しました。Google CloudのClient IDとAuthorized JavaScript originsを確認してください。"
        );
        return false;
      }
      if (errorMessage === "login_failed") {
        setGoogleStatus("ログイン処理に失敗しました。サーバーログを確認してください。");
        return false;
      }
      setGoogleStatus(`Googleログインに失敗しました: ${errorMessage}`);
      return false;
    }

    if (payload && payload.access_token) {
      setAccessToken(payload.access_token);
    }
    const username = payload && payload.user ? payload.user.username : null;
    if (payload && payload.user) {
      cacheProfileUser(payload.user);
    }
    if (!username || !String(username).trim()) {
      setGoogleStatus("ログイン成功。サインアップ画面へ移動します...");
      window.location.href = AppPath.toApp("/auth/signup_profile.html");
      return true;
    }

    setGoogleStatus("ログイン成功。地図画面へ移動します...");
    window.location.href = AppPath.toApp("/map/Index.html");
    return true;
  } catch (err) {
    const detail = err && err.message ? String(err.message) : "unknown_error";
    setGoogleStatus(`エラーが出てGoogleログインに失敗しました: ${detail}`);
    return false;
  }
}

async function loginAsGuest() {
  const text = getAuthText();
  if (guestLoginButton) {
    guestLoginButton.disabled = true;
  }
  try {
    setGoogleStatus(text.guestChecking);
    const res = await fetch(AppPath.toApi("/auth/guest"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    const payload = await res.json().catch(() => null);
    if (!res.ok) {
      const errorMessage = payload && payload.error ? payload.error : `status_${res.status}`;
      const errorDetail = payload && payload.message ? String(payload.message) : "";
      if (res.status === 409 || errorMessage === "already_authenticated") {
        setGoogleStatus(text.guestAlreadyAuthenticated);
        window.location.href = AppPath.toApp("/map/Index.html");
        return true;
      }
      setGoogleStatus(`${text.guestFailed}: ${errorMessage}${errorDetail ? ` (${errorDetail})` : ""}`);
      return false;
    }

    if (!payload || !payload.access_token) {
      setGoogleStatus(`${text.guestResponseMissing}: status_${res.status}`);
      return false;
    }

    if (payload && payload.access_token) {
      setAccessToken(payload.access_token);
    }
    if (payload && payload.user) {
      cacheProfileUser(payload.user);
    }
    setGoogleStatus(text.guestSuccess);
    window.location.href = AppPath.toApp("/map/Index.html");
    return true;
  } catch {
    setGoogleStatus(text.guestNetworkError);
    return false;
  } finally {
    if (guestLoginButton) {
      guestLoginButton.disabled = false;
    }
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("file_read_failed"));
    reader.readAsDataURL(file);
  });
}

async function ensureSignupProfileSession() {
  try {
    const res = await authFetch("/auth/me");
    if (!res.ok) {
      window.location.replace(AppPath.toApp("/auth/login.html"));
      return null;
    }
    const payload = await res.json();
    const user = payload && payload.user ? payload.user : null;
    if (!user) {
      window.location.replace(AppPath.toApp("/auth/login.html"));
      return null;
    }
    if (user.username && String(user.username).trim()) {
      window.location.replace(AppPath.toApp("/map/Index.html"));
      return null;
    }
    return user;
  } catch {
    window.location.replace(AppPath.toApp("/auth/login.html"));
    return null;
  }
}

async function initSignupProfilePage() {
  const pendingSignupIdToken = getPendingSignupIdToken();
  let user = null;
  let deferredSignupMode = false;
  if (pendingSignupIdToken) {
    deferredSignupMode = true;
  } else {
    user = await ensureSignupProfileSession();
    if (!user) {
      return;
    }
  }

  const form = document.getElementById("signup-profile-form");
  const usernameInput = document.getElementById("signup-profile-username");
  const iconInput = document.getElementById("signup-profile-icon");
  const preview = document.getElementById("signup-profile-icon-preview");
  const agreementCheckbox = document.getElementById("signup-agreement-checkbox");
  const submitButton = document.getElementById("signup-profile-submit");
  const agreementModal = document.getElementById("user-agreement-modal");
  const agreementContent = document.getElementById("user-agreement-content");
  const openAgreementButton = document.getElementById("open-user-agreement");
  const closeAgreementButton = document.getElementById("close-user-agreement");
  if (
    !form ||
    !usernameInput ||
    !iconInput ||
    !preview ||
    !agreementCheckbox ||
    !submitButton ||
    !agreementModal ||
    !agreementContent ||
    !openAgreementButton ||
    !closeAgreementButton
  ) {
    return;
  }

  let agreementLoaded = false;
  const openAgreementModal = async () => {
    agreementModal.classList.remove("hidden");
    if (agreementLoaded) {
      return;
    }
    agreementContent.textContent = "読み込み中...";
    try {
      const res = await fetch(AppPath.toApp("/assets/user_agreement.md"), { cache: "no-store" });
      if (!res.ok) {
        agreementContent.textContent = "利用規約の読み込みに失敗しました。";
        return;
      }
      const text = await res.text();
      agreementContent.innerHTML = renderMarkdownToHtml(text);
      agreementLoaded = true;
    } catch {
      agreementContent.textContent = "利用規約の読み込みに失敗しました。";
    }
  };

  const closeAgreementModal = () => {
    agreementModal.classList.add("hidden");
  };

  const syncSubmitButtonState = () => {
    submitButton.disabled = !agreementCheckbox.checked;
  };

  openAgreementButton.addEventListener("click", () => {
    openAgreementModal();
  });
  closeAgreementButton.addEventListener("click", closeAgreementModal);
  agreementCheckbox.addEventListener("change", syncSubmitButtonState);
  agreementModal.addEventListener("click", (event) => {
    if (event.target === agreementModal) {
      closeAgreementModal();
    }
  });
  syncSubmitButtonState();

  let previewUrl = "";
  iconInput.addEventListener("change", () => {
    const file = iconInput.files && iconInput.files[0];
    if (!file || !file.type.startsWith("image/")) {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        previewUrl = "";
      }
      preview.removeAttribute("src");
      preview.classList.add("hidden");
      return;
    }
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    previewUrl = URL.createObjectURL(file);
    preview.src = previewUrl;
    preview.classList.remove("hidden");
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = usernameInput.value ? usernameInput.value.trim() : "";
    const iconFile = iconInput.files && iconInput.files[0] ? iconInput.files[0] : null;

    if (!username) {
      setGoogleStatus("アカウント名を入力してください。");
      return;
    }
    if (!iconFile) {
      setGoogleStatus("アイコン画像を選択してください。");
      return;
    }
    if (!iconFile.type.startsWith("image/")) {
      setGoogleStatus("画像ファイルを選択してください。");
      return;
    }
    if (!agreementCheckbox.checked) {
      setGoogleStatus("利用規約に同意してください。");
      return;
    }

    try {
      setGoogleStatus("保存中です...");
      const iconDataUrl = await fileToDataUrl(iconFile);
      let res;
      if (deferredSignupMode) {
        res = await fetch(AppPath.toApi("/auth/google/signup"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id_token: pendingSignupIdToken,
            username,
            icon_data_url: iconDataUrl,
          }),
        });
      } else {
        res = await authFetch("/auth/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            username,
            icon_data_url: iconDataUrl,
          }),
        });
      }
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        const errorMessage = payload.error || "profile_update_failed";
        if (errorMessage === "missing_username") {
          setGoogleStatus("アカウント名を入力してください。");
          return;
        }
        if (errorMessage === "username_too_long") {
          setGoogleStatus("アカウント名は50文字以内で入力してください。");
          return;
        }
        if (errorMessage === "invalid_icon_image") {
          setGoogleStatus("アイコン画像が不正です。別の画像で再試行してください。");
          return;
        }
        if (errorMessage === "missing_icon_image") {
          setGoogleStatus("アイコン画像を選択してください。");
          return;
        }
        if (errorMessage === "account_not_found") {
          clearPendingSignupIdToken();
          setGoogleStatus("登録状態の確認に失敗しました。ログイン画面からやり直してください。");
          window.location.replace(AppPath.toApp("/auth/login.html"));
          return;
        }
        if (errorMessage === "invalid_token") {
          clearPendingSignupIdToken();
          clearAccessToken();
          setGoogleStatus("Google認証の有効期限が切れました。ログイン画面から再度お試しください。");
          window.location.replace(AppPath.toApp("/auth/login.html"));
          return;
        }
        setGoogleStatus(`保存に失敗しました: ${errorMessage}`);
        return;
      }

      try {
        const payload = await res.json().catch(() => ({}));
        if (payload && payload.access_token) {
          setAccessToken(payload.access_token);
        }
        if (payload && payload.user) {
          cacheProfileUser(payload.user);
        }
      } catch {
        // Ignore parse/cache failure.
      }
      clearPendingSignupIdToken();
      setGoogleStatus("保存しました。地図画面へ移動します...");
      window.location.href = AppPath.toApp("/map/Index.html");
    } catch {
      setGoogleStatus("ネットワークエラーで保存に失敗しました。");
    }
  });
}

async function handleGoogleCredential(response) {
  const idToken = response && response.credential;
  if (!idToken) {
    setGoogleStatus("Google認証トークンの取得に失敗しました。");
    return;
  }

  setGoogleStatus(signupPage ? "Googleサインアップを確認中です..." : "Googleログインを確認中です...");
  if (signupPage) {
    setPendingSignupIdToken(idToken);
    setGoogleStatus("サインアップ画面へ移動します...");
    window.location.href = AppPath.toApp("/auth/signup_profile.html");
    return;
  }
  await loginWithGoogle(idToken);
}

function initGoogleSignIn() {
  if (signupProfilePage) {
    return;
  }
  const buttonContainer = document.getElementById("google-signin-button");
  if (!buttonContainer) {
    return;
  }

  const initialize = () => {
    if (!(window.google && window.google.accounts && window.google.accounts.id)) {
      setGoogleStatus("Googleログインの読み込みに失敗しました。");
      return;
    }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: handleGoogleCredential,
    });
    window.google.accounts.id.renderButton(buttonContainer, {
      theme: "outline",
      size: "large",
      shape: "pill",
      text: signupPage ? "signup_with" : "signin_with",
      width: 320,
    });
  };

  if (document.readyState === "complete") {
    initialize();
    return;
  }
  window.addEventListener("load", initialize, { once: true });
}

function initGuestLogin() {
  if (signupPage || signupProfilePage || !guestLoginButton) {
    return;
  }
  guestLoginButton.addEventListener("click", () => {
    void loginAsGuest();
  });
}

(async () => {
  initLoginViewportMetrics();
  if (signupProfilePage) {
    initSignupProfilePage();
    return;
  }
  const redirected = await redirectIfAlreadyAuthenticated();
  if (redirected) {
    return;
  }
  initGoogleSignIn();
  initGuestLogin();
})();
