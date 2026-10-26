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
python3 -m unittest discover -s tools/pdf   # PDF読み込みツールのテスト
```

## 構成

| パス | 内容 |
| --- | --- |
| `src/content/topics.ts` | 論点マスタ（小項目） |
| `src/content/bank.ts` | 問題バンク。旧コースの問題を論点に割り当てる |
| `src/content/courses.ts` | コース定義（TAC順・本試験頻度順）。論点をセクションに並べるだけを持つ |
| `src/content/legacy/` | モック由来の旧4コースの問題データ。出題しないものも保管している |
| `src/domain/` | 型定義、採点などの問題形式ヘルパー、進捗ルール |
| `src/screens/`, `src/components/` | 画面とUIパーツ |
| `src/storage.ts` | 進捗の保存（localStorage） |
| `tools/pdf/` | 参考書のsearchable PDFから問題を抽出するツール（[手順](docs/reference-workflow.md)） |

レッスンは `src/domain/course.ts` が自動で組み立てる。小項目（論点）ごとに 5要素分類 → 仕訳穴埋め を並べ、セクションの最後に復習を置く。復習は正答率70%以上で合格になり、誤答の多い問題を優先して出す。

問題形式を追加するときは `src/domain/types.ts` の `Question` に型を足す。`questions.ts` と `QuestionRenderer.tsx` の分岐漏れは型エラーで検出される。

## 取り扱い注意

参考書のPDFやOCRの結果は著作物のためコミットしない（`references/` と `*.pdf` は `.gitignore` 済み）。問題文はすべてオリジナルで作成する。
