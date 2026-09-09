/** レイアウト監査で検出した問題。 */
export interface AuditFinding {
  /** 設計書で定義された監査種別。 */
  kind: 'horizontalScroll' | 'smallTapTarget' | 'overlap' | 'textOverflow';
  /** 問題がある要素の指定名。 */
  target: string;
  /** 寸法や重なった相手などの根拠。 */
  detail: string;
}
