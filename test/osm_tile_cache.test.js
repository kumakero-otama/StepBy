const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const source = fs.readFileSync(path.join(__dirname, "../UI0/map/osm-tile-cache.js"), "utf8");
const windowObject = { setTimeout, clearTimeout, console };
vm.runInNewContext(source, { window: windowObject, console, setTimeout, clearTimeout, AbortController });
const cache = windowObject.StepByOsmTileCache;

assert.ok(cache, "tile cache module must be exposed");
assert.strictEqual(cache.CLEANUP_INTERVAL_MS, 6 * 60 * 60 * 1000, "tile cleanup must follow the six-hour specification");
assert.strictEqual(cache.tileApiResponseRequiresLegacyFallback(404), true, "missing tile API must use legacy mode");
assert.strictEqual(cache.tileApiResponseRequiresLegacyFallback(501), true, "unimplemented tile API must use legacy mode");
assert.strictEqual(cache.tileApiResponseRequiresLegacyFallback(503), true, "tile API server failures must use legacy mode");
assert.strictEqual(cache.tileApiResponseRequiresLegacyFallback(200, { allFailed: true }), true, "an all-failed batch must use legacy mode");
assert.strictEqual(cache.tileApiResponseRequiresLegacyFallback(200, { success: true }), false, "a successful tile response must stay in tile mode");
const okayama = cache.latLngToTile(34.66, 133.92);
assert.strictEqual(okayama.z, 15, "z15 must be the fixed cache grid");
assert.deepStrictEqual(cache.parseTileId(okayama.tileId), okayama);
const bounds = cache.tileToBounds(okayama);
assert.ok(bounds.south < 34.66 && bounds.north > 34.66, "tile bounds must include latitude");
assert.ok(bounds.west < 133.92 && bounds.east > 133.92, "tile bounds must include longitude");

const visible = cache.tilesForBounds({
  north: 34.67, south: 34.65, west: 133.90, east: 133.94,
}, { lat: 34.66, lng: 133.92 }, { maxTiles: 36 });
assert.ok(visible.length > 0 && visible.length <= 36, "viewport tiles must be bounded");
assert.strictEqual(visible[0].tileId, okayama.tileId, "viewport center tile must be first");

