const assert = require("assert");
const fs = require("fs");
const path = require("path");

const mapSource = fs.readFileSync(path.join(__dirname, "../UI0/map/map.js"), "utf8");

assert.doesNotMatch(mapSource, /liveLocationPane|\blastDot\b/,
  "raw GPS must not be rendered as a separate yellow-green point");
assert.match(
  mapSource,
  /function handleNewLocation\(latitude, longitude, accuracy = null\)[\s\S]{0,700}?latestLocation = \{[\s\S]{0,80}?lat: latitude,[\s\S]{0,40}?lng: longitude/,
  "raw GPS updates must remain available for tracking and recording",
);
assert.match(mapSource, /function updateCurrentLocationMarker\([\s\S]{0,500}?redPinIcon/,
  "the fitted current location must remain visible as the red marker");
assert.match(
  mapSource,
  /function refreshLocationTracking\(reason = "manual"\)[\s\S]{0,500}?requestPosition\(true\);[\s\S]{0,100}?startWatching\(\);/,
  "mobile startup and resume must combine an immediate position request with a fresh watch",
);
assert.match(
  mapSource,
  /document\.addEventListener\("visibilitychange"[\s\S]{0,180}?refreshLocationTracking\("visibility"\)/,
  "returning to a visible PWA must restart location tracking",
);
assert.match(
  mapSource,
  /function checkLocationWatchHealth\(\)[\s\S]{0,400}?GPS_WATCH_STALE_MS[\s\S]{0,180}?refreshLocationTracking\("watchdog"\)/,
  "a visible PWA must restart a geolocation watch that silently stops delivering fixes",
);
assert.match(
  mapSource,
  /err\.code !== 1[\s\S]{0,300}?refreshLocationTracking\("watch_error"\)/,
  "temporary geolocation errors must recover without repeatedly retrying a denied permission",
);
assert.match(
  mapSource,
  /queuedBrowserMatch\s*=\s*\{[\s\S]{0,300}?runQueuedBrowserMatches\(\)/,
  "slow fitting must collapse duplicate polls and eventually process the latest GPS fix",
);
assert.doesNotMatch(
  mapSource,
  /latestLocation\.lat\s*!==\s*latitude\s*\|\|\s*latestLocation\.lng\s*!==\s*longitude/,
  "a slow match must not be discarded merely because a newer nearby GPS fix arrived",
);
assert.match(
  mapSource,
  /Date\.now\(\) - latestSnappedAt >= FITTED_MARKER_STALE_MS[\s\S]{0,250}?updateCurrentLocationMarker\(latitude, longitude\)/,
  "raw GPS must temporarily move the red marker when fitted updates have become stale",
);

console.log("raw GPS stays hidden while fitted marker tracking remains covered");
