(function exposeStepByRecordQueue(global) {
  "use strict";

  const DB_NAME = "stepby-ui10-record-queue-v1";
  const STORE_NAME = "jobs";
  const BASE_RETRY_MS = 2000;
  const MAX_RETRY_MS = 5 * 60 * 1000;

  function retryDelay(attempts) {
    return Math.min(MAX_RETRY_MS, BASE_RETRY_MS * (2 ** Math.max(0, Number(attempts || 1) - 1)));
  }

  function openDb(dbName = DB_NAME, storeName = STORE_NAME) {
    return new Promise((resolve, reject) => {
      if (!global.indexedDB) {
        reject(new Error("indexeddb_unavailable"));
        return;
      }
      const request = global.indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "id" });
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("queue_db_open_failed"));
    });
  }

  function createIndexedDbStorage(dbName = DB_NAME, storeName = STORE_NAME) {
    async function withStore(mode, operation) {
      const db = await openDb(dbName, storeName);
      try {
        return await new Promise((resolve, reject) => {
          const tx = db.transaction(storeName, mode);
          const request = operation(tx.objectStore(storeName));
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error || tx.error);
        });
      } finally {
        db.close();
      }
    }
    return {
      getAll: () => withStore("readonly", (store) => store.getAll()),
      put: (job) => withStore("readwrite", (store) => store.put(job)),
      delete: (id) => withStore("readwrite", (store) => store.delete(id)),
    };
  }

  class RecordQueue {
    constructor(options = {}) {
      this.storage = options.storage || createIndexedDbStorage();
      this.handler = options.handler || null;
      this.onChange = options.onChange || (() => {});
      this.online = options.online || (() => global.navigator ? global.navigator.onLine !== false : true);
      this.now = options.now || (() => Date.now());
      this.running = false;
      this.timer = null;
    }

    setHandler(handler) {
      this.handler = handler;
    }

    async enqueue(payload) {
      if (!payload || !payload.id) throw new Error("queue_job_id_required");
      const existing = (await this.storage.getAll()).find((job) => job.id === payload.id);
      if (existing) return existing;
      const job = {
        id: payload.id,
        payload,
        completedStages: [],
        status: "pending",
        attempts: 0,
        createdAt: this.now(),
        updatedAt: this.now(),
        nextAttemptAt: this.now(),
        lastError: null,
      };
      await this.storage.put(job);
      this.onChange({ type: "queued", job });
      void this.flush();
      return job;
    }

    async pending() {
      return (await this.storage.getAll()).filter((job) => job.status !== "completed");
    }

    async flush() {
      if (this.running || !this.handler || !this.online()) return;
      this.running = true;
      if (this.timer) {
        global.clearTimeout(this.timer);
        this.timer = null;
      }
      try {
        const jobs = (await this.pending()).sort((a, b) => a.createdAt - b.createdAt);
        for (const job of jobs) {
          if (!this.online()) break;
          if (Number(job.nextAttemptAt || 0) > this.now()) continue;
          job.status = "sending";
          job.updatedAt = this.now();
          await this.storage.put(job);
          this.onChange({ type: "sending", job });
          const checkpoint = async (stage) => {
            if (!job.completedStages.includes(stage)) job.completedStages.push(stage);
            job.updatedAt = this.now();
            await this.storage.put(job);
          };
          try {
            await this.handler(job.payload, { job, checkpoint });
            job.status = "completed";
            job.updatedAt = this.now();
            // 完了済みIDをtombstoneとして残し、画面再実行や再起動で同じ記録を二重送信しない。
            await this.storage.put(job);
            this.onChange({ type: "completed", job });
          } catch (error) {
            job.status = "retry";
            job.attempts += 1;
            job.lastError = String(error && error.message ? error.message : error);
            job.updatedAt = this.now();
            job.nextAttemptAt = this.now() + retryDelay(job.attempts);
            await this.storage.put(job);
            this.onChange({ type: "retry", job, error });
          }
        }
      } finally {
        this.running = false;
        const remaining = await this.pending().catch(() => []);
        if (remaining.length && this.online()) {
          const nextAt = Math.min(...remaining.map((job) => Number(job.nextAttemptAt || this.now())));
          this.timer = global.setTimeout(() => void this.flush(), Math.max(250, nextAt - this.now()));
        }
      }
    }
  }

  global.StepByRecordQueue = { RecordQueue, createIndexedDbStorage, retryDelay };
})(window);
