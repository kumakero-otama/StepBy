const assert = require("assert");
const fs = require("fs");
const vm = require("vm");
const source = fs.readFileSync("UI0/auth/token_client.js", "utf8");
const start = source.indexOf("  async function logEvent(entry)");
const end = source.indexOf("  async function sendClientLogBatch", start);
const context = {
  createLogRecord: value => value,
  safeConsoleLog() {},
  // MacのDB待機停止を再現してもAPI前処理が完了すること。
  putPendingLog: () => new Promise(() => {}),
};
vm.createContext(context);
vm.runInContext(source.slice(start, end), context);
Promise.race([
  context.logEvent({ event: "save" }).then(result => assert.equal(result.event, "save")),
  new Promise((_, reject) => setTimeout(() => reject(new Error("diagnostic DB blocked API")), 100)),
]).then(() => console.log("diagnostic DB cannot block API requests"));
