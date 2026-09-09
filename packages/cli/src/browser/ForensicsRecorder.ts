import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Page } from 'playwright';
import { DebugOutputLayout } from '../artifacts/DebugOutputLayout.js';
import { BrowserSession } from './BrowserSession.js';

/** 未処理例外ごとに診断資料を直列保存する。 */
export class ForensicsRecorder {
  private pending: Promise<void> = Promise.resolve();
  private latestPath: string | undefined;
  private readonly unsubscribe: () => void;
  private failure: string | undefined;

  /** popup を含む全ページの例外を購読する。 */
  constructor(session: BrowserSession, private readonly layout: DebugOutputLayout) {
    this.unsubscribe = session.onPage(page => {
      const listener = (exception: Error): void => {
        this.pending = this.pending.then(() => this.save(page, exception)).catch(error => { this.failure = String(error); });
      };
      page.on('pageerror', listener);
      return () => { page.off('pageerror', listener); };
    });
  }

  /** 書き込み完了後の最新パスを返す。 */
  async latest(): Promise<{ path?: string; message?: string }> {
    await this.pending;
    return { ...(this.latestPath === undefined ? {} : { path: this.latestPath }), ...(this.failure === undefined ? {} : { message: this.failure }) };
  }

  /** 終了前に保存を完了させる。 */
  async flush(): Promise<void> { await this.pending; }
  /** 購読と保存を終了する。 */
  async dispose(): Promise<void> { this.unsubscribe(); await this.flush(); }

  private async save(page: Page, exception: Error): Promise<void> {
    const directory = this.layout.forensics();
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'exception.txt'), exception.stack ?? exception.message, 'utf8');
    const results = await Promise.allSettled([
      page.screenshot({ path: join(directory, 'capture.png'), type: 'png' }),
      page.evaluate(() => window.__vertex!.observe()).then(text => writeFile(join(directory, 'observation.txt'), text, 'utf8')),
    ]);
    const failures = results.filter(result => result.status === 'rejected').map(result => String(result.reason));
    if (failures.length > 0) { await writeFile(join(directory, 'save-errors.txt'), failures.join('\n'), 'utf8'); }
    this.latestPath = directory;
  }
}
