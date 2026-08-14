const assert = require("assert");
const fs = require("fs");
const path = require("path");

const mapCss = fs.readFileSync(path.join(__dirname, "../UI10/map/map.css"), "utf8");
const mobileAppBarCss = mapCss.slice(
  mapCss.indexOf("@media (max-width: 520px)"),
  mapCss.indexOf(".map-layout"),
);

assert.ok(mobileAppBarCss, "mobile map app-bar styles must exist");
assert.doesNotMatch(mobileAppBarCss, /\.map-app-bar\s*\{[\s\S]*?padding-(?:left|right):/,
  "mobile map app-bar must keep the shared 14px horizontal padding");
assert.doesNotMatch(mobileAppBarCss, /\.map-app-bar-actions\s*\{[\s\S]*?gap:/,
  "mobile map buttons must keep the shared 8px gap");

console.log("map app-bar uses the shared mobile alignment");
