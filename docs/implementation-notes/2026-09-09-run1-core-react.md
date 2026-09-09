# 2026-09-09 run1: core / react

## 実装内容

- `@vertex/core`: 観測、指定名解決、検索、レイアウト監査、状態登録、コンソール計数、公開型、IIFE 注入エントリを追加した。ブラウザ実装は DOM 標準 API のみに依存する。
- 観測の分類・ラベル・指定名・可視性・収集・属性・整形・差分を責務別に分割した。検索は同じ収集・整形を使う。
- `observe(document, options, context)` は渡された履歴を更新する。履歴省略時は Document ごとの WeakMap、注入 API ではクロージャー内の専用履歴を使う。
- `@vertex/react`: コミット後の effect で値を登録する hook を追加した。更新・キー変更では以前の登録を解除して再登録し、アンマウントでは登録先インスタンスから解除する。未注入では副作用なし。core は型のみ import する。
- Vitest の jsdom 設定とテストを追加した。矩形と `elementFromPoint` はテスト内でスタブし、本番実装に jsdom 固有分岐は入れていない。
- React パッケージへ型参照先の `@vertex/core` と、テスト用の `react-dom` / `@types/react-dom` を追加した。`@testing-library/react` は追加していない。

## 設計書との優先関係・未定義箇所の判断

- 語彙、指定名の優先順、監査の四種は変更していない。設計書本文では指定名が必須のため、例で指定名を省略している Heading / Text / Link にも指定名を出す。
- `find` の末尾は今回の受け入れ条件を優先して `→ click:"指定名"` とした。設計書の op 表にある `"click":"…"` とは記法が異なる。
- 未フォーカス時は `focus=none`。インデントは対象自身を含まないランドマーク／セクション祖先数 × 半角空白二つ。
- `switch` は Checkbox、`slider` は Input、`tab` / `menuitem` は Button、`option` role は Select、`status` は Alert。input の checkbox / radio は対応種別、button / submit / reset / image は Button。その他の `[data-testid]` は Text にする。
- ラベル候補は textContent → aria-label → placeholder → alt → 現在の value。空白を一つに正規化し、大文字小文字を区別する。Input / textarea の表示列では value と本文を重複させず、aria-label / placeholder / alt を使う。select の表示文字は textContent、現在の選択値は value で表す。
- `checked` / `selected` は native プロパティまたは対応 ARIA 属性が true の場合の裸のトークンとする。false は省略。fieldset による無効化と `aria-disabled=true` も `!disabled` に含める。文字列 value / title / click 指定は JSON の引用符規則で改行等をエスケープする。
- 可視性は祖先の非表示も確認する。設計書に列挙された CSS / aria-hidden に加え、hidden 属性、hidden input、面積ゼロ、visibility:collapse も hidden とする。hidden は offscreen と重複させない。部分的な画面内への交差は visible とし、中心が画面外なら遮蔽判定を省く。中心の hit が null の場合は blocker なしとする。
- 観測・検索とラベル解決は body の子孫を走査する。html / body 自身がすべての textContent に一致するのを避けるため。明示属性での解決は文書全体を対象にする。空指定と空の `label:` は null、find の空ラベルは空文字。
- `label:` は観測種別で絞らず、祖先も含めて文書順の最初の一致を返す。例: `<main><button>実行</button></main>` の `label:実行` は main を返す。この曖昧さを勝手に末端優先へ変えず、テストで固定した。明示名がない場合、find の推奨指定にも同じ制限がある。
- 指定属性もラベルも空なら `label:` と表示する。解決不能な名前を独自生成する仕様は追加しない。
- 状態は同じキーの最後の登録が勝つ。readStates は通常のオブジェクトを返し、`__proto__` も安全な own property として扱う。文字列は引用符なし、オブジェクト／配列は JSON、undefined / null / bigint 等は文字列化する。循環参照等は `[unserializable]`。getter の例外は呼び出し元へ伝播する。
- コンソールは注入時に導入する。公開 observe を直接使う場合は `installConsoleCounter()` を明示的に呼ぶ。計数は console ごと、観測ごとに取り出してゼロに戻す。導入は冪等で、返される `dispose()` で元の出力へ戻せる。注入ではページの寿命まで維持する。
- 差分の変更行は `~ 現在の行`、削除は以前の順、追加・変更は現在の順で出力する。初回は接頭辞なしの全行。通常観測も次の比較基準になる。DOM 要素は参照で識別し、同じ指定名を持つ複数要素を混同しない。DOM の置換は削除＋追加、文言・深さの変わらない並べ替えだけでは差分を出さない。ヘッダー、state 節、各状態キー、console も比較する。
- audit の横スクロールは `document.scrollingElement ?? document.documentElement` を対象とする。非表示は除外し、画面外は含める。44px 判定は幅または高さのどちらかが未満の場合。操作対象は native controls と設計書の操作系 role で、disabled は除外する。重なりは同じ親の操作可能な二要素の正の交差面積を一組一件として出す。
- 文字はみ出しは、文字を持つ Text / Heading / Alert / Button / Link と、span 等の直接の文字ノードを持つ要素を対象にする。文字を子孫へ包むだけのレイアウト div は重複報告しない。文字のない要素と script / style / template は除外する。比較は設計どおり scrollWidth > clientWidth。
- React のテストは `react-dom/client` の createRoot と React が公開する `act` を使う。`react-dom/client` は act の公開元ではないため。StrictMode と API 差し替え時の解除先も確認した。
- 再注入は既存の `window.__vertex` を保持する。hook の登録状態や console のラップを失わないため。

## 検証結果

