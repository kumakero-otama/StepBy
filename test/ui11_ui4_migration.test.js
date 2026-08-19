const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const ui10 = path.join(root, "UI10");
const ui11 = path.join(root, "UI11");

assert.ok(fs.existsSync(ui11), "UI11 must exist");
assert.ok(!fs.existsSync(path.join(root, "UI4")), "UI4 must not be copied into dev or modified");

const functionalFiles = [
  "auth/auth.js",
  "auth/token_client.js",
  "language_redirect.js",
  "map/async-record-queue.js",
  "map/map.js",
  "map/osm-browser-matcher.js",
  "profile/edit.js",
  "profile/profile.js",
  "pwa.js",
  "road-info-queue.js",
  "road_info_detail/road_info_detail.js",
];

function normalizeUiName(source) {
  return source.replaceAll("UI11", "UI10").replaceAll("ui11", "ui10");
}

for (const relativePath of functionalFiles) {
  const source = fs.readFileSync(path.join(ui10, relativePath), "utf8");
  const migrated = normalizeUiName(fs.readFileSync(path.join(ui11, relativePath), "utf8"));
  if (relativePath.endsWith(".html")) {
    assert.strictEqual(
      migrated.replace(/\s*<link rel="stylesheet" href="\.\.\/ui4-theme\.css" \/>/, ""),
      source,
      `${relativePath} must retain UI10 structure and behavior`
    );
  } else {
    assert.strictEqual(migrated, source, `${relativePath} must retain UI10 behavior`);
  }
}

const config = fs.readFileSync(path.join(ui11, "config.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(ui11, "sw.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(ui11, "manifest.webmanifest"), "utf8"));
const theme = fs.readFileSync(path.join(ui11, "ui4-theme.css"), "utf8");

