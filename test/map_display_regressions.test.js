const assert = require("assert");
const fs = require("fs");
const path = require("path");

const mapSource = fs.readFileSync(path.join(__dirname, "../UI0/map/map.js"), "utf8");
const matcherSource = fs.readFileSync(path.join(__dirname, "../UI0/map/osm-browser-matcher.js"), "utf8");
const mapCss = fs.readFileSync(path.join(__dirname, "../UI0/map/map.css"), "utf8");
const appBarCss = fs.readFileSync(path.join(__dirname, "../UI0/appbar.css"), "utf8");
for (const name of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const html = fs.readFileSync(path.join(__dirname, "../UI0/map", name), "utf8");
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
assert.doesNotMatch(mapSource, /サーバーへの送信を完了できないため端末に保管しています/,
  "normal users must not see internal server-delivery wording");
assert.match(mapSource, /showMapToast\("記録しました。"/,
  "record completion must use a short general-user message");
assert.match(mapSource, /non_walkway_way_not_eligible/);
assert.match(mapSource, /osm_draft_skipped_safely/,
  "a safely ineligible OSM Way must complete StepBy storage instead of retrying forever");
assert.match(mapSource, /showMapToast\("削除しました。"/,
  "delete completion must use a short general-user message");
assert.doesNotMatch(mapSource, /\/api\/osm\/records\/\$\{encodeURIComponent\(recordId\)\}\/publish/,
  "a general-user save must not publish directly to OSM");
assert.match(mapSource, /authorization:\s*"administrator_review_required"/,
  "an OSM-eligible save must create an administrator-review draft");
assert.match(mapSource, /runStage\("osm_review_queued"/,
  "the durable queue must checkpoint completion of administrator review registration");
assert.match(mapSource, /stepby_owned_record_id/,
  "only server-identified owned StepBy features may expose deletion");
assert.match(mapSource, /function bindStepByOsmRecordCard/,
  "all StepBy records must open the unified detail card regardless of owner");
assert.match(mapSource, /properties\.stepby_record_id \|\| properties\.stepby_owned_record_id/,
  "non-owner StepBy records must retain a public detail identifier");
assert.match(mapSource, /osmRecordId: properties\.stepby_can_revert \? recordId : ""/,
  "only the owner-authorized feature may expose OSM deletion");
assert.match(mapSource, /const canEditOwnSession = isOwnTactileSession\(ownerUserId\);[\s\S]{0,220}?const memoHtml = memoValue/,
  "the detail card must keep owner-aware memo handling even though the API is the primary privacy boundary");
assert.strictEqual((mapSource.match(/data-edit-tactile-memo=/g) || []).length, 1,
  "memo editing must use one consistent button whether the memo is empty or populated");
assert.doesNotMatch(mapSource, /tactile-session-card-memo-edit/,
  "the duplicate inline pencil button must not remain");
assert.match(mapSource, /ownerUserId:\s*currentUserId/,
  "queued recordings must retain the StepBy account that created them");
assert.match(mapSource, /record_owner_not_loaded[\s\S]{0,180}?retryable = true/,
  "queued recordings must wait until the current account is known");
assert.match(mapSource, /record_owner_changed[\s\S]{0,180}?retryable = false/,
  "a recording queued by another account must never be submitted under the current account");
assert.match(mapSource, /privateScope:\s*"本人のみ表示"/,
  "private PRO tags must describe their actual owner-only visibility");
assert.doesNotMatch(mapSource, /tag\.osmExportable \? "OSM公開対象" : "StepByのみ"/,
  "the obsolete StepBy-only tag scope label must not remain");
assert.match(mapSource, /session_tag_save_failed:\$\{res\.status\}[\s\S]{0,180}?res\.status >= 500/,
  "a PRO authorization rejection must not retry forever");
assert.ok(mapSource.indexOf("const apiResult = await apiAttempt") < mapSource.indexOf("const attempts = hosts.map"),
  "the enriched StepBy API response must be preferred over anonymous Overpass data");
assert.match(mapSource, /data\.osmUpstreamUnavailable && cachedOsmFeatures\.length > 0/,
  "temporary OSM read failures must retain the last successful map display");
assert.match(mapSource, /if \(degradedApiResult\) return degradedApiResult/,
  "the browser fallback must preserve StepBy data when every direct OSM read also fails");
assert.doesNotMatch(mapSource, /alert\("OSM点字ブロックデータの取得に失敗しました/,
  "a temporary upstream failure must not interrupt users with a blocking alert");
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
assert.match(mapSource, /osmPublished:\s*true[\s\S]{0,200}?osmRecordId:\s*properties\.stepby_can_revert \? recordId : ""/,
  "owned OSM lines must use the same detailed record card with published state");
assert.match(mapSource, /data-revert-osm-record/,
  "the unified card must keep a distinct OSM revert action");
assert.match(mapSource, /OSM公開済み/,
  "the unified card must clearly show the OSM publication state");
assert.doesNotMatch(mapSource, /bindOwnedOsmRevertPopup|StepByで記録した点字ブロックです。/,
  "the old delete-only OSM popup must not remain");
assert.match(mapSource, /stepby-ui0-osm-revert-queue-v1/,
  "OSM reverts must survive page/network interruptions in their own persistent queue");
assert.match(mapSource, /context\.checkpoint\("osm_reverted"\)[\s\S]{0,500}?refreshAfterOsmChange/,
  "revert must be checkpointed before refreshing so a refresh retry cannot repeat the OSM write");
assert.match(matcherSource, /async refreshAfterOsmChange\(points\)[\s\S]{0,900}?await clearCaches\(\)/,
  "post-write refresh must clear stale IndexedDB and in-memory OSM regions");
assert.match(mapSource, /buildBrowserOsmPreview\(allTracePoints\)/,
  "record finalization must use current OSM data instead of a fresh-looking browser cache");
assert.match(mapSource, /persistCurrentSessionWithoutConfirmation[\s\S]{0,900}?buildBrowserOsmPreview\(tracePoints\)/,
  "pause persistence must use the browser OSM matcher instead of the retired Valhalla trace");
assert.match(mapSource, /recordActionBtn\.disabled = Boolean\(recordPaused/,
  "record stop must be disabled while recording is paused");
assert.match(matcherSource, /if \(options\.force\) params\.set\("forceRefresh", "1"\)/,
  "a forced browser refresh must also bypass the server-side OSM network cache");
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
