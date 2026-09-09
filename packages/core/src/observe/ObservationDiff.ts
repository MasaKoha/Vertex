import type { ObservationLine } from './ObservationLine';

/** 行番号のずれを変更と誤認せず、同じ対象の文言だけを比較する。 */
export function formatObservationDiff(previous: readonly ObservationLine[], current: readonly ObservationLine[]): string {
  const previousByIdentity = new Map(previous.map(line => [line.identity, line.text]));
  const currentIdentities = new Set(current.map(line => line.identity));
  const differences = previous.filter(line => !currentIdentities.has(line.identity))
    .map(line => `- ${line.text}`);
  for (const line of current) {
    const previousText = previousByIdentity.get(line.identity);
    if (previousText === undefined) {
      differences.push(`+ ${line.text}`);
    } else if (previousText !== line.text) {
      differences.push(`~ ${line.text}`);
    }
  }
  return differences.join('\n');
}
