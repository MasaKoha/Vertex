import { getElementLabel } from './ElementLabel';

/** 観測と解決で共有する識別属性の優先順。 */
export const targetAttributes = ['data-testid', 'id', 'name'] as const;

/** 明示的な指定名を優先し、なければラベル指定へ退避する。 */
export function getTargetName(element: Element): string {
  for (const attribute of targetAttributes) {
    const value = element.getAttribute(attribute);
    if (value) {
      return value;
    }
  }
  return `label:${getElementLabel(element)}`;
}
