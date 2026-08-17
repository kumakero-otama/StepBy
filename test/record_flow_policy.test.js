const assert = require("assert");
const fs = require("fs");
const path = require("path");

const mapSource = fs.readFileSync(path.join(__dirname, "../UI10/map/map.js"), "utf8");
assert.doesNotMatch(mapSource, /auth\/osm\/start|preopenOsmConnectionPopup|shouldOpenOsmConnection/,
  "record saving must never start per-user OSM OAuth");
assert.match(mapSource, /authorization:\s*"record_save"/,
  "the user's Save confirmation must remain the record-scoped publication authorization");
for (const name of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const html = fs.readFileSync(path.join(__dirname, `../UI10/map/${name}`), "utf8");
  assert.doesNotMatch(html, /record-flow-policy\.js/);
}
console.log(JSON.stringify({ result: "passed", editorMode: "stepby_service_account" }));
