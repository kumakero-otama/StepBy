# StepByフロントエンド

最終確認日: 2026-08-18

StepByのブラウザ/PWAフロントエンドです。現在の提出候補・機能基準は`UI10/`です。`UI0/`は現行公開版、`UI1/`〜`UI3/`は過去または別デザインの検証用であり、UI10の仕様確認には使用しません。

提出までにUI10の確認済み実装をUI0へ移植し、正式URLへ切り替える予定です。現時点ではUI10とUI0を混ぜず、UI10を独立した開発版として維持します。

## UI11デザイン統合版

`UI11/`は、UI10を機能・画面構成の基準として複製し、チームメンバーが`main`へ追加したUI4のデザインを移植した候補です。UI4とUI10は変更せず、UI4の不完全な認証・API・画面構成は取り込んでいません。UI4由来の見た目は`UI11/ui4-theme.css`へ分離しています。

- 入口: `UI11/map/Index.html`
- PWA scope: `/StepBy/UI11/`
- API・認証・記録・OSM処理: UI10と同じ
- デザイン: UI4の配色、最大480pxのモバイルシェル、ヘッダー、カード、フォーム、ボタン
- 検証: `test/ui11_ui4_migration.test.js`でUI10の機能コード維持とUI11専用パスを確認

## 現在のUI10

- 公開: GitHub Pages `https://kumakero-otama.github.io/StepBy/UI10/`
- 入口: `UI10/map/Index.html`
- 実装: Vanilla HTML/CSS/JavaScript、Leaflet、Service Worker、Web App Manifest
- API: Google Compute Engine上のNode.js API
- 認証: Google認証またはゲスト認証後、StepByのBearerトークンを使用
- OSM編集者: 一般利用者の個人OSMアカウントではなく、バックエンドのStepBy専用OSMアカウント
- 通常のフィッティング: ブラウザ内JavaScriptで、現在地を中心とする約1kmのOSM道路・歩道ネットワークを使用
- 地図ネットワーク更新: 取得中心から約650m移動したときと、OSM送信・取消し後
- 点字ブロック表示: 約10km範囲を表示用として取得し、フィッティング用ネットワークとは分離
- 保存処理: IndexedDBの永続キューでバックグラウンド送信・再試行・冪等化

点字ブロック公開対象タグだけをOSMへ送信します。柵・塀・グレーチング・その他・ひとことメモなどの本人限定情報はOSMへ送らず、バックエンドのPostgreSQLに保存します。他人には公開対象タグ・記録者・日時を表示できますが、本人限定タグとひとことメモは記録者本人だけに返します。

## 主要ファイル

- `UI10/config.js`: UIのベースパス、API URL、環境識別
- `UI10/auth/`: Google/ゲスト認証、利用規約同意、トークン管理
- `UI10/map/`: Leaflet地図、GPS記録、ブラウザフィッティング、保存・取消しキュー
- `UI10/profile/`: プロフィールとPROモード
- `UI10/post_road/`: 道情報投稿
- `UI10/road_info_detail/`: 道情報詳細
- `UI10/setting/`: 表示・言語・アクセシビリティ設定
- `UI10/sw.js`: UI10専用Service Worker
- `UI10/docs/openapi.yaml`: フロント同梱のAPI資料。実装の最終正本はバックエンド`barrierfree-map`の`dev`ブランチ

## 再現・確認

第三者向けのローカル起動、必要環境、テスト、UI10からUI0へ昇格するときの確認事項は[`FRONTEND_REPRODUCTION.md`](FRONTEND_REPRODUCTION.md)を参照してください。文書の現行・履歴区分は[`documents/README.md`](documents/README.md)にまとめています。

## 安全上の注意

- UI10の通常の保存・本人による取消しは、本番APIの安全条件がすべて成立した場合にOSM送信へ進みます。
- 自動テストでは本番OSMへ接続しません。
- UI10の`config.js`、PWA scope、キャッシュ名をUI0と共有しないでください。
- OAuthシークレット、アクセストークン、管理者キーをこのリポジトリへ保存しないでください。Google OAuthのWebクライアントIDは公開識別子ですが、クライアントシークレットはフロントへ置きません。
