// アプリケーションバージョン
const FRONTEND_VERSION = "1.6.0";
const BACKEND_VERSION = "1.21.0";

const VERSION_LABELS = {
  ja: {
    frontend: "フロントエンド",
    backend: "バックエンド",
  },
  en: {
    frontend: "Frontend",
    backend: "Backend",
  },
  hi: {
    frontend: "फ्रंटएंड",
    backend: "बैकएंड",
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

// バージョン番号を表示する関数
function displayVersion() {
  const versionElement = document.getElementById("app-version");
  if (!versionElement) {
    return;
  }

  const language = getCurrentLanguage();
  const labels = VERSION_LABELS[language] || VERSION_LABELS.ja;
  versionElement.innerHTML = `${labels.frontend}: v${FRONTEND_VERSION}<br>${labels.backend}: v${BACKEND_VERSION}`;
}

// DOMContentLoadedイベントで実行
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", displayVersion);
} else {
  displayVersion();
}
