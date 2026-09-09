import { setTimeout as delay } from 'node:timers/promises';
import type { ElementHandle, Page } from 'playwright';
import { WaitDefaults } from './WaitDefaults.js';

/** core の解決結果が操作可能になるまで再取得する。 */
export class ReadyWaiter {
  /** 戻り値の handle は呼び出し側で必ず破棄する。 */
  async resolve(page: Page, target: string | undefined, timeoutMilliseconds: number, scrollIntoView = false): Promise<ElementHandle<Element>> {
    const deadline = Date.now() + timeoutMilliseconds;
    do {
      const element = await this.tryResolve(page, target, scrollIntoView);
      if (element) { return element; }
      await delay(Math.min(WaitDefaults.pollMilliseconds, Math.max(0, deadline - Date.now())));
    } while (Date.now() < deadline);
    throw new Error(`準備待ちがタイムアウトしました: ${target ?? 'フォーカス中の要素'}`);
  }

  private async tryResolve(page: Page, target: string | undefined, scrollIntoView: boolean): Promise<ElementHandle<Element> | null> {
    const handle = await page.evaluateHandle(name => name === undefined ? document.activeElement : window.__vertex!.resolve(name), target);
    let transferred = false;
    try {
      const element = handle.asElement() as ElementHandle<Element> | null;
      if (!element) { return null; }
      if (scrollIntoView) { await element.evaluate(candidate => candidate.scrollIntoView({ block: 'center', inline: 'center', behavior: 'instant' })); }
      if (!await this.isReady(element)) { return null; }
      transferred = true;
      return element;
    } finally {
      if (!transferred) { await handle.dispose(); }
    }
  }

  private async isReady(element: ElementHandle<Element>): Promise<boolean> {
    return element.evaluate(candidate => {
      const rectangle = candidate.getBoundingClientRect();
      const centerX = rectangle.left + rectangle.width / 2;
      const centerY = rectangle.top + rectangle.height / 2;
      const hit = document.elementFromPoint(centerX, centerY);
      let ancestor: Element | null = candidate;
      while (ancestor) {
        const style = getComputedStyle(ancestor);
        const hidden = ancestor.hasAttribute('hidden') || ancestor.hasAttribute('inert') || ancestor.getAttribute('aria-hidden') === 'true';
        if (hidden || style.display === 'none' || style.visibility === 'hidden' || style.visibility === 'collapse') { return false; }
        ancestor = ancestor.parentElement;
      }
      const enabled = !candidate.matches(':disabled') && candidate.getAttribute('aria-disabled') !== 'true';
      return candidate.isConnected && rectangle.width > 0 && rectangle.height > 0 && enabled && hit !== null && (hit === candidate || candidate.contains(hit));
    });
  }
}
