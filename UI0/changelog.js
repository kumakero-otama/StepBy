// 利用者へ知らせる更新内容は、新しいものを先頭へ追加する。
// versionはversion.jsのFRONTEND_VERSIONと一致させる。
(function initializeStepByChangelog(globalScope) {
  const entries = [
    {
      version: "1.29.1",
      date: "2026-10-04",
      content: {
        ja: {
          title: "新バージョン v1.29.1",
          items: [
            "アプリ更新後の初回起動時に、更新内容を確認できるようになりました。",
            "ヘルプページのフォーム一覧を整備し、「StepByご意見・ご質問フォーム」として分かりやすくしました。",
            "FAQにPROモードの切り替え方法を追加しました。",
          ],
          close: "閉じる",
        },
        en: {
          title: "New version v1.29.1",
          items: [
            "The latest changes are now shown the first time you open an updated version of the app.",
            "The forms section on the Help page now clearly lists the StepBy Feedback and Questions Form.",
            "The FAQ now explains how to switch PRO mode.",
          ],
          close: "Close",
        },
        hi: {
          title: "नया संस्करण v1.29.1",
          items: [
            "ऐप अपडेट होने के बाद पहली बार खोलने पर अब नवीनतम बदलाव दिखाई देंगे।",
            "सहायता पेज की फ़ॉर्म सूची में अब StepBy सुझाव और प्रश्न फ़ॉर्म स्पष्ट रूप से दिखाया गया है।",
            "FAQ में PRO मोड बदलने का तरीका जोड़ा गया है।",
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
