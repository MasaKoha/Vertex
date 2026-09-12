# Vertex

Web フロントエンドを、テストコードや AI エージェントから「見て、触る」ためのツール群。
Unity 向け [UniTestify](https://github.com/MasaKoha/UniTestify)、Avalonia 向け [Avalon](https://github.com/MasaKoha/Avalon) の Web 版。

## なぜ作ったか

E2E テストは、押したい要素を指し示すところで壊れやすい。
CSS セレクタはマークアップを変えただけで効かなくなり、表示文字での指定は見出しやラベルに巻き込まれる。
「今このボタンは無効なのか」「モーダルに隠れて押せないのか」を、
スクリーンショットから確実に読み取ることもできない。

Vertex はページを 1 枚のテキストに変換する。何があって、どこにフォーカスがあって、
何が無効で、コンソールにエラーが出ているかが、そのまま文字で返ってくる。

```
url=http://localhost:3000/ title="ダイスロール" viewport=1024x768 focus=dice-input
[Heading] label:ダイスロール 「ダイスロール」
  [Input] dice-input value="2d6" *focused
  [Button] roll-button 「振る」
  [Text] label:出目 3, 4 → 合計 7 「出目 3, 4 → 合計 7」
  [Button] share-button 「結果を共有」 !disabled
  [Link] label:ルールを見る 「ルールを見る」 href=/rules
state:
  session.characterName=リン
  session.rollCount=3
console: errors=0 warnings=0
```

`div` や `span` のような入れ物は省き、操作と判断に要る要素だけが並ぶ。
深さが増えるのは `main` や `dialog` のような意味を持つ区切りだけなので、
マークアップを整理しても行の構造は動きにくい。

`state:` はアプリ側が登録した値で、画面に出ていない内部の状態も一緒に観測できる。
`console:` の件数は、操作の裏でエラーが出ていないかを毎回確かめるためにある。

## 何ができるか

**押せるようになるまで待ってから押す。** 要素が現れ、可視になり、有効になり、
何にも遮られていない状態を確認してから操作する。操作したあとはページが落ち着くまで待ち、
その時点の観測を返す。呼ぶ側で待ち時間を調整する必要はない。

**期待どおりかを機械が判定する。** 「このボタンが有効になっているはず」「この文字が出ているはず」を
操作と同時に渡せる。満たされなければ、どの条件が外れたかが返る。

**手順を記録して回帰テストにできる。** 一度手で通した操作をそのまま JSON として書き出し、繰り返し実行できる。

このほか、ページの PNG 撮影（白紙かどうかの判定つき）、
モバイル表示の監査（横スクロールの発生、44px 未満のタップ対象、要素の重なり、文字のはみ出し）、
ブラウザコンソールの取得、未処理例外が出たときの証拠の自動保存がある。

## 要素の指し示し方

`data-testid` → `id` → `name` → 表示ラベルの部分一致、の順に解決する。

**先に `data-testid` を付けておくのが確実である。** 表示ラベルでの指定は、
同じ語を含む見出しやリンクに当たることがある。
どう指定すればよいか分からないときは、探したい語を `find` に渡すと、そのまま使える指定文字列が返る。

## 構成

| パッケージ | 役割 |
|---|---|
| `packages/core` | ブラウザ内で動く観測・操作・監査の本体。DOM 標準 API のみを使う |
| `packages/react` | アプリの状態を観測へ載せる hook（`useVertexState`） |
| `packages/cli` | Playwright でブラウザを持ち、メールボックスと CLI を提供する |
| `tools/vertex_client.py` | メールボックスの Python クライアント。標準ライブラリのみ |

## 試す

```sh
pnpm install
pnpm exec playwright install --with-deps chromium
pnpm --filter @vertex/cli build
```

対象アプリを別のターミナルで起動してから、ブラウザを持つプロセスを立ち上げる。

```sh
node packages/cli/bin/vertex.js serve --url http://localhost:5173 --viewport mobile
```

さらに別のターミナルから、同じ作業ディレクトリで操作する。

```sh
python3 tools/vertex_client.py observe
python3 tools/vertex_client.py act '{"action":{"click":"roll-button"}}'
python3 tools/vertex_client.py capture '{"name":"result"}'
```

一度見るだけなら、プロセスを立てずに済ませられる。

```sh
node packages/cli/bin/vertex.js observe --url http://localhost:5173
```

成果物は作業ディレクトリの `DebugOutput/` に出る。バージョン管理からは除外する。

## AI エージェントから使う

やり取りはファイルの読み書きだけで完結する。ネットワークを使わないため、
外部への通信が制限されたサンドボックスからでも動く。
Claude Code と Codex それぞれの使い方は [はじめかた](docs/getting-started.md) にある。

## 気をつけること

**表示ラベルでの指定は当たりどころが広い。** 同じ語を含む見出しやリンクに解決されることがあるため、
操作の対象には `data-testid` を付けておく。

**要求は 1 件ずつ処理する。** 同時に送られたものはキューに入る。

## もっと詳しく

| ページ | 内容 |
|---|---|
| [docs/getting-started.md](docs/getting-started.md) | 導入、メールボックスの起動、シナリオの再生、アプリの状態を観測へ載せる方法 |
| [docs/design.md](docs/design.md) | 設計の方針と、その判断に至った理由 |

## 開発

```sh
pnpm install
pnpm typecheck
pnpm test
```

- 最初の利用先: TRPG（private リポジトリ）

MIT License
