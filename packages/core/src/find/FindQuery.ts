import type { ElementKind } from '../observe/ElementKind';

/** ラベルの部分一致で候補を絞り込む条件。 */
export interface FindQuery {
  /** 大文字小文字を区別する部分一致文字列。 */
  label: string;
  /** 省略時はすべての行種別を対象にする。 */
  kind?: ElementKind;
  /** 既定では非表示と画面外の要素を省く。 */
  scope?: 'visible' | 'all';
}
