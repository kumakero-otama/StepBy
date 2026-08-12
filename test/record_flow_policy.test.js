const assert = require("assert");
global.window = global;
require("../UI10/map/record-flow-policy.js");
const shouldOpen = StepByRecordFlowPolicy.shouldOpenOsmConnection;
assert.strictEqual(shouldOpen({ configured: true, connected: false }), true, "unconnected configured user opens popup");
assert.strictEqual(shouldOpen({ configured: true, connected: true }), false, "connected user stays in StepBy");
assert.strictEqual(shouldOpen({ configured: false, connected: false }), false, "unconfigured server cannot open popup");
assert.strictEqual(shouldOpen(null), false);
console.log(JSON.stringify({ result: "passed", unconnectedOnly: true }));
