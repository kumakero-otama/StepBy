const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const ui10 = path.join(root, "UI10");
const ui11 = path.join(root, "UI11");

assert.ok(fs.existsSync(ui11), "UI11 must exist");

const functionalFiles = [
  "auth/auth.js",
  "auth/token_client.js",
  "language_redirect.js",
  "map/async-record-queue.js",
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

const ui11MapSource = fs.readFileSync(path.join(ui11, "map/map.js"), "utf8");
assert.match(ui11MapSource, /osm_review_queued/, "UI11 must stop after creating the administrator review item");
assert.doesNotMatch(ui11MapSource, /function publishOsmRecord/, "UI11 must not immediately publish a saved record to OSM");
assert.ok(
  ui11MapSource.indexOf('traceConfirmModalEl.classList.remove("hidden")') < ui11MapSource.indexOf("await prepareTraceTagModal()"),
  "the save confirmation must appear before waiting for PRO tag network access"
);
assert.match(ui11MapSource, /tactile_tags_fetch_timeout/, "PRO tag loading must not leave confirmation setup waiting forever");
assert.match(ui11MapSource, /recordEnabled = true;[\s\S]{0,180}?確認画面を開けませんでした。記録は保持されています。/,
  "unexpected confirmation errors must preserve the recording for a retry");
const ui11MapCss = fs.readFileSync(path.join(ui11, "map/map.css"), "utf8");
assert.match(ui11MapCss, /\.record-main-btn:disabled\s*\{[\s\S]{0,80}?color:\s*#fff/,
  "the recording label must stay white while stop processing is busy");
assert.match(ui11MapSource, /function handleNewLocation[\s\S]{0,600}?if \(!marker\) \{[\s\S]{0,100}?updateCurrentLocationMarker\(latitude, longitude\)/,
  "the first GPS fix must show the current-location pin without waiting for map matching");
assert.match(ui11MapSource, /if \(browser\)[\s\S]{0,350}?updateDisplay\(latitude, longitude, latitude, longitude, true\)/,
  "a temporary map-match miss must preserve the last matched marker instead of moving it back to raw GPS");
assert.ok(ui11MapSource.indexOf("showTraceConfirmPreparing();") < ui11MapSource.indexOf("browserOsmMatcher.ensureTraceCoverage"),
  "record stop must show its confirmation progress window before refreshing OSM data");
assert.match(ui11MapSource, /const redPinIcon = L\.icon\([\s\S]{0,300}?marker-icon-2x-red\.png/,
  "the current-location marker must retain the original red pin artwork");
assert.match(ui11MapSource, /trace_coverage_timeout/,
  "OSM refresh must not leave the visible confirmation progress window waiting forever");

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
assert.match(settingsLayoutCss, /\.settings-card \.option-separator\s*\{[\s\S]*?border-top:/, "UI11 settings choices must be separated by lines");
for (const localeFile of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const settingsHtml = fs.readFileSync(path.join(ui11, "setting", localeFile), "utf8");
  assert.match(settingsHtml, /ui4-layout\.css/, `${localeFile} must load the UI4 settings layout`);
  assert.doesNotMatch(settingsHtml, /setting-trigger-description/, `${localeFile} must not place the map explanation under the accordion title`);
  assert.match(settingsHtml, /<p class="map-display-note">/, `${localeFile} must place the UI4 note below the map choices`);
  assert.strictEqual((settingsHtml.match(/class="option-separator"/g) || []).length, 6, `${localeFile} must separate all theme, text-size, and language choices`);
}

for (const localeFile of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const roadPostHtml = fs.readFileSync(path.join(ui11, "post_road", localeFile), "utf8");
  assert.match(roadPostHtml, /new Set\(\["test", "test１", "テスト", "テスト用", "テスト用2"\]\)/, `${localeFile} must hide test-only database tags`);
  assert.match(roadPostHtml, /!isCompleteTag\(tag\).*tag\.label\.toLowerCase\(\)\.includes\(query\)/, `${localeFile} must exclude complete from the normal tag list`);
  assert.match(roadPostHtml, /id="complete-tag-button"/, `${localeFile} must expose complete as a dedicated action`);
  assert.match(roadPostHtml, /id="tag-list"[\s\S]*?class="complete-tag-controls"[\s\S]*?<\/section>/, `${localeFile} must keep the completion tag inside the tag card`);
  assert.match(roadPostHtml, /id="complete-tag-info-button"[\s\S]*?help_66gray\.png[\s\S]*?<\/button>/, `${localeFile} must use the profile PRO help icon`);
}
assert.match(settingsLayoutCss, /\.settings-card \.map-display-note\s*\{[\s\S]*?font-size:\s*0\.75rem/, "UI11 map display note must use UI4's smaller supporting text");
assert.match(settingsLayoutCss, /\.settings-card \.language-options\s*\{[\s\S]*?align-items:\s*flex-start/, "UI11 radio choices must not stretch across the settings panel");
assert.match(settingsLayoutCss, /\.settings-card \.language-option\s*\{[\s\S]*?width:\s*fit-content/, "UI11 radio choice width must follow its label");
assert.match(settingsLayoutCss, /\.settings-card \.option-separator\s*\{[\s\S]*?width:\s*calc\(100% - 8px\)/, "UI11 option separators must be slightly shorter than their panel");

const helpLayoutCss = fs.readFileSync(path.join(ui11, "help/ui4-layout.css"), "utf8");
assert.match(helpLayoutCss, /\.help-wrap > \.help-card\s*\{[\s\S]*?background:\s*transparent\s*!important/, "UI11 help sections must not remain inside one shared card");
assert.match(helpLayoutCss, /\.help-wrap > \.help-card\s*\{[\s\S]*?margin-top:\s*24px\s*!important/, "UI11 help FAQ must have breathing room below the hero");
assert.match(helpLayoutCss, /\.help-section > \.help-list\s*\{[\s\S]*?background:\s*var\(--ui11-raised\)\s*!important/, "UI11 help content must sit on separate UI4-style cards");
for (const localeFile of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const helpHtml = fs.readFileSync(path.join(ui11, "help", localeFile), "utf8");
  assert.match(helpHtml, /ui4-layout\.css/, `${localeFile} must load the UI4 help layout`);
  assert.strictEqual((helpHtml.match(/class="help-heading-icon"/g) || []).length, 3, `${localeFile} must show an icon beside each help subheading`);
}
assert.match(helpLayoutCss, /\.help-heading-icon\s*\{[\s\S]*?background:\s*var\(--ui11-primary-bg\)/, "UI11 help heading icons must use the UI4-style icon tile");


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
