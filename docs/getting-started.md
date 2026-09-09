# はじめかた

## 1. 導入

Vertex のリポジトリで依存と Chromium を準備する。Node.js 22 以降、pnpm、Python 3 が必要。

```sh
pnpm install
pnpm exec playwright install --with-deps chromium
pnpm --filter @vertex/cli build
```

CLI の build は先に core をビルドし、`packages/core/dist/vertex-inject.js` を生成する。アプリ側への組み込みは、状態登録を使う場合だけ必要。

## 2. メールボックスを起動する

対象アプリを起動してから、**利用側の作業ディレクトリ**でサーバーを起動する。`DebugOutput/` はその作業ディレクトリにできる。

```sh
# Vertex のチェックアウト位置に合わせる。
export VERTEX_ROOT=/absolute/path/to/Vertex
cd /absolute/path/to/TRPG/apps/tutorial
pnpm dev
```

別のターミナルで、同じ利用側ディレクトリから実行する。

```sh
export VERTEX_ROOT=/absolute/path/to/Vertex
cd /absolute/path/to/TRPG/apps/tutorial
node "$VERTEX_ROOT/packages/cli/bin/vertex.js" serve \
  --url http://localhost:5173 --viewport mobile
```

`vertex` が PATH に導入済みなら、上の `node .../vertex.js` は `vertex` に置き換えられる。画面を表示する場合は `--headed` を付ける。終了は Ctrl+C。

- `desktop`: 1280×800。
- `mobile`: Playwright の iPhone 13 プロファイル。390×844、タッチ・モバイル UA・端末の画素倍率を含む。
- メールボックスの場所: `--mailbox` → `VERTEX_MAILBOX` → 作業ディレクトリの `DebugOutput/agent-mailbox/`。
- `.enabled` はサーバーとクライアントが自動作成する。サーバーを起動する機能は持たない。

## 3. クライアントから操作する

上と同じ作業ディレクトリで実行する。場所が異なる場合は `--mailbox` または `VERTEX_MAILBOX` に絶対パスを指定する。

```sh
python3 "$VERTEX_ROOT/tools/vertex_client.py" ping
python3 "$VERTEX_ROOT/tools/vertex_client.py" session.begin \
  '{"options":{"viewport":"mobile","url":"http://localhost:5173"}}'
python3 "$VERTEX_ROOT/tools/vertex_client.py" observe
python3 "$VERTEX_ROOT/tools/vertex_client.py" find '{"label":"振る","kind":"Button"}'
python3 "$VERTEX_ROOT/tools/vertex_client.py" act \
  '{"steps":[{"text":"2d6+3","target":"dice-input"},{"click":"roll-button","reason":"出目の表示を確認","expect":[{"kind":"state","key":"dice.total","op":"ge","value":"5"},{"kind":"noException"}]}]}'
python3 "$VERTEX_ROOT/tools/vertex_client.py" observe '{"capture":"rolled"}'
python3 "$VERTEX_ROOT/tools/vertex_client.py" audit
python3 "$VERTEX_ROOT/tools/vertex_client.py" logs '{"count":40,"level":"error"}'
python3 "$VERTEX_ROOT/tools/vertex_client.py" forensics.latest
python3 "$VERTEX_ROOT/tools/vertex_client.py" session.export '{"name":"dice-tour"}'
```

出力は `text` を含む**一つの JSON**。`ok:false` は終了コード 1。各手の `ready`、`settled`、`waitedMs`、`expectOk`、`expectFailures` を確認する。静止の上限到達は `settled:false` として返り、操作や事後条件が成功していれば `ok:true` の場合もある。

Python のメールボックス解決は、明示指定 → 環境変数 → 作業ディレクトリから親へ既存メールボックスを探索 → 作業ディレクトリに新規作成、の順。既定の応答待ちは 60 秒。タイムアウト時は要求を残すため、再送前に遅れて応答が出ていないか確認する。

### Claude Code から

Bash から同じ Python クライアントを呼ぶ。`visual-verifier` にメールボックスの絶対パスと対象画面・事後条件を渡す。`observe` / `find` で対象名を確認し、操作後は観測と PNG の両方を根拠にする。

### Codex から

依頼者がアプリと `vertex serve` を起動し、Codex はファイルメールボックスだけを使う。指示には「ブラウザを起動しない。`tools/vertex_client.py` で操作・観測する」と記載する。ブラウザを再作成する `session.begin` / `scenario.run`、終了する `session.end` も、その制約下では依頼者が実行する。

