const assert = require("assert");
const fs = require("fs");
const path = require("path");

const mapSource = fs.readFileSync(path.join(__dirname, "../UI10/map/map.js"), "utf8");
for (const name of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const html = fs.readFileSync(path.join(__dirname, "../UI10/map", name), "utf8");
  assert.match(html, /class="pro-badge map-pro-badge"/);
}
assert.match(mapSource, /stepByBaseColor\s*=\s*recordColor/);
assert.match(mapSource, /activeTactileSessionPolyline\.options\.stepByBaseColor/);
assert.doesNotMatch(mapSource, /fetchOsmTactileDisplay\([\s\S]{0,200}?\.then\(\(res\)[\s\S]{0,120}?res\.ok/,
  "display helper already returns parsed data and must not be treated as a Response");
assert.match(mapSource, /if \(!isCenterCurrentEnabled\(\) && cached\.center/);
assert.match(mapSource, /suppressAutoCenterAfterReturn = false;[\s\S]{0,180}?map\.setView\(\[cached\.lat, cached\.lng\]/);
assert.doesNotMatch(mapSource, /周回経路のOSM変更案は要確認/,
  "normal users must not be asked to review a loop route");
assert.doesNotMatch(mapSource, /通信できないため端末に保管しています/,
  "queue failures must not be mislabeled as loss of internet connectivity");
console.log("map display fetch, initial location follow, PRO badge, and selected-line color regressions are covered");
