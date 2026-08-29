const assert = require("assert");
const fs = require("fs");
const path = require("path");

for (const [relativePath, expectedTitle] of [
  ["profile/Index.html", "プロフィール"],
  ["help/Index.html", "ヘルプ"],
  ["setting/Index.html", "設定"],
]) {
  const html = fs.readFileSync(path.join(__dirname, "../UI0", relativePath), "utf8");
  assert.match(
    html,
    new RegExp(`<h1 class="app-bar-title">${expectedTitle}</h1>`),
    `日本語画面 ${relativePath} の上部タイトルを日本語で表示すること`,
  );
}

console.log("Japanese app-bar titles are localized");
