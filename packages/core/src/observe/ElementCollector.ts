import { classifyElement } from './element/ElementClassifier';
import { getDisplayLabel } from './element/ElementLabel';
import type { ElementLine } from './element/ElementLine';
import type { ObserveOptions } from './ObserveOptions';
import { getTargetName } from './element/TargetName';
import { getVisibility } from './element/Visibility';

const sectionSelector = 'main,nav,aside,header,footer,section,article,dialog,form,'
  + '[role="region"],[role="dialog"],[role="tabpanel"]';

/** レイアウト用ラッパーを省き、文書順で意味のある行を集める。 */
export function collectElementLines(document: Document, scope: ObserveOptions['scope'] = 'visible'): ElementLine[] {
  const lines: ElementLine[] = [];
  for (const element of document.querySelectorAll('body *')) {
    const kind = classifyElement(element);
    if (kind === null) {
      continue;
    }
    const visibility = getVisibility(element);
    if (scope === 'visible' && (visibility.hidden || visibility.offscreen)) {
      continue;
    }
    lines.push({ element, kind, depth: getSectionDepth(element), target: getTargetName(element),
      label: getDisplayLabel(element), visibility });
  }
  return lines;
}

function getSectionDepth(element: Element): number {
  let depth = 0;
  for (let ancestor = element.parentElement; ancestor; ancestor = ancestor.parentElement) {
    if (ancestor.matches(sectionSelector)) {
      depth += 1;
    }
  }
  return depth;
}
