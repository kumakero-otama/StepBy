(function initAppConfig(globalScope) {
  const defaults = {
    APP_BASE_PATH: "/StepBy/UI1",
    API_BASE_URL: "https://barrierfree-map.loophole.site",
  };

  const current = globalScope.APP_CONFIG || {};
  globalScope.APP_CONFIG = {
    APP_BASE_PATH: typeof current.APP_BASE_PATH === "string" ? current.APP_BASE_PATH : defaults.APP_BASE_PATH,
    API_BASE_URL: typeof current.API_BASE_URL === "string" ? current.API_BASE_URL : defaults.API_BASE_URL,
    VERSION: '1.1.2'
  };
})(window);









