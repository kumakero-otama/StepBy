const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const source = fs.readFileSync("UI0/map/async-record-queue.js", "utf8");
const timers = [];
const window = { setTimeout: (fn) => { timers.push(fn); return timers.length; }, clearTimeout() {} };
vm.runInNewContext(source, { window });
const { RecordQueue } = window.StepByRecordQueue;
const clone = (value) => JSON.parse(JSON.stringify(value));
function blocked(id, changes = {}) {
  return { id, status: "blocked", payload: { id, ownerUserId: 7, rawPoints: [{ lat: 1, lng: 2 }], tagIds: [4] },
    completedStages: ["session_started", "trace_saved", "session_ended"], attempts: 3,
    lastError: "session_tag_save_failed:403", createdAt: 1, updatedAt: 2, nextAttemptAt: 99, ...changes };
}
function storageFor(jobs) {
  const records = new Map(jobs.map((job) => [job.id, clone(job)]));
  return { records, getAll: async () => [...records.values()].map(clone),
    put: async (job) => records.set(job.id, clone(job)), delete: async (id) => records.delete(id) };
}
(async () => {
  const target = blocked("target");
  const excluded = [blocked("other-owner", { payload: { ownerUserId: 8 } }),
    blocked("missing-owner", { payload: {} }), blocked("other-error", { lastError: "session_tag_save_failed:500" }),
    blocked("missing-trace", { completedStages: ["session_ended"] }),
    blocked("missing-end", { completedStages: ["trace_saved"] }),
    blocked("tags-done", { completedStages: ["trace_saved", "session_ended", "tags_saved"] }),
    blocked("already-recovered", { tagSave403RecoveryVersion: 1 })];
  const storage = storageFor([target, ...excluded]);
  let userId = null;
  let calls = 0;
  const queue = new RecordQueue({ storage, now: () => 100, currentUserId: () => userId,
    handler: async (payload, { job, checkpoint }) => {
      calls++;
      assert.deepEqual(clone(payload), target.payload);
      assert.deepEqual(clone(job.completedStages), target.completedStages);
      await checkpoint("tags_saved");
    } });
  await queue.flush();
  assert.equal(calls, 0, "unknown auth must not recover");
  userId = 7;
  await queue.flush();
  assert.equal(calls, 1);
  const saved = storage.records.get("target");
  assert.equal(saved.status, "completed");
  assert.equal(saved.attempts, 3);
  assert.equal(saved.tagSave403RecoveryVersion, 1);
  for (const original of excluded) assert.deepEqual(storage.records.get(original.id), original);
  await queue.flush();
  assert.equal(calls, 1, "completed job must not replay");

  const failingStorage = storageFor([blocked("still-denied")]);
  let failures = 0;
  const failing = new RecordQueue({ storage: failingStorage, currentUserId: () => 7, handler: async () => {
    failures++;
    throw Object.assign(new Error("session_tag_save_failed:403"), { retryable: false });
  } });
  await failing.flush();
  await failing.flush();
  assert.equal(failures, 1, "a persistent 403 must stay blocked after one recovery");
  assert.equal(failingStorage.records.get("still-denied").status, "blocked");

  const racingStorage = storageFor([blocked("auth-race")]);
  const getAll = racingStorage.getAll;
  let release;
  let entered;
  const waiting = new Promise((resolve) => { entered = resolve; });
  racingStorage.getAll = async () => {
    racingStorage.getAll = getAll;
    entered();
    await new Promise((resolve) => { release = resolve; });
    return getAll();
  };
  userId = null;
  let racingCalls = 0;
  const racing = new RecordQueue({ storage: racingStorage, currentUserId: () => userId,
    handler: async () => { racingCalls++; } });
  const initialFlush = racing.flush();
  await waiting;
  userId = 7;
  await racing.flush();
  release();
  await initialFlush;
  assert.equal(racingCalls, 0);
  assert.equal(timers.length, 1, "auth arriving during a flush must schedule another pass");
  timers.shift()();
  // Timer callback intentionally starts flush without returning its promise.
  for (let i = 0; i < 30; i++) await Promise.resolve();
  assert.equal(racingCalls, 1);

  const mapSource = fs.readFileSync("UI0/map/map.js", "utf8");
  assert.match(mapSource, /currentUserId: \(\) => currentUserId/);
  assert.match(mapSource, /currentUserId = userId;\s+if \(recordUploadQueue\) void recordUploadQueue.flush\(\)/);
  assert.match(mapSource, /!Number.isFinite\(Number\(currentUserId\)\) \|\| Number\(currentUserId\) <= 0/);
  console.log("blocked tag-save recovery is owner-scoped, checkpoint-preserving and one-time");
})().catch((error) => { console.error(error); process.exitCode = 1; });
