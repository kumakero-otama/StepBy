const assert = require("node:assert/strict"), fs = require("node:fs"), vm = require("node:vm");
const source = fs.readFileSync("UI0/map/map.js", "utf8");
const context = {console: {error() {}}, currentSessionId: "active", recordingSessionIds: ["previous", "active"],
  currentSessionSnappedPoints: [], points: [{lat: 1, lng: 2}], rollbackCalls: 0, storageCalls: 0,
  getCurrentSessionTracePoints() { return this.points; }};
context.getCurrentSessionTracePoints = () => context.points;
context.rollbackCurrentSessionPointsFromRecording = () => {context.rollbackCalls++;};
context.saveRecordingStateToStorage = () => {context.storageCalls++;};
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf("function postSessionLifecycle("), source.indexOf("function extractTraceCoordinates(")), context);
vm.runInContext(source.slice(source.indexOf("function recordingResponseError("), source.indexOf("function requestBrowserTraceData(")), context);
vm.runInContext(source.slice(source.indexOf("async function persistCurrentSessionWithoutConfirmation("), source.indexOf("const RECORD_DIAGNOSTIC_KEY")), context);
context.authFetch = async () => ({ok: true, json: async () => ({})});
(async () => {
  const result = await context.persistCurrentSessionWithoutConfirmation();
  assert.equal(result.canceled, true);
  assert.deepEqual(Array.from(context.recordingSessionIds), ["previous"]);
  assert.equal(context.rollbackCalls, 1);
  assert.equal(context.storageCalls, 1);
  context.recordingSessionIds = ["previous", "active"];
  context.authFetch = async () => ({ok: false, status: 503, headers: {get: () => "10"}, json: async () => ({})});
  await assert.rejects(() => context.persistCurrentSessionWithoutConfirmation(),
    (error) => error.retryable && error.retryAfterMs === 10000);
  assert.deepEqual(Array.from(context.recordingSessionIds), ["previous", "active"]);
  assert.equal(context.rollbackCalls, 1, "failed cancel must not discard points");
  context.points = [{lat: 1, lng: 2}, {lat: 2, lng: 3}];
  context.processAndDisplayTrace = async () => true;
  await assert.rejects(() => context.persistCurrentSessionWithoutConfirmation({segments: []}), /session end failed: 503/);
  assert.equal(context.currentSessionId, "active");
  assert.equal(context.points.length, 2);
  assert.equal(context.rollbackCalls, 1, "failed end must preserve points");
  assert.match(source, /catch \(error\) \{\s*console.error\("\[Pause\] Session persistence failed:"[\s\S]{0,300}recordPaused = false;[\s\S]{0,100}saveRecordingStateToStorage/);
  console.log("pause cancellation removes only confirmed IDs; lifecycle failures preserve data and propagate");
})().catch((error) => {console.error(error); process.exitCode = 1;});
