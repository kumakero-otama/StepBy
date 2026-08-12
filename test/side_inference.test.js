const assert = require("assert");
global.window = global;
global.document = null;
global.indexedDB = null;
require("../UI10/map/osm-browser-matcher.js");

const road = {
  id: 50, version: 1, nodes: [1, 2], coordinates: [[139, 35], [139.002, 35]],
  tags: { highway: "residential" }, priority: "road",
};
function decide(latitudes, accuracies = []) {
  return StepByOsmMatcher.inferWaySideDetail({
    rawPoints: latitudes.map((lat, index) => ({ lat, lng: 139.001, accuracy: accuracies[index] || 5 })),
    matches: [],
  }, road);
}
const left = decide([35.00002, 35.00003, 34.99999], [3, 3, 30]);
assert.strictEqual(left.side, "left", "accurate north-side points must win");
const right = decide([34.99998, 34.99997, 35.00001], [3, 3, 30]);
assert.strictEqual(right.side, "right", "accurate south-side points must win");
const noisyTie = decide([35.000001, 34.999999, 35.000004], [8, 8, 8]);
assert.ok(["left", "right"].includes(noisyTie.side), "noisy center trace must still be decided by app");
assert.notStrictEqual(noisyTie.method, undefined);
const noSamples = decide([35.01]);
assert.strictEqual(noSamples.side, "left", "no usable samples must use deterministic fallback without asking user");
const reversed = { ...road, nodes: [2, 1], coordinates: road.coordinates.slice().reverse() };
const reversedResult = StepByOsmMatcher.inferWaySideDetail({ rawPoints: [{ lat: 35.00003, lng: 139.001, accuracy: 3 }], matches: [] }, reversed);
assert.strictEqual(reversedResult.side, "right", "left/right must follow OSM Way node direction");
console.log(JSON.stringify({ result: "passed", left, right, noisyTie, reversed: reversedResult, userChoiceRequired: false }));
