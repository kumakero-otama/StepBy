// 利用者へ知らせる更新内容は、新しいものを先頭へ追加する。
// versionはversion.jsのFRONTEND_VERSIONと一致させる。
(function initializeStepByChangelog(globalScope) {
  const entries = [
    {
      version: "1.29.0",
      date: "2026-10-04",
      content: {
        ja: {
          title: "新バージョン v1.29.0",
          items: [
            "アプリ更新後の初回起動時に、更新内容を確認できるようになりました。",
            "ヘルプにPROモードの切り替え方法と、ご意見・ご質問フォームの案内を追加しました。",
          ],
          close: "閉じる",
        },
        en: {
          title: "New version v1.29.0",
          items: [
            "The latest changes are now shown the first time you open an updated version of the app.",
            "Help now explains how to switch PRO mode and links to the feedback and questions form.",
          ],
          close: "Close",
        },
        hi: {
          title: "नया संस्करण v1.29.0",
          items: [
            "ऐप अपडेट होने के बाद पहली बार खोलने पर अब नवीनतम बदलाव दिखाई देंगे।",
            "सहायता पेज में PRO मोड बदलने और सुझाव व प्रश्न फ़ॉर्म की जानकारी जोड़ी गई है।",
          ],
          close: "बंद करें",
        },
      },
    },
  ];

  const SEEN_VERSION_KEY = "stepby.changelog.lastSeenVersion.v1";
  let shownThisPage = false;

  function currentLanguage() {
    const lang = String(document.documentElement.lang || "ja").toLowerCase();
    if (lang.startsWith("en")) return "en";
    if (lang.startsWith("hi")) return "hi";
    return "ja";
  }

  function getSeenVersion() {
    try { return localStorage.getItem(SEEN_VERSION_KEY) || ""; } catch { return ""; }
  }

  function rememberVersion(version) {
    try { localStorage.setItem(SEEN_VERSION_KEY, version); } catch {}
  }

  function showLatest() {
    const latest = entries[0];
    if (!latest || shownThisPage || getSeenVersion() === latest.version) return false;
    shownThisPage = true;
    const language = currentLanguage();
    const text = latest.content[language] || latest.content.ja;
    const banner = document.createElement("aside");
    banner.id = "map-changelog-banner";
    banner.className = "map-changelog-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");

    const copy = document.createElement("div");
    copy.className = "map-changelog-copy";
    const title = document.createElement("strong");
    title.className = "map-changelog-title";
    title.textContent = text.title;
    const list = document.createElement("ul");
    list.className = "map-changelog-list";
    text.items.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.textContent = item;
      list.appendChild(listItem);
    });
    copy.append(title, list);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "map-changelog-close";
    close.textContent = text.close;
    close.setAttribute("aria-label", text.close);
    close.addEventListener("click", () => {
      banner.classList.remove("is-visible");
      window.setTimeout(() => banner.remove(), 220);
    });

    banner.append(copy, close);
    const anchor = document.querySelector(".map-app-bar-spacer");
    if (anchor) anchor.insertAdjacentElement("afterend", banner);
    else document.body.prepend(banner);
    rememberVersion(latest.version);
    requestAnimationFrame(() => banner.classList.add("is-visible"));
    return true;
  }

  globalScope.StepByChangelog = Object.freeze({ entries, latestVersion: entries[0].version, showLatest });
})(window);
