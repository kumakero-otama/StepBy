const assert = require("assert");
const fs = require("fs");
const path = require("path");

const mapCss = fs.readFileSync(path.join(__dirname, "../UI0/map/map.css"), "utf8");
const appBarCss = fs.readFileSync(path.join(__dirname, "../UI0/appbar.css"), "utf8");
const mobileAppBarCss = mapCss.slice(
  mapCss.indexOf("@media (max-width: 520px)"),
  mapCss.indexOf(".map-layout"),
);

assert.ok(mobileAppBarCss, "mobile map app-bar styles must exist");
assert.doesNotMatch(mobileAppBarCss, /\.map-app-bar\s*\{[\s\S]*?padding-(?:left|right):/,
  "mobile map app-bar must keep the shared 14px horizontal padding");
assert.doesNotMatch(mobileAppBarCss, /\.map-app-bar-actions\s*\{[\s\S]*?gap:/,
  "mobile map buttons must keep the shared 8px gap");
assert.match(mapCss, /\.map-app-bar\s*\{[\s\S]*?overflow:\s*hidden;[\s\S]*?box-shadow:\s*0 10px 28px rgba\(30, 122, 109, 0\.26\)/,
  "map app-bar must use the same visible bounds and shadow as other screens");
assert.match(mapCss, /\.map-app-bar-action\s*\{[\s\S]*?background:\s*rgba\(255, 255, 255, 0\.16\)[\s\S]*?border:\s*1px solid rgba\(255, 255, 255, 0\.22\)/,
  "map app-bar buttons must use the shared button appearance");
assert.match(mapCss, /\.map-app-bar-wave\s*\{\s*display:\s*none;/,
  "the map-only wave must not make the app-bar appear taller than other screens");
assert.match(appBarCss, /\.app-bar-icon-link\s*\{[\s\S]*?box-sizing:\s*content-box;/,
  "app-bar buttons must keep the same outer 38px size even on pages with global border-box sizing");

console.log("map app-bar uses the shared mobile alignment");
