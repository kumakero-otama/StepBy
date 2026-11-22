const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("UI0/map/map.js", "utf8");
const context = { Date, isCurrentUserPro: false };
vm.createContext(context);
vm.runInContext(source.slice(source.indexOf("function recordingResponseError("), source.indexOf("function requestBrowserTraceData(")), context);
vm.runInContext(source.slice(source.indexOf("function isNonProVisibleTactileSession("), source.indexOf('L.tileLayer("https://{s}.tile.openstreetmap.org')), context);
vm.runInContext(source.slice(source.indexOf("function getVisibleTactilePaths("), source.indexOf("function getVisibleRoadInfoPoints(")), context);
context.shouldShowOnlyMyTactile = () => false;
context.currentUserId = 7;
const response = (status, header) => ({ status, headers: { get: () => header } });
const errorFor = (status, header, payload = {}) => context.recordingResponseError(response(status, header), payload);
assert.equal(errorFor(429, "60").retryAfterMs, 60000);
assert.equal(errorFor(503, "3", { retryAfterSeconds: 90 }).retryAfterMs, 90000);
assert.equal(errorFor(503, "invalid", { retryAfterSeconds: 4 }).retryAfterMs, 4000);
assert.equal(errorFor(503, null).retryAfterMs, 0);
const httpDate = new Date(Date.now() + 60000).toUTCString();
assert.ok(errorFor(429, httpDate).retryAfterMs >= 58000);
for (const status of [400, 401, 403, 404, 409, 422]) assert.equal(errorFor(status, "60").retryable, false);
for (const status of [408, 429, 500, 503]) assert.equal(errorFor(status, null).retryable, true);
for (const code of ["tactile_paving", "tactile_paving_jis", "tactile_paving_non_jis"]) {
  assert.equal(context.isNonProVisibleTactileSession({tag_codes: [code, "private"], tags: ["任意"]}), true);
}
assert.equal(context.isNonProVisibleTactileSession({tag_codes: ["private"], tags: ["点字ブロック"]}), false);
assert.equal(context.isNonProVisibleTactileSession({tags: ["JISの点字ブロック", "追加情報"]}), true);
assert.equal(context.isNonProVisibleTactileSession({tags: ["非公開情報"]}), false);
context.isCurrentUserPro = true;
assert.equal(context.isNonProVisibleTactileSession({tag_codes: ["private"]}), true);
const cachedPrivate = {record_class: "pro_private", user_id: 8, tag_codes: ["tactile_paving"]};
assert.equal(context.getVisibleTactilePaths([cachedPrivate]).length, 0, "other PRO private cache geometry must not render");
assert.equal(context.getVisibleTactilePaths([{...cachedPrivate, user_id: 7}]).length, 1, "PRO owner retains private visibility");
context.currentUserId = null;
assert.equal(context.getVisibleTactilePaths([cachedPrivate]).length, 0, "unknown owner must not display private geometry");
context.currentUserId = 7;
context.isCurrentUserPro = false;
assert.equal(context.getVisibleTactilePaths([cachedPrivate]).length, 0, "normal mode also excludes other private geometry");

const window = { setTimeout: () => 1, clearTimeout() {} };
vm.runInNewContext(fs.readFileSync("UI0/map/async-record-queue.js", "utf8"), {window});
const {RecordQueue} = window.StepByRecordQueue;
(async () => {
  vm.runInContext(source.slice(source.indexOf("function requestBrowserTraceData("), source.indexOf("// trace_attributesで")), context);
  vm.runInContext(source.slice(source.indexOf("async function saveSessionTags("), source.indexOf("// 一般モードの記録は")), context);
  context.authFetch = async () => ({...response(429, "5"), ok: false,
    json: async () => ({retryAfterSeconds: 12})});
  for (const operation of [() => context.requestBrowserTraceData({segments: []}, "record", []),
    () => context.saveSessionTags(["record"], [1])]) {
    await assert.rejects(operation, (error) => error.retryable === true && error.retryAfterMs === 12000);
  }
  context.authFetch = async () => ({...response(403, "5"), ok: false, json: async () => ({})});
  await assert.rejects(() => context.requestBrowserTraceData({segments: []}, "record", []),
    (error) => error.retryable === false && error.status === 403);
  for (const stage of ["start", "end"]) assert.ok(source.includes(
    `await throwRecordingResponseError(response, \`queued_session_${stage}_failed:\${response.status}\`)`));
  for (const serverDelay of [0, 60000]) {
    let job = {id: "retry", payload: {}, completedStages: [], status: "pending", attempts: 0, createdAt: 1};
    const storage = {getAll: async () => [job], put: async (value) => {job = value;}, delete: async () => {}};
    const queue = new RecordQueue({storage, now: () => 1000, random: () => 0,
      handler: async () => {throw Object.assign(new Error("busy"), {retryAfterMs: serverDelay});}});
    await queue.flush();
    assert.equal(job.nextAttemptAt, 1000 + Math.max(2000, serverDelay) + 100);
    await queue.flush();
    assert.equal(job.attempts, 1, "manual flush must respect server delay");
  }
  const css = fs.readFileSync("UI0/map/map.css", "utf8");
  assert.match(css, /\.map-toast\s*\{[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;/);
  console.log("record retries respect server delays and public tactile visibility");
})().catch((error) => {console.error(error); process.exitCode = 1;});
