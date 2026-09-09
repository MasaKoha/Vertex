import { classifyElement } from '../observe/ElementClassifier';
import { interactiveKinds } from '../observe/ElementKind';
import { matchesLabel, matchesLabelExactly } from '../observe/ElementLabel';
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
  const candidates = Array.from(document.querySelectorAll('body *'))
    .filter(element => classifyElement(element) !== null);
  // 「振る」は見出し「ダイスを振る」にも部分一致する。完全一致と操作可能な種別を先に選ばないと
  // 押せない見出しを掴んでクリックが無反応になる。
  return preferInteractive(candidates.filter(element => matchesLabelExactly(element, label)))
    ?? preferInteractive(candidates.filter(element => matchesLabel(element, label)))
    ?? null;
}

function preferInteractive(candidates: Element[]): Element | null {
  const interactive = candidates.find(element => interactiveKinds.includes(classifyElement(element)!));
  return interactive ?? candidates[0] ?? null;
}
