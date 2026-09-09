# Vertex

**AI エージェント（Claude Code / Codex）が Web フロント（React）アプリを実際に動かし、自分で見て、何がおかしいかを判断する**ためのツール群。Unity 向け [Testify](https://github.com/MasaKoha/Testify)、Avalonia 向け [Avalon](https://github.com/MasaKoha/Avalon) の Web 版。

設計は [docs/design.md](docs/design.md) を参照。

## 構成

```
packages/core    ブラウザ内で動く観測・操作・監査の本体（DOM 標準 API のみ）
packages/react   アプリの状態を観測へ載せる hook（useVertexState）
packages/cli     Playwright でブラウザを持ち、メールボックスと CLI を提供
tools/vertex_client.py  メールボックスの Python クライアント（標準ライブラリのみ）
```

## 使い方（予定）

```sh
# 対象アプリを起動しておく（例: TRPG の pnpm dev）
pnpm --filter @vertex/cli exec vertex serve --url http://localhost:5173 --viewport mobile
python3 tools/vertex_client.py observe
python3 tools/vertex_client.py act '{"action":{"click":"label:振る"}}'
```

## 開発

```sh
pnpm install
pnpm typecheck
pnpm test
```

- ライセンス: MIT
- 最初の利用先: [TRPG](https://github.com/MasaKoha/TRPG)
