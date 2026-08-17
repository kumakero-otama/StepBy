const assert = require("assert");
const fs = require("fs");
const path = require("path");

const authSource = fs.readFileSync(path.join(__dirname, "../UI10/auth/auth.js"), "utf8");
const mapSource = fs.readFileSync(path.join(__dirname, "../UI10/map/map.js"), "utf8");
const profileSource = fs.readFileSync(path.join(__dirname, "../UI10/profile/profile.js"), "utf8");
const continuation = authSource.slice(
  authSource.indexOf("async function continueAfterGoogleAuth"),
  authSource.indexOf("function cacheProfileUser")
);

assert.match(continuation, /window\.location\.href = mapUrl/,
  "Google認証後は個別OSM OAuthを要求せず地図へ進むこと");
assert.doesNotMatch(continuation, /auth\/osm\/start|waitForRequiredOsmConnection|osm_connection_not_completed/,
  "各利用者のOSM認証を開始しないこと");
assert.match(authSource, /const osmPopup = null;/,
  "Google認証時に不要なOSMポップアップを開かないこと");
const mapGate = mapSource.slice(
  mapSource.indexOf("async function requireOsmConnectionBeforeMapUse"),
  mapSource.indexOf("function updateRecordButton")
);
assert.match(mapGate, /Individual users authenticate to StepBy with Google only/);
assert.doesNotMatch(mapGate, /auth\/osm\/status|osm_required=1/);
assert.match(profileSource, /editorMode === "stepby_service_account"/);
assert.match(profileSource, /記録した点字ブロック情報は/);
assert.match(profileSource, /https:\/\/www\.openstreetmap\.org\//);
for (const name of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const html = fs.readFileSync(path.join(__dirname, `../UI10/profile/${name}`), "utf8");
  assert.doesNotMatch(html, /id="osm-disconnect-btn"/,
    "統合アカウントは一般利用者のプロフィールから解除できないこと");
}
console.log("StepBy central OSM account frontend policy passed");
