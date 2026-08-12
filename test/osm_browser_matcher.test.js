const assert = require("assert");

global.window = {};
require("../UI10/map/osm-browser-matcher.js");

const matcher = global.window.StepByOsmMatcher;

const eastboundRoad = {
  id: 100,
  version: 1,
  tags: { highway: "residential", sidewalk: "both" },
  nodes: [1, 2],
  coordinates: [[139, 35], [139.001, 35]],
};
const northPoints = [
  { lat: 35.00003, lng: 139.0002 },
  { lat: 35.00004, lng: 139.0005 },
  { lat: 35.00003, lng: 139.0008 },
];
const southPoints = northPoints.map((point) => ({ ...point, lat: 34.99997 }));

assert.strictEqual(matcher.inferWaySide({ rawPoints: northPoints }, eastboundRoad), "left");
assert.strictEqual(matcher.inferWaySide({ rawPoints: southPoints }, eastboundRoad), "right");
assert.strictEqual(matcher.inferWaySide({ rawPoints: [{ lat: 35, lng: 139.0005 }] }, eastboundRoad), "left");

const walkway = { ...eastboundRoad, tags: { highway: "footway" } };
assert.strictEqual(matcher.inferWaySide({ rawPoints: northPoints }, walkway), null);

const route = {
  routeConfirmed: true,
  ways: [eastboundRoad],
  rawPoints: northPoints,
  start: { wayId: 100, segmentIndex: 0, fraction: 0.2, lat: 35, lng: 139.0002 },
  end: { wayId: 100, segmentIndex: 0, fraction: 0.8, lat: 35, lng: 139.0008 },
};
const preview = matcher.buildOsmChangePreview(route);
assert.strictEqual(preview.segments[0].side, "left");
assert.strictEqual(preview.segments[0].tagStrategy, "sidewalk:left:tactile_paving=yes");
assert.strictEqual(preview.connected, true);

console.log("osm_browser_matcher tests passed");
