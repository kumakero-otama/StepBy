const assert = require("assert");
global.window = global;
global.document = null;
global.indexedDB = null;
require("../UI10/map/osm-browser-matcher.js");

(async () => {
  let requests = 0;
  const responses = [
    { success: true, ways: [{ id: 10, version: 1, nodes: [1, 2], coordinates: [[0, 0], [0.001, 0]], tags: {}, priority: "pedestrian" }] },
    { success: true, ways: [{ id: 11, version: 1, nodes: [2, 3], coordinates: [[0.001, 0], [0.007, 0]], tags: {}, priority: "pedestrian" }] },
  ];
  const matcher = new StepByOsmMatcher.BrowserMatcher({
    radiusMeters: 1000,
    fetcher: async () => ({ ok: true, json: async () => responses[requests++] }),
  });
  await matcher.prefetchForLocation(0, 0);
  await matcher.prefetchForLocation(0, 0.007);
  assert.strictEqual(requests, 2, "moving outside coverage must fetch another region");
  assert.deepStrictEqual(matcher.network.map((way) => way.id).sort(), [10, 11], "old and new regions must be merged");
  await matcher.prefetchForLocation(0, 0.0071);
  assert.strictEqual(requests, 2, "nearby location must reuse fetched region");
  const route = StepByOsmMatcher.finalizeTrace([
    { lat: 0, lng: 0.0002, accuracy: 5 },
    { lat: 0, lng: 0.0068, accuracy: 5 },
  ], matcher.network);
  assert(route && route.routeConfirmed, "route across downloaded regions must remain confirmable");
  assert.deepStrictEqual(route.wayIds, [10, 11]);
  console.log(JSON.stringify({ result: "passed", requests, wayIds: route.wayIds }));
})().catch((error) => { console.error(error); process.exit(1); });
