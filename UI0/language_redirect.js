(() => {
  const LANGUAGE_SETTINGS_KEY = "displayLanguage.v1";
  const DEFAULT_LANGUAGE = "ja";

  function loadLanguageSetting() {
    try {
      const savedLanguage = window.localStorage.getItem(LANGUAGE_SETTINGS_KEY);
      return ["ja", "en"].includes(savedLanguage) ? savedLanguage : DEFAULT_LANGUAGE;
    } catch {
      return DEFAULT_LANGUAGE;
    }
  }

  function buildTargetPathname(pathname, toEnglish) {
    if (typeof pathname !== "string" || !pathname) {
      return pathname;
    }
    if (toEnglish) {
      if (/_en\.html?$/.test(pathname)) {
        return pathname;
      }
      return pathname.replace(/\.html?$/, "_en.html");
    }
    return pathname.replace(/_en\.html?$/, ".html");
  }

  function applyLanguageRedirect() {
    const currentPath = window.location.pathname;
    if (!/\.html?$/.test(currentPath)) {
      return;
    }
    const selectedLanguage = loadLanguageSetting();
    const isEnglishPage = /_en\.html?$/.test(currentPath);

    if (selectedLanguage === "en" && !isEnglishPage) {
      const targetPath = buildTargetPathname(currentPath, true);
      if (targetPath !== currentPath) {
        window.location.replace(`${targetPath}${window.location.search}${window.location.hash}`);
      }
      return;
    }

    if (selectedLanguage === "ja" && isEnglishPage) {
      const targetPath = buildTargetPathname(currentPath, false);
      if (targetPath !== currentPath) {
        window.location.replace(`${targetPath}${window.location.search}${window.location.hash}`);
      }
    }
  }

  applyLanguageRedirect();
})();
