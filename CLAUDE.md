# CLAUDE.md — Vertex

規約の正本は `~/.claude/rules/`（coding-principles.md）。ここには本リポジトリ固有の事項だけ書く。

- 設計の正本は `docs/design.md`。op・行動・expect の語彙を変えるときは先に設計書を直す
- `packages/core` は DOM 標準 API 以外を import しない。React・Playwright・Node 依存は `cli` / `react` に閉じる
- `core` のテストは Vitest + jsdom。`cli` のテストは Playwright で `packages/cli/fixtures/` の静的 HTML を対象にする
- 観測テキスト・メールボックスの形式は Testify / Avalon と揃える（AI が同じ手順で使えることが価値）
- デフォルトブランチは `develop`（保護あり）。直コミット禁止
