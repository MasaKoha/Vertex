import type { ElementKind } from './ElementKind';

const roleKinds: ReadonlyMap<string, ElementKind> = new Map([
  ['button', 'Button'], ['checkbox', 'Checkbox'], ['radio', 'Radio'], ['switch', 'Checkbox'],
  ['slider', 'Input'], ['tab', 'Button'], ['menuitem', 'Button'], ['option', 'Select'],
  ['alert', 'Alert'], ['status', 'Alert'],
]);
const buttonInputTypes = new Set(['button', 'submit', 'reset', 'image']);

/** 設計書の列挙対象だけに行種別を割り当てる。 */
export function classifyElement(element: Element): ElementKind | null {
  const roleKind = roleKinds.get(element.getAttribute('role') ?? '');
  if (roleKind) {
    return roleKind;
  }
  if (element.matches('input')) {
    return classifyInput(element.getAttribute('type')?.toLowerCase() ?? 'text');
  }
  if (element.matches('button')) { return 'Button'; }
  if (element.matches('a[href]')) { return 'Link'; }
  if (element.matches('textarea')) { return 'Input'; }
  if (element.matches('select')) { return 'Select'; }
  if (element.matches('h1,h2,h3,h4,h5,h6')) { return 'Heading'; }
  if (element.matches('img[alt]')) { return 'Image'; }
  if (element.matches('label,[data-testid]')) { return 'Text'; }
  if (element.matches('p,li') && element.textContent?.trim()) { return 'Text'; }
  return null;
}

function classifyInput(inputType: string): ElementKind {
  if (buttonInputTypes.has(inputType)) { return 'Button'; }
  if (inputType === 'checkbox') { return 'Checkbox'; }
  if (inputType === 'radio') { return 'Radio'; }
  return 'Input';
}
