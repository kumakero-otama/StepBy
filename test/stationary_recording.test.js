const assert = require("assert"), fs = require("fs"), vm = require("vm");
const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(fs.readFileSync("UI0/map/osm-browser-matcher.js", "utf8"), context);
const matcher = context.window.StepByOsmMatcher;
const way = { id: 1, version: 1, nodes: [1, 2], coordinates: [[134, 34], [134.001, 34]], tags: { highway: "footway" } };
for (const count of [1, 3, 10]) {
  const points = Array.from({ length: count }, () => ({ lat: 34.00001, lng: 134.0005, accuracy: 35 }));
  const route = matcher.finalizeTrace(points, [way]);
  assert.equal(route.stationary, true);
  const preview = matcher.buildOsmChangePreview(route);
  assert.equal(preview.stationary, true);
  assert.equal(preview.segments[0].coordinates.length, 2);
  assert.equal(preview.segments[0].coordinates[0][1], 34);
  assert.deepEqual(preview.segments[0].coordinates[0], preview.segments[0].coordinates[1]);
}
assert.equal(matcher.finalizeTrace([{ lat: 35, lng: 135 }], [way]), null);
console.log("stationary records remain matched points without invented length");
