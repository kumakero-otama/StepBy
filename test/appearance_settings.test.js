const assert = require("assert");
const fs = require("fs");
const path = require("path");

const css = fs.readFileSync(path.join(__dirname, "../UI10/appbar.css"), "utf8");
const profileSource = fs.readFileSync(path.join(__dirname, "../UI10/profile/profile.js"), "utf8");
const mapSource = fs.readFileSync(path.join(__dirname, "../UI10/map/map.js"), "utf8");

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
assert.match(css, /data-theme="dark"[\s\S]*?background:\s*#11171b !important/,
  "dark mode must color the root canvas below short pages");
assert.match(css, /data-theme="dark"[\s\S]*?\.record-actions[\s\S]*?\.tactile-session-card[\s\S]*?\.fitting-detail-panel/,
  "dark mode must cover map action and detail cards");
assert.match(css, /\.record-action-btn[\s\S]*?font-size:\s*0\.9375rem !important/,
  "record and pause labels must follow the selected root font size");

for (const popupSource of [profileSource, mapSource]) {
  assert.match(popupSource, /fontSize:\s*`\$\{Math\.max\(20, sourceRootSize \* 1\.125\)\}px`/,
    "StepBy OAuth preparation text must be at least 20px and follow the selected font size");
  assert.match(popupSource, /background:\s*dark \? "#11171b" : "#f5f7fa"/,
    "StepBy OAuth preparation window must follow the selected theme");
  assert.doesNotMatch(popupSource, /body\.textContent\s*=\s*"OpenStreetMapの認証画面を準備しています/,
    "the old unstyled OAuth preparation text must not return");
}

console.log("appearance settings cover scalable text and dark interactive surfaces");
