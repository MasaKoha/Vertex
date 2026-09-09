/** 観測対象の範囲と差分出力を指定する。 */
export interface ObserveOptions {
  /** 既定では非表示と画面外の要素を省く。 */
  scope?: 'visible' | 'all';
  /** 初回以外は前回から変化した行だけを返す。 */
  diffOnly?: boolean;
}
