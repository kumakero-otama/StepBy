# StepBy UI10フロントエンド再現手順

最終確認日: 2026-08-18

この文書は、`StepBy`の`dev`ブランチにあるUI10をローカルで表示し、OSMへ書き込まない自動試験を実行するための手順です。

## 1. 必要環境

- Git
- Node.js 18以上（静的配信スクリプトと自動テストに使用）
- JavaScriptが有効な現行ブラウザ
- 位置情報を試す場合はHTTPSまたは`localhost`

UI10はビルド工程やnpm依存を持たないVanilla HTML/CSS/JavaScriptです。地図表示にはHTMLから読み込むLeafletを使用します。

## 2. 取得と起動

```bash
git clone --branch dev https://github.com/kumakero-otama/StepBy.git
cd StepBy
node dev-server.js
```

ブラウザで`http://127.0.0.1:3200/StepBy/UI10/map/Index.html`を開きます。`dev-server.js`はGitHub Pagesのパス構造を再現する単純な静的サーバーで、API機能は提供しません。

## 3. API接続先

`UI10/config.js`の`APP_BASE_PATH`、`API_BASE_URL`、`ENVIRONMENT`で指定します。APIを別環境で再現する場合は、バックエンド`barrierfree-map`の`REPRODUCTION.md`に従い、OSM書込みを無効にして起動してからURLを変更します。ブラウザのOriginをバックエンドのCORS許可一覧にも追加します。

## 4. 自動テスト

```bash
node --test test/*.test.js
```

テストはソース、DOM構造、キュー、ブラウザマッチャーをローカルで検証し、本番OSMへ送信しません。主な対象は、通常処理のValhalla非依存、ログイン復帰、PWA表示領域、1km/650m/10kmの範囲分離、GPS精度と連続Way、保存・取消しキュー、PRO/ゲスト権限、本人限定情報、文字サイズ、ダークモード、地図上の当たり判定です。

## 5. PWAとキャッシュ

UI10は`manifest.webmanifest`、`sw.js`、`pwa.js`で独立PWAとして動作し、Service Workerのscopeは`/StepBy/UI10/`です。古い画面が残る場合はキャッシュバージョン、Service Worker、Cache Storageを確認します。UI0のキャッシュを削除・上書きしません。

## 6. UI10をUI0へ正式昇格するとき

1. UI10を基準にUI0へファイルを反映する。
2. `APP_BASE_PATH`を`/StepBy/UI0`へ変更する。
3. manifestの`start_url`と`scope`をUI0へ変更する。
4. Service Workerのパスとキャッシュ名をUI0用に変更する。
5. 開発バッジを削除または正式版表示へ変更する。
6. 正式API URL、CORS、Google OAuthの許可Originを確認する。
7. UI0の既存Service Workerから安全に更新できることを確認する。
8. 全自動テストとスマートフォン/PWAでの手動確認を行う。
9. 比較・復旧用に提出時点のUI10のtagまたはcommit IDを残す。

正式昇格は別作業として行い、開発中のUI10変更を直接UI0へ混在させません。

## 7. リポジトリに含めないもの

Google OAuthクライアントシークレット、StepByのBearerトークン、OSM OAuthトークン、管理者キー、本番ユーザーの個人情報・位置記録は保存しません。フロントで必要なGoogle OAuthクライアントIDは公開識別子で、秘密情報はバックエンドのSecret Managerで管理します。
