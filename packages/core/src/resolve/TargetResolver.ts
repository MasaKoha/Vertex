import { classifyElement } from '../observe/ElementClassifier';
import { matchesLabel } from '../observe/ElementLabel';
import { targetAttributes } from '../observe/TargetName';

const labelPrefix = 'label:';

/** 指定名を優先順に探し、同名なら文書順で最初の要素を返す。 */
export function resolve(document: Document, target: string): Element | null {
  if (!target) {
    return null;
  }
  // セレクターへ利用者の文字列を埋め込まず、特殊文字も名前として扱う。
  for (const attribute of targetAttributes) {
    const match = Array.from(document.querySelectorAll(`[${attribute}]`))
      .find(element => element.getAttribute(attribute) === target);
    if (match) {
      return match;
    }
  }
  if (!target.startsWith(labelPrefix)) {
    return null;
  }
  const label = target.slice(labelPrefix.length);
  // 祖先の textContent も部分一致するため、観測の行に出る要素だけを候補にしないと
  // `label:振る` が main や section を返してしまう。
  return Array.from(document.querySelectorAll('body *'))
    .find(element => classifyElement(element) !== null && matchesLabel(element, label)) ?? null;
}