| 確認 | 結果 |
| --- | --- |
| core: TypeScript `--noEmit -p packages/core/tsconfig.json` | 成功 |
| react: TypeScript `--noEmit -p packages/react/tsconfig.json` | 成功 |
| core: Vitest run / jsdom | 9 ファイル、125 件成功 |
| react: Vitest run / jsdom | 1 ファイル、5 件成功 |
| core の既存 build スクリプト相当の esbuild IIFE 生成 | 成功。`packages/core/dist/vertex-inject.js`、約 17.9 KiB |
| 生成済み IIFE を jsdom の beforeParse で評価 | 成功。DOM 構築前の注入、全 API、state、console、差分、再注入保持、解除を確認 |
| React バンドルの依存確認 | 成功。入力は hook と index のみ。core の実装は取り込まれていない |
| 追加依存の package.json / pnpm-lock.yaml 整合 | 成功 |
| `pnpm typecheck` | 依存の自動取得段階で npm の DNS エラーにより失敗 |
| `pnpm --filter @vertex/core test`、`pnpm --config.offline=true test` | 同じ依存取得エラーで失敗 |
| CLI の既存 TypeScript 設定の読み取り検証 | `src` がないため TS18003。ルート typecheck の別の阻害要因 |

### 依存取得と代替検証環境

`pnpm add` と `pnpm install --offline` を試したが、npm の名前解決エラー／キャッシュ不足により完了しなかった。自動取得は pnpm のスクリプト実行時にも発生した。ネットワークや供給網チェックの設定は変更していない。

既存プロジェクトにインストール済みの依存を、このリポジトリの無視対象 `node_modules` にコピーして検証した。コピー元への変更は行っていない。検証実行にはローカルの TypeScript / Vitest / esbuild エントリを Node から直接呼んだ。

- 使用版: TypeScript 7.0.2、Vitest 5.0.0、React / React DOM 19.2.8、@types/react 19.2.18、@types/react-dom 19.2.7。
- 代替版: jsdom 26.1.0（ルート指定は ^30.0.1）、esbuild 0.28.1（ルート指定は ^0.28.2）。ルートの依存指定は変更していない。
- lock は React DOM / scheduler / @types/react-dom の既存ロックの integrity と依存メタデータを使って必要な箇所だけ反映した。ネットワークからの新規解決・取得は未完了。

## 変更ファイル一覧

### core

- `packages/core/src/index.ts`
- `packages/core/src/inject.ts`
- `packages/core/src/inject.test.ts`
- `packages/core/src/VertexGlobal.ts`
- `packages/core/src/observe/ElementKind.ts`
- `packages/core/src/observe/ObserveOptions.ts`
- `packages/core/src/observe/Observer.ts`
- `packages/core/src/observe/Observer.test.ts`
- `packages/core/src/observe/ElementClassifier.ts`
- `packages/core/src/observe/ElementClassifier.test.ts`
- `packages/core/src/observe/ElementLabel.ts`
- `packages/core/src/observe/TargetName.ts`
- `packages/core/src/observe/Visibility.ts`
- `packages/core/src/observe/Visibility.test.ts`
- `packages/core/src/observe/ElementAttributes.ts`
- `packages/core/src/observe/ElementLine.ts`
- `packages/core/src/observe/ElementCollector.ts`
- `packages/core/src/observe/LineFormatter.ts`
- `packages/core/src/observe/ObservationLine.ts`
- `packages/core/src/observe/ObservationContext.ts`
- `packages/core/src/observe/ObservationDiff.ts`
- `packages/core/src/resolve/TargetResolver.ts`
- `packages/core/src/resolve/TargetResolver.test.ts`
- `packages/core/src/find/FindQuery.ts`
- `packages/core/src/find/ElementFinder.ts`
- `packages/core/src/find/ElementFinder.test.ts`
- `packages/core/src/audit/AuditFinding.ts`
- `packages/core/src/audit/LayoutAuditor.ts`
- `packages/core/src/audit/LayoutAuditor.test.ts`
- `packages/core/src/state/StateRegistry.ts`
- `packages/core/src/state/StateRegistry.test.ts`
- `packages/core/src/state/StateFormatter.ts`
- `packages/core/src/console/ConsoleCounts.ts`
- `packages/core/src/console/ConsoleCounter.ts`
- `packages/core/src/console/ConsoleCounter.test.ts`
- `packages/core/src/testing/DomGeometry.test-support.ts`
- `packages/core/vitest.config.ts`

### react と記録

- `packages/react/src/index.ts`
- `packages/react/src/useVertexState.ts`
- `packages/react/src/useVertexState.test.ts`
- `packages/react/vitest.config.ts`
- `packages/react/package.json`
- `pnpm-lock.yaml`
- `docs/implementation-notes/2026-09-09-run1-core-react.md`

ビルド生成物 `packages/core/dist/vertex-inject.js` は既存の ignore 対象。`packages/cli`、ルート package.json / tsconfig.base.json、.github、設計書、TRPG は変更していない。git 操作・ブラウザ起動は行っていない。

## 未実行の確認事項

- ネットワークが利用可能な環境での依存インストール、および指定 jsdom / esbuild 版での `pnpm test` と build。
- CLI に入力ファイルが追加された後のルート `pnpm typecheck` 全体成功。今回の core / react の型チェックは成功済み。
- 実ブラウザでの CSS・レイアウト・elementFromPoint の精度、次ランの addInitScript / Playwright 統合。

## 提案

- label 解決の祖先一致の扱いを設計に追記する / 現在はコンテナーがボタンより先に一致し、明示名のない推奨指定が操作対象へ届かない場合がある / 1 ラン。
- 同じ状態キーの登録所有者を区別する / 複数 hook が同じキーを使うと、一方の解除で他方の状態も消える / 1 ラン。
- 指定名もラベルもない要素の識別方法を設計する / 現在の `label:` は解決できず、その要素を操作できない / 1 ラン。
