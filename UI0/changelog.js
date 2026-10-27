// 利用者へ知らせる更新内容は、新しいものを先頭へ追加する。
// 各項目のidは閲覧記録の識別子になるため、公開後は変更・再利用しない。
(function initializeStepByChangelog(globalScope) {
  const entries = [
    {
      version: "1.30.5",
      date: "2026-10-27",
      items: [
        {
          id: "1.30.5.gps-recovery",
          text: {
            ja: "アプリを開いたままでも現在地追跡が止まった際に自動復旧し、赤い現在地ピンが移動へ追従し続けるよう改善しました。",
            en: "Location tracking now recovers automatically if it stalls while the app remains open, keeping the red location pin moving with you.",
            hi: "ऐप खुला रहने पर स्थान ट्रैकिंग रुकने की स्थिति में अब यह अपने-आप फिर शुरू होती है और लाल स्थान पिन आपके साथ चलता रहता है।",
          },
        },
        {
          id: "1.30.5.record-confirmation-speed",
          text: {
            ja: "記録終了後は取得済みの道路情報を優先し、確認画面をより早く表示するよう改善しました。",
            en: "The confirmation screen now opens faster after recording by prioritizing already downloaded road data.",
            hi: "रिकॉर्डिंग समाप्त होने के बाद पहले से डाउनलोड सड़क डेटा को प्राथमिकता देकर पुष्टि स्क्रीन अब तेज़ी से खुलती है।",
          },
        },
        {
          id: "1.30.5.osm-local-cache-refresh",
          text: {
            ja: "岡山市内のOSM点字ブロック情報を繰り返し再取得していた問題を修正し、保存済み情報を安定して表示するよう改善しました。",
            en: "Fixed repeated reloading of cached OSM tactile-paving data in Okayama City so saved information now displays reliably.",
            hi: "ओकायामा शहर में कैश किए गए OSM टैक्टाइल पेविंग डेटा को बार-बार लोड करने की समस्या ठीक की गई है, जिससे सहेजी गई जानकारी अब स्थिर रूप से दिखाई देती है।",
          },
        },
      ],
      labels: {
        ja: { title: "新バージョン v1.30.5", close: "閉じる" },
        en: { title: "New version v1.30.5", close: "Close" },
        hi: { title: "नया संस्करण v1.30.5", close: "बंद करें" },
      },
    },
    {
      version: "1.30.4",
      date: "2026-10-25",
      items: [
        {
          id: "1.30.4.osm-cold-load",
          text: {
            ja: "OSM点字ブロック情報の初回取得が地図操作を待たせないようにし、同じ範囲の重複通信を減らしました。",
            en: "Initial OSM tactile-paving retrieval no longer delays map use, and duplicate requests for the same area have been reduced.",
            hi: "OSM टैक्टाइल पेविंग की पहली प्राप्ति अब नक्शे के उपयोग को नहीं रोकती और एक ही क्षेत्र के दोहराए गए अनुरोध कम किए गए हैं।",
          },
        },
      ],
      labels: {
        ja: { title: "新バージョン v1.30.4", close: "閉じる" },
        en: { title: "New version v1.30.4", close: "Close" },
        hi: { title: "नया संस्करण v1.30.4", close: "बंद करें" },
      },
    },
    {
      version: "1.30.3",
      date: "2026-10-25",
      items: [
        {
          id: "1.30.3.osm-tile-cache",
          text: {
            ja: "OSMの点字ブロック情報を地図の表示範囲ごとに保存し、取得済みの地域をすばやく表示できるよう改善しました。",
            en: "OSM tactile-paving information is now cached by visible map area so previously fetched regions appear faster.",
            hi: "OSM टैक्टाइल पेविंग जानकारी अब दिखाई देने वाले नक्शा क्षेत्र के अनुसार कैश होती है, जिससे पहले प्राप्त क्षेत्र तेज़ी से दिखते हैं।",
          },
        },
      ],
      labels: {
        ja: { title: "新バージョン v1.30.3", close: "閉じる" },
        en: { title: "New version v1.30.3", close: "Close" },
        hi: { title: "नया संस्करण v1.30.3", close: "बंद करें" },
      },
    },
    {
      version: "1.30.2",
      date: "2026-10-24",
      items: [
        {
          id: "1.30.2.osm-display-speed",
          text: {
            ja: "OSMの点字ブロック情報を、取得済みの地域ではすぐに表示し、バックグラウンドで更新するよう高速化しました。",
            en: "Previously fetched OSM tactile-paving information now appears immediately and refreshes in the background.",
            hi: "पहले प्राप्त OSM टैक्टाइल पेविंग जानकारी अब तुरंत दिखाई जाती है और पृष्ठभूमि में अपडेट होती है।",
          },
        },
      ],
      labels: {
        ja: { title: "新バージョン v1.30.2", close: "閉じる" },
        en: { title: "New version v1.30.2", close: "Close" },
        hi: { title: "नया संस्करण v1.30.2", close: "बंद करें" },
      },
    },
    {
      version: "1.30.1",
      date: "2026-10-24",
      items: [
        {
          id: "1.30.1.fitted-location-only",
          text: {
            ja: "現在地表示を、道路上に補正された赤いピンだけに統一しました。",
            en: "The map now shows only the road-matched red pin for your current location.",
            hi: "वर्तमान स्थान के लिए अब केवल सड़क से मिलाया गया लाल पिन दिखाया जाता है।",
          },
        },
      ],
      labels: {
        ja: { title: "新バージョン v1.30.1", close: "閉じる" },
        en: { title: "New version v1.30.1", close: "Close" },
        hi: { title: "नया संस्करण v1.30.1", close: "बंद करें" },
      },
    },
    {
      version: "1.30.0",
      date: "2026-10-24",
      items: [
        {
          id: "1.30.0.live-location",
          text: {
            ja: "現在地の黄緑の点と、道路上に補正された赤いピンが安定して更新されるよう改善しました。",
            en: "The live green location dot and the road-matched red pin now update more reliably.",
            hi: "लाइव हरा स्थान बिंदु और सड़क से मिलाया गया लाल पिन अब अधिक स्थिरता से अपडेट होते हैं।",
          },
        },
        {
          id: "1.30.0.record-preservation",
          text: {
            ja: "道路上の経路を確定できない場合も、歩行記録を失わず保存できるよう改善しました。",
            en: "Walking records are now preserved even when a road-aligned route cannot be confirmed immediately.",
            hi: "सड़क से जुड़ा मार्ग तुरंत तय न हो पाने पर भी चलने का रिकॉर्ड अब सुरक्षित रहता है।",
          },
        },
        {
          id: "1.30.0.osm-progressive-load",
          text: {
            ja: "OSMの点字ブロック情報を、地図を操作しながら中心付近から順次表示するよう高速化しました。",
            en: "OSM tactile-paving information now loads progressively from the map center without blocking map use.",
            hi: "OSM टैक्टाइल पेविंग जानकारी अब नक्शे के केंद्र से क्रमशः लोड होती है और नक्शे का उपयोग नहीं रोकती।",
          },
        },
      ],
      labels: {
        ja: { title: "新バージョン v1.30.0", close: "閉じる" },
        en: { title: "New version v1.30.0", close: "Close" },
        hi: { title: "नया संस्करण v1.30.0", close: "बंद करें" },
      },
    },
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
