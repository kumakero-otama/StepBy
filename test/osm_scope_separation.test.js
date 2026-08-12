const assert = require("assert");
const fs = require("fs");
const path = require("path");

const mapSource = fs.readFileSync(path.join(__dirname, "../UI10/map/map.js"), "utf8");
const matcherSource = fs.readFileSync(path.join(__dirname, "../UI10/map/osm-browser-matcher.js"), "utf8");

assert.match(mapSource, /radiusMeters:\s*1000/);
assert.match(mapSource, /MAP_DATA_REFRESH_DISTANCE_METERS\s*=\s*650/);
assert.match(mapSource, /OSM_DISPLAY_RADIUS_KM\s*=\s*10/);
assert.doesNotMatch(mapSource, /osmFeatures:\s*cloneSerializable/);
assert.match(mapSource, /cachedOsmFeatures\s*=\s*\[\];/);
assert.match(matcherSource, /PREFETCH_DISTANCE_METERS\s*=\s*650/);

console.log("OSM display 10km is separated from persisted fitting network 1km/650m");
