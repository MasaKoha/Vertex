# CLAUDE.md — Vertex

規約の正本は `~/.claude/rules/`（coding-principles.md）。ここには本リポジトリ固有の事項だけ書く。

- 設計の正本は `docs/design.md`。op・行動・expect の語彙を変えるときは先に設計書を直す
- `packages/core` は DOM 標準 API 以外を import しない。React・Playwright・Node 依存は `cli` / `react` に閉じる
- `observe/` は**観測テキストの組み立て**、`observe/element/` は**要素 1 つについての知識**（種別・ラベル・属性・可視性）。
  要素の判定を増やすときは `element/` に置く（`~/.claude/rules/coding-principles.md` §2.5 フォルダ構成）
- `core` のテストは Vitest + jsdom。`cli` のテストは Playwright で `packages/cli/fixtures/` の静的 HTML を対象にする
- 観測テキスト・メールボックスの形式は UniTestify / Avalon と揃える（AI が同じ手順で使えることが価値）
- デフォルトブランチは `develop`（保護あり）。直コミット禁止
