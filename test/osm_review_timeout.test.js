"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "../UI0/admin/osm-review.js"), "utf8");

assert.match(source, /AbortController\(\)/, "管理画面の通信にはタイムアウト制御が必要");
assert.match(source, /clearTimeout\(timer\)/, "通信完了時にタイマーを必ず解除する");
assert.match(source, /timeoutMs: action === "refit" \? 95000 : 75000/, "OSM承認・再マッチング処理に有限の待ち時間を設定する");
assert.match(source, /finally\s*{\s*setBusy\(false\)/, "成功・失敗・タイムアウトの全経路で画面操作を戻す");
assert.match(source, /\$\("note"\)\.value = selected\.admin_note \|\| ""/, "保存済み管理者メモを再表示する");
assert.match(source, /await load\(selectedReviewId\)/, "保存後も選択中の記録を再読込する");
assert.match(source, /action === "refit"/, "最新OSMでの再マップマッチング操作を提供する");
assert.match(source, /openstreetmap\.org\/\?mlat=/, "記録地点をOSM公式サイトで開ける");

console.log("OSM review timeout always restores the admin screen");
