/** 回帰シナリオへ変換可能な一手の記録。 */
export interface RecordedAction {
  /** 行動の語彙と引数。 */
  action: Record<string, unknown>;
  /** 実行時に指定した事後条件。 */
  expect: unknown[];
  /** 実行時の事後条件の成否。 */
  expectOk: boolean;
  /** 行動理由。 */
  reason: string;
  /** 実行時間。 */
  elapsedMs: number;
  /** 再生時にも引き継ぐ静止時間。 */
  settleMilliseconds: number;
}