assert.match(config, /APP_BASE_PATH:\s*"\/StepBy\/UI11"/);
assert.match(config, /UI11 · DEV/);
assert.match(serviceWorker, /APP_BASE_PATH = "\/StepBy\/UI11"/);
assert.match(serviceWorker, /stepby-ui11/);
assert.match(serviceWorker, /ui4-theme\.css/);
assert.strictEqual(manifest.scope, "/StepBy/UI11/");
assert.strictEqual(manifest.start_url, "/StepBy/UI11/map/Index.html");
assert.match(theme, /UI10 remains the functional and structural source of truth/);
assert.match(theme, /--ui11-shell:\s*480px/);
assert.match(theme, /\.map-row\s*\{[\s\S]*?width:\s*min\(100vw, var\(--ui11-shell\)\)/, "UI11 map must fill the visible app shell");
assert.match(theme, /\.map-row\s*\{[\s\S]*?flex-shrink:\s*0/, "UI11 map must not shrink away its right edge");
assert.doesNotMatch(theme, /\.map-row\s*\{[^}]*margin-inline:\s*auto/, "UI11 theme must not shift the full-width map to the right");
assert.match(theme, /:root\[data-theme="dark"\] \.actions\s*\{[\s\S]*?background:\s*var\(--ui11-page\)\s*!important/, "UI11 road-post actions must not retain their white light-theme background in dark mode");
assert.match(theme, /:root\[data-theme="dark"\] \.profile-edit-card[\s\S]*?background-color:\s*var\(--ui11-page\)\s*!important/, "UI11 profile editor must use one continuous dark page background");

const profileEditCss = fs.readFileSync(path.join(ui11, "profile/edit.css"), "utf8");
assert.match(profileEditCss, /\.form-card:nth-child\(2\)\s*\{[\s\S]*?order:\s*-1/, "UI11 profile edit must place the avatar picker first like UI4");
assert.match(profileEditCss, /\.edit-footer\s*\{[\s\S]*?position:\s*static/, "UI11 profile edit save action must follow UI4's document layout");
for (const localeFile of ["edit.html", "edit_en.html", "edit_hi.html"]) {
  const profileEditHtml = fs.readFileSync(path.join(ui11, "profile", localeFile), "utf8");
  assert.match(profileEditHtml, /id="profile-edit-back-btn"/, `${localeFile} must use UI4's back-button header`);
  assert.match(profileEditHtml, /id="profile-icon-preview"/, `${localeFile} must retain avatar editing`);
  assert.match(profileEditHtml, /id="profile-username-input"/, `${localeFile} must retain username editing`);
  assert.match(profileEditHtml, /id="profile-pro-toggle-input"/, `${localeFile} must retain PRO mode editing`);
  assert.match(profileEditHtml, /id="profile-edit-save-btn"/, `${localeFile} must retain profile saving`);
}

const profileCss = fs.readFileSync(path.join(ui11, "profile/profile.css"), "utf8");
assert.match(profileCss, /\.profile-edit-btn\s*\{[\s\S]*?background:\s*rgba\(255, 255, 255, 0\.9\)/, "UI11 profile edit button must use UI4's light hero-button tone");
assert.match(profileCss, /\.profile-edit-btn\s*\{[\s\S]*?color:\s*#1e7a6d/, "UI11 profile edit button must use UI4's primary-dark text tone");

const settingsLayoutCss = fs.readFileSync(path.join(ui11, "setting/ui4-layout.css"), "utf8");
assert.match(settingsLayoutCss, /\.settings-card \.accordion-item \+ \.accordion-item\s*\{[\s\S]*?border-top:/, "UI11 settings sections must use UI4-style line separators");
assert.match(settingsLayoutCss, /\.settings-card \.language-option \+ \.language-option\s*\{[\s\S]*?border-top:/, "UI11 settings choices must be separated by lines");
for (const localeFile of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const settingsHtml = fs.readFileSync(path.join(ui11, "setting", localeFile), "utf8");
  assert.match(settingsHtml, /ui4-layout\.css/, `${localeFile} must load the UI4 settings layout`);
  assert.doesNotMatch(settingsHtml, /setting-trigger-description/, `${localeFile} must not place the map explanation under the accordion title`);
  assert.match(settingsHtml, /<p class="map-display-note">/, `${localeFile} must place the UI4 note below the map choices`);
}

for (const localeFile of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const roadPostHtml = fs.readFileSync(path.join(ui11, "post_road", localeFile), "utf8");
  assert.match(roadPostHtml, /new Set\(\["test", "test１", "テスト", "テスト用", "テスト用2"\]\)/, `${localeFile} must hide test-only database tags`);
  assert.match(roadPostHtml, /!isCompleteTag\(tag\).*tag\.label\.toLowerCase\(\)\.includes\(query\)/, `${localeFile} must exclude complete from the normal tag list`);
  assert.match(roadPostHtml, /id="complete-tag-button"/, `${localeFile} must expose complete as a dedicated action`);
  assert.match(roadPostHtml, /id="complete-tag-info-button"[\s\S]*?>i<\/button>/, `${localeFile} must provide completion-tag information`);
}
assert.match(settingsLayoutCss, /\.settings-card \.map-display-note\s*\{[\s\S]*?font-size:\s*0\.75rem/, "UI11 map display note must use UI4's smaller supporting text");
assert.match(settingsLayoutCss, /\.settings-card \.language-options\s*\{[\s\S]*?align-items:\s*flex-start/, "UI11 radio choices must not stretch across the settings panel");
assert.match(settingsLayoutCss, /\.settings-card \.language-option\s*\{[\s\S]*?width:\s*fit-content/, "UI11 radio choice width must follow its label");

const helpLayoutCss = fs.readFileSync(path.join(ui11, "help/ui4-layout.css"), "utf8");
assert.match(helpLayoutCss, /\.help-wrap > \.help-card\s*\{[\s\S]*?background:\s*transparent\s*!important/, "UI11 help sections must not remain inside one shared card");
assert.match(helpLayoutCss, /\.help-section > \.help-list\s*\{[\s\S]*?background:\s*var\(--ui11-raised\)\s*!important/, "UI11 help content must sit on separate UI4-style cards");
for (const localeFile of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const helpHtml = fs.readFileSync(path.join(ui11, "help", localeFile), "utf8");
  assert.match(helpHtml, /ui4-layout\.css/, `${localeFile} must load the UI4 help layout`);
}


const htmlFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.name.endsWith(".html")) htmlFiles.push(target);
  }
}
walk(ui11);
assert.ok(htmlFiles.length > 0);
for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, "utf8");
  assert.match(html, /ui4-theme\.css/, `${path.relative(root, htmlFile)} must load the UI4 visual layer`);
  assert.doesNotMatch(html, /\/StepBy\/UI10\//, `${path.relative(root, htmlFile)} must not target UI10`);
}

console.log(JSON.stringify({ result: "passed", htmlFiles: htmlFiles.length, functionalFiles: functionalFiles.length }));