```sh
python3 "$VERTEX_ROOT/tools/vertex_client.py" observe \
  --mailbox /absolute/path/to/TRPG/apps/tutorial/DebugOutput/agent-mailbox
```

### 単発 CLI

`serve` を使わず一度だけブラウザを開き、応答後に閉じる。

```sh
node "$VERTEX_ROOT/packages/cli/bin/vertex.js" observe \
  '{"capture":"initial"}' --url http://localhost:5173 --viewport mobile
node "$VERTEX_ROOT/packages/cli/bin/vertex.js" act \
  '{"action":{"click":"roll-button"}}' --url http://localhost:5173
```

URL は `--url` → `VERTEX_URL` → `about:blank`。複数呼び出し間でページや操作記録を保持する場合は `serve` を使う。

## 4. 記録したシナリオを再生する

`session.export` が返した `path` を渡す。シナリオ実行は同期応答なので、Python の待ち時間もシナリオの上限より長くする。

```sh
python3 "$VERTEX_ROOT/tools/vertex_client.py" scenario.run \
  '{"path":"/absolute/path/to/scenario.json","name":"dice-tour","timeoutMilliseconds":900000}' \
  --timeout 930
python3 "$VERTEX_ROOT/tools/vertex_client.py" scenario.status
python3 "$VERTEX_ROOT/tools/vertex_client.py" session.end
```

`scenario.status` は別のクライアントから実行中にも呼べる。`session.end` 後もサーバーは待機し、最後の記録を `session.export` できる。

- 結果: `DebugOutput/scenarios/<name>/result.json`。`outputDirectory` を指定したシナリオはそちらへ保存。
- `verdict`: 行動・事後条件・成果物保存が成功すれば `pass`。`audit:true` の検出と静止待ちの上限到達は `warningCount`。監査を失敗条件にする場合は `expect:[{"kind":"auditClean"}]`。
- `stopOnFail` の既定は true。各ステップに `waitedMs` を保存する。
- シナリオ上限到達時はブラウザを閉じ、未完了の操作を中断する。再開は `session.begin`。
- export は記録開始 URL への移動を先頭に追加し、未達の手に `comment:"元の実行では未達"` を付ける。

行動・事後条件の一覧は [設計書](design.md)。座標はビューポートの CSS px で指定する。

```json
{"action":{"hover":{"x":100,"y":200}}}
{"action":{"pointer":true,"x":100,"y":200}}
{"action":{"drag":true,"from":"source","to":"destination","milliseconds":300}}
{"action":{"swipe":true,"from":{"x":200,"y":600},"to":"up"}}
{"action":{"select":true,"target":"choice","item":"次"}}
{"action":{"set":true,"target":"checkbox","value":true}}
```

`scrollTo` は対象を画面内へ移してから準備を確認する。`set` の checkbox / radio / switch は真偽値、range は数値または数値文字列。`navigate` は URL 文字列、または `navigate:true` と `url`。`reason` 単独の手は入力を行わず、静止待ち・観測・事後条件を実行する。

## 5. アプリの状態を観測に載せる（任意）

```tsx
import { useVertexState } from '@vertex/react';

function DicePanel() {
  // 実際のアプリの状態を渡す。
  useVertexState('dice.total', result?.total);
  // ...
}
```

React 以外では `window.__vertex?.registerState('dice.total', () => total)` を使う。CLI は公開 API の観測テキストから `state` を判定する。オブジェクトの比較は JSON 表現、数値比較は有限数への変換で行う。

## 6. うまくいかないとき

| 症状 | 確認箇所 |
|---|---|
| メールボックス応答がタイムアウト | `serve` の起動、作業ディレクトリ、明示したメールボックスの一致、長いシナリオの `--timeout` |
| 注入ファイルがない | `pnpm --filter @vertex/cli build` を実行したか |
| `ready:false` | `find` と `observe {"scope":"all"}` で指定名・遮蔽・disabled・画面外を確認 |
| `settled:false` | 終わらない CSS アニメーション、DOM 更新、長時間の通信。必要に応じて `settleTimeoutMilliseconds` を指定 |
| `blank:true` | 一様な画面。PNG の輝度標準偏差が 3.0 未満。暗い画面やローディングも該当しうる |
| 例外の原因を見たい | `forensics.latest` のディレクトリ内の `capture.png` / `observation.txt` / `exception.txt` |
| ブラウザが閉じている | `session.end` またはシナリオタイムアウト後は `session.begin` |

開発時の検証は `pnpm typecheck` と `pnpm test`。後者は実際に Chromium を起動するため、ブラウザ起動を禁止した Codex 作業では依頼者が実行する。
