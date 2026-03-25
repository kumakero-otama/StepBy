(() => {
  const LANGUAGE_SETTINGS_KEY = "displayLanguage.v1";
  const DEFAULT_LANGUAGE = "ja";
  const HINDI_UNSUPPORTED_PREFIXES = ["/home/", "/analog/"];

  function loadLanguageSetting() {
    try {
      const savedLanguage = window.localStorage.getItem(LANGUAGE_SETTINGS_KEY);
      return ["ja", "en", "hi"].includes(savedLanguage) ? savedLanguage : DEFAULT_LANGUAGE;
    } catch {
      return DEFAULT_LANGUAGE;
    }
  }

  function getLanguageNeutralPath(pathname) {
    if (typeof pathname !== "string" || !pathname) {
      return pathname;
    }
    return pathname.replace(/_(en|hi)\.html?$/, ".html");
  }

  function buildTargetPathname(pathname, language) {
    const neutralPath = getLanguageNeutralPath(pathname);
    if (language === "ja") {
      return neutralPath;
    }
    if (language === "en") {
      return neutralPath.replace(/\.html?$/, "_en.html");
    }
    if (language === "hi") {
      return neutralPath.replace(/\.html?$/, "_hi.html");
    }
    return pathname;
  }

  function isHindiUnsupportedPath(pathname) {
    return HINDI_UNSUPPORTED_PREFIXES.some((prefix) => pathname.includes(prefix));
  }

  function applyLanguageRedirect() {
    const currentPath = window.location.pathname;
    if (!/\.html?$/.test(currentPath)) {
      return;
    }
    const selectedLanguage = loadLanguageSetting();
    if (selectedLanguage === "hi" && isHindiUnsupportedPath(currentPath)) {
      return;
    }

    const targetPath = buildTargetPathname(currentPath, selectedLanguage);
    if (targetPath !== currentPath) {
      window.location.replace(`${targetPath}${window.location.search}${window.location.hash}`);
    }
  }

  applyLanguageRedirect();
})();
