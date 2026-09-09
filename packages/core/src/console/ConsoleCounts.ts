/** 前回観測以降のコンソール件数。 */
export interface ConsoleCounts {
  /** console.error の呼び出し回数。 */
  errors: number;
  /** console.warn の呼び出し回数。 */
  warnings: number;
}
