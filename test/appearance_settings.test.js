const assert = require("assert");
const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "../UI10/appbar.css"), "utf8");

assert.match(css, /:root\[data-font-size="medium"\][\s\S]*?font-size:\s*115%/,
  "medium must increase the root rem size");
assert.match(css, /:root\[data-font-size="large"\][\s\S]*?font-size:\s*130%/,
  "large must increase the root rem size");
assert.doesNotMatch(css, /data-font-size="medium"\]\s*body[\s\S]{0,160}?16px/,
  "font scaling must not be limited to inherited body text");
assert.match(css, /data-theme="dark"[\s\S]*?\.accordion-item[\s\S]*?\.stat-card[\s\S]*?\.form-card[\s\S]*?\.map-controls-panel[\s\S]*?\.section-card/,
  "dark mode must cover cards from settings, profile, edit, map, and detail screens");
assert.match(css, /data-theme="dark"[\s\S]*?input\[type="text"\][\s\S]*?textarea[\s\S]*?--stepby-input-bg/,
  "dark mode must cover text inputs and textareas");
assert.match(css, /data-theme="dark"[\s\S]*?\.osm-disconnect-btn[\s\S]*?\.trace-confirm-cancel-btn/,
  "dark mode must cover secondary buttons");

console.log("appearance settings cover scalable text and dark interactive surfaces");
