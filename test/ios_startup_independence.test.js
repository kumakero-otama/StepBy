const assert = require("assert"), fs = require("fs");
const source = fs.readFileSync("UI0/map/map.js", "utf8");
assert.doesNotMatch(source, /loadConfig\(\)\.then\(async/,
  "config must not gate GPS and listener registration");
assert.match(source, /void \(async \(\) => \{ try \{[\s\S]*?await loadCurrentUserId\(\)[\s\S]*?\} \}\)\(\);[\s\S]*?refreshLocationTracking\("bootstrap"\)/,
  "auth bootstrap must run independently of GPS startup");
assert.match(source, /if \(nextEnabled && !currentUserId\)/,
  "early record clicks must explain pending authentication instead of creating ownerless sessions");
const sw = fs.readFileSync("UI0/sw.js", "utf8");
assert.doesNotMatch(sw, /const fallbackPath =/,
  "offline navigation must never return another screen under a different relative path");
console.log("iOS startup no longer waits for config/auth to bind controls");
