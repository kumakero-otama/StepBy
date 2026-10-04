const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const changelog = fs.readFileSync(path.join(root, "UI0/changelog.js"), "utf8");
const version = fs.readFileSync(path.join(root, "UI0/version.js"), "utf8");
const map = fs.readFileSync(path.join(root, "UI0/map/map.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "UI0/sw.js"), "utf8");

const latest = changelog.match(/version:\s*"([^"]+)"/);
const frontend = version.match(/FRONTEND_VERSION\s*=\s*"([^"]+)"/);

assert.ok(latest && frontend, "changelog and frontend versions must be declared");
assert.strictEqual(
  latest[1],
  frontend[1],
  "latest changelog version must match FRONTEND_VERSION"
);
assert.match(
  changelog,
  /SEEN_ITEM_KEY_PREFIX/,
  "seen item ids must persist locally for offline recovery"
);
assert.match(
  changelog,
  /currentUserScope\(\)/,
  "local changelog state must be separated by authenticated user"
);
assert.match(
  changelog,
  /\/api\/changelog-views/,
  "displayed items must be synchronized to the backend"
);
assert.match(
  changelog,
  /dataset\.changelogItemId = item\.id/,
  "each displayed line must retain its stable changelog item id"
);
assert.match(
  map,
  /safetyConfirmAcceptBtn\.addEventListener[\s\S]*?StepByChangelog\.showLatest/,
  "changelog must follow safety acceptance"
);
assert.match(
  serviceWorker,
  /changelog\.js/,
  "the PWA must cache the changelog implementation"
);

console.log(
  "map changelog is versioned, tracked per user and item, and shown after safety acceptance"
);
