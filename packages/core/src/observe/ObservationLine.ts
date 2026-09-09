/** 文言が変わっても同じ行と判定できる観測スナップショット。 */
export interface ObservationLine {
  /** 要素は DOM 参照、ヘッダーや状態は専用キーで識別する。 */
  identity: Element | string;
  /** 観測時点の整形済みテキスト。 */
  text: string;
}
