const assert = require("assert");
const fs = require("fs");
const path = require("path");

const mapSource = fs.readFileSync(path.join(__dirname, "../UI10/map/map.js"), "utf8");
for (const name of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const html = fs.readFileSync(path.join(__dirname, "../UI10/map", name), "utf8");
  assert.match(html, /class="pro-badge map-pro-badge"/);
  assert.doesNotMatch(html, /osm-change-preview|OSM変更予定プレビュー/,
    "general-user save confirmation must not expose the OSM change preview");
}
assert.match(mapSource, /stepByBaseColor\s*=\s*recordColor/);
assert.match(mapSource, /activeTactileSessionPolyline\.options\.stepByBaseColor/);
assert.doesNotMatch(mapSource, /fetchOsmTactileDisplay\([\s\S]{0,200}?\.then\(\(res\)[\s\S]{0,120}?res\.ok/,
  "display helper already returns parsed data and must not be treated as a Response");
assert.match(mapSource, /if \(!isCenterCurrentEnabled\(\) && cached\.center/);
assert.match(mapSource, /suppressAutoCenterAfterReturn = false;[\s\S]{0,180}?map\.setView\(\[cached\.lat, cached\.lng\]/);
assert.doesNotMatch(mapSource, /周回経路のOSM変更案は要確認/,
  "normal users must not be asked to review a loop route");
assert.doesNotMatch(mapSource, /分割予定：開始|osmPreviewWayIdsEl|renderOsmPreviewTagStrategies/,
  "general-user confirmation must render only the recorded route");
assert.doesNotMatch(mapSource, /通信できないため端末に保管しています/,
  "queue failures must not be mislabeled as loss of internet connectivity");
assert.match(mapSource, /\/api\/osm\/records\/\$\{encodeURIComponent\(recordId\)\}\/publish/,
  "saving an OSM-eligible record must enqueue its publication");
assert.match(mapSource, /authorization:\s*"record_save"/,
  "the Save action must be carried to the record-scoped publication endpoint");
assert.match(mapSource, /stepby_owned_record_id/,
  "only server-identified owned StepBy features may expose deletion");
assert.match(mapSource, /isOwnedStepByRecord[\s\S]{0,700}?weight:\s*48[\s\S]{0,150}?opacity:\s*0/,
  "owned green OSM lines need a four-times-wider invisible tap target");
assert.match(mapSource, /const hitPolyline = L\.polyline\(coordinates,[\s\S]{0,220}?weight:\s*48/,
  "saved StepBy paths need a wider invisible detail tap target");
assert.match(mapSource, /authorization:\s*"owned_green_line_delete"/,
  "confirmed green-line deletion must call the record-scoped revert endpoint");
assert.match(mapSource, /stepby-ui10-osm-revert-queue-v1/,
  "OSM reverts must survive page/network interruptions in their own persistent queue");
console.log("map display fetch, initial location follow, PRO badge, and selected-line color regressions are covered");
