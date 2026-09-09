/** CLI とメールボックスで共通の応答。 */
export interface CommandResponse {
  /** コマンドと事後条件の成否。 */
  ok: boolean;
  /** 要求された操作名。 */
  op: string;
  /** 補足情報。 */
  message?: string;
  /** 観測または一覧の本文。 */
  text?: string;
  /** 成果物の絶対パス。 */
  path?: string;
  /** 失敗の理由。 */
  error?: string;
  /** 処理時間。 */
  elapsedMs: number;
  /** 静止を確認できたか。 */
  settled?: boolean;
  /** 操作対象の準備ができたか。 */
  ready?: boolean;
  /** 準備と静止の待機時間の合計。 */
  waitedMs?: number;
  /** PNG の画素幅。 */
  width?: number;
  /** PNG の画素高さ。 */
  height?: number;
  /** 輝度の標準偏差が閾値未満か。 */
  blank?: boolean;
  /** 事後条件をすべて満たしたか。 */
  expectOk?: boolean;
  /** 未達条件の説明。 */
  expectFailures?: string[];
  /** シナリオの進行状態。 */
  status?: string;
  /** シナリオ全体の判定。 */
  verdict?: 'pass' | 'fail';
  /** 失敗したステップ数。 */
  failedSteps?: number;
  /** 監査と静止待ちの警告数。 */
  warningCount?: number;
  /** 記録セッションの識別子。 */
  session?: string;
}
