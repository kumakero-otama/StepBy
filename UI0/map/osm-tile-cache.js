// OSM点字ブロック表示専用の区画キャッシュ。
// 公開OSMの点字ブロック地物と「0件だった区画」だけをIndexedDBへ保存する。
(function initializeOsmTileCache(globalScope) {
  "use strict";

  const DEFAULT_ZOOM = 15;
  const FRESH_MS = 24 * 60 * 60 * 1000;
  const STALE_MS = 30 * 24 * 60 * 60 * 1000;
  const EVICT_MS = 90 * 24 * 60 * 60 * 1000;
  const CLEANUP_INTERVAL_MS = 6 * 60 * 60 * 1000;
  const MAX_BYTES = 25 * 1024 * 1024;
  const MAX_VISIBLE_TILES = 36;
  const DB_NAME = "stepby-osm-tactile-cache";
  const DB_VERSION = 1;
  const USER_SCOPED_PROPERTY_KEYS = new Set(["stepby_owned_record_id", "stepby_can_revert"]);

  function clampLatitude(lat) {
    return Math.max(-85.05112878, Math.min(85.05112878, Number(lat)));
  }

  function latLngToTile(lat, lng, zoom = DEFAULT_ZOOM) {
    const scale = 2 ** zoom;
    const safeLat = clampLatitude(lat);
    const normalizedLng = ((Number(lng) + 180) % 360 + 360) % 360 - 180;
    const x = Math.max(0, Math.min(scale - 1, Math.floor((normalizedLng + 180) / 360 * scale)));
    const latitudeRadians = safeLat * Math.PI / 180;
    const y = Math.max(0, Math.min(scale - 1, Math.floor(
      (1 - Math.asinh(Math.tan(latitudeRadians)) / Math.PI) / 2 * scale
    )));
    return { z: zoom, x, y, tileId: `${zoom}/${x}/${y}` };
  }

  function tileToBounds(tile) {
    const scale = 2 ** tile.z;
    const west = tile.x / scale * 360 - 180;
    const east = (tile.x + 1) / scale * 360 - 180;
    const north = Math.atan(Math.sinh(Math.PI * (1 - 2 * tile.y / scale))) * 180 / Math.PI;
    const south = Math.atan(Math.sinh(Math.PI * (1 - 2 * (tile.y + 1) / scale))) * 180 / Math.PI;
    return { north, south, east, west };
  }

  function parseTileId(tileId) {
    const parts = String(tileId || "").split("/").map(Number);
    if (parts.length !== 3 || !parts.every(Number.isInteger)) return null;
    const [z, x, y] = parts;
    const scale = 2 ** z;
    if (z !== DEFAULT_ZOOM || x < 0 || y < 0 || x >= scale || y >= scale) return null;
    return { z, x, y, tileId: `${z}/${x}/${y}` };
  }

  function normalizeBounds(bounds) {
    const north = Number(typeof bounds.getNorth === "function" ? bounds.getNorth() : bounds.north);
    const south = Number(typeof bounds.getSouth === "function" ? bounds.getSouth() : bounds.south);
    const east = Number(typeof bounds.getEast === "function" ? bounds.getEast() : bounds.east);
    const west = Number(typeof bounds.getWest === "function" ? bounds.getWest() : bounds.west);
    return { north, south, east, west };
  }

  // 画面内の区画を中心距離順に並べる。低ズームで対象が多い場合も中央を優先する。
  function tilesForBounds(bounds, center, { zoom = DEFAULT_ZOOM, maxTiles = MAX_VISIBLE_TILES, includeRing = false } = {}) {
    const normalized = normalizeBounds(bounds);
    const centerTile = latLngToTile(center.lat, center.lng, zoom);
    const nw = latLngToTile(normalized.north, normalized.west, zoom);
    const se = latLngToTile(normalized.south, normalized.east, zoom);
    let minX = Math.min(nw.x, se.x);
    let maxX = Math.max(nw.x, se.x);
    let minY = Math.min(nw.y, se.y);
    let maxY = Math.max(nw.y, se.y);
    if (includeRing) {
      minX -= 1; maxX += 1; minY -= 1; maxY += 1;
    }
    const scale = 2 ** zoom;
    const result = [];
    for (let x = Math.max(0, minX); x <= Math.min(scale - 1, maxX); x += 1) {
      for (let y = Math.max(0, minY); y <= Math.min(scale - 1, maxY); y += 1) {
        result.push({
          z: zoom,
          x,
          y,
          tileId: `${zoom}/${x}/${y}`,
          priority: Math.hypot(x - centerTile.x, y - centerTile.y),
        });
      }
    }
    return result.sort((a, b) => a.priority - b.priority).slice(0, maxTiles);
  }

  function featureId(feature) {
    const properties = feature && feature.properties || {};
    const type = properties.osm_type || (feature && feature.geometry && feature.geometry.type) || "feature";
    const id = properties.osm_way_id ?? properties.osm_node_id ?? properties.osm_id;
    return id == null ? `${type}:${JSON.stringify(feature && feature.geometry || null)}` : `${type}:${id}`;
  }

  // タイル本体は全利用者で共有する公開OSM情報だけを保持する。
  // 所有者・取消可否などの利用者別情報はmap.js側の短命・利用者別キャッシュで合成する。
  function publicFeatureForCache(feature) {
    if (!feature || typeof feature !== "object") return feature;
    const clone = JSON.parse(JSON.stringify(feature));
    if (clone.properties && typeof clone.properties === "object") {
      USER_SCOPED_PROPERTY_KEYS.forEach((key) => delete clone.properties[key]);
    }
    return clone;
  }

  class UserMetadataCache {
    constructor(ttlMs = 30 * 60 * 1000) {
      this.ttlMs = ttlMs;
      this.entries = new Map();
    }

    capture(userId, features, now = Date.now()) {
      const normalizedUserId = Number(userId);
      if (!Number.isFinite(normalizedUserId)) return;
      (Array.isArray(features) ? features : []).forEach((feature) => {
        const properties = feature && feature.properties || {};
        const metadata = {};
        USER_SCOPED_PROPERTY_KEYS.forEach((key) => {
          if (Object.prototype.hasOwnProperty.call(properties, key)) metadata[key] = properties[key];
        });
        if (Object.keys(metadata).length) {
          this.entries.set(`${normalizedUserId}|${featureId(feature)}`, {
            metadata,
            expiresAt: now + this.ttlMs,
          });
        }
      });
    }

    merge(userId, features, now = Date.now()) {
      const normalizedUserId = Number(userId);
      return (Array.isArray(features) ? features : []).map((feature) => {
        if (!Number.isFinite(normalizedUserId)) return feature;
        const key = `${normalizedUserId}|${featureId(feature)}`;
        const cached = this.entries.get(key);
        if (!cached || cached.expiresAt <= now) {
          if (cached) this.entries.delete(key);
          return feature;
        }
        return {
          ...feature,
          properties: { ...(feature.properties || {}), ...cached.metadata },
        };
      });
    }
  }

  function tileApiResponseRequiresLegacyFallback(status, payload = null) {
    const normalizedStatus = Number(status);
    return normalizedStatus === 404
      || normalizedStatus === 501
      || normalizedStatus >= 500
      || Boolean(payload && payload.allFailed === true);
  }

  function requestResult(request) {
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("indexeddb_request_failed"));
    });
  }

  function transactionDone(transaction) {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error || new Error("indexeddb_transaction_failed"));
      transaction.onabort = () => reject(transaction.error || new Error("indexeddb_transaction_aborted"));
    });
  }

  class TileStore {
    constructor() {
      this.dbPromise = null;
      this.memoryTiles = new Map();
      this.memoryFeatures = new Map();
      this.memoryRelations = new Map();
    }

    async open() {
      if (!globalScope.indexedDB) return null;
      if (this.dbPromise) return this.dbPromise;
      this.dbPromise = new Promise((resolve, reject) => {
        const request = globalScope.indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains("tiles")) db.createObjectStore("tiles", { keyPath: "tileId" });
          if (!db.objectStoreNames.contains("features")) db.createObjectStore("features", { keyPath: "featureId" });
          if (!db.objectStoreNames.contains("tileFeatures")) {
            const relations = db.createObjectStore("tileFeatures", { keyPath: "relationId" });
            relations.createIndex("tileId", "tileId", { unique: false });
            relations.createIndex("featureId", "featureId", { unique: false });
          }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error || new Error("indexeddb_open_failed"));
      }).catch((error) => {
        console.warn("[OsmTileCache] IndexedDB unavailable; using memory cache", error);
        return null;
      });
      return this.dbPromise;
    }

    async readTiles(tileIds) {
      const db = await this.open();
      if (!db) return tileIds.map((tileId) => this.memoryTiles.get(tileId)).filter(Boolean);
      const transaction = db.transaction(["tiles"], "readonly");
      const done = transactionDone(transaction);
      const store = transaction.objectStore("tiles");
      const records = await Promise.all(tileIds.map((tileId) => requestResult(store.get(tileId))));
      await done;
      return records.filter(Boolean);
    }

    async featuresForTiles(tileIds) {
      const db = await this.open();
      const unique = new Map();
      if (!db) {
        tileIds.forEach((tileId) => {
          const ids = this.memoryRelations.get(tileId) || [];
          ids.forEach((id) => {
            const record = this.memoryFeatures.get(id);
            if (record) unique.set(id, record.feature);
          });
        });
        return Array.from(unique.values());
      }
      const transaction = db.transaction(["tileFeatures", "features"], "readonly");
      const done = transactionDone(transaction);
      const relations = transaction.objectStore("tileFeatures").index("tileId");
      const features = transaction.objectStore("features");
      for (const tileId of tileIds) {
        const rows = await requestResult(relations.getAll(tileId));
        for (const row of rows || []) {
          if (unique.has(row.featureId)) continue;
          const record = await requestResult(features.get(row.featureId));
          if (record) unique.set(row.featureId, record.feature);
        }
      }
      await done;
      return Array.from(unique.values());
    }

    async writeTile(tileId, features, fetchedAt = Date.now(), status = null) {
      const normalizedFeatures = Array.isArray(features)
        ? features.filter(Boolean).map(publicFeatureForCache)
        : [];
      const featureIds = normalizedFeatures.map(featureId);
      const normalizedStatus = status || (featureIds.length ? "ready" : "empty");
      if (normalizedStatus !== "ready" && normalizedStatus !== "empty") {
        throw new Error("osm_tile_cache_status_not_persistable");
      }
      const tileRecord = {
        tileId,
        fetchedAt: Number(fetchedAt) || Date.now(),
        lastAccessedAt: Date.now(),
        status: normalizedStatus,
        featureIds,
      };
      const db = await this.open();
      if (!db) {
        this.memoryTiles.set(tileId, tileRecord);
        this.memoryRelations.set(tileId, featureIds);
        normalizedFeatures.forEach((feature, index) => this.memoryFeatures.set(featureIds[index], {
          featureId: featureIds[index], feature, lastAccessedAt: Date.now(), approxBytes: JSON.stringify(feature).length * 2,
        }));
        return;
      }
      const transaction = db.transaction(["tiles", "features", "tileFeatures"], "readwrite");
      const done = transactionDone(transaction);
      const tiles = transaction.objectStore("tiles");
      const featureStore = transaction.objectStore("features");
      const relationStore = transaction.objectStore("tileFeatures");
      const oldRelations = await requestResult(relationStore.index("tileId").getAll(tileId));
      (oldRelations || []).forEach((relation) => relationStore.delete(relation.relationId));
      tiles.put(tileRecord);
      normalizedFeatures.forEach((feature, index) => {
        const id = featureIds[index];
        featureStore.put({ featureId: id, feature, lastAccessedAt: Date.now(), approxBytes: JSON.stringify(feature).length * 2 });
        relationStore.put({ relationId: `${tileId}|${id}`, tileId, featureId: id });
      });
      await done;
    }

    async touch(tileIds) {
      const records = await this.readTiles(tileIds);
      const db = await this.open();
      if (!db) {
        records.forEach((record) => this.memoryTiles.set(record.tileId, { ...record, lastAccessedAt: Date.now() }));
        return;
      }
      const transaction = db.transaction(["tiles"], "readwrite");
      const done = transactionDone(transaction);
      records.forEach((record) => transaction.objectStore("tiles").put({ ...record, lastAccessedAt: Date.now() }));
      await done;
    }

    async invalidate(tileIds) {
      const records = await this.readTiles(tileIds);
      const db = await this.open();
      if (!db) {
        records.forEach((record) => this.memoryTiles.set(record.tileId, { ...record, fetchedAt: 0 }));
        return;
      }
      const transaction = db.transaction(["tiles"], "readwrite");
      const done = transactionDone(transaction);
      records.forEach((record) => transaction.objectStore("tiles").put({ ...record, fetchedAt: 0 }));
      await done;
    }

    async cleanup(now = Date.now()) {
      const db = await this.open();
      if (!db) {
        const sortedTiles = Array.from(this.memoryTiles.values())
          .sort((a, b) => Number(a.lastAccessedAt || 0) - Number(b.lastAccessedAt || 0));
        const referencedFeatureIds = () => new Set(
          Array.from(this.memoryRelations.values()).flatMap((ids) => ids || [])
        );
        const currentBytes = () => Array.from(referencedFeatureIds()).reduce((sum, id) => {
          return sum + Number(this.memoryFeatures.get(id)?.approxBytes || 0);
        }, 0);
        for (const tile of sortedTiles) {
          const expired = now - Number(tile.lastAccessedAt || tile.fetchedAt || 0) > EVICT_MS;
          if (!expired && currentBytes() <= MAX_BYTES) break;
          this.memoryTiles.delete(tile.tileId);
          this.memoryRelations.delete(tile.tileId);
        }
        const retainedIds = referencedFeatureIds();
        Array.from(this.memoryFeatures.keys()).forEach((id) => {
          if (!retainedIds.has(id)) this.memoryFeatures.delete(id);
        });
        return;
      }
      const transaction = db.transaction(["tiles", "features", "tileFeatures"], "readwrite");
      const done = transactionDone(transaction);
      const tilesStore = transaction.objectStore("tiles");
      const featureStore = transaction.objectStore("features");
      const relationStore = transaction.objectStore("tileFeatures");
      const tiles = await requestResult(tilesStore.getAll());
      const features = await requestResult(featureStore.getAll());
      const removable = (tiles || []).filter((tile) => now - Number(tile.lastAccessedAt || tile.fetchedAt || 0) > EVICT_MS)
        .sort((a, b) => Number(a.lastAccessedAt || 0) - Number(b.lastAccessedAt || 0));
      let approxBytes = (features || []).reduce((sum, item) => sum + Number(item.approxBytes || 0), 0);
      const candidates = [...removable];
      if (approxBytes > MAX_BYTES) {
        (tiles || []).sort((a, b) => Number(a.lastAccessedAt || 0) - Number(b.lastAccessedAt || 0))
          .forEach((tile) => { if (!candidates.some((item) => item.tileId === tile.tileId)) candidates.push(tile); });
      }
      for (const tile of candidates) {
        if (now - Number(tile.lastAccessedAt || tile.fetchedAt || 0) <= EVICT_MS && approxBytes <= MAX_BYTES) break;
        const relations = await requestResult(relationStore.index("tileId").getAll(tile.tileId));
        for (const relation of relations || []) relationStore.delete(relation.relationId);
        tilesStore.delete(tile.tileId);
        approxBytes -= (tile.featureIds || []).reduce((sum, id) => {
          const record = (features || []).find((item) => item.featureId === id);
          return sum + Number(record && record.approxBytes || 0);
        }, 0);
      }
      await done;
      await this.removeOrphanFeatures();
    }

    async removeOrphanFeatures() {
      const db = await this.open();
      if (!db) return;
      const transaction = db.transaction(["features", "tileFeatures"], "readwrite");
      const done = transactionDone(transaction);
      const featureStore = transaction.objectStore("features");
      const relationStore = transaction.objectStore("tileFeatures");
      const features = await requestResult(featureStore.getAllKeys());
      for (const id of features || []) {
        const relation = await requestResult(relationStore.index("featureId").getKey(id));
        if (relation === undefined) featureStore.delete(id);
      }
      await done;
    }
  }

  class TileLoader {
    constructor({ fetchTile, onFeatures, onError = () => {}, isEnabled = () => true, maxVisibleTiles = MAX_VISIBLE_TILES } = {}) {
      this.fetchTile = fetchTile;
      this.onFeatures = onFeatures;
      this.onError = onError;
      this.isEnabled = isEnabled;
      this.maxVisibleTiles = maxVisibleTiles;
      this.store = new TileStore();
      this.generation = 0;
      this.controller = null;
      this.lastCleanupAt = 0;
    }

    cancel() {
      this.generation += 1;
      if (this.controller) this.controller.abort();
      this.controller = null;
    }

    async invalidateBounds(bounds, center) {
      const tiles = tilesForBounds(bounds, center, { maxTiles: this.maxVisibleTiles, includeRing: true });
      await this.store.invalidate(tiles.map((tile) => tile.tileId));
    }

    async refresh(bounds, center) {
      this.cancel();
      if (!this.isEnabled()) return;
      const generation = this.generation;
      const controller = new AbortController();
      this.controller = controller;
      const visible = tilesForBounds(bounds, center, { maxTiles: this.maxVisibleTiles });
      const withRing = tilesForBounds(bounds, center, { maxTiles: this.maxVisibleTiles, includeRing: true });
      const visibleIds = new Set(visible.map((tile) => tile.tileId));
      const queue = [...visible, ...withRing.filter((tile) => !visibleIds.has(tile.tileId))];
      const ids = queue.map((tile) => tile.tileId);
      try {
        const storedFeatures = await this.store.featuresForTiles(ids);
        if (generation !== this.generation || controller.signal.aborted) return;
        if (storedFeatures.length) this.onFeatures(storedFeatures, { source: "indexeddb", complete: false });
        await this.store.touch(ids);
        const tileRecords = new Map((await this.store.readTiles(ids)).map((record) => [record.tileId, record]));
        let hasAuthoritativeTile = tileRecords.size > 0;
        for (const tile of queue) {
          if (generation !== this.generation || controller.signal.aborted || !this.isEnabled()) return;
          const record = tileRecords.get(tile.tileId);
          const age = record ? Date.now() - Number(record.fetchedAt || 0) : Infinity;
          if (record && age < FRESH_MS) continue;
          try {
            const response = await this.fetchTile(tile, controller.signal);
            if (generation !== this.generation || controller.signal.aborted) return;
            const responseStatus = String(response && response.status || "").toLowerCase();
            // 取得失敗を空区画として保存すると、24時間「点字ブロックなし」と誤認するため拒否する。
            if (responseStatus === "error" || responseStatus === "failed") {
              throw new Error("osm_tile_payload_error");
            }
            const features = Array.isArray(response && response.features) ? response.features : [];
            const cacheStatus = features.length ? "ready" : "empty";
            await this.store.writeTile(tile.tileId, features, response && response.fetchedAt, cacheStatus);
            hasAuthoritativeTile = true;
            const currentFeatures = await this.store.featuresForTiles(ids);
            if (generation !== this.generation || controller.signal.aborted) return;
            this.onFeatures(currentFeatures, { source: "network", tileId: tile.tileId, complete: false });
          } catch (error) {
            if (controller.signal.aborted) return;
            this.onError(error, tile);
            // staleデータが30日以内なら表示を維持し、取得失敗で消さない。
            if (!record || age > STALE_MS) console.warn("[OsmTileCache] tile unavailable", tile.tileId, error);
          }
          await new Promise((resolve) => globalScope.setTimeout(resolve, 0));
        }
        if (hasAuthoritativeTile && generation === this.generation && !controller.signal.aborted) {
          this.onFeatures(await this.store.featuresForTiles(ids), { source: "complete", complete: true });
        }
        const cleanupNow = Date.now();
        if (cleanupNow - this.lastCleanupAt >= CLEANUP_INTERVAL_MS) {
          // 長時間開いたPWAでも、孤立データ・90日超過・25MB超過を6時間ごとに再点検する。
          this.lastCleanupAt = cleanupNow;
          globalScope.setTimeout(() => this.store.cleanup().catch(() => {}), 0);
        }
      } finally {
        if (generation === this.generation) this.controller = null;
      }
    }
  }

  globalScope.StepByOsmTileCache = {
    DEFAULT_ZOOM,
    FRESH_MS,
    STALE_MS,
    EVICT_MS,
    CLEANUP_INTERVAL_MS,
    MAX_BYTES,
    latLngToTile,
    tileToBounds,
    parseTileId,
    tilesForBounds,
    featureId,
    publicFeatureForCache,
    UserMetadataCache,
    tileApiResponseRequiresLegacyFallback,
    TileStore,
    TileLoader,
  };
})(window);
