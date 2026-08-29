// UI0開発環境専用。公開中のUI0とはURL・API・キャッシュを完全に分離する。
(function initAppConfig(globalScope) {
  const defaults = {
    APP_BASE_PATH: "/StepBy/UI0",
    API_BASE_URL: "https://stepby-api-8-229-191-182.sslip.io",
    ENVIRONMENT: "development",
  };

  const current = globalScope.APP_CONFIG || {};
  globalScope.APP_CONFIG = {
    APP_BASE_PATH: typeof current.APP_BASE_PATH === "string" ? current.APP_BASE_PATH : defaults.APP_BASE_PATH,
    API_BASE_URL: typeof current.API_BASE_URL === "string" ? current.API_BASE_URL : defaults.API_BASE_URL,
    ENVIRONMENT: defaults.ENVIRONMENT,
  };
})(window);
