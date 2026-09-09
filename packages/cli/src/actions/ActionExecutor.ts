import type { ElementHandle } from 'playwright';
import { BrowserSession } from '../browser/BrowserSession.js';
import { ReadyWaiter } from '../browser/ReadyWaiter.js';
import { ActionCommand } from './ActionCommand.js';
import { PointerGesture } from './PointerGesture.js';
import { ActionExecutionError } from './ActionExecutionError.js';
import { CommandArguments } from '../dispatch/CommandArguments.js';

/** 行動語彙を core で解決した ElementHandle に対して実行する。 */
export class ActionExecutor {
  /** 対象ブラウザを受け取る。 */
  constructor(private readonly session: BrowserSession) {}

  /** 準備時間と実行を分離して計測する。 */
  async execute(action: ActionCommand, timeoutMilliseconds: number): Promise<{ ready: boolean; waitedMs: number }> {
    const target = action.target();
    const needsElement = target !== undefined || ['text', 'type', 'select', 'set'].includes(action.name);
    if (!needsElement) {
      if (action.name === 'drag' || action.name === 'swipe') {
        if (action.name === 'swipe' && this.session.viewport !== 'mobile') { throw new Error('swipe は mobile viewport が必要です'); }
        return new PointerGesture().execute(this.session.page, action, timeoutMilliseconds);
      }
      try { await this.executePage(action, timeoutMilliseconds); }
      catch (exception) { throw new ActionExecutionError(String(exception), true, 0); }
      return { ready: true, waitedMs: 0 };
    }
    const started = Date.now();
    const element = await new ReadyWaiter().resolve(this.session.page, target, timeoutMilliseconds, action.name === 'scrollTo');
    const waitedMs = Date.now() - started;
    try { await this.executeElement(element, action, timeoutMilliseconds); }
    catch (exception) { throw new ActionExecutionError(String(exception), true, waitedMs); }
    finally { await element.dispose(); }
    return { ready: true, waitedMs };
  }

  private async executeElement(element: ElementHandle<Element>, action: ActionCommand, timeout: number): Promise<void> {
    switch (action.name) {
      case 'click': await element.click({ timeout }); return;
      case 'tap':
        if (this.session.viewport === 'mobile') { await element.tap({ timeout }); }
        else { await element.click({ timeout }); }
        return;
      case 'doubleClick': await element.dblclick({ timeout }); return;
      case 'rightClick': await element.click({ button: 'right', timeout }); return;
      case 'hover': await element.hover({ timeout }); return;
      case 'text': await element.fill(action.string('text'), { timeout }); return;
      case 'type': await element.type(action.string('type'), { timeout }); return;
      case 'focus': await element.focus(); return;
      case 'scrollTo': await element.scrollIntoViewIfNeeded({ timeout }); return;
      case 'select': await element.selectOption({ label: action.string('item') }, { timeout }); return;
      case 'set': await this.setValue(element, action, timeout); return;
      case 'scroll':
        await element.hover({ timeout });
        await this.session.page.mouse.wheel(action.number('deltaX', 0, -Infinity), action.number('deltaY', 0, -Infinity));
        return;
      case 'key': await element.press(action.string('key'), { timeout }); return;
      default: throw new Error(`${action.name} は target を受け付けません`);
    }
  }

  private async executePage(action: ActionCommand, timeout: number): Promise<void> {
    const page = this.session.page;
    switch (action.name) {
      case 'pointer': case 'hover': {
        const value = action.values[action.name];
        const coordinates = typeof value === 'object' ? CommandArguments.parse(value) : action;
        const position = { x: coordinates.number('x', NaN), y: coordinates.number('y', NaN) };
        if (action.name === 'pointer') { await page.mouse.click(position.x, position.y); }
        else { await page.mouse.move(position.x, position.y); }
        return;
      }
      case 'key': await page.keyboard.press(action.string('key')); return;
      case 'scroll': await page.mouse.wheel(action.number('deltaX', 0, -Infinity), action.number('deltaY', 0, -Infinity)); return;
      case 'navigate': {
        const destination = typeof action.values['navigate'] === 'string' ? action.string('navigate') : action.string('url');
        await page.goto(new URL(destination, page.url()).href, { timeout, waitUntil: 'domcontentloaded' });
        return;
      }
      case 'back': await page.goBack({ timeout, waitUntil: 'domcontentloaded' }); return;
      case 'reason': return;
      default: throw new Error(`${action.name} の対象がありません`);
    }
  }

  private async setValue(element: ElementHandle<Element>, action: ActionCommand, timeout: number): Promise<void> {
    const value = action.values['value'];
    const nativeCheckbox = await element.evaluate(candidate => candidate instanceof HTMLInputElement && ['checkbox', 'radio'].includes(candidate.type));
    if (nativeCheckbox) {
      if (typeof value !== 'boolean') { throw new Error('checkbox / radio の value は真偽値です'); }
      const clearRadio = !value && await element.evaluate(candidate => candidate instanceof HTMLInputElement && candidate.type === 'radio');
      if (clearRadio) {
        await element.evaluate(candidate => {
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'checked')!.set!;
          setter.call(candidate, false);
          candidate.dispatchEvent(new Event('input', { bubbles: true }));
          candidate.dispatchEvent(new Event('change', { bubbles: true }));
        });
        return;
      }
      await element.setChecked(value, { timeout });
      return;
    }
    const role = await element.getAttribute('role');
    if (role === 'switch' || role === 'checkbox' || role === 'radio') {
      if (typeof value !== 'boolean') { throw new Error('switch の value は真偽値です'); }
      if ((await element.getAttribute('aria-checked') === 'true') !== value) { await element.click({ timeout }); }
      return;
    }
    if (typeof value !== 'number' && typeof value !== 'string') { throw new Error('range の value は数値または文字列です'); }
    if (String(value).trim() === '' || !Number.isFinite(Number(value))) { throw new Error('range の value は有限数が必要です'); }
    await element.evaluate((candidate, nextValue) => {
      if (!(candidate instanceof HTMLInputElement) || candidate.type !== 'range') { throw new Error('set の対象は checkbox / radio / range / switch です'); }
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
      setter.call(candidate, String(nextValue));
      candidate.dispatchEvent(new Event('input', { bubbles: true }));
      candidate.dispatchEvent(new Event('change', { bubbles: true }));
    }, value);
  }
}
