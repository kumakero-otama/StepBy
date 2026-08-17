const assert = require("assert");
const fs = require("fs");
const path = require("path");

const mapSource = fs.readFileSync(path.join(__dirname, "../UI10/map/map.js"), "utf8");
const mapCss = fs.readFileSync(path.join(__dirname, "../UI10/map/map.css"), "utf8");
const appBarCss = fs.readFileSync(path.join(__dirname, "../UI10/appbar.css"), "utf8");
for (const name of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const html = fs.readFileSync(path.join(__dirname, "../UI10/map", name), "utf8");
  assert.match(html, /class="pro-badge map-pro-badge"/);
  assert.doesNotMatch(html, /osm-change-preview|OSM変更予定プレビュー/,
    "general-user save confirmation must not expose the OSM change preview");
}
assert.match(mapSource, /stepByBaseColor\s*=\s*recordColor/);
assert.match(mapSource, /"OSM公開対象"/, "PRO tag picker must clearly say the tag is publicly exported to OSM");
assert.doesNotMatch(mapSource, /"OSM対象"/, "ambiguous old PRO tag label must not return");
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
assert.doesNotMatch(mapSource, /サーバーへの送信を完了できないため端末に保管しています/,
  "normal users must not see internal server-delivery wording");
assert.match(mapSource, /showMapToast\("記録しました。"/,
  "record completion must use a short general-user message");
assert.match(mapSource, /non_walkway_way_not_eligible/);
assert.match(mapSource, /osm_draft_skipped_safely/,
  "a safely ineligible OSM Way must complete StepBy storage instead of retrying forever");
assert.match(mapSource, /showMapToast\("削除しました。"/,
  "delete completion must use a short general-user message");
assert.match(mapSource, /\/api\/osm\/records\/\$\{encodeURIComponent\(recordId\)\}\/publish/,
  "saving an OSM-eligible record must enqueue its publication");
assert.match(mapSource, /authorization:\s*"record_save"/,
  "the Save action must be carried to the record-scoped publication endpoint");
assert.match(mapSource, /stepby_owned_record_id/,
  "only server-identified owned StepBy features may expose deletion");
assert.match(mapSource, /createCenteredPolylineHitTarget[\s\S]{0,700}?weight:\s*48[\s\S]{0,500}?radius:\s*24/,
  "owned green OSM lines need centered line and circular tap targets");
assert.match(mapSource, /const hitPolyline = osmManaged \? null : L\.polyline\(coordinates,[\s\S]{0,220}?weight:\s*48/,
  "saved StepBy paths need a wider invisible detail tap target");
assert.match(mapSource, /path\.osm_status === "merged" \|\| path\.osm_status === "revert_draft"/,
  "OSM-managed records must not retain a second, offset StepBy hit target");
assert.match(mapSource, /loadAndShowAllRecords\(map\.getCenter\(\)\)/,
  "a completed OSM revert must refresh the StepBy record layer");
assert.match(mapSource, /authorization:\s*"owned_green_line_delete"/,
  "confirmed green-line deletion must call the record-scoped revert endpoint");
assert.match(mapSource, /osmPublished:\s*true[\s\S]{0,200}?osmRecordId:\s*recordId/,
  "owned OSM lines must use the same detailed record card with published state");
assert.match(mapSource, /data-revert-osm-record/,
  "the unified card must keep a distinct OSM revert action");
assert.match(mapSource, /OSM公開済み/,
  "the unified card must clearly show the OSM publication state");
assert.doesNotMatch(mapSource, /bindOwnedOsmRevertPopup|StepByで記録した点字ブロックです。/,
  "the old delete-only OSM popup must not remain");
assert.match(mapSource, /stepby-ui10-osm-revert-queue-v1/,
  "OSM reverts must survive page/network interruptions in their own persistent queue");
const mobileAppBarCss = mapCss.slice(
  mapCss.indexOf("@media (max-width: 520px)"),
  mapCss.indexOf(".map-layout"),
);
assert.ok(mobileAppBarCss, "mobile map app-bar styles must exist");
assert.doesNotMatch(mobileAppBarCss, /\.map-app-bar\s*\{[\s\S]*?padding-(?:left|right):/,
  "mobile map app-bar must keep the shared 14px horizontal padding");
assert.doesNotMatch(mobileAppBarCss, /\.map-app-bar-actions\s*\{[\s\S]*?gap:/,
  "mobile map buttons must keep the shared 8px gap");
assert.match(mapCss, /\.map-app-bar\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?box-shadow:\s*0 10px 28px rgba\(30, 122, 109, 0\.26\)/,
  "map app-bar must use the same visible bounds and shadow as other screens");
assert.match(mapCss, /\.map-app-bar-action\s*\{[\s\S]*?background:\s*rgba\(255, 255, 255, 0\.16\)[\s\S]*?border:\s*1px solid rgba\(255, 255, 255, 0\.22\)/,
  "map app-bar buttons must use the shared button appearance");
assert.match(mapCss, /\.map-app-bar-wave\s*\{\s*display:\s*none;/,
  "the map-only wave must not make the app-bar appear taller than other screens");
assert.match(appBarCss, /\.app-bar-icon-link\s*\{[\s\S]*?box-sizing:\s*content-box;/,
  "app-bar buttons must keep the same outer 38px size even on pages with global border-box sizing");
console.log("map display fetch, initial location follow, PRO badge, and selected-line color regressions are covered");
