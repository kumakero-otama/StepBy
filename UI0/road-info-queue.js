(function initRoadInfoQueue(global) {
  "use strict";
  if (!global.StepByRecordQueue) return;
  const storage = global.StepByRecordQueue.createIndexedDbStorage("stepby-ui0-road-info-queue-v1", "jobs");
  const authFetch = global.AuthToken && typeof global.AuthToken.authFetch === "function"
    ? global.AuthToken.authFetch : global.fetch.bind(global);
  const queue = new global.StepByRecordQueue.RecordQueue({
    storage,
    handler: async (payload, { job, checkpoint }) => {
      if ((job.completedStages || []).includes("road_info_saved")) return;
      const response = await authFetch("/api/road-info", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": payload.id },
        body: payload.body,
      });
      if (!response.ok) throw new Error(`road_info_save_failed:${response.status}`);
      await checkpoint("road_info_saved");
    },
    onChange(event) {
      const detail = { jobId: event.job && event.job.id, status: event.type };
      global.dispatchEvent(new CustomEvent("stepby:road-info-queue", { detail }));
      try {
        if (event.type === "completed") global.sessionStorage.setItem("roadInfoPostCompleted.v1", "1");
        if (event.type === "retry") global.sessionStorage.setItem("roadInfoPostRetry.v1", "1");
      } catch (_) {}
    },
  });
  global.StepByRoadInfoQueue = {
    enqueue(body, id) { return queue.enqueue({ id, body }); },
    flush() { return queue.flush(); },
    pending() { return queue.pending(); },
  };
  global.addEventListener("online", () => void queue.flush());
  global.addEventListener("pageshow", () => void queue.flush());
  void queue.flush();
})(window);
