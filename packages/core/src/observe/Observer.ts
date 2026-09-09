import { takeConsoleCounts } from '../console/ConsoleCounter';
import { formatStateValue } from '../state/StateFormatter';
import { readStates } from '../state/StateRegistry';
import { escapeLine } from './ElementAttributes';
import { collectElementLines } from './ElementCollector';
import { formatElementLine } from './LineFormatter';
import type { ObservationContext } from './ObservationContext';
import { formatObservationDiff } from './ObservationDiff';
import type { ObservationLine } from './ObservationLine';
import type { ObserveOptions } from './ObserveOptions';
import { getTargetName } from './TargetName';

const documentContexts = new WeakMap<Document, ObservationContext>();

/** ページ内の UI・状態・コンソール件数を一枚の観測にする。 */
export function observe(document: Document, options: ObserveOptions = {},
  context: ObservationContext = getDocumentContext(document)): string {
  const lines: ObservationLine[] = [{ identity: 'header', text: formatHeader(document) }];
  lines.push(...collectElementLines(document, options.scope)
    .map(line => ({ identity: line.element, text: formatElementLine(line) })));
  lines.push(...collectStateLines());
  const counts = takeConsoleCounts(document.defaultView?.console ?? console);
  lines.push({ identity: 'console', text: `console: errors=${counts.errors} warnings=${counts.warnings}` });
  const output = options.diffOnly && context.previousLines
    ? formatObservationDiff(context.previousLines, lines)
    : lines.map(line => line.text).join('\n');
  context.previousLines = lines;
  return output;
}

function getDocumentContext(document: Document): ObservationContext {
  const existing = documentContexts.get(document);
  if (existing) {
    return existing;
  }
  const context: ObservationContext = {};
  documentContexts.set(document, context);
  return context;
}

function formatHeader(document: Document): string {
  const view = document.defaultView;
  const focused = document.activeElement;
  const focus = focused && focused !== document.body && focused !== document.documentElement
    ? escapeLine(getTargetName(focused)) : 'none';
  const width = view?.innerWidth ?? document.documentElement.clientWidth;
  const height = view?.innerHeight ?? document.documentElement.clientHeight;
  return `url=${escapeLine(document.URL)} title=${JSON.stringify(document.title)} viewport=${width}x${height} focus=${focus}`;
}

function collectStateLines(): ObservationLine[] {
  const entries = Object.entries(readStates());
  if (entries.length === 0) {
    return [];
  }
  return [{ identity: 'state', text: 'state:' }, ...entries.map(([key, value]) => ({
    identity: `state:${key}`, text: `  ${escapeLine(key)}=${formatStateValue(value)}`,
  }))];
}
