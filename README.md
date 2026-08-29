# StepBy フロントエンド

StepByの公開PWAフロントエンドです。GitHub Pagesで配信し、画面表示、GPS記録、ブラウザ内マップマッチング、記録の一時保存と再送をHTML・CSS・JavaScriptで実装しています。

## 公開画面

- 入口: `UI0/map/Index.html`
- PWA scope: `/StepBy/UI0/`
- API URL: `UI0/config.js`
- 地図表示: Leaflet
- マップマッチング: ブラウザ内JavaScript（Valhallaは使用しません）

旧UIは2026-08-29の正式版切替で削除しました。切替前の状態はGitタグ`pre-ui11-to-ui0-20260829`から確認・復元できます。

## 主な構成

- `UI0/auth/`: Google認証と利用開始画面
- `UI0/map/`: 地図、GPS記録、ブラウザフィッティング、バックグラウンド送信
- `UI0/profile/`: プロフィール表示・編集
- `UI0/post_road/`: 道情報の投稿
- `UI0/road_info_detail/`: 記録詳細
- `UI0/setting/`: 表示と言語の設定
- `UI0/admin/`: 管理者向け確認画面
- `UI0/sw.js`: PWAキャッシュとバックグラウンド通信
- `test/`: 主要仕様の退行テスト

## ローカル確認

```bash
python3 -m http.server 8080
```

ブラウザで`http://localhost:8080/UI0/map/Index.html`を開きます。認証や保存には、`UI0/config.js`が指すバックエンドと、公開元URLを許可したGoogle OAuth設定が必要です。

## テスト

```bash
for test_file in test/*.test.js; do node "$test_file"; done
```

テストではHTML参照、認証導線、GPS表示、記録キュー、マップマッチング、安全条件、PROモード、外観、多言語表示などを確認します。OSMへの実送信は行いません。
