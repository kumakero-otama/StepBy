# UI10 API利用一覧

最終確認日: 2026-08-18

これはUI10から見たAPIの分類です。API実装・項目・安全条件の正本はバックエンド`barrierfree-map`の`dev`ブランチです。UI10内の`docs/openapi.yaml`は閲覧用の同梱資料で、バックエンド変更後に同期確認が必要です。

## 認証・利用者

- `POST /auth/google`、`POST /auth/google/signup`: Google認証と初回登録
- `POST /auth/guest`: 端末ごとに区別されるゲスト利用
- `GET /auth/me`、`POST /auth/logout`、`POST /auth/profile`: 利用者状態
- `GET /auth/osm/status`: StepBy専用OSMアカウント方式の状態
- `GET/PUT /api/pro-status`: 通常/PROモード

## 地図・記録

- `GET /api/osm-walkable-network`: 約1kmの道路・歩道ネットワーク
- `GET /api/osm-tactile-ways`: 約10kmの既存点字ブロック表示
- `POST /api/session/start`、`POST /api/trace`、`POST /api/session/end`: GPS生座標と確定経路の保存
- `GET /api/records`、`GET /api/tactile-session-info`: StepBy記録の表示
- `POST /api/session/memo`、`POST /api/session/deactivate`: 本人メモと論理削除
- `GET/POST /api/tactile-tags`、`GET/POST /api/session-tags`: PROタグ

通常のフィッティングはブラウザ内の`osm-browser-matcher.js`が行います。`/api/match`やValhalla系処理は通常記録の確定には使用しません。

## OSM変更

- `POST /api/osm/split-plan`: 最新Way/Versionから変更案を作成
- `POST /api/osm/records/{recordId}/publish`: 本人の保存操作に対応する1件を公開
- `POST /api/osm/records/{recordId}/revert-plan`: 現在状態から取消し案を作成
- `POST /api/osm/records/{recordId}/revert`: 本人の削除確定に対応する反対変更

送信・取消しは、機能フラグ、所有者、追記型監査、冪等性、OAuth権限、OSM Version競合の安全条件をすべて満たした場合だけ実行されます。

## 道情報・運用

- `GET/POST /api/post-tags`、`GET/POST /api/road-info`: 道情報
- `GET /api/config`: クライアント設定
- `POST /api/client-logs`、`GET /api/client-logs/health`: 通信ログ
- `/api/admin/*`: 管理者専用DB・監査・実験確認
- `/api/fitting-comparisons`、`/api/fitting-details/*`: 開発診断

道情報、写真、説明文、本人限定タグ・メモはOSMへ送信しません。一般画面から管理者APIを呼ばず、管理者キーをGitHub Pagesへ埋め込みません。
