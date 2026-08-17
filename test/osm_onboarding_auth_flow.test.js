const assert = require("assert");
const fs = require("fs");
const path = require("path");

const authSource = fs.readFileSync(path.join(__dirname, "../UI10/auth/auth.js"), "utf8");
const profileSource = fs.readFileSync(path.join(__dirname, "../UI10/profile/profile.js"), "utf8");
const profileHtmlFiles = ["Index.html", "Index_en.html", "Index_hi.html"].map((name) => (
  fs.readFileSync(path.join(__dirname, "../UI10/profile", name), "utf8")
));

assert.match(authSource, /async function continueAfterGoogleAuth\(/,
  "Google認証後のOSMオンボーディング処理が存在すること");
assert.match(authSource, /authFetch\("\/auth\/osm\/status"/,
  "OSM連携済みかを先に確認すること");
assert.match(authSource, /authFetch\([\s\S]*?`\/auth\/osm\/start\?mode=/,
  "未連携時だけOSM認証を開始できること");
assert.match(authSource, /continueAfterGoogleAuth\(payload\.user \|\| null, osmPopup, "google_login_success"\)/,
  "既存ユーザーのGoogleログイン直後にもOSM連携を確認すること");
assert.match(authSource, /continueAfterGoogleAuth\(savedPayload\.user \|\| user \|\| null, osmPopup, "signup_profile_saved"\)/,
  "新規ユーザーのプロフィール登録直後にもOSM連携を確認すること");
assert.doesNotMatch(authSource, /openstreetmap\.org\/logout|\/auth\/osm\/logout/,
  "OSMでログイン中のアカウントを勝手にログアウトさせないこと");

for (const profileHtml of profileHtmlFiles) {
  assert.doesNotMatch(profileHtml, /id="osm-connect-btn"/,
    "プロフィールに手動のOSM連携開始ボタンを表示しないこと");
  assert.match(profileHtml, /id="osm-disconnect-btn"/,
    "連携済みアカウントの解除操作は残すこと");
}
assert.doesNotMatch(profileSource, /startOsmConnection|osmConnectBtnEl/,
  "プロフィールから手動でOSM連携を開始しないこと");
assert.match(profileSource, /次回のGoogleログイン時に登録・連携を開始します/,
  "未連携ユーザーへ次回ログイン時の自動再試行を案内すること");

console.log("OSM onboarding starts after Google auth without forcing an OSM logout");
