/** 準備完了後の失敗でも待機結果を失わない操作エラー。 */
export class ActionExecutionError extends Error {
  /** 準備待ちと実行失敗を応答で区別する。 */
  constructor(message: string, readonly ready: boolean, readonly waitedMs: number) {
    super(message);
    this.name = 'ActionExecutionError';
  }
}
