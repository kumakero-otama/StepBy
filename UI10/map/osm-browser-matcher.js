(function exposeStepByOsmMatcher(global) {
  "use strict";

  const EARTH_METERS_PER_DEGREE = 111320;
  const CACHE_DB = "stepby-ui10-osm-network-v1";
  const CACHE_STORE = "networks";

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
            connectedToPrevious: !previousWay || way.id === previousWay.id || sharesNode(way, previousWay) };
        }
      }
    });
    return best;
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
    const sampled = points.filter((_, index) => index === 0 || index === points.length - 1 || index % 3 === 0);
    const matches = [];
    let previousWayId = null;
    sampled.forEach((point) => {
      const match = chooseBestMatch(point, ways, previousWayId);
      if (match) {
        matches.push(match);
        previousWayId = match.wayId;
      }
    });
    if (matches.length < 2) return null;
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
      ways: connectedWayIds.map((id) => ways.find((way) => way.id === id)).filter(Boolean),
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

  function buildOsmChangePreview(route) {
    if (!route || !route.ways || !route.ways.length) return null;
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
      return {
        wayId: way.id,
        wayVersion: way.version,
        tags: way.tags || {},
        nodes: way.nodes || [],
        fullCoordinates: way.coordinates || [],
        relations: way.relations || [],
        from,
        to,
        coordinates: sliceWayCoordinates(way, from, to),
      };
    });
    return {
      segments,
      start: { lat: route.start.lat, lng: route.start.lng, wayId: route.start.wayId },
      end: { lat: route.end.lat, lng: route.end.lng, wayId: route.end.wayId },
      connected: true,
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

  class BrowserMatcher {
    constructor(options) {
      this.fetcher = options.fetcher;
      this.radiusMeters = options.radiusMeters || 1000;
      this.network = null;
      this.center = null;
      this.previousWayId = null;
      this.loading = null;
    }

    async ensureNetwork(lat, lng) {
      const point = { lat, lng };
      if (this.network && this.center && distanceMeters(point, this.center) < 400) return this.network;
      if (this.loading) return this.loading;
      const params = new URLSearchParams({ centerLat: String(lat), centerLng: String(lng), radiusMeters: String(this.radiusMeters) });
      this.loading = this.fetcher(`/api/osm-walkable-network?${params}`)
        .then((response) => {
          if (!response.ok) throw new Error(`osm network failed with status ${response.status}`);
          return response.json();
        })
        .then(async (data) => {
          if (!data.success || !Array.isArray(data.ways)) throw new Error("invalid osm network response");
          this.network = data.ways;
          this.center = point;
          const key = `${lat.toFixed(3)}:${lng.toFixed(3)}:${this.radiusMeters}`;
          await writeCache({ key, savedAt: Date.now(), center: point, ways: data.ways }).catch(() => {});
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

    finalize(points) {
      return finalizeTrace(points, this.network || []);
    }
  }

  global.StepByOsmMatcher = {
    BrowserMatcher,
    chooseBestMatch,
    projectToSegment,
    distanceMeters,
    buildWayGraph,
    findConnectedWayPath,
    finalizeTrace,
    buildOsmChangePreview,
  };
  if (global.document && global.document.documentElement) {
    global.document.documentElement.dataset.osmBrowserMatcher = "loaded";
  }
})(window);
