const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const rootHtml = fs.readFileSync(path.join(__dirname, "..", "index.html"), "utf8");
const ui0Path = "./UI0/map/Index.html";

assert.match(rootHtml, new RegExp(`<meta[^>]+http-equiv=["']refresh["'][^>]+${ui0Path.replaceAll(".", "\\.")}`));
assert.match(rootHtml, /window\.location\.replace\(["']\.\/UI0\/map\/Index\.html["']\)/);
assert.match(rootHtml, /href=["']\.\/UI0\/map\/Index\.html["']/);

console.log("root_redirect.test.js: OK");
