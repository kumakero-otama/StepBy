// このファイルはブラウザ言語と現在の URL を見て適切な言語ページへ誘導する。
(() => {
  const LANGUAGE_SETTINGS_KEY = "displayLanguage.v1";
  const DEFAULT_LANGUAGE = "ja";
  const HINDI_UNSUPPORTED_PREFIXES = [];

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

// テーマ（ライト/ダーク）・文字サイズ（小/中/大）を全UI0ページで早期適用するための初期化処理。
// language_redirect.js は全UI0ページの<head>で読まれるため、ここで data-theme / data-font-size 属性を
// <html>に付けておくことで、初回ペイント時から正しい配色・文字サイズが反映される。
(() => {
  const THEME_KEY = "displayTheme.v1";
  const FONT_SIZE_KEY = "displayFontSize.v1";
  const ALLOWED_THEMES = ["light", "dark", "system"];
  const ALLOWED_FONT_SIZES = ["small", "medium", "large"];

  function loadTheme() {
    try {
      const v = window.localStorage && localStorage.getItem(THEME_KEY);
      return ALLOWED_THEMES.includes(v) ? v : "light";
    } catch (e) { return "light"; }
  }
  function loadFontSize() {
    try {
      const v = window.localStorage && localStorage.getItem(FONT_SIZE_KEY);
      return ALLOWED_FONT_SIZES.includes(v) ? v : "small";
    } catch (e) { return "small"; }
  }
  function resolveEffectiveTheme(theme) {
    if (theme !== "system") return theme;
    try {
      return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    } catch (e) { return "light"; }
  }
  function applyAppearance() {
    const theme = loadTheme();
    const fontSize = loadFontSize();
    const root = document.documentElement;
    if (!root) return;
    root.setAttribute("data-theme", resolveEffectiveTheme(theme));
    root.setAttribute("data-theme-mode", theme);
    root.setAttribute("data-font-size", fontSize);
  }

  applyAppearance();

  try {
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    if (mql && typeof mql.addEventListener === "function") {
      mql.addEventListener("change", () => {
        if (loadTheme() === "system") applyAppearance();
      });
    }
  } catch (e) {}

  window.addEventListener("storage", (e) => {
    if (e && (e.key === THEME_KEY || e.key === FONT_SIZE_KEY)) applyAppearance();
  });

  window.UI0Appearance = {
    apply: applyAppearance,
    getTheme: loadTheme,
    getFontSize: loadFontSize,
    THEME_KEY,
    FONT_SIZE_KEY,
  };
})();
