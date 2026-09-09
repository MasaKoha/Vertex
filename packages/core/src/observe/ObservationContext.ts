import type { ObservationLine } from './ObservationLine';

/** 呼び出し元ごとに差分の基準を分離するための観測履歴。 */
export interface ObservationContext {
  /** diffOnly が false の観測も次の比較基準になる。 */
  previousLines?: readonly ObservationLine[];
}
