import { isElementDisabled } from '../observe/element/ElementAttributes';
import { classifyElement } from '../observe/element/ElementClassifier';
import { getTargetName } from '../observe/element/TargetName';
import { isElementHidden } from '../observe/element/Visibility';
import type { AuditFinding } from './AuditFinding';

const minimumTapSize = 44;
const interactiveSelector = 'button,a[href],input:not([type="hidden"]),textarea,select,'
  + '[role="button"],[role="checkbox"],[role="radio"],[role="switch"],[role="slider"],'
  + '[role="tab"],[role="menuitem"],[role="option"]';

/** 画面外も含む表示中のページを、設計書の四つの基準で監査する。 */
export function audit(document: Document): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const scrollingElement = document.scrollingElement ?? document.documentElement;
  if (scrollingElement.scrollWidth > scrollingElement.clientWidth) {
    findings.push({ kind: 'horizontalScroll', target: getTargetName(scrollingElement),
      detail: `scrollWidth=${scrollingElement.scrollWidth} clientWidth=${scrollingElement.clientWidth}` });
  }
  const visibleElements = Array.from(document.querySelectorAll('body *')).filter(element => !isElementHidden(element));
  const interactiveElements = visibleElements.filter(element => element.matches(interactiveSelector)
    && !isElementDisabled(element));
  for (const element of interactiveElements) {
    const rectangle = element.getBoundingClientRect();
    if (rectangle.width < minimumTapSize || rectangle.height < minimumTapSize) {
      findings.push({ kind: 'smallTapTarget', target: getTargetName(element),
        detail: `width=${rectangle.width} height=${rectangle.height} minimum=${minimumTapSize}` });
    }
  }
  findings.push(...findSiblingOverlaps(interactiveElements));
  for (const element of visibleElements) {
    if (isTextElement(element) && element.scrollWidth > element.clientWidth) {
      findings.push({ kind: 'textOverflow', target: getTargetName(element),
        detail: `scrollWidth=${element.scrollWidth} clientWidth=${element.clientWidth}` });
    }
  }
  return findings;
}

function isTextElement(element: Element): boolean {
  if (element.matches('script,style,template')) {
    return false;
  }
  const kind = classifyElement(element);
  const hasOwnText = Array.from(element.childNodes)
    .some(node => node.nodeType === node.TEXT_NODE && Boolean(node.textContent?.trim()));
  return (hasOwnText || kind === 'Text' || kind === 'Heading' || kind === 'Alert' || kind === 'Button' || kind === 'Link')
    && Boolean(element.textContent?.trim());
}

function findSiblingOverlaps(elements: readonly Element[]): AuditFinding[] {
  const findings: AuditFinding[] = [];
  const previousSiblings = new Map<Element, Element[]>();
  for (const element of elements) {
    const parent = element.parentElement;
    if (!parent) {
      continue;
    }
    const siblings = previousSiblings.get(parent) ?? [];
    findings.push(...findOverlaps(element, siblings));
    siblings.push(element);
    previousSiblings.set(parent, siblings);
  }
  return findings;
}

function findOverlaps(element: Element, siblings: readonly Element[]): AuditFinding[] {
  const rectangle = element.getBoundingClientRect();
  const findings: AuditFinding[] = [];
  for (const sibling of siblings) {
    const siblingRectangle = sibling.getBoundingClientRect();
    const width = Math.min(rectangle.right, siblingRectangle.right) - Math.max(rectangle.left, siblingRectangle.left);
    const height = Math.min(rectangle.bottom, siblingRectangle.bottom) - Math.max(rectangle.top, siblingRectangle.top);
    if (width > 0 && height > 0) {
      findings.push({ kind: 'overlap', target: getTargetName(sibling),
        detail: `with=${getTargetName(element)} width=${width} height=${height}` });
    }
  }
  return findings;
}
