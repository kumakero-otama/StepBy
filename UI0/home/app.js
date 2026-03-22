const clockEl = document.getElementById("clock");
const homeProBadgeEl = document.getElementById("home-pro-badge");
const authTokenApi = window.AuthToken || null;

function authFetch(input, init) {
  if (authTokenApi && typeof authTokenApi.authFetch === "function") {
    return authTokenApi.authFetch(input, init);
  }
  return fetch(input, init);
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

async function loadHomeProStatus() {
  if (!homeProBadgeEl) {
    return;
  }
  homeProBadgeEl.hidden = true;
  try {
    const res = await authFetch("/api/pro-status", { cache: "no-store" });
    if (!res.ok) {
      return;
    }
    const payload = await res.json().catch(() => null);
    const isPro = parseIsPro(payload);
    homeProBadgeEl.hidden = !Boolean(isPro);
  } catch {
    homeProBadgeEl.hidden = true;
  }
}

// ホーム画面の時刻表示を現在時刻で更新する。
function updateClock() {
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  clockEl.textContent = `${hh}:${mm}:${ss}`;
}

updateClock();
setInterval(updateClock, 1000);
loadHomeProStatus();
