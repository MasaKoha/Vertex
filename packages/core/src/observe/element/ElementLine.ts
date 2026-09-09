import type { ElementKind } from './ElementKind';
import type { ElementVisibility } from './Visibility';

/** 観測と検索で共有する、整形前の要素行。 */
export interface ElementLine {
  /** 差分比較でも同一要素を追跡するための参照。 */
  element: Element;
  /** 観測の行種別。 */
  kind: ElementKind;
  /** ランドマークとセクションの祖先数。 */
  depth: number;
  /** 指定名の優先順で選んだ操作対象。 */
  target: string;
  /** 表示文字または代替ラベル。 */
  label: string;
  /** 範囲による絞り込みと属性出力に使う判定。 */
  visibility: ElementVisibility;
}
