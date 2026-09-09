import type { ConsoleMessage, Page, Request } from 'playwright';

const MAXIMUM_ENTRIES = 10000;
const DEFAULT_LOG_COUNT = 40;

/** ブラウザの診断イベントを観測とは独立して保持する。 */
export class ConsoleRecorder {
  private entries: { level: string; text: string; timestamp: string }[] = [];
  private exceptionCount = 0;

  /** noException の比較用累積件数。 */
  get errorCount(): number { return this.exceptionCount; }

  /** ページの寿命に合わせて解除可能な購読を作る。 */
  attach(page: Page): () => void {
    const consoleListener = (message: ConsoleMessage): void => {
      this.append(message.type(), message.text());
      if (message.type() === 'error') { this.exceptionCount += 1; }
    };
    const errorListener = (exception: Error): void => {
      this.exceptionCount += 1;
      this.append('error', exception.stack ?? exception.message);
    };
    const failureListener = (request: Request): void => {
      this.append('error', `${request.method()} ${request.url()} ${request.failure()?.errorText ?? 'requestfailed'}`);
    };
    page.on('console', consoleListener);
    page.on('pageerror', errorListener);
    page.on('requestfailed', failureListener);
    return () => {
      page.off('console', consoleListener);
      page.off('pageerror', errorListener);
      page.off('requestfailed', failureListener);
    };
  }

  /** 最後の指定件数を時系列のテキストにする。 */
  logs(count = DEFAULT_LOG_COUNT, level: 'all' | 'error' = 'all'): string {
    const matching = this.entries.filter(entry => level === 'all' || entry.level === 'error');
    return matching.slice(-Math.floor(count)).filter(() => count > 0)
      .map(entry => `${entry.timestamp} [${entry.level}] ${entry.text}`).join('\n');
  }

  private append(level: string, text: string): void {
    this.entries.push({ level, text, timestamp: new Date().toISOString() });
    if (this.entries.length > MAXIMUM_ENTRIES) { this.entries.shift(); }
  }
}
