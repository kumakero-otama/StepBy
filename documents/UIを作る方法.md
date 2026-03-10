# 新しいUIを作る方法（UI1 用）

このドキュメントは、`UI0` を元にして `UI1` を作るチーム向け（主にMariaさん向け）ガイドです。
（otamaが基本はAIに作らせた後、ところどころ直して作ったmdなので変なところがあるかもです）

---

## 1. 前提（このプロジェクトの考え方）

- `UI0/`: 現在の基準UI（動いているもの）
- `UI1/`: 新デザイン案（今回の作業対象・現在Netlifyで公開しているもの）

大事な方針:

- `UI0` は壊さない
- 新しい案は `UI1` で分離して作る
- もしさらに新しいUIを作りたいときは、UI2/やUI3/なども同じように作っていく

---

## 2. 作業の全体フロー

1. `UI1` の中身を持ってくる
2. `UI1/config.js` の `APP_BASE_PATH` を `"/StepBy/UI1"` にする  
3. `UI1/map/Index.html` が開くことを確認  
4. デザイン変更を実装  
5. ルート `index.html` に `UI1` へのリンクを追加  

---

## 3. 最初の作成手順（コピーベース）

今は `UI1/` が空フォルダとして作成済みなので、`UI0` の中身を `UI1` へコピーします。

```bash
cp -r UI0/. UI1/
```

作成後には`UI1/config.js`を以下のように修正してください

```js
// UI1/config.js
APP_BASE_PATH: "/StepBy/UI1"
```


---

## 4. 入口ページの更新

`/home/otama/StepBy/index.html` にリンクを追加します（UI1のみ）

```html
<p><a href="./UI0/map/Index.html">UI0へ移動</a></p>
<p><a href="./UI1/map/Index.html">UI1へ移動</a></p>
```

---

## リンクまとめ
・otamaが主に更新するバリアフリー地図アプリのサイト：`https://barrierfree-map.loophole.site`
・このリポジトリ（StepBy）のGitHub：`https://github.com/kumakero-otama/StepBy`
・このリポジトリ（StepBy）をGitHub Pagesで公開したもの：`https://kumakero-otama.github.io/StepBy/`