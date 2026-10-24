const assert = require("assert");
const fs = require("fs");
const path = require("path");

const mapSource = fs.readFileSync(path.join(__dirname, "../UI0/map/map.js"), "utf8");

assert.match(
  mapSource,
  /map\.createPane\("liveLocationPane"\)[\s\S]{0,220}?zIndex = "680"/,
  "the live GPS point must stay visible above the fitted red marker",
);
assert.match(
  mapSource,
  /function handleNewLocation\(latitude, longitude, accuracy = null\)[\s\S]*?lastDot\.setLatLng\(\[latitude, longitude\]\)/,
  "every browser geolocation update must move the live GPS point without waiting for browser matching",
);
assert.match(
  mapSource,
  /pane: "liveLocationPane"[\s\S]{0,400}?fillColor: "#9acd32"|fillColor: "#9acd32"[\s\S]{0,400}?pane: "liveLocationPane"/,
  "the live GPS point must use the expected yellow-green color",
);
assert.match(
  mapSource,
  /function refreshLocationTracking\(\)[\s\S]{0,260}?requestPosition\(true\);[\s\S]{0,100}?startWatching\(\);/,
  "mobile startup and resume must combine an immediate position request with a fresh watch",
);
assert.match(
  mapSource,
  /document\.addEventListener\("visibilitychange"[\s\S]{0,180}?refreshLocationTracking\(\)/,
  "returning to a visible PWA must restart location tracking",
);

console.log("live GPS point and fitted marker update regressions are covered");
