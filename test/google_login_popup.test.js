const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(path.join(__dirname, "../UI10/auth/auth.js"), "utf8");
assert.match(source, /ux_mode:\s*"popup"/, "Google sign-in must explicitly use popup mode");
assert.match(source, /attempts\s*<\s*20[\s\S]*setTimeout\(initialize,\s*250\)/,
  "Google library initialization must retry when its async script is late");
assert.match(source, /initialized\s*=\s*true[\s\S]*buttonContainer\.replaceChildren\(\)/,
  "Google button initialization must be idempotent");
console.log("Google popup and delayed-library initialization regressions are covered");
