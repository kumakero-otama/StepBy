# StepBy UI11

UI11は、UI10の機能と画面構成を維持しながら、UI4のデザインを統合した開発候補です。

## 優先順位

1. UI10の認証、記録、OSM連携、権限、安全条件
2. UI10のボタン、表示、画面構成
3. UI4の配色、タイポグラフィ、余白、角丸、カード、フォーム、モバイルシェル

UI4の画面やJavaScriptはコピーしていません。デザイン移植は`ui4-theme.css`へ集約し、UI10由来のページと機能コードを直接置き換えない構成です。

## UI11専用設定

- `config.js`: `/StepBy/UI11`
- `manifest.webmanifest`: start URLとscopeをUI11へ分離
- `sw.js`: UI11専用キャッシュと`ui4-theme.css`の事前キャッシュ
- 開発バッジ: `UI11 · DEV`

確認はルートで次を実行します。

```bash
node --test test/*.test.js
```

`test/ui11_ui4_migration.test.js`は、重要な機能コードがUI10から欠落していないこと、全HTMLがUI4デザイン層を読み込むこと、UI10のパスやキャッシュへ干渉しないことを確認します。
