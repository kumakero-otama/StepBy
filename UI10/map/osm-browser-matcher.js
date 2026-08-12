(function exposeStepByOsmMatcher(global) {
  "use strict";

  const EARTH_METERS_PER_DEGREE = 111320;
  const LOW_ACCURACY_METERS = 25;
  const CACHE_DB = "stepby-ui10-osm-network-v1";
  const CACHE_STORE = "networks";
  const CACHE_MAX_AGE_MS = 30 * 60 * 1000;
  const PREFETCH_DISTANCE_METERS = 650;

  function distanceMeters(a, b) {
    const meanLat = ((a.lat + b.lat) / 2) * Math.PI / 180;
    const dx = (b.lng - a.lng) * EARTH_METERS_PER_DEGREE * Math.cos(meanLat);
    const dy = (b.lat - a.lat) * EARTH_METERS_PER_DEGREE;
    return Math.hypot(dx, dy);
  }

  function projectToSegment(point, start, end) {
    const meanLat = ((point.lat + start.lat + end.lat) / 3) * Math.PI / 180;
    const scaleX = EARTH_METERS_PER_DEGREE * Math.cos(meanLat);
    const ax = (start.lng - point.lng) * scaleX;
    const ay = (start.lat - point.lat) * EARTH_METERS_PER_DEGREE;
    const bx = (end.lng - point.lng) * scaleX;
    const by = (end.lat - point.lat) * EARTH_METERS_PER_DEGREE;
    const vx = bx - ax;
    const vy = by - ay;
    const lengthSquared = vx * vx + vy * vy;
    const t = lengthSquared ? Math.max(0, Math.min(1, -(ax * vx + ay * vy) / lengthSquared)) : 0;
    const x = ax + t * vx;
    const y = ay + t * vy;
    return {
      lat: point.lat + y / EARTH_METERS_PER_DEGREE,
      lng: point.lng + x / scaleX,
      distance: Math.hypot(x, y),
      fraction: t,
    };
  }

  function signedOffsetMeters(point, start, end) {
    const meanLat = ((point.lat + start.lat + end.lat) / 3) * Math.PI / 180;
    const scaleX = EARTH_METERS_PER_DEGREE * Math.cos(meanLat);
    const vx = (end.lng - start.lng) * scaleX;
    const vy = (end.lat - start.lat) * EARTH_METERS_PER_DEGREE;
    const px = (point.lng - start.lng) * scaleX;
    const py = (point.lat - start.lat) * EARTH_METERS_PER_DEGREE;
    const length = Math.hypot(vx, vy);
    return length ? (vx * py - vy * px) / length : 0;
  }

  function sharesNode(a, b) {
    if (!a || !b || !Array.isArray(a.nodes) || !Array.isArray(b.nodes)) return false;
    const nodes = new Set(a.nodes);
    return b.nodes.some((nodeId) => nodes.has(nodeId));
  }

  function chooseBestMatch(point, ways, previousWayId) {
    const previousWay = ways.find((way) => way.id === previousWayId) || null;
    let best = null;
    ways.forEach((way) => {
      if (!Array.isArray(way.coordinates)) return;
      for (let index = 0; index < way.coordinates.length - 1; index += 1) {
        const a = { lng: way.coordinates[index][0], lat: way.coordinates[index][1] };
        const b = { lng: way.coordinates[index + 1][0], lat: way.coordinates[index + 1][1] };
        const projected = projectToSegment(point, a, b);
        if (projected.distance > 60) continue;
        const pedestrianPenalty = way.priority === "pedestrian" ? 0 : 18;
        const continuityPenalty = !previousWay ? 0 :
          way.id === previousWay.id ? 0 : sharesNode(way, previousWay) ? 3 : 14;
        const score = projected.distance + pedestrianPenalty + continuityPenalty;
        if (!best || score < best.score) {
          best = { ...projected, score, wayId: way.id, wayVersion: way.version, segmentIndex: index,
            priority: way.priority, tags: way.tags, nodes: way.nodes,
            sourcePoint: { lat: point.lat, lng: point.lng },
            signedOffsetMeters: signedOffsetMeters(point, a, b),
            connectedToPrevious: !previousWay || way.id === previousWay.id || sharesNode(way, previousWay) };
        }
      }
    });
    return best;
  }

  function preparePoints(points, lowAccuracyMeters = LOW_ACCURACY_METERS) {
    const normalized = points.map((point, index) => ({ ...point, originalIndex: index,
      accuracy: Number.isFinite(Number(point.accuracy)) ? Number(point.accuracy) : null }));
    return normalized.map((point, index) => {
      if (point.accuracy === null || point.accuracy <= lowAccuracyMeters) return { ...point, quality: "observed" };
      let previous = null, next = null;
      for (let i = index - 1; i >= 0; i -= 1) if (normalized[i].accuracy === null || normalized[i].accuracy <= lowAccuracyMeters) { previous = normalized[i]; break; }
      for (let i = index + 1; i < normalized.length; i += 1) if (normalized[i].accuracy === null || normalized[i].accuracy <= lowAccuracyMeters) { next = normalized[i]; break; }
      if (!previous || !next || next.originalIndex === previous.originalIndex) return { ...point, quality: "discarded", discardReason: "low_accuracy_without_neighbors" };
      const ratio = (index - previous.originalIndex) / (next.originalIndex - previous.originalIndex);
      return { ...point, lat: previous.lat + (next.lat - previous.lat) * ratio, lng: previous.lng + (next.lng - previous.lng) * ratio,
        quality: "interpolated", interpolatedFrom: [previous.originalIndex, next.originalIndex] };
    });
  }

  function buildWayGraph(ways) {
    const byNode = new Map();
    const byId = new Map();
    ways.forEach((way) => {
      byId.set(way.id, way);
      (way.nodes || []).forEach((nodeId) => {
        if (!byNode.has(nodeId)) byNode.set(nodeId, []);
        byNode.get(nodeId).push(way.id);
      });
    });
    const neighbors = new Map(ways.map((way) => [way.id, new Set()]));
    byNode.forEach((wayIds) => {
      wayIds.forEach((wayId) => wayIds.forEach((otherId) => {
        if (wayId !== otherId) neighbors.get(wayId).add(otherId);
      }));
    });
    return { byId, neighbors };
  }

  function dominantConnectedComponent(ways, matches) {
    const counts = new Map(); matches.filter(Boolean).forEach((match) => counts.set(match.wayId, (counts.get(match.wayId) || 0) + 1));
    const graph = buildWayGraph(ways), seen = new Set(); let best = ways, bestCount = -1;
    ways.forEach((way) => {
      if (seen.has(way.id)) return;
      const queue = [way.id], ids = []; seen.add(way.id);
      while (queue.length) { const id = queue.shift(); ids.push(id); (graph.neighbors.get(id) || []).forEach((next) => { if (!seen.has(next)) { seen.add(next); queue.push(next); } }); }
      const count = ids.reduce((sum, id) => sum + (counts.get(id) || 0), 0);
      if (count > bestCount) { bestCount = count; best = ids.map((id) => graph.byId.get(id)).filter(Boolean); }
    });
    return best;
  }

  function findConnectedWayPath(ways, startWayId, endWayId) {
    if (startWayId === endWayId) return [startWayId];
    const graph = buildWayGraph(ways);
    if (!graph.byId.has(startWayId) || !graph.byId.has(endWayId)) return null;
    const queue = [{ id: startWayId, cost: 0 }];
    const costById = new Map([[startWayId, 0]]);
    const previous = new Map();
    while (queue.length) {
      queue.sort((a, b) => a.cost - b.cost);
      const current = queue.shift();
      if (current.cost !== costById.get(current.id)) continue;
      if (current.id === endWayId) break;
      (graph.neighbors.get(current.id) || []).forEach((nextId) => {
        const way = graph.byId.get(nextId);
        const nextCost = current.cost + (way.priority === "pedestrian" ? 1 : 3);
        if (!costById.has(nextId) || nextCost < costById.get(nextId)) {
          costById.set(nextId, nextCost);
          previous.set(nextId, current.id);
          queue.push({ id: nextId, cost: nextCost });
        }
      });
    }
    if (!previous.has(endWayId)) return null;
    const path = [endWayId];
    while (path[0] !== startWayId) path.unshift(previous.get(path[0]));
    return path;
  }

  function finalizeTrace(points, ways) {
    if (!Array.isArray(points) || points.length < 2) return null;
    const prepared = preparePoints(points);
    const sampled = prepared.filter((point, index) => point.quality !== "discarded" && (index === 0 || index === points.length - 1 || index % 3 === 0));
    let matches = [];
    let previousWayId = null;
    sampled.forEach((point) => {
      const match = chooseBestMatch(point, ways, previousWayId);
      if (match) {
        matches.push(match);
        previousWayId = match.wayId;
      }
    });
    if (matches.length < 2) return null;
    let routeSmoothed = false;
    const initiallyDisconnected = matches.slice(1).some((match, index) => !findConnectedWayPath(ways, matches[index].wayId, match.wayId));
    if (initiallyDisconnected) {
      const routeWays = dominantConnectedComponent(ways, matches), smoothed = [];
      let previous = null;
      sampled.forEach((point) => { const match = chooseBestMatch(point, routeWays, previous); if (match) { smoothed.push(match); previous = match.wayId; } });
      if (smoothed.length >= 2 && !smoothed.slice(1).some((match, index) => !findConnectedWayPath(routeWays, smoothed[index].wayId, match.wayId))) {
        matches = smoothed; routeSmoothed = true;
      }
    }
    const observedWayIds = matches.reduce((ids, match) => ids[ids.length - 1] === match.wayId ? ids : [...ids, match.wayId], []);
    if (matches.length / sampled.length < 0.8) return null;
    const connectedWayIds = [matches[0].wayId];
    for (let index = 1; index < matches.length; index += 1) {
      const fromWayId = connectedWayIds[connectedWayIds.length - 1];
      const toWayId = matches[index].wayId;
      if (fromWayId === toWayId) continue;
      const bridge = findConnectedWayPath(ways, fromWayId, toWayId);
      if (!bridge) return null;
      connectedWayIds.push(...bridge.slice(1));
    }
    return {
      start: matches[0],
      end: matches[matches.length - 1],
      matches,
      wayIds: connectedWayIds,
      observedWayIds,
      connectorWayIds: connectedWayIds.filter((id) => !observedWayIds.includes(id)),
      routeConfirmed: true,
      routeSmoothed,
      ways: connectedWayIds.map((id) => ways.find((way) => way.id === id)).filter(Boolean),
      rawPoints: points.map((point) => ({ lat: Number(point.lat), lng: Number(point.lng), accuracy: Number.isFinite(Number(point.accuracy)) ? Number(point.accuracy) : null })),
      quality: { interpolatedPointCount: prepared.filter((point) => point.quality === "interpolated").length,
        discardedPointCount: prepared.filter((point) => point.quality === "discarded").length,
        discardedPoints: prepared.filter((point) => point.quality === "discarded").map((point) => ({ index: point.originalIndex, accuracy: point.accuracy, reason: point.discardReason })) },
    };
  }

  function sharedNodeIndex(a, b) {
    const other = new Set(b.nodes || []);
    return (a.nodes || []).findIndex((nodeId) => other.has(nodeId));
  }

  function projectedCoordinate(match) {
    return [match.lng, match.lat];
  }

  function sliceWayCoordinates(way, from, to) {
    const coordinates = way.coordinates || [];
    const fromIndex = from.kind === "projection" ? from.segmentIndex + from.fraction : from.index;
    const toIndex = to.kind === "projection" ? to.segmentIndex + to.fraction : to.index;
    const startCoordinate = from.kind === "projection" ? from.coordinate : coordinates[from.index];
    const endCoordinate = to.kind === "projection" ? to.coordinate : coordinates[to.index];
    const result = [startCoordinate];
    if (fromIndex <= toIndex) {
      for (let i = Math.floor(fromIndex) + 1; i <= Math.floor(toIndex); i += 1) result.push(coordinates[i]);
    } else {
      for (let i = Math.ceil(fromIndex) - 1; i >= Math.ceil(toIndex); i -= 1) result.push(coordinates[i]);
    }
    if (result[result.length - 1] !== endCoordinate) result.push(endCoordinate);
    return result.filter(Boolean);
  }

  function isIndependentWalkway(way) {
    const tags = way && way.tags || {};
    return ["footway", "path", "pedestrian", "steps", "corridor"].includes(String(tags.highway || "").toLowerCase()) ||
      String(tags.footway || "").toLowerCase() === "sidewalk";
  }

  function inferWaySideDetail(route, way) {
    if (isIndependentWalkway(way)) return { side: null, confidence: 1, method: "independent_walkway", sampleCount: 0 };
    const offsets = [];
    (route.rawPoints || []).forEach((point) => {
      let nearest = null;
      for (let index = 0; index < (way.coordinates || []).length - 1; index += 1) {
        const start = { lng: way.coordinates[index][0], lat: way.coordinates[index][1] };
        const end = { lng: way.coordinates[index + 1][0], lat: way.coordinates[index + 1][1] };
        const projection = projectToSegment(point, start, end);
        if (!nearest || projection.distance < nearest.distance) {
          nearest = { distance: projection.distance, offset: signedOffsetMeters(point, start, end) };
        }
      }
      if (nearest && nearest.distance <= 30 && Number.isFinite(nearest.offset)) {
        const accuracy = Number.isFinite(Number(point.accuracy)) ? Math.max(1, Number(point.accuracy)) : 10;
        offsets.push({ value: nearest.offset, weight: 1 / (accuracy + Math.max(0, nearest.distance) + 1) });
      }
    });
    // rawがWayから遠すぎる場合は、同じWayへマッチした点に保存済みの符号付き距離を使う。
    if (!offsets.length) {
      (route.matches || []).filter((match) => match.wayId === way.id && Number.isFinite(match.signedOffsetMeters))
        .forEach((match) => offsets.push({ value: match.signedOffsetMeters, weight: 1 / (Math.max(0, Number(match.distance) || 0) + 1) }));
    }
    if (!offsets.length) return { side: "left", confidence: 0, method: "deterministic_fallback", sampleCount: 0 };
    const weighted = offsets.reduce((sum, item) => sum + item.value * item.weight, 0);
    const totalWeight = offsets.reduce((sum, item) => sum + item.weight, 0) || 1;
    const weightedMean = weighted / totalWeight;
    const strongest = offsets.slice().sort((a, b) => Math.abs(b.value) - Math.abs(a.value))[0];
    const signedDecision = Math.abs(weightedMean) >= 0.05 ? weightedMean : strongest.value;
    const agreeingWeight = offsets.filter((item) => signedDecision >= 0 ? item.value >= 0 : item.value < 0)
      .reduce((sum, item) => sum + item.weight, 0);
    return {
      side: signedDecision >= 0 ? "left" : "right",
      confidence: Math.max(0, Math.min(1, agreeingWeight / totalWeight)),
      method: Math.abs(weightedMean) >= 0.05 ? "accuracy_weighted_offset" : "strongest_offset_tiebreak",
      sampleCount: offsets.length,
      weightedOffsetMeters: weightedMean,
    };
  }

  function inferWaySide(route, way) {
    return inferWaySideDetail(route, way).side;
  }

  function buildOsmChangePreview(route) {
    if (!route || route.routeConfirmed !== true || !route.ways || !route.ways.length) return null;
    const connectors = [];
    for (let i = 0; i < route.ways.length - 1; i += 1) {
      const leftIndex = sharedNodeIndex(route.ways[i], route.ways[i + 1]);
      if (leftIndex < 0) return null;
      const nodeId = route.ways[i].nodes[leftIndex];
      connectors.push({ nodeId, leftIndex, rightIndex: route.ways[i + 1].nodes.indexOf(nodeId) });
    }
    const segments = route.ways.map((way, index) => {
      const from = index === 0
        ? { kind: "projection", segmentIndex: route.start.segmentIndex, fraction: route.start.fraction, coordinate: projectedCoordinate(route.start) }
        : { kind: "node", index: connectors[index - 1].rightIndex };
      const to = index === route.ways.length - 1
        ? { kind: "projection", segmentIndex: route.end.segmentIndex, fraction: route.end.fraction, coordinate: projectedCoordinate(route.end) }
        : { kind: "node", index: connectors[index].leftIndex };
      const sideDetail = inferWaySideDetail(route, way);
      const side = sideDetail.side;
      return {
        wayId: way.id,
        wayVersion: way.version,
        tags: way.tags || {},
        nodes: way.nodes || [],
        fullCoordinates: way.coordinates || [],
        relations: way.relations || [],
        side,
        sideConfidence: sideDetail.confidence,
        sideInferenceMethod: sideDetail.method,
        tagStrategy: isIndependentWalkway(way)
          ? "tactile_paving=yes"
          : side ? `sidewalk:${side}:tactile_paving=yes` : "左右判定不可",
        from,
        to,
        coordinates: sliceWayCoordinates(way, from, to),
      };
    });
    return {
      segments,
      matchedSamples: (route.matches || []).map((match) => ({
        lat: match.lat,
        lon: match.lng,
        wayId: match.wayId,
        distance: match.distance,
      })),
      start: { lat: route.start.lat, lng: route.start.lng, wayId: route.start.wayId },
      end: { lat: route.end.lat, lng: route.end.lng, wayId: route.end.wayId },
      connected: true,
      routeConfirmed: true,
    };
  }

  function openCache() {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) { resolve(null); return; }
      const request = global.indexedDB.open(CACHE_DB, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(CACHE_STORE, { keyPath: "key" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async function writeCache(record) {
    const db = await openCache();
    if (!db) return;
    await new Promise((resolve, reject) => {
      const tx = db.transaction(CACHE_STORE, "readwrite");
      tx.objectStore(CACHE_STORE).put(record);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  }

  async function readCaches() {
    const db = await openCache();
    if (!db) return [];
    try {
      return await new Promise((resolve, reject) => {
        const tx = db.transaction(CACHE_STORE, "readonly");
        const request = tx.objectStore(CACHE_STORE).getAll();
        request.onsuccess = () => resolve(Array.isArray(request.result) ? request.result : []);
        request.onerror = () => reject(request.error || tx.error);
      });
    } finally {
      db.close();
    }
  }

  function mergeWays(regions) {
    const byId = new Map();
    regions.forEach((region) => (region.ways || []).forEach((way) => {
      const current = byId.get(way.id);
      if (!current || Number(way.version || 0) >= Number(current.version || 0)) byId.set(way.id, way);
    }));
    return Array.from(byId.values());
  }

  class BrowserMatcher {
    constructor(options) {
      this.fetcher = options.fetcher;
      this.radiusMeters = options.radiusMeters || 1000;
      this.network = null;
      this.center = null;
      this.regions = [];
      this.previousWayId = null;
      this.loading = null;
      this.ready = this.restoreCachedRegions();
    }

    async restoreCachedRegions() {
      const now = Date.now();
      const cached = await readCaches().catch(() => []);
      this.regions = cached.filter((region) => region && region.center && Array.isArray(region.ways) &&
        now - Number(region.savedAt || 0) <= CACHE_MAX_AGE_MS);
      this.network = mergeWays(this.regions);
      return this.network;
    }

    hasFreshCoverage(point, distance = PREFETCH_DISTANCE_METERS) {
      const now = Date.now();
      return this.regions.some((region) => now - Number(region.savedAt || 0) <= CACHE_MAX_AGE_MS &&
        distanceMeters(point, region.center) < distance);
    }

    async ensureNetwork(lat, lng, options = {}) {
      const point = { lat, lng };
      await this.ready;
      if (!options.force && this.hasFreshCoverage(point)) return this.network;
      if (this.loading) return this.loading;
      const params = new URLSearchParams({ centerLat: String(lat), centerLng: String(lng), radiusMeters: String(this.radiusMeters) });
      this.loading = this.fetcher(`/api/osm-walkable-network?${params}`)
        .then((response) => {
          if (!response.ok) throw new Error(`osm network failed with status ${response.status}`);
          return response.json();
        })
        .then(async (data) => {
          if (!data.success || !Array.isArray(data.ways)) throw new Error("invalid osm network response");
          this.center = point;
          const key = `${lat.toFixed(3)}:${lng.toFixed(3)}:${this.radiusMeters}`;
          const region = { key, savedAt: Date.now(), center: point, radiusMeters: this.radiusMeters, ways: data.ways };
          const existingIndex = this.regions.findIndex((item) => item.key === key);
          if (existingIndex >= 0) this.regions.splice(existingIndex, 1, region);
          else this.regions.push(region);
          this.network = mergeWays(this.regions);
          await writeCache(region).catch(() => {});
          return this.network;
        })
        .finally(() => { this.loading = null; });
      return this.loading;
    }

    async match(lat, lng) {
      const ways = await this.ensureNetwork(lat, lng);
      const result = chooseBestMatch({ lat, lng }, ways, this.previousWayId);
      if (result) this.previousWayId = result.wayId;
      return result;
    }

    prefetchForLocation(lat, lng) {
      const point = { lat, lng };
      return this.ready.then(() => {
        if (this.hasFreshCoverage(point)) return this.network;
        return this.ensureNetwork(lat, lng, { force: true });
      });
    }

    finalize(points) {
      return finalizeTrace(points, this.network || []);
    }
  }

  global.StepByOsmMatcher = {
    BrowserMatcher,
    chooseBestMatch,
    preparePoints,
    projectToSegment,
    distanceMeters,
    signedOffsetMeters,
    inferWaySide,
    inferWaySideDetail,
    isIndependentWalkway,
    buildWayGraph,
    mergeWays,
    findConnectedWayPath,
    finalizeTrace,
    buildOsmChangePreview,
  };
  if (global.document && global.document.documentElement) {
    global.document.documentElement.dataset.osmBrowserMatcher = "loaded";
  }
})(window);
