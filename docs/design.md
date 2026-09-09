# Vertex 設計書

**AI エージェント（Claude Code / Codex）が Web フロント（React）アプリを実際に動かし、自分で見て、何がおかしいかを判断する**ためのツール群。Unity 向け [Testify](https://github.com/MasaKoha/Testify)、Avalonia 向け [Avalon](https://github.com/MasaKoha/Avalon) の Web 版。人がスクリーンショットを開いて目視する工程を、**構造化された観測テキスト**と**事後条件の自動判定**に置き換える。

最初の利用先は [TRPG](https://github.com/MasaKoha/TRPG)（`apps/tutorial`）。PC とスマホの両方の画面で検証できることを重視する。

## 決定事項（2026-09-09）

| 項目 | 決定 |
|---|---|
| 形 | pnpm workspace monorepo。`@vertex/core`（ブラウザ内で動く観測・操作の本体、DOM 以外に依存しない）/ `@vertex/react`（アプリ状態を観測へ載せる薄い hook）/ `@vertex/cli`（Node。Playwright でブラウザを持ち、メールボックスと CLI を提供） |
| ブラウザ制御 | **Playwright**（Chromium）。`core` のバンドルを `addInitScript` でページへ注入する。アプリ側の組み込みは `@vertex/react` の hook を使うときだけ（状態登録が不要なら組み込み 0 行） |
| 接続 | **ファイルメールボックス**（Testify / Avalon と同じ `req-<id>.json` / `res-<id>.json`）。Codex のサンドボックス（localhost 不可）でも動かすため。加えて直接 `vertex <op> '<json>'` でも呼べる |
| クライアント | `tools/vertex_client.py`（標準ライブラリのみ。`ai_client.py` / `avalon_client.py` と同じ使い勝手） |
| 画面 | `session.begin` の `viewport` で `desktop`（1280x800）/ `mobile`（iPhone 相当 390x844、タッチ有効、モバイル UA）を切り替える。同じシナリオを両方で回す |
| 機能 | 観測・検索・操作・撮影・事後条件・コンソールログ／未処理例外フォレンジック・回帰シナリオ・レイアウト監査 |
| テスト | `core` は Vitest + jsdom（DOM を組み立てて観測テキストを検証）。`cli` は Vitest + Playwright で `packages/cli/fixtures/` の静的 HTML を対象に実行 |

## 用語

- **メールボックス**: `<利用側の作業ディレクトリ>/DebugOutput/agent-mailbox/`。`vertex serve --url <URL>` が監視する。環境変数 `VERTEX_MAILBOX` で場所を上書きできる
- **観測（observe）**: ページの UI 要素を 1 枚のテキストにしたもの
- **要素の指定**: `data-testid` → `id` → `name` 属性 → `label:<表示文字の部分一致>`（`textContent` / `aria-label` / `placeholder` / `alt` / `value`）の順で解決する。同名が複数あれば最初のもの。曖昧さは `find` で解消する
- **落ち着き待ち（settle）**: 操作後、DOM 変異（`MutationObserver`）・ネットワーク・アニメーション（`document.getAnimations()`）が `settleMilliseconds`（既定 150）の間止まるまで待つ。上限 `settleTimeoutMilliseconds`（既定 10000）

## 観測テキストの形

```
url=http://localhost:5173/ title="TRPG チュートリアル" viewport=390x844 focus=dice-input
[Heading] 「TRPG チュートリアル」
[Heading] 「ダイスを振る」
[Input] dice-input value="2d6" *focused
[Button] roll-button 「振る」
[Text] 「出目 3, 4 → 合計 7」
[Button] install-button 「ホーム画面に追加」 !disabled
[Button] label:通知を受け取る 「通知を受け取る」
[Link] 「利用規約」 href=/terms
[Button] label:閉じる 「閉じる」 blocked:modal-backdrop
[Button] label:次へ 「次へ」 [offscreen]
state:
  dice.total=7
  push.permission=default
console: errors=0 warnings=1
```

- 1 要素 1 行。インデントは**ランドマーク／セクションの深さ**（`main` / `nav` / `section` / `dialog` / `[role=region]` 等）。レイアウト用の `div` / `span` は行にしないし深さも増やさない（AI が読む行数を減らすため）
- 行に出す要素: `button` / `[role=button]` / `a[href]` / `input` / `textarea` / `select` / `[role=checkbox|radio|switch|slider|tab|menuitem|option]` / `h1`〜`h6` / `label` / `img[alt]` / `[role=alert|status]` / `p` と `li` のうち文字を持つもの / `[data-testid]` が付いているもの
- 行の 2 列目は**指定名**（`data-testid` / `id` / `name` のどれか。無ければ `label:<文字>` の推奨指定）。3 列目は表示文字 `「…」`
- 属性: `value`、`checked`、`selected`、`href`、`!disabled`、`*focused`、`[offscreen]`（ビューポート外。`scope=all` のときだけ出す）、`[hidden]`（`display:none` / `visibility:hidden` / `aria-hidden`。`scope=all` のときだけ）、`blocked:<要素名>`（要素中心の `elementFromPoint` が自分でも子孫でもない）
- `scope`: `visible`（既定。可視でビューポート内）/ `all`
- `state:` は `@vertex/react` の `useVertexState` か `window.__vertex.registerState(key, () => value)` で登録した値
- `console:` は前回観測以降のコンソールの件数。本文は `logs` で取る
- `diffOnly=true` で前回観測との差分行だけ返す（追加 `+`、削除 `-`、変更 `~`）

## op 一覧

すべて `cli` の `CommandDispatcher` が実装し、メールボックスと CLI の両方から同じ意味で呼ぶ。応答の共通フィールドは Testify と同じ（`ok` / `op` / `message` / `text` / `path` / `elapsedMs` / `settled` / `ready` / `waitedMs` / `expectOk` / `expectFailures`）。

| op | 引数 | 説明 |
|---|---|---|
| `ping` | – | `url=<現在URL> viewport=<w>x<h> uptimeMs=<n>` |
| `ops` | – | op 名の一覧 |
| `observe` | `diffOnly`, `scope`, `capture`（撮影名） | 観測テキスト。`capture` 付きなら同時に撮影して `path/width/height/blank` を埋める |
| `find` | `label`, `kind`（Button/Link/Input/Text/Heading/Checkbox…）, `scope` | ラベル部分一致で検索。1 行 1 件、末尾に推奨の `"click":"…"` |
| `act` | `action` または `steps[]`, `expect[]`, `settleMilliseconds`, `readyTimeoutMilliseconds`(5000) | 1 手または複数手。各手: 準備待ち（存在・可視・遮られていない・enabled）→ 実行 → 落ち着き待ち → 観測 |
| `capture` | `name`（英数字・`_`・`-`）, `directory`, `fullPage` | ページを PNG に。`blank`（輝度の標準偏差 3.0 未満）を判定 |
| `logs` | `count`(40), `level`（`all` / `error`） | ブラウザコンソール（`console.*` / `pageerror` / 失敗したリクエスト）の末尾 |
| `forensics.latest` | – | 直近の未処理例外フォレンジック（撮影 PNG・観測テキスト・例外文）のパス |
| `audit` | – | レイアウト監査。横スクロール発生（`scrollWidth > clientWidth`）・タップ対象が 44px 未満・要素の重なり（兄弟の矩形交差で両方が操作可能）・文字のはみ出し（`scrollWidth > clientWidth` の文字要素）を列挙 |
| `scenario.run` | `path`, `name`, `timeoutMilliseconds`(900000) | JSON シナリオを実行し `verdict` / `failedSteps` / `warningCount` を返す |
| `scenario.status` | – | 直前のシナリオの状態 |
| `session.begin` | `options`（`viewport`: desktop/mobile, `url`） | ブラウザを開き操作ログの記録を開始（`DebugOutput/agent/<session>/actions.jsonl`） |
| `session.end` | – | 記録終了・ブラウザを閉じる |
| `session.export` | `name` | 記録した手順を回帰シナリオ `scenario.json` に書き出す。`expect` 付きの手はそのまま、未達だった手は `comment` 付き |

### 行動（`action`）の語彙

| キー | 例 | 意味 |
|---|---|---|
| `click` | `"roll-button"` / `"label:振る"` | 要素をクリック（Playwright の `click`。可視・安定・遮られていない待ちを使う） |
| `tap` | 要素名 | タッチ（`mobile` のとき。`desktop` では `click` と同じ） |
| `doubleClick` / `rightClick` | 要素名 | |
| `pointer` + `x` `y` | 座標 | ビューポート座標でクリック |
| `hover` | 要素名 or 座標 | |
| `text` + `target`? | `"2d6+3"` | フォーカス中（または `target`）の入力欄へ `fill` |
| `type` + `target`? | | 1 文字ずつ入力（IME や onKeyDown を試すとき） |
| `key` | `"Enter"` `"Escape"` `"Tab"` `"ArrowDown"` `"Control+S"` | キー入力（Playwright のキー名） |
| `focus` | 要素名 | |
| `scroll` + `target`? `deltaX` `deltaY` | | ホイール |
| `scrollTo` | 要素名 | `scrollIntoView` |
| `select` + `target` `item` | `select` の項目をラベルで選択 | |
| `set` + `target` `value` | checkbox / radio / range / switch に値を入れる | |
| `drag` + `from` `to` or 座標 + `milliseconds` | | ドラッグ |
| `swipe` + `from` `to`（up/down/left/right）or 座標 | | `mobile` のタッチスワイプ |
| `navigate` + `url` | | ページ遷移 |
| `back` | | 履歴を戻る |
| `reason` | | 行動理由（`actions.jsonl` に残る） |

### 事後条件（`expect`）の語彙

`{"kind": "...", "value": "...", "target": "...", "key": "...", "op": "..."}` の配列。

| kind | 判定 |
|---|---|
| `textVisible` / `textAbsent` | `value` の文字が観測（visible）に含まれる／含まれない |
| `exists` / `absent` / `enabled` / `disabled` / `focused` / `checked` / `unchecked` | `target` の要素の状態 |
| `urlIs` / `urlContains` | 現在 URL |
| `state` | `state:` の `key` が `op`（eq/ne/contains/lt/le/gt/ge）で `value` を満たす |
| `changed` | 直前との差分に `target` が含まれる |
| `noException` | 操作中に `pageerror` / `console.error` が増えていない |
| `auditClean` | レイアウト監査が 0 件 |

### シナリオ JSON

```json
{
  "name": "dice-tour",
  "outputDirectory": "DebugOutput/scenarios/dice-tour",
  "viewport": "mobile",
  "stopOnFail": true,
  "steps": [
    { "navigate": "/" , "expect": [ { "kind": "textVisible", "value": "ダイスを振る" } ] },
    { "text": "2d6+3", "target": "dice-input" },
    { "click": "roll-button", "expect": [ { "kind": "state", "key": "dice.total", "op": "ge", "value": "5" } ], "capture": "01_rolled", "audit": true }
  ]
}
```

ステップは行動の語彙 + `expect` / `capture` / `audit` / `settleMilliseconds` / `comment`。結果は `<outputDirectory>/result.json`（`verdict` / `failedSteps` / `warningCount` / 各ステップの `waitedMs`）。`viewport` はシナリオ単位（既定 `desktop`）。

## メールボックスのプロトコル

- 要求: `req-<id>.json` = `{"op": "act", "args": "<JSON 文字列>"}`。`args` は JSON 文字列（Testify と同じ。クライアントが詰める）
- 応答: `res-<id>.json`。同一ディレクトリの一時ファイルへ書いてから `rename` で公開する（読みかけを見せない）
- 処理済みの `req-*.json` は応答後に削除する。`res-*.json` はクライアントが読んだら削除する
- サーバー: `vertex serve --url http://localhost:5173 [--mailbox <dir>] [--viewport mobile]`。`.enabled` が無ければ作って起動する（Unity と違い本番に混入する経路が無いため、フラグは「今どこが監視中か」の目印として使う）

## アプリ側の組み込み（任意）

```tsx
import { useVertexState } from '@vertex/react';

function DiceRollerPanel() {
  const [result, setResult] = useState<DiceRollResult | null>(null);
  useVertexState('dice.total', result?.total);   // 観測の state: に出る
  ...
}
```

- `useVertexState(key, value)` は `window.__vertex` が無ければ何もしない（本番ビルドに残っても副作用なし）
- `window.__vertex` は `cli` が `addInitScript` で注入する `core` のバンドルが定義する。`registerState(key, getter)` / `observe(options)` / `find(query)` / `resolve(target)` / `audit()` を持つ

## 成果物のレイアウト（利用側の `DebugOutput/`）

```
DebugOutput/
  agent-mailbox/        req-*.json / res-*.json / .enabled
  agent/<session>/      actions.jsonl / session.json / scenario.json（export）
  captures/             capture の PNG
  scenarios/<name>/     result.json / 撮影 / 監査 JSON
  forensics/<日時>/     未処理例外時の PNG・観測・例外文
```

## 依存の鉄則

- `core` は DOM 標準 API だけに依存する。React・Playwright・Node を import しない
- `react` は `core` の `window.__vertex` の型だけを見る（実体を import しない）
- `cli` だけが Playwright と Node に依存する。`core` はビルド時に IIFE バンドルにして `cli` へ同梱する

## 未決

- 視覚回帰（基準画像との比較）は Testify にはあるが初回では作らない
- Firefox / WebKit（iOS Safari 相当）は Playwright で追加できるが、初回は Chromium のみ
