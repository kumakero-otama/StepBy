// UI11開発環境専用。公開中のUI0とはURL・API・キャッシュを完全に分離する。
(function initAppConfig(globalScope) {
  const defaults = {
    APP_BASE_PATH: "/StepBy/UI11",
    API_BASE_URL: "https://stepby-api-8-229-191-182.sslip.io",
    ENVIRONMENT: "development",
  };

  const current = globalScope.APP_CONFIG || {};
  globalScope.APP_CONFIG = {
    APP_BASE_PATH: typeof current.APP_BASE_PATH === "string" ? current.APP_BASE_PATH : defaults.APP_BASE_PATH,
    API_BASE_URL: typeof current.API_BASE_URL === "string" ? current.API_BASE_URL : defaults.API_BASE_URL,
    ENVIRONMENT: defaults.ENVIRONMENT,
  };

  globalScope.addEventListener("DOMContentLoaded", () => {
    if (document.querySelector("[data-stepby-dev-badge]")) return;
    const badge = document.createElement("div");
    badge.dataset.stepbyDevBadge = "true";
    badge.textContent = "UI11 · DEV";
    badge.setAttribute("aria-label", "StepBy UI11 開発環境");
    Object.assign(badge.style, {
      position: "fixed",
      top: "8px",
      right: "8px",
      zIndex: "2147483647",
      padding: "5px 9px",
      borderRadius: "999px",
      color: "#ffffff",
      background: "#9d3f31",
      font: "700 11px/1.2 system-ui, sans-serif",
      letterSpacing: ".06em",
      boxShadow: "0 4px 14px rgba(0,0,0,.18)",
      pointerEvents: "none",
    });
    document.body.appendChild(badge);
  }, { once: true });
})(window);
