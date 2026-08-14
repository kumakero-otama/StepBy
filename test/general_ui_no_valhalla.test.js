const assert = require("assert");
const fs = require("fs");
const path = require("path");

for (const name of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const html = fs.readFileSync(path.join(__dirname, "../UI10/map", name), "utf8");
  assert.doesNotMatch(html, /fitting-comparison-panel|comparison-test-button|fitting-detail-modal|Valhalla/);
}
const source = fs.readFileSync(path.join(__dirname, "../UI10/map/map.js"), "utf8");
const normalFunction = source.slice(source.indexOf("function requestSnappedLocation"), source.indexOf("if (comparisonTestButtonEl)"));
assert.doesNotMatch(normalFunction, /\/api\/match|compareValhalla|saveFittingComparison|renderFittingComparison/);
assert.match(normalFunction, /browserOsmMatcher\.match/);

for (const [relativePath, expectedTitle] of [
  ["profile/Index.html", "プロフィール"],
  ["help/Index.html", "ヘルプ"],
  ["setting/Index.html", "設定"],
]) {
  const html = fs.readFileSync(path.join(__dirname, "../UI10", relativePath), "utf8");
  assert.match(
    html,
    new RegExp(`<h1 class="app-bar-title">${expectedTitle}</h1>`),
    `日本語画面 ${relativePath} の上部タイトルを日本語で表示すること`,
  );
}
console.log("general UI and normal fitting path have no Valhalla dependency");
