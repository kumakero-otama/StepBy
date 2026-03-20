// アプリケーションバージョン
const FRONTEND_VERSION = "1.3.9";
const BACKEND_VERSION = "1.18.7";

// バージョン番号を表示する関数
function displayVersion() {
  const versionElement = document.getElementById("app-version");
  if (versionElement) {
    versionElement.innerHTML = `フロントエンド: v${FRONTEND_VERSION}<br>バックエンド: v${BACKEND_VERSION}`;
  }
}

// DOMContentLoadedイベントで実行
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", displayVersion);
} else {
  displayVersion();
}
