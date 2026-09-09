import { setTimeout as delay } from 'node:timers/promises';
import type { Page, Request } from 'playwright';
import { WaitDefaults } from './WaitDefaults.js';

/** DOM・アニメーション・通信が連続して停止するまで待つ。 */
export class SettleWaiter {
  private readonly requests = new Set<Request>();
  private lastNetworkActivity = Date.now();
  private readonly onRequest = (request: Request): void => {
    this.requests.add(request);
    this.lastNetworkActivity = Date.now();
  };
  private readonly onFinished = (request: Request): void => {
    this.requests.delete(request);
    this.lastNetworkActivity = Date.now();
  };

  /** 操作前の通信も追跡するためページ生成時に購読する。 */
  constructor(private readonly page: Page) {
    page.on('request', this.onRequest);
    page.on('requestfinished', this.onFinished);
    page.on('requestfailed', this.onFinished);
  }

  /** 上限到達は失敗ではなく settled=false として返す。 */
  async wait(quietMilliseconds: number, timeoutMilliseconds: number): Promise<{ settled: boolean; waitedMs: number }> {
    const started = Date.now();
    const deadline = started + timeoutMilliseconds;
    while (Date.now() < deadline) {
      try {
        const settled = await this.waitDocument(quietMilliseconds, deadline);
        return { settled, waitedMs: Date.now() - started };
      } catch (exception) {
        if (this.page.isClosed()) { throw exception; }
        // リダイレクトで旧 Document が消えた場合は、新しい Document で静止を測り直す。
        if (!String(exception).includes('Execution context was destroyed')) { throw exception; }
      }
    }
    return { settled: false, waitedMs: Date.now() - started };
  }

  /** ページ購読を解除する。 */
  dispose(): void {
    this.page.off('request', this.onRequest);
    this.page.off('requestfinished', this.onFinished);
    this.page.off('requestfailed', this.onFinished);
    this.requests.clear();
  }

  private async waitDocument(quietMilliseconds: number, deadline: number): Promise<boolean> {
    const tracker = await this.page.evaluateHandle(() => {
      const state = { lastActivity: performance.now(), observer: new MutationObserver(() => { state.lastActivity = performance.now(); }) };
      state.observer.observe(document, { subtree: true, childList: true, attributes: true, characterData: true });
      return state;
    });
    try {
      while (Date.now() < deadline) {
        const quiet = await tracker.evaluate(state => {
          if (document.getAnimations().some(animation => animation.playState === 'running' || animation.pending)) {
            state.lastActivity = performance.now();
          }
          return performance.now() - state.lastActivity;
        });
        const networkQuiet = this.requests.size === 0 && Date.now() - this.lastNetworkActivity >= quietMilliseconds;
        if (quiet >= quietMilliseconds && networkQuiet) { return true; }
        await delay(Math.min(WaitDefaults.pollMilliseconds, Math.max(0, deadline - Date.now())));
      }
      return false;
    } finally {
      await tracker.evaluate(state => state.observer.disconnect()).catch(() => undefined);
      await tracker.dispose();
    }
  }
}
