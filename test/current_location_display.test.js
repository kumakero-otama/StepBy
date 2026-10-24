const assert = require("assert");
const fs = require("fs");
const path = require("path");

const mapSource = fs.readFileSync(path.join(__dirname, "../UI0/map/map.js"), "utf8");

assert.doesNotMatch(mapSource, /liveLocationPane|\blastDot\b/,
  "raw GPS must not be rendered as a separate yellow-green point");
assert.match(
  mapSource,
  /function handleNewLocation\(latitude, longitude, accuracy = null\)[\s\S]{0,320}?latestLocation = \{ lat: latitude, lng: longitude/,
  "raw GPS updates must remain available for tracking and recording",
);
assert.match(mapSource, /function updateCurrentLocationMarker\([\s\S]{0,500}?redPinIcon/,
  "the fitted current location must remain visible as the red marker");
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

console.log("raw GPS stays hidden while fitted marker tracking remains covered");
