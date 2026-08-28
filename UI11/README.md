# StepBy UI11

UI11は、StepByの提出・公開候補となるPWAフロントエンドです。HTML、CSS、JavaScriptだけで動作し、GitHub Pagesから配信します。UI4のデザインを取り入れていますが、認証・記録・地図・通信処理はUI11内で完結しています。

## 主な機能

- Googleアカウントまたはゲストでの利用
- GPSによる点字ブロック記録
- ブラウザ内JavaScriptによるOSM道路・歩道へのマップマッチング
- 通信断時のIndexedDB一時保存と自動再送
- 道情報、PROタグ、本人限定メモの表示・投稿
- 日本語・英語表示、文字サイズ、ライト・ダークテーマ
- 管理者向けOSM公開確認画面

一般利用者の記録は、ブラウザで経路を確定してからバックエンドへ送ります。OSMへの公開可否や監査履歴はバックエンドが管理するため、ブラウザへ秘密情報は置きません。

## ディレクトリ

- `auth/`: ログイン、初回登録、利用規約同意
- `map/`: 地図表示、GPS記録、ブラウザフィッティング
- `post_road/`: 道情報の投稿
- `profile/`: プロフィール表示・編集
- `settings/`: 表示と言語の設定
- `admin/`: 管理者用OSM公開確認画面
- `assets/js/`: 認証、API設定、送信待ちキューなどの共通処理
- `assets/icons/`, `assets/images/`, `assets/videos/`: UI素材
- `config.js`: API URLやUI11の基準パス
- `manifest.webmanifest`, `sw.js`: PWA設定とキャッシュ制御

## ローカルで確認する

`file://`ではService Workerや一部APIが動かないため、リポジトリのルートでHTTPサーバーを起動します。

```bash
python3 -m http.server 8080
```

ブラウザで `http://localhost:8080/UI11/map/Index.html` を開きます。実際の認証や記録保存には、`config.js`が指すバックエンドと、そのURLを許可したGoogle OAuth設定が必要です。

## テスト

外部サービスへ書き込まない静的・単体テストです。リポジトリのルートで実行します。

```bash
for file in test/*.test.js; do node "$file" || exit 1; done
```

テストは、HTMLから参照するファイルの存在、UI11専用パス、認証導線、記録キュー、マップマッチング、安全条件、多言語表示などを確認します。OSMへの実送信は行いません。

## 実装上の方針

- UI0、UI4、UI10とはキャッシュ名とPWA scopeを分離する。
- Google・OSM・管理者キーなどの秘密情報をフロントエンドへ埋め込まない。
- OSMへ送らないPRO情報と本人限定メモは、画面表示時にも所有者を確認する。
- APIエラー時は記録を失わず、同じ送信を重複実行しない。
