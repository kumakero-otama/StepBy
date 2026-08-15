const assert = require("assert");
const fs = require("fs");
const path = require("path");

for (const locale of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const source = fs.readFileSync(path.join(__dirname, "..", "UI10", "post_road", locale), "utf8");
  assert.match(source, /authFetch\("\/api\/post-tags"\)/, `${locale}: tags must load from the DB API`);
  assert.doesNotMatch(source, /fallbackTags/, `${locale}: fixed fallback tags must not replace DB tags`);
}

const mapSource = fs.readFileSync(path.join(__dirname, "..", "UI10", "map", "map.js"), "utf8");
assert.match(mapSource, /authFetch\("\/api\/tactile-tags\?activeOnly=1"/, "PRO tags must load from the DB API");
assert.match(mapSource, /traceTagOptions = \[\]/, "PRO tag load failure must not silently show fixed tags");

console.log("UI10 road and PRO tags use their development database APIs");
