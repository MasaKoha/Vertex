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

## 使い方

```sh
pnpm install
pnpm exec playwright install --with-deps chromium
pnpm --filter @vertex/cli build

# 対象アプリを別のターミナルで起動しておく。
node packages/cli/bin/vertex.js serve --url http://localhost:5173 --viewport mobile
```

別のターミナルで、同じ作業ディレクトリから操作する。

```sh
python3 tools/vertex_client.py observe
python3 tools/vertex_client.py act '{"action":{"click":"label:振る"}}'
python3 tools/vertex_client.py capture '{"name":"result"}'
```

ブラウザを一度だけ開いて観測する場合:

```sh
node packages/cli/bin/vertex.js observe --url http://localhost:5173
```

成果物は作業ディレクトリの `DebugOutput/` に保存する。利用側での起動、セッション記録・シナリオ再生、Claude Code / Codex からの使い方は [はじめかた](docs/getting-started.md) を参照。

## 開発

```sh
pnpm install
pnpm typecheck
pnpm test
```

- ライセンス: MIT
- 最初の利用先: [TRPG](https://github.com/MasaKoha/TRPG)
