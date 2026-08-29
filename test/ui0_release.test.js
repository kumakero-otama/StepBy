const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const ui0 = path.join(root, "UI0");

assert.ok(fs.existsSync(ui0), "UI0 must exist");

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

const ui0MapSource = fs.readFileSync(path.join(ui0, "map/map.js"), "utf8");
assert.match(ui0MapSource, /osm_review_queued/, "UI0 must stop after creating the administrator review item");
assert.doesNotMatch(ui0MapSource, /function publishOsmRecord/, "UI0 must not immediately publish a saved record to OSM");
assert.ok(
  ui0MapSource.indexOf('traceConfirmModalEl.classList.remove("hidden")') < ui0MapSource.indexOf("await prepareTraceTagModal()"),
  "the save confirmation must appear before waiting for PRO tag network access"
);
assert.match(ui0MapSource, /tactile_tags_fetch_timeout/, "PRO tag loading must not leave confirmation setup waiting forever");
assert.match(ui0MapSource, /recordEnabled = true;[\s\S]{0,180}?確認画面を開けませんでした。記録は保持されています。/,
  "unexpected confirmation errors must preserve the recording for a retry");
const ui0MapCss = fs.readFileSync(path.join(ui0, "map/map.css"), "utf8");
assert.match(ui0MapCss, /\.record-main-btn:disabled\s*\{[\s\S]{0,80}?color:\s*#fff/,
  "the recording label must stay white while stop processing is busy");
assert.match(ui0MapSource, /function handleNewLocation[\s\S]{0,1000}?if \(!hasLiveMatchedFix\) \{[\s\S]{0,160}?updateCurrentLocationMarker\(latitude, longitude\)/,
  "live GPS must replace the previous-launch marker while the first map match is pending");
assert.match(ui0MapSource, /if \(browser\)[\s\S]{0,500}?else \{[\s\S]{0,180}?if \(!hasLiveMatchedFix\) updateDisplay\(latitude, longitude, latitude, longitude\)/,
  "a temporary map-match miss must preserve the last matched marker instead of moving it back to raw GPS");
assert.ok(ui0MapSource.indexOf("showTraceConfirmPreparing();") < ui0MapSource.indexOf("browserOsmMatcher.ensureTraceCoverage"),
  "record stop must show its confirmation progress window before refreshing OSM data");
assert.match(ui0MapSource, /const redPinIcon = L\.icon\([\s\S]{0,300}?marker-icon-2x-red\.png/,
  "the current-location marker must retain the original red pin artwork");
assert.match(ui0MapSource, /trace_coverage_timeout/,
  "OSM refresh must not leave the visible confirmation progress window waiting forever");
assert.match(ui0MapSource, /if \(!hasLiveGpsFix\)[\s\S]{0,180}?latestSnappedLocation = null/,
  "the first live GPS fix must invalidate the previous-launch snapped location");
assert.match(ui0MapSource, /if \(!hasLiveMatchedFix\)[\s\S]{0,350}?map\.setView\(\[latitude, longitude\]/,
  "live GPS must update the marker and auto-center while the first map match is pending");
assert.match(ui0MapSource, /function requestSnappedLocation[\s\S]{0,180}?if \(!hasLiveGpsFix\) return/,
  "a cached previous-launch coordinate must never be accepted as a new live map match");

for (const relativePath of functionalFiles) {
  assert.ok(fs.existsSync(path.join(ui0, relativePath)), `${relativePath} must exist in the public UI`);
}

const config = fs.readFileSync(path.join(ui0, "config.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(ui0, "sw.js"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(ui0, "manifest.webmanifest"), "utf8"));
const theme = fs.readFileSync(path.join(ui0, "ui4-theme.css"), "utf8");

assert.match(config, /APP_BASE_PATH:\s*"\/StepBy\/UI0"/);
assert.doesNotMatch(config, /UI0 · DEV|data-stepby-dev-badge|stepbyDevBadge/,
  "UI0 must not display a development badge over general-user screens");
assert.match(serviceWorker, /APP_BASE_PATH = "\/StepBy\/UI0"/);
assert.match(serviceWorker, /stepby-ui0/);
assert.match(serviceWorker, /ui4-theme\.css/);
assert.strictEqual(manifest.scope, "/StepBy/UI0/");
assert.strictEqual(manifest.start_url, "/StepBy/UI0/map/Index.html");
assert.strictEqual(manifest.name, "StepBy");
assert.strictEqual(manifest.short_name, "StepBy");
assert.match(theme, /UI0 remains the functional and structural source of truth/);
assert.match(theme, /--ui0-shell:\s*480px/);
assert.match(theme, /\.map-row\s*\{[\s\S]*?width:\s*min\(100vw, var\(--ui0-shell\)\)/, "UI0 map must fill the visible app shell");
assert.match(theme, /\.map-row\s*\{[\s\S]*?flex-shrink:\s*0/, "UI0 map must not shrink away its right edge");
assert.doesNotMatch(theme, /\.map-row\s*\{[^}]*margin-inline:\s*auto/, "UI0 theme must not shift the full-width map to the right");
assert.match(theme, /:root\[data-theme="dark"\] \.actions\s*\{[\s\S]*?background:\s*var\(--ui0-page\)\s*!important/, "UI0 road-post actions must not retain their white light-theme background in dark mode");
assert.match(theme, /:root\[data-theme="dark"\] \.profile-edit-card[\s\S]*?background-color:\s*var\(--ui0-page\)\s*!important/, "UI0 profile editor must use one continuous dark page background");

const profileEditCss = fs.readFileSync(path.join(ui0, "profile/edit.css"), "utf8");
assert.match(profileEditCss, /\.form-card:nth-child\(2\)\s*\{[\s\S]*?order:\s*-1/, "UI0 profile edit must place the avatar picker first like UI4");
assert.match(profileEditCss, /\.edit-footer\s*\{[\s\S]*?position:\s*static/, "UI0 profile edit save action must follow UI4's document layout");
for (const localeFile of ["edit.html", "edit_en.html", "edit_hi.html"]) {
  const profileEditHtml = fs.readFileSync(path.join(ui0, "profile", localeFile), "utf8");
  assert.match(profileEditHtml, /id="profile-edit-back-btn"/, `${localeFile} must use UI4's back-button header`);
  assert.match(profileEditHtml, /id="profile-icon-preview"/, `${localeFile} must retain avatar editing`);
  assert.match(profileEditHtml, /id="profile-username-input"/, `${localeFile} must retain username editing`);
  assert.match(profileEditHtml, /id="profile-pro-toggle-input"/, `${localeFile} must retain PRO mode editing`);
  assert.match(profileEditHtml, /id="profile-edit-save-btn"/, `${localeFile} must retain profile saving`);
}

const profileCss = fs.readFileSync(path.join(ui0, "profile/profile.css"), "utf8");
assert.match(profileCss, /\.profile-edit-btn\s*\{[\s\S]*?background:\s*rgba\(255, 255, 255, 0\.9\)/, "UI0 profile edit button must use UI4's light hero-button tone");
assert.match(profileCss, /\.profile-edit-btn\s*\{[\s\S]*?color:\s*#1e7a6d/, "UI0 profile edit button must use UI4's primary-dark text tone");

const settingsLayoutCss = fs.readFileSync(path.join(ui0, "setting/ui4-layout.css"), "utf8");
assert.match(settingsLayoutCss, /\.settings-card \.accordion-item \+ \.accordion-item\s*\{[\s\S]*?border-top:/, "UI0 settings sections must use UI4-style line separators");
assert.match(settingsLayoutCss, /\.settings-card \.option-separator\s*\{[\s\S]*?border-top:/, "UI0 settings choices must be separated by lines");
for (const localeFile of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const settingsHtml = fs.readFileSync(path.join(ui0, "setting", localeFile), "utf8");
  assert.match(settingsHtml, /ui4-layout\.css/, `${localeFile} must load the UI4 settings layout`);
  assert.doesNotMatch(settingsHtml, /setting-trigger-description/, `${localeFile} must not place the map explanation under the accordion title`);
  assert.match(settingsHtml, /<p class="map-display-note">/, `${localeFile} must place the UI4 note below the map choices`);
  assert.strictEqual((settingsHtml.match(/class="option-separator"/g) || []).length, 6, `${localeFile} must separate all theme, text-size, and language choices`);
}

for (const localeFile of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const roadPostHtml = fs.readFileSync(path.join(ui0, "post_road", localeFile), "utf8");
  assert.match(roadPostHtml, /new Set\(\["test", "test１", "テスト", "テスト用", "テスト用2"\]\)/, `${localeFile} must hide test-only database tags`);
  assert.match(roadPostHtml, /!isCompleteTag\(tag\).*tag\.label\.toLowerCase\(\)\.includes\(query\)/, `${localeFile} must exclude complete from the normal tag list`);
  assert.match(roadPostHtml, /id="complete-tag-button"/, `${localeFile} must expose complete as a dedicated action`);
  assert.match(roadPostHtml, /id="tag-list"[\s\S]*?class="complete-tag-controls"[\s\S]*?<\/section>/, `${localeFile} must keep the completion tag inside the tag card`);
  assert.match(roadPostHtml, /id="complete-tag-info-button"[\s\S]*?help_66gray\.png[\s\S]*?<\/button>/, `${localeFile} must use the profile PRO help icon`);
}
assert.match(settingsLayoutCss, /\.settings-card \.map-display-note\s*\{[\s\S]*?font-size:\s*0\.75rem/, "UI0 map display note must use UI4's smaller supporting text");
assert.match(settingsLayoutCss, /\.settings-card \.language-options\s*\{[\s\S]*?align-items:\s*flex-start/, "UI0 radio choices must not stretch across the settings panel");
assert.match(settingsLayoutCss, /\.settings-card \.language-option\s*\{[\s\S]*?width:\s*fit-content/, "UI0 radio choice width must follow its label");
assert.match(settingsLayoutCss, /\.settings-card \.option-separator\s*\{[\s\S]*?width:\s*calc\(100% - 8px\)/, "UI0 option separators must be slightly shorter than their panel");

const helpLayoutCss = fs.readFileSync(path.join(ui0, "help/ui4-layout.css"), "utf8");
assert.match(helpLayoutCss, /\.help-wrap > \.help-card\s*\{[\s\S]*?background:\s*transparent\s*!important/, "UI0 help sections must not remain inside one shared card");
assert.match(helpLayoutCss, /\.help-wrap > \.help-card\s*\{[\s\S]*?margin-top:\s*24px\s*!important/, "UI0 help FAQ must have breathing room below the hero");
assert.match(helpLayoutCss, /\.help-section > \.help-list\s*\{[\s\S]*?background:\s*var\(--ui0-raised\)\s*!important/, "UI0 help content must sit on separate UI4-style cards");
for (const localeFile of ["Index.html", "Index_en.html", "Index_hi.html"]) {
  const helpHtml = fs.readFileSync(path.join(ui0, "help", localeFile), "utf8");
  assert.match(helpHtml, /ui4-layout\.css/, `${localeFile} must load the UI4 help layout`);
  assert.strictEqual((helpHtml.match(/class="help-heading-icon"/g) || []).length, 3, `${localeFile} must show an icon beside each help subheading`);
}
assert.match(helpLayoutCss, /\.help-heading-icon\s*\{[\s\S]*?background:\s*var\(--ui0-primary-bg\)/, "UI0 help heading icons must use the UI4-style icon tile");


const htmlFiles = [];
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(target);
    else if (entry.name.endsWith(".html")) htmlFiles.push(target);
  }
}
walk(ui0);
assert.ok(htmlFiles.length > 0);
for (const htmlFile of htmlFiles) {
  const html = fs.readFileSync(htmlFile, "utf8");
  assert.match(html, /ui4-theme\.css/, `${path.relative(root, htmlFile)} must load the UI4 visual layer`);
  assert.doesNotMatch(html, /\/StepBy\/UI(?:1|2|3|4|10|11)\//, `${path.relative(root, htmlFile)} must not target an obsolete UI`);
}

console.log(JSON.stringify({ result: "passed", htmlFiles: htmlFiles.length, functionalFiles: functionalFiles.length }));
