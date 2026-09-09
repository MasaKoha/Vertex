import { escapeLine, formatElementAttributes } from './ElementAttributes';
import type { ElementLine } from './ElementLine';

const indentation = '  ';

/** 観測と検索の語彙および属性順を統一する。 */
export function formatElementLine(line: ElementLine): string {
  const columns = [`[${line.kind}]`, escapeLine(line.target)];
  if (line.label) {
    columns.push(`「${line.label}」`);
  }
  columns.push(...formatElementAttributes(line.element, line.visibility));
  return indentation.repeat(line.depth) + columns.join(' ');
}
