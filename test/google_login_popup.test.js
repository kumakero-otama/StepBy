const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "../UI10/auth/auth.js"), "utf8");
const swSource = fs.readFileSync(path.join(__dirname, "../UI10/sw.js"), "utf8");
assert.match(source, /ux_mode:\s*"popup"/, "Google sign-in must explicitly use popup mode");
assert.match(source, /attempts\s*<\s*20[\s\S]*setTimeout\(initialize,\s*250\)/,
  "Google library initialization must retry when its async script is late");
assert.match(source, /initialized\s*=\s*true[\s\S]*buttonContainer\.replaceChildren\(\)/,
  "Google button initialization must be idempotent");
assert.doesNotMatch(swSource, /CACHE_NAME[^\n]*Date\.now/,
  "service worker must not lose its navigation cache after a process restart");
assert.match(swSource, /request\.mode === "navigate"[\s\S]*ignoreSearch:\s*true[\s\S]*new Response/,
  "navigation must always return a cached page or a visible recovery response");
console.log("Google popup and delayed-library initialization regressions are covered");
