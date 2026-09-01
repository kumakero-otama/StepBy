"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../UI0/admin/osm-review.js"), "utf8");

assert.match(source, /AbortController\(\)/, "管理画面の通信にはタイムアウト制御が必要");
assert.match(source, /finally\{clearTimeout\(timer\)\}/, "通信完了時にタイマーを必ず解除する");
assert.match(source, /timeoutMs:75000/, "OSM承認処理にも有限の待ち時間を設定する");
assert.match(source, /finally\{setBusy\(false\)\}/, "成功・失敗・タイムアウトの全経路で画面操作を戻す");

console.log("OSM review timeout always restores the admin screen");
