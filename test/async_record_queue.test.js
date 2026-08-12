const assert = require("assert");
global.window = global;
global.navigator = { onLine: true };
require("../UI10/map/async-record-queue.js");

class MemoryStorage {
  constructor() { this.jobs = new Map(); }
  async getAll() { return Array.from(this.jobs.values()).map((job) => structuredClone(job)); }
  async put(job) { this.jobs.set(job.id, structuredClone(job)); }
  async delete(id) { this.jobs.delete(id); }
}

(async () => {
  const storage = new MemoryStorage();
  const calls = [];
  let failOnce = true;
  let now = 1000;
  const queue = new StepByRecordQueue.RecordQueue({
    storage,
    now: () => now,
    handler: async (payload, { job, checkpoint }) => {
      if (!job.completedStages.includes("trace")) {
        calls.push(`trace:${payload.id}`);
        await checkpoint("trace");
      }
      if (failOnce) { failOnce = false; throw new Error("offline"); }
      calls.push(`draft:${payload.id}`);
      await checkpoint("draft");
    },
  });
  await queue.enqueue({ id: "record:one" });
  while (queue.running) await new Promise((resolve) => setTimeout(resolve, 1));
  assert.strictEqual((await queue.pending()).length, 1, "failed job must remain queued");
  now += StepByRecordQueue.retryDelay(1);
  await queue.flush();
  assert.deepStrictEqual(calls, ["trace:record:one", "draft:record:one"], "completed stage must not run twice");
  assert.strictEqual((await queue.pending()).length, 0, "successful retry must remove job");
  await queue.enqueue({ id: "record:two" });
  await queue.enqueue({ id: "record:two" });
  while (queue.running) await new Promise((resolve) => setTimeout(resolve, 1));
  assert.strictEqual(calls.filter((item) => item === "trace:record:two").length, 1, "same id must not duplicate");
  console.log(JSON.stringify({ result: "passed", calls }));
})().catch((error) => { console.error(error); process.exit(1); });
