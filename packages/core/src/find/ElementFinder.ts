import { collectElementLines } from '../observe/ElementCollector';
import { matchesLabel } from '../observe/element/ElementLabel';
import { formatElementLine } from '../observe/LineFormatter';
import type { FindQuery } from './FindQuery';

/** 観測と同じ行形式に推奨指定を添えて検索結果を返す。 */
export function find(document: Document, query: FindQuery): string {
  return collectElementLines(document, query.scope)
    .filter(line => (!query.kind || line.kind === query.kind) && matchesLabel(line.element, query.label))
    .map(line => `${formatElementLine(line)} → click:${JSON.stringify(line.target)}`)
    .join('\n');
}