(async () => {
  const emptyStore = new cache.TileStore();
  await emptyStore.writeTile(okayama.tileId, [], Date.now(), "empty");
  const emptyRecord = (await emptyStore.readTiles([okayama.tileId]))[0];
  assert.strictEqual(emptyRecord.status, "empty", "a zero-result tile must be cached explicitly");
  assert.strictEqual((await emptyStore.featuresForTiles([okayama.tileId])).length, 0, "empty tile must not store unrelated map data");
  const ownerScopedStore = new cache.TileStore();
  await ownerScopedStore.writeTile(okayama.tileId, [{
    type: "Feature",
    properties: {
      osm_type: "way", osm_way_id: 123, tactile_paving: "yes",
      stepby_recorded: true, stepby_record_id: "record-123", stepby_owner_user_id: 77,
      stepby_owned_record_id: "record-123", stepby_can_revert: true,
    },
    geometry: { type: "LineString", coordinates: [[133.92, 34.66], [133.921, 34.661]] },
  }], Date.now(), "ready");
  const persistedPublicFeature = (await ownerScopedStore.featuresForTiles([okayama.tileId]))[0];
  assert.strictEqual(persistedPublicFeature.properties.tactile_paving, "yes", "public OSM tags must remain cached");
  assert.strictEqual(persistedPublicFeature.properties.stepby_recorded, true, "public StepBy origin must remain cached for green-line display");
  assert.strictEqual(persistedPublicFeature.properties.stepby_owner_user_id, 77, "public detail ownership must remain available after reload");
  assert.strictEqual(persistedPublicFeature.properties.stepby_record_id, "record-123", "public record detail ID must remain cached");
  assert.strictEqual(persistedPublicFeature.properties.stepby_owned_record_id, undefined, "user-specific owned record ID must not enter tile storage");
  assert.strictEqual(persistedPublicFeature.properties.stepby_can_revert, undefined, "revert capability must not enter tile storage");
  const userMetadata = new cache.UserMetadataCache(1000);
  const enrichedFeature = {
    ...persistedPublicFeature,
    properties: { ...persistedPublicFeature.properties, stepby_recorded: true, stepby_owner_user_id: 77, stepby_can_revert: true },
  };
  userMetadata.capture(77, [enrichedFeature], 100);
  assert.strictEqual(userMetadata.merge(77, [persistedPublicFeature], 200)[0].properties.stepby_can_revert, true,
    "the same user must retain short-lived ownership display metadata");
  assert.strictEqual(userMetadata.merge(88, [persistedPublicFeature], 200)[0].properties.stepby_can_revert, undefined,
    "ownership display metadata must never cross user IDs");
  assert.strictEqual(userMetadata.merge(77, [persistedPublicFeature], 1200)[0].properties.stepby_can_revert, undefined,
    "expired ownership display metadata must be discarded");
  await assert.rejects(
    emptyStore.writeTile("15/1/1", [], Date.now(), "error"),
    /osm_tile_cache_status_not_persistable/,
    "error responses must never be persisted directly"
  );
  assert.strictEqual((await emptyStore.readTiles(["15/1/1"])).length, 0, "rejected error tile must leave no cache record");

  let emptyFetchCount = 0;
  const emptyLoader = new cache.TileLoader({
    maxVisibleTiles: 1,
    fetchTile: async () => {
      emptyFetchCount += 1;
      return { status: "empty", features: [], fetchedAt: Date.now() };
    },
    onFeatures: () => {},
  });
  const smallBounds = { north: 34.661, south: 34.659, west: 133.919, east: 133.921 };
  await emptyLoader.refresh(smallBounds, { lat: 34.66, lng: 133.92 });
  const emptyFirstFetchCount = emptyFetchCount;
  await emptyLoader.refresh(smallBounds, { lat: 34.66, lng: 133.92 });
  assert.strictEqual(emptyFetchCount, emptyFirstFetchCount, "fresh empty tiles must be reused without another request");

  let fetchCount = 0;
  const renders = [];
  const loader = new cache.TileLoader({
    isEnabled: () => true,
    fetchTile: async (tile) => {
      fetchCount += 1;
      return {
        fetchedAt: Date.now(),
        status: "ready",
        features: [{
          type: "Feature",
          properties: { osm_type: "way", osm_way_id: fetchCount, tactile_paving: "yes" },
          geometry: { type: "LineString", coordinates: [[133.92, 34.66], [133.921, 34.661]] },
        }],
      };
    },
    onFeatures: (features) => renders.push(features),
  });
  await loader.refresh(smallBounds, { lat: 34.66, lng: 133.92 });
  const firstFetchCount = fetchCount;
  assert.ok(firstFetchCount > 0, "uncached viewport must fetch tile data");
  assert.ok(renders.some((features) => features.length > 0), "each fetched tile must be rendered incrementally");
  await loader.refresh(smallBounds, { lat: 34.66, lng: 133.92 });
  assert.strictEqual(fetchCount, firstFetchCount, "fresh and empty tiles must not be fetched again");

  let errorFetchCount = 0;
  const errorLoader = new cache.TileLoader({
    maxVisibleTiles: 1,
    fetchTile: async () => {
      errorFetchCount += 1;
      return { status: "error", features: [] };
    },
    onFeatures: () => {},
  });
  await errorLoader.refresh(smallBounds, { lat: 34.66, lng: 133.92 });
  const failedTile = cache.tilesForBounds(smallBounds, { lat: 34.66, lng: 133.92 })[0];
  assert.ok(errorFetchCount > 0, "error response must be attempted");
  assert.strictEqual((await errorLoader.store.readTiles([failedTile.tileId])).length, 0, "error tile must not be cached as fresh or empty");

  let activeFetches = 0;
  let maximumActiveFetches = 0;
  const sequentialLoader = new cache.TileLoader({
    maxVisibleTiles: 4,
    fetchTile: async () => {
      activeFetches += 1;
      maximumActiveFetches = Math.max(maximumActiveFetches, activeFetches);
      await new Promise((resolve) => setTimeout(resolve, 2));
      activeFetches -= 1;
      return { status: "empty", features: [], fetchedAt: Date.now() };
    },
    onFeatures: () => {},
  });
  await sequentialLoader.refresh({ north: 34.68, south: 34.64, west: 133.89, east: 133.95 }, { lat: 34.66, lng: 133.92 });
  assert.strictEqual(maximumActiveFetches, 1, "viewport tiles must be fetched sequentially");

  let firstRequestAborted = false;
  let cancellationFetchCount = 0;
  const cancellationLoader = new cache.TileLoader({
    maxVisibleTiles: 1,
    fetchTile: async (_tile, signal) => {
      cancellationFetchCount += 1;
      if (cancellationFetchCount > 1) return { status: "empty", features: [], fetchedAt: Date.now() };
      return new Promise((resolve, reject) => {
        signal.addEventListener("abort", () => {
          firstRequestAborted = true;
          reject(new Error("aborted"));
        }, { once: true });
      });
    },
    onFeatures: () => {},
  });
  const oldRefresh = cancellationLoader.refresh(smallBounds, { lat: 34.66, lng: 133.92 });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const newBounds = { north: 35.01, south: 34.99, west: 134.99, east: 135.01 };
  const newRefresh = cancellationLoader.refresh(newBounds, { lat: 35, lng: 135 });
  await Promise.all([oldRefresh, newRefresh]);
  assert.strictEqual(firstRequestAborted, true, "a viewport change must abort the previous in-flight request");

  const cleanupStore = new cache.TileStore();
  const oldTileId = "15/100/100";
  const largeOldTileId = "15/101/100";
  const largeNewTileId = "15/102/100";
  const makeFeature = (id) => ({
    type: "Feature",
    properties: { osm_type: "way", osm_way_id: id, tactile_paving: "yes" },
    geometry: { type: "LineString", coordinates: [[133.9, 34.6], [133.91, 34.61]] },
  });
  await cleanupStore.writeTile(oldTileId, [makeFeature(9001)]);
  await cleanupStore.writeTile(largeOldTileId, [makeFeature(9002)]);
  await cleanupStore.writeTile(largeNewTileId, [makeFeature(9003)]);
  const now = Date.now();
  cleanupStore.memoryTiles.get(oldTileId).lastAccessedAt = now - cache.EVICT_MS - 1;
  cleanupStore.memoryTiles.get(largeOldTileId).lastAccessedAt = now - 2000;
  cleanupStore.memoryTiles.get(largeNewTileId).lastAccessedAt = now - 1000;
  cleanupStore.memoryFeatures.get("way:9002").approxBytes = 20 * 1024 * 1024;
  cleanupStore.memoryFeatures.get("way:9003").approxBytes = 20 * 1024 * 1024;
  await cleanupStore.cleanup(now);
  assert.strictEqual(cleanupStore.memoryTiles.has(oldTileId), false, "tiles unused for more than 90 days must be removed");
  assert.strictEqual(cleanupStore.memoryTiles.has(largeOldTileId), false, "LRU must remove the older tile when the cache exceeds 25 MB");
  assert.strictEqual(cleanupStore.memoryTiles.has(largeNewTileId), true, "LRU must retain the most recently used tile within 25 MB");
  assert.strictEqual(cleanupStore.memoryFeatures.has("way:9001"), false, "cleanup must remove orphaned features");
  assert.strictEqual(cache.CLEANUP_INTERVAL_MS, 6 * 60 * 60 * 1000, "cleanup must be scheduled every six hours");
  console.log("OSM tactile viewport tile cache calculations and fresh-cache reuse passed");
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
