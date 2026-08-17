const assert = require("assert");
const fs = require("fs");
const path = require("path");

const authSource = fs.readFileSync(path.join(__dirname, "../UI10/auth/auth.js"), "utf8");
const profileSource = fs.readFileSync(path.join(__dirname, "../UI10/profile/profile.js"), "utf8");
const mapSource = fs.readFileSync(path.join(__dirname, "../UI10/map/map.js"), "utf8");
const loginHtmlFiles = ["login.html", "login_en.html", "login_hi.html"].map((name) => (
  fs.readFileSync(path.join(__dirname, "../UI10/auth", name), "utf8")
));
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
assert.match(authSource, /const connected = await waitForRequiredOsmConnection\(popup\)/,
  "OSM連携完了を確認するまで地図へ進まないこと");
assert.match(authSource, /if \(!connected\) throw new Error\("osm_connection_not_completed"\)/,
  "OSM画面を閉じた場合は未完了として停止すること");
assert.doesNotMatch(authSource, /osm_deferred/,
  "OSM連携失敗後に地図へ迂回させないこと");
assert.doesNotMatch(authSource, /openstreetmap\.org\/logout|\/auth\/osm\/logout/,
  "OSMでログイン中のアカウントを勝手にログアウトさせないこと");
assert.doesNotMatch(authSource, /if \(user && Boolean\(user\.isGuest/,
  "ゲストをOSM必須認証から迂回させないこと");
for (const loginHtml of loginHtmlFiles) {
  assert.doesNotMatch(loginHtml, /id="guest-login-button"/,
    "GoogleとOSMの両認証を必須にするためゲスト開始ボタンを表示しないこと");
}
assert.match(mapSource, /await requireOsmConnectionBeforeMapUse\(\)/,
  "地図の直接URLでもOSM連携状態を確認すること");
assert.match(mapSource, /login\.html\?osm_required=1/,
  "未連携の直接アクセスを認証画面へ戻すこと");

for (const profileHtml of profileHtmlFiles) {
  assert.doesNotMatch(profileHtml, /id="osm-connect-btn"/,
    "プロフィールに手動のOSM連携開始ボタンを表示しないこと");
  assert.match(profileHtml, /id="osm-disconnect-btn"/,
    "連携済みアカウントの解除操作は残すこと");
}
assert.doesNotMatch(profileSource, /startOsmConnection|osmConnectBtnEl/,
  "プロフィールから手動でOSM連携を開始しないこと");
assert.match(profileSource, /登録・連携を完了するまで地図へ進めません/,
  "未連携ユーザーへOSM連携が必須であることを案内すること");

console.log("OSM onboarding starts after Google auth without forcing an OSM logout");
