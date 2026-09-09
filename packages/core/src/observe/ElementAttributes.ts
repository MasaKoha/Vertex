import { readElementValue } from './ElementLabel';
import { getTargetName } from './TargetName';
import type { ElementVisibility } from './Visibility';

/** 無効な fieldset に属する入力も操作対象から除くための判定。 */
export function isElementDisabled(element: Element): boolean {
  return element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true';
}

/** 属性の初期値ではなく現在の UI 状態を観測へ載せる。 */
export function formatElementAttributes(element: Element, visibility: ElementVisibility): string[] {
  const attributes: string[] = [];
  const value = readElementValue(element) ?? element.getAttribute('aria-valuenow');
  if (value !== null && (element.matches('input,textarea,select')
    || element.hasAttribute('value') || element.hasAttribute('aria-valuenow'))) {
    attributes.push(`value=${JSON.stringify(value)}`);
  }
  if (hasBooleanState(element, 'checked')) { attributes.push('checked'); }
  if (hasBooleanState(element, 'selected')) { attributes.push('selected'); }
  const href = element.getAttribute('href');
  if (href !== null) { attributes.push(`href=${escapeLine(href)}`); }
  if (isElementDisabled(element)) { attributes.push('!disabled'); }
  if (element.ownerDocument.activeElement === element) { attributes.push('*focused'); }
  if (visibility.offscreen) { attributes.push('[offscreen]'); }
  if (visibility.hidden) { attributes.push('[hidden]'); }
  if (visibility.blocker) { attributes.push(`blocked:${escapeLine(getTargetName(visibility.blocker))}`); }
  return attributes;
}

function hasBooleanState(element: Element, property: 'checked' | 'selected'): boolean {
  if (property in element && Reflect.get(element, property) === true) {
    return true;
  }
  return element.getAttribute(`aria-${property}`) === 'true';
}

/** 行区切りを値に含む場合も一要素一行を維持する。 */
export function escapeLine(value: string): string {
  return value.replace(/\r/gu, '\\r').replace(/\n/gu, '\\n');
}
