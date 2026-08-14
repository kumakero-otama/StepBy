const assert = require("assert");
const fs = require("fs");
const path = require("path");

const editSource = fs.readFileSync(path.join(__dirname, "../UI10/profile/edit.js"), "utf8");
const editCss = fs.readFileSync(path.join(__dirname, "../UI10/profile/edit.css"), "utf8");
const loadStatusMatch = editSource.match(
  /async function loadCurrentProStatus\(user\) \{([\s\S]*?)\n\}/,
);

assert.ok(loadStatusMatch, "PRO状態を読み込む処理が存在すること");
assert.doesNotMatch(
  loadStatusMatch[1],
  /proToggleInputEl\.checked\s*=\s*false/,
  "API確認前にキャッシュ済みのON表示をOFFへ戻してはいけない",
);
assert.match(
  loadStatusMatch[1],
  /proToggleInputEl\.disabled\s*=\s*true/,
  "最新状態の確認中は誤操作を防ぐこと",
);
assert.match(
  loadStatusMatch[1],
  /typeof isPro === "boolean"[\s\S]*proToggleInputEl\.checked = isPro/,
  "APIが返した確定値だけをトグルへ反映すること",
);

console.log("profile PRO toggle keeps its cached state while the API status is loading");

assert.match(
  editCss,
  /\.pro-help-modal\s*\{[\s\S]*?min-height:\s*100dvh;[\s\S]*?safe-area-inset-top[\s\S]*?overflow-y:\s*auto;/,
  "PRO説明モーダルは動的画面高とセーフエリア内でスクロールできること",
);
assert.match(
  editCss,
  /\.pro-help-panel\s*\{[\s\S]*?max-height:\s*calc\(100dvh[\s\S]*?overflow-y:\s*auto;/,
  "PRO説明パネルが画面高を超えて見切れないこと",
);
