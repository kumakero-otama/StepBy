// 利用者へ知らせる更新内容は、新しいものを先頭へ追加する。
// 各項目のidは閲覧記録の識別子になるため、公開後は変更・再利用しない。
(function initializeStepByChangelog(globalScope) {
  const entries = [
    {
      version: "1.29.1",
      date: "2026-10-04",
      items: [
        {
          id: "1.29.1.changelog-popup",
          text: {
            ja: "アプリ更新後の初回起動時に、更新内容を確認できるようになりました。",
            en: "The latest changes are now shown the first time you open an updated version of the app.",
            hi: "ऐप अपडेट होने के बाद पहली बार खोलने पर अब नवीनतम बदलाव दिखाई देंगे।",
          },
        },
        {
          id: "1.29.1.help-form",
          text: {
            ja: "ヘルプページのフォーム一覧を整備し、「StepByご意見・ご質問フォーム」として分かりやすくしました。",
            en: "The forms section on the Help page now clearly lists the StepBy Feedback and Questions Form.",
            hi: "सहायता पेज की फ़ॉर्म सूची में अब StepBy सुझाव और प्रश्न फ़ॉर्म स्पष्ट रूप से दिखाया गया है।",
          },
        },
        {
          id: "1.29.1.pro-faq",
          text: {
            ja: "FAQにPROモードの切り替え方法を追加しました。",
            en: "The FAQ now explains how to switch PRO mode.",
            hi: "FAQ में PRO मोड बदलने का तरीका जोड़ा गया है।",
          },
        },
      ],
      labels: {
        ja: { title: "新バージョン v1.29.1", close: "閉じる" },
        en: { title: "New version v1.29.1", close: "Close" },
        hi: { title: "नया संस्करण v1.29.1", close: "बंद करें" },
      },
    },
  ];

  const SEEN_ITEM_KEY_PREFIX = "stepby.changelog.seenItems.v2.";
  let showPromise = null;

  function currentLanguage() {
    const lang = String(document.documentElement.lang || "ja").toLowerCase();
    if (lang.startsWith("en")) return "en";
    if (lang.startsWith("hi")) return "hi";
    return "ja";
  }

  function currentUserScope() {
    try {
      const token = localStorage.getItem("access_token.v1") || "";
      const payloadPart = token.split(".")[1];
      if (!payloadPart) return "signed-out";
      const normalized = payloadPart.replace(/-/g, "+").replace(/_/g, "/");
      const bytes = atob(normalized);
      const encoded = Array.from(bytes, (char) =>
        `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`).join("");
      const payload = JSON.parse(decodeURIComponent(encoded));
      const userId = Number(payload && payload.sub);
      return Number.isFinite(userId) && userId > 0 ? `user-${Math.trunc(userId)}` : "signed-out";
    } catch {
      return "signed-out";
    }
  }

  function localSeenItems(scope) {
    try {
      const parsed = JSON.parse(localStorage.getItem(`${SEEN_ITEM_KEY_PREFIX}${scope}`) || "[]");
      return new Set(Array.isArray(parsed) ? parsed.filter((id) => typeof id === "string") : []);
    } catch {
      return new Set();
    }
  }

  function saveLocalSeenItems(scope, itemIds) {
    try {
      localStorage.setItem(`${SEEN_ITEM_KEY_PREFIX}${scope}`, JSON.stringify(Array.from(itemIds)));
    } catch {}
  }

  function authFetch(path, init) {
    if (globalScope.AuthToken && typeof globalScope.AuthToken.authFetch === "function") {
      return globalScope.AuthToken.authFetch(path, init);
    }
    return fetch(path, init);
  }

  async function serverSeenItems() {
    try {
      const response = await authFetch("/api/changelog-views", { cache: "no-store" });
      if (!response.ok) return null;
      const body = await response.json();
      return new Set((body.items || []).map((item) => item.itemId).filter(Boolean));
    } catch {
      return null;
    }
  }

  function findItem(itemId) {
    for (const entry of entries) {
      const item = entry.items.find((candidate) => candidate.id === itemId);
      if (item) return { entry, item };
    }
    return null;
  }

  async function recordItems(itemIds, language) {
    const grouped = new Map();
    itemIds.forEach((itemId) => {
      const found = findItem(itemId);
      if (!found) return;
      if (!grouped.has(found.entry.version)) grouped.set(found.entry.version, []);
      grouped.get(found.entry.version).push({
        itemId,
        text: found.item.text[language] || found.item.text.ja,
      });
    });
    for (const [version, items] of grouped) {
      if (!items.length) continue;
      try {
        await authFetch("/api/changelog-views", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ version, language, items }),
        });
      } catch {}
    }
  }

  function renderBanner(latest, visibleItems, language) {
    const labels = latest.labels[language] || latest.labels.ja;
    const banner = document.createElement("aside");
    banner.id = "map-changelog-banner";
    banner.className = "map-changelog-banner";
    banner.setAttribute("role", "status");
    banner.setAttribute("aria-live", "polite");

    const copy = document.createElement("div");
    copy.className = "map-changelog-copy";
    const title = document.createElement("strong");
    title.className = "map-changelog-title";
    title.textContent = labels.title;
    const list = document.createElement("ul");
    list.className = "map-changelog-list";
    visibleItems.forEach((item) => {
      const listItem = document.createElement("li");
      listItem.dataset.changelogItemId = item.id;
      listItem.textContent = item.text[language] || item.text.ja;
      list.appendChild(listItem);
    });
    copy.append(title, list);

    const close = document.createElement("button");
    close.type = "button";
    close.className = "map-changelog-close";
    close.textContent = labels.close;
    close.setAttribute("aria-label", labels.close);
    close.addEventListener("click", () => {
      banner.classList.remove("is-visible");
      window.setTimeout(() => banner.remove(), 220);
    });

    banner.append(copy, close);
    const anchor = document.querySelector(".map-app-bar-spacer");
    if (anchor) anchor.insertAdjacentElement("afterend", banner);
    else document.body.prepend(banner);
    requestAnimationFrame(() => banner.classList.add("is-visible"));
  }

  async function showLatestOnce() {
    const latest = entries[0];
    if (!latest || document.getElementById("map-changelog-banner")) return false;
    const language = currentLanguage();
    const scope = currentUserScope();
    const localItems = localSeenItems(scope);
    const remoteItems = await serverSeenItems();
    const seenItems = new Set([...localItems, ...(remoteItems || [])]);

    // 以前オフラインで記録した項目も、通信復帰時にユーザー単位のサーバー記録へ同期する。
    if (localItems.size) void recordItems(localItems, language);

    const visibleItems = latest.items.filter((item) => !seenItems.has(item.id));
    if (!visibleItems.length) return false;
    renderBanner(latest, visibleItems, language);

    visibleItems.forEach((item) => seenItems.add(item.id));
    saveLocalSeenItems(scope, seenItems);
    void recordItems(new Set(visibleItems.map((item) => item.id)), language);
    return true;
  }

  function showLatest() {
    if (!showPromise) showPromise = showLatestOnce().finally(() => { showPromise = null; });
    return showPromise;
  }

  globalScope.StepByChangelog = Object.freeze({
    entries,
    latestVersion: entries[0].version,
    showLatest,
  });
})(window);
