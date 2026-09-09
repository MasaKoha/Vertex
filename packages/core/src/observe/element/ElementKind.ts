/** 観測と検索で共通の行種別。 */
export type ElementKind =
  | 'Button' | 'Link' | 'Input' | 'Text' | 'Heading'
  | 'Checkbox' | 'Radio' | 'Select' | 'Image' | 'Alert';

/** 操作を受け付ける種別。同じラベルに複数一致したとき、こちらを先に選ぶ。 */
export const interactiveKinds: readonly ElementKind[] = ['Button', 'Link', 'Input', 'Checkbox', 'Radio', 'Select'];
