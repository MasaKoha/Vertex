import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { chromium, devices } from 'playwright';
import type { Browser, BrowserContext, Page } from 'playwright';
import type {} from '@vertex/core';
import { ConsoleRecorder } from './ConsoleRecorder.js';
import { SettleWaiter } from './SettleWaiter.js';
import { WaitDefaults } from './WaitDefaults.js';

const DESKTOP_VIEWPORT = { width: 1280, height: 800 };

/** Chromium と注入済みページの寿命を所有する。 */
export class BrowserSession {
  private browser: Browser | undefined;
  private context: BrowserContext | undefined;
  private activePage: Page | undefined;
  private readonly pageListeners = new Set<(page: Page) => () => void>();
  private readonly cleanups = new Map<Page, (() => void)[]>();
  private readonly waiters = new Map<Page, SettleWaiter>();
  private currentViewport: 'desktop' | 'mobile' = 'desktop';
  private currentUrl = 'about:blank';
  private headed = false;
  private generation = 0;
  private readonly started = Date.now();
  /** 観測によって消えないログ。 */
  readonly console = new ConsoleRecorder();

  /** 使用中のページ。終了済みなら明示的に失敗する。 */
  get page(): Page {
    if (!this.activePage || this.activePage.isClosed()) { throw new Error('ブラウザが閉じています。session.begin を実行してください'); }
    return this.activePage;
  }
  /** 現在の画面プロファイル。 */
  get viewport(): 'desktop' | 'mobile' { return this.currentViewport; }
  /** 起動からの経過時間。 */
  get uptimeMilliseconds(): number { return Date.now() - this.started; }
  /** ページの静止待ちを取得する。 */
  get settleWaiter(): SettleWaiter {
    const waiter = this.waiters.get(this.page);
    if (!waiter) { throw new Error('ページの追跡が未初期化です'); }
    return waiter;
  }

  /** 各ページで例外等を購読し、解除関数を返す。 */
  onPage(listener: (page: Page) => () => void): () => void {
    const disposers = new Set<() => void>();
    const tracked = (page: Page): (() => void) => {
      const unsubscribe = listener(page);
      const dispose = (): void => {
        unsubscribe();
        disposers.delete(dispose);
      };
      disposers.add(dispose);
      return dispose;
    };
    for (const [page, cleanups] of this.cleanups) { cleanups.push(tracked(page)); }
    this.pageListeners.add(tracked);
    return () => {
      this.pageListeners.delete(tracked);
      for (const dispose of disposers) { dispose(); }
      disposers.clear();
    };
  }

  /** viewport 変更時はタッチと UA も含め context を作り直す。 */
  async open(options: { url?: string; viewport?: 'desktop' | 'mobile'; headed?: boolean } = {}): Promise<void> {
    const url = options.url ?? this.activePage?.url() ?? this.currentUrl;
    this.currentUrl = url;
    this.currentViewport = options.viewport ?? this.currentViewport;
    this.headed = options.headed ?? this.headed;
    await this.close();
    const generation = this.generation;
    const browser = await chromium.launch({ headless: !this.headed });
    if (generation !== this.generation) {
      await browser.close();
      throw new Error('ブラウザの起動が中断されました');
    }
    this.browser = browser;
    try {
      const device = this.currentViewport === 'mobile' ? devices['iPhone 13'] : { viewport: DESKTOP_VIEWPORT };
      if (!device) { throw new Error('iPhone 13 プロファイルが見つかりません'); }
      this.context = await this.browser.newContext({ ...device });
      const require = createRequire(import.meta.url);
      const injectionPath = resolve(dirname(require.resolve('@vertex/core')), '../dist/vertex-inject.js');
      // popup の最初のスクリプトより先に注入するため context にも設定する。
      await this.context.addInitScript({ path: injectionPath });
      this.context.on('page', page => this.track(page));
      const page = await this.context.newPage();
      await page.addInitScript({ path: injectionPath });
      await page.goto(url, { waitUntil: 'domcontentloaded' });
    } catch (exception) {
      await this.close();
      throw exception;
    }
  }

  /** 全ページと Chromium を終了する。 */
  async close(): Promise<void> {
    this.generation += 1;
    const browser = this.browser;
    this.browser = undefined;
    this.activePage = undefined;
    this.context = undefined;
    for (const disposers of this.cleanups.values()) {
      for (const dispose of disposers) { dispose(); }
    }
    this.cleanups.clear();
    this.waiters.clear();
    await browser?.close();
  }

  private track(page: Page): void {
    this.activePage = page;
    page.setDefaultTimeout(WaitDefaults.readyTimeoutMilliseconds);
    const waiter = new SettleWaiter(page);
    this.waiters.set(page, waiter);
    const disposers = [this.console.attach(page), () => waiter.dispose()];
    for (const listener of this.pageListeners) { disposers.push(listener(page)); }
    this.cleanups.set(page, disposers);
    page.once('close', () => {
      for (const dispose of disposers) { dispose(); }
      this.cleanups.delete(page);
      this.waiters.delete(page);
      if (this.activePage === page) { this.activePage = this.context?.pages().at(-1); }
    });
  }
}
