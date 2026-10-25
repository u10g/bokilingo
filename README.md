# ボキリンゴ

Duolingo風の日商簿記3級 学習アプリ（個人用）。出題区分表は2022年度適用版（2026年度試験）に準拠。

- 公開URL: https://u10g.github.io/bokilingo/ （mainへのpushで自動デプロイ）
- 設計資料: [docs/design/](docs/design/)（設計ドキュメントと元のモック）

## 開発

```sh
npm ci
npm run dev        # 開発サーバー
npm test           # 問題データ検証・ロジックのテスト
npm run typecheck
npm run lint
npm run build      # dist/ に出力
```

## 構成

| パス | 内容 |
| --- | --- |
| `src/content/` | 問題データ（コースごと）と、その検証テスト |
| `src/domain/` | 型定義、採点などの問題形式ヘルパー、進捗ルール |
| `src/screens/`, `src/components/` | 画面とUIパーツ |
| `src/storage.ts` | 進捗の保存（localStorage） |

問題形式を追加するときは `src/domain/types.ts` の `Question` に型を足す。`questions.ts` と `QuestionRenderer.tsx` の分岐漏れは型エラーで検出される。

## 取り扱い注意

参考書のPDFやOCRの結果は著作物のためコミットしない（`references/` と `*.pdf` は `.gitignore` 済み）。問題文はすべてオリジナルで作成する。
