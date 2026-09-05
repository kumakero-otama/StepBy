"use strict";

// 点字ブロック記録中に道情報投稿画面へ移動しても、旧Valhalla APIへ戻らないことを固定する。
const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
for (const relativePath of [
  "UI0/post_road/Index.html",
  "UI0/post_road/Index_en.html",
  "UI0/post_road/Index_hi.html",
]) {
  const source = fs.readFileSync(path.join(root, relativePath), "utf8");
  assert.doesNotMatch(source, /\/api\/match\?[^"'`]*record=1/,
    `${relativePath} must not call the retired Valhalla recording path`);
  assert.match(source, /authFetch\("\/api\/session\/point"/,
    `${relativePath} must persist raw GPS through the session API`);
  assert.match(source, /latestState\.rawPoints\.push\(point\)/,
    `${relativePath} must retain raw GPS locally for browser fitting`);
}

console.log("post-road recording continues with raw GPS and no Valhalla dependency");
