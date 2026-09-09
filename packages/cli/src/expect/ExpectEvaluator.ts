import type { Page } from 'playwright';
import { CommandArguments } from '../dispatch/CommandArguments.js';

/** 操作前後の証拠から設計書の事後条件を判定する。 */
export class ExpectEvaluator {
  /** 空配列は成功、不明な条件は未達として返す。 */
  async evaluate(page: Page, conditions: unknown[], evidence: { text: string; difference: string; errorsBefore: number; errorsAfter: number }): Promise<{ expectOk: boolean; expectFailures: string[] }> {
    const expectFailures: string[] = [];
    for (const condition of conditions) {
      try {
        const parameters = CommandArguments.parse(condition);
        if (!await this.matches(page, parameters, evidence)) { expectFailures.push(JSON.stringify(condition)); }
      } catch (exception) { expectFailures.push(`${JSON.stringify(condition)}: ${String(exception)}`); }
    }
    return { expectOk: expectFailures.length === 0, expectFailures };
  }

  private async matches(page: Page, condition: CommandArguments, evidence: { text: string; difference: string; errorsBefore: number; errorsAfter: number }): Promise<boolean> {
    const kind = condition.string('kind');
    switch (kind) {
      case 'textVisible': return evidence.text.includes(condition.string('value'));
      case 'textAbsent': return !evidence.text.includes(condition.string('value'));
      case 'urlIs': return page.url() === condition.string('value');
      case 'urlContains': return page.url().includes(condition.string('value'));
      case 'changed': return evidence.difference.split('\n').some(line => /^[+~-] /.test(line) && line.includes(condition.string('target')));
      case 'noException': return evidence.errorsBefore === evidence.errorsAfter;
      case 'auditClean': return (await page.evaluate(() => window.__vertex!.audit())).length === 0;
      case 'state': return this.stateMatches(condition, evidence.text);
      default: return this.elementMatches(page, kind, condition.string('target'));
    }
  }

  private async elementMatches(page: Page, kind: string, target: string): Promise<boolean> {
    return page.evaluate(({ kind, target }) => {
      const element = window.__vertex!.resolve(target);
      if (kind === 'exists') { return element !== null; }
      if (kind === 'absent') { return element === null; }
      if (!['enabled', 'disabled', 'focused', 'checked', 'unchecked'].includes(kind)) { throw new Error(`不明な expect kind: ${kind}`); }
      if (!element) { return false; }
      const disabled = element.matches(':disabled') || element.getAttribute('aria-disabled') === 'true';
      if (kind === 'enabled') { return !disabled; }
      if (kind === 'disabled') { return disabled; }
      if (kind === 'focused') { return document.activeElement === element; }
      const checkable = element instanceof HTMLInputElement && ['checkbox', 'radio'].includes(element.type);
      const ariaCheckable = ['checkbox', 'radio', 'switch'].includes(element.getAttribute('role') ?? '');
      if (!checkable && !ariaCheckable) { return false; }
      const checked = checkable ? element.checked : element.getAttribute('aria-checked') === 'true';
      return kind === 'checked' ? checked : !checked;
    }, { kind, target });
  }

  private stateMatches(condition: CommandArguments, text: string): boolean {
    const lines = text.split('\n');
    const stateIndex = lines.indexOf('state:');
    if (stateIndex < 0) { return false; }
    const prefix = `  ${condition.string('key')}=`;
    const stateLines: string[] = [];
    for (const line of lines.slice(stateIndex + 1)) {
      if (!line.startsWith('  ')) { break; }
      stateLines.push(line);
    }
    const line = stateLines.find(candidate => candidate.startsWith(prefix));
    if (line === undefined) { return false; }
    const actual = line.slice(prefix.length);
    const expectedValue = condition.values['value'];
    if (expectedValue === undefined) { throw new Error('state の value が必要です'); }
    const expectedText = typeof expectedValue === 'object' && expectedValue !== null ? JSON.stringify(expectedValue) : String(expectedValue);
    const expected = expectedText.replace(/\r/gu, '\\r').replace(/\n/gu, '\\n');
    switch (condition.string('op', 'eq')) {
      case 'eq': return actual === expected;
      case 'ne': return actual !== expected;
      case 'contains': return actual.includes(expected);
      case 'lt': return this.compareNumbers(actual, expected, (left, right) => left < right);
      case 'le': return this.compareNumbers(actual, expected, (left, right) => left <= right);
      case 'gt': return this.compareNumbers(actual, expected, (left, right) => left > right);
      case 'ge': return this.compareNumbers(actual, expected, (left, right) => left >= right);
      default: throw new Error('不明な state 比較演算子です');
    }
  }

  private compareNumbers(actual: string, expected: string, compare: (left: number, right: number) => boolean): boolean {
    const left = Number(actual);
    const right = Number(expected);
    return actual.trim() !== '' && expected.trim() !== '' && Number.isFinite(left) && Number.isFinite(right) && compare(left, right);
  }
}
