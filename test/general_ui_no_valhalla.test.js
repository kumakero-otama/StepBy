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
console.log("general UI and normal fitting path have no Valhalla dependency");
