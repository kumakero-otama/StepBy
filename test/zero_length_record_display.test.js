const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../UI0/map/map.js"), "utf8");
const helper = source.slice(source.indexOf("function createRecordedPathLayer("), source.indexOf("function displayTraceLine("));
const context = { L: {
  circleMarker: (coordinates, options) => ({ type: "point", coordinates, options }),
  polyline: (coordinates, options) => ({ type: "line", coordinates, options }),
} };
vm.createContext(context);
vm.runInContext(helper, context);
const same = [[34, 134], [34, 134]];
const point = context.createRecordedPathLayer(same, { color: "#00b050", weight: 4, opacity: 0.85 });
assert.equal(point.type, "point");
assert.equal(point.options.radius, 2);
assert.equal(point.options.stroke, false);
assert.equal(point.options.fillColor, "#00b050");
assert.equal(point.options.fillOpacity, 0.85);
const hit = context.createRecordedPathLayer(same, { weight: 48, opacity: 0, bubblingMouseEvents: false });
assert.equal(hit.options.radius, 24);
assert.equal(hit.options.fillOpacity, 0);
assert.equal(hit.options.bubblingMouseEvents, false);
const moving = [[34, 134], [34.000001, 134]];
assert.equal(context.createRecordedPathLayer(moving, { weight: 4 }).type, "line");
assert.equal(moving[1][0], 34.000001); // 短距離も切り捨てず、架空の座標も加えない。
assert.equal((source.match(/= createRecordedPathLayer\(coordinates,/g) || []).length, 3);
assert(source.includes("osmManaged ? null : createRecordedPathLayer(coordinates,"));
const selection = source.slice(source.indexOf("function hideTactileSessionCard()"), source.indexOf("function positionTactileSessionCard("));
vm.runInContext("let activeTactileSessionPolyline = null; let tactileSessionCardLatLng = null; const tactileSessionBackdropEl = null; const tactileSessionCardEl = null;" + selection, context);
const layer = { options: { stepByBaseColor: "#00b050" }, setStyle(style) { Object.assign(this.options, style); } };
context.setActiveTactileSessionPolyline(layer);
assert.equal(layer.options.fillColor, "#ff7a00");
assert.equal(layer.options.radius, 4);
context.hideTactileSessionCard();
assert.equal(layer.options.fillColor, "#00b050");
assert.equal(layer.options.radius, 2);
console.log("PASS: zero-length rendering, 4px diameter, hit target, unchanged short lines, shared render paths");
