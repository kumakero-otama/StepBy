const assert = require("assert");
const fs = require("fs");
const path = require("path");

const mapSource = fs.readFileSync(path.join(__dirname, "../UI10/map/map.js"), "utf8");
for (const name of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const html = fs.readFileSync(path.join(__dirname, "../UI10/map", name), "utf8");
  assert.match(html, /class="pro-badge map-pro-badge"/);
}
assert.match(mapSource, /stepByBaseColor\s*=\s*recordColor/);
assert.match(mapSource, /activeTactileSessionPolyline\.options\.stepByBaseColor/);
console.log("PRO badge class and selected-line base color are preserved");
