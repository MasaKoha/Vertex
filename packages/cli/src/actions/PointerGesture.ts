import { setTimeout as delay } from 'node:timers/promises';
import type { Page } from 'playwright';
import { ReadyWaiter } from '../browser/ReadyWaiter.js';
import { WaitDefaults } from '../browser/WaitDefaults.js';
import { CommandArguments } from '../dispatch/CommandArguments.js';
import { ActionCommand } from './ActionCommand.js';
import { ActionExecutionError } from './ActionExecutionError.js';

const GESTURE_SEGMENTS = 12;
const SWIPE_DISTANCE_RATIO = 0.35;

/** ドラッグと実タッチの移動経路を再生する。 */
export class PointerGesture {
  /** 要素名と座標を同じ経路へ解決する。 */
  async execute(page: Page, action: ActionCommand, timeoutMilliseconds: number): Promise<{ ready: boolean; waitedMs: number }> {
    const started = Date.now();
    const from = await this.point(page, action.values['from'], timeoutMilliseconds);
    const remainingMilliseconds = Math.max(1, timeoutMilliseconds - (Date.now() - started));
    const destination = action.values['to'];
    const to = typeof destination === 'string' && ['up', 'down', 'left', 'right'].includes(destination)
      ? this.direction(page, from, destination) : await this.point(page, destination, remainingMilliseconds);
    const waitedMs = Date.now() - started;
    const milliseconds = action.number('milliseconds', WaitDefaults.gestureMilliseconds);
    try {
      if (action.name === 'swipe') { await this.touch(page, from, to, milliseconds); }
      else { await this.drag(page, from, to, milliseconds); }
    } catch (exception) { throw new ActionExecutionError(String(exception), true, waitedMs); }
    return { ready: true, waitedMs };
  }

  private async drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, milliseconds: number): Promise<void> {
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    try { await this.move(from, to, milliseconds, point => page.mouse.move(point.x, point.y)); }
    finally { await page.mouse.up(); }
  }

  private async point(page: Page, value: unknown, timeoutMilliseconds: number): Promise<{ x: number; y: number }> {
    if (typeof value !== 'string') {
      const coordinates = CommandArguments.parse(value);
      return { x: coordinates.number('x', NaN), y: coordinates.number('y', NaN) };
    }
    const element = await new ReadyWaiter().resolve(page, value, timeoutMilliseconds);
    try {
      const rectangle = await element.boundingBox();
      if (!rectangle) { throw new Error(`座標を解決できません: ${value}`); }
      return { x: rectangle.x + rectangle.width / 2, y: rectangle.y + rectangle.height / 2 };
    } finally { await element.dispose(); }
  }

  private direction(page: Page, from: { x: number; y: number }, direction: string): { x: number; y: number } {
    const viewport = page.viewportSize();
    if (!viewport) { throw new Error('viewport がありません'); }
    const horizontal = viewport.width * SWIPE_DISTANCE_RATIO;
    const vertical = viewport.height * SWIPE_DISTANCE_RATIO;
    const offsets: Record<string, { x: number; y: number }> = {
      up: { x: 0, y: -vertical }, down: { x: 0, y: vertical }, left: { x: -horizontal, y: 0 }, right: { x: horizontal, y: 0 },
    };
    const offset = offsets[direction]!;
    return { x: Math.max(0, Math.min(viewport.width - 1, from.x + offset.x)), y: Math.max(0, Math.min(viewport.height - 1, from.y + offset.y)) };
  }

  private async touch(page: Page, from: { x: number; y: number }, to: { x: number; y: number }, milliseconds: number): Promise<void> {
    const protocol = await page.context().newCDPSession(page);
    try {
      await protocol.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [from] });
      await this.move(from, to, milliseconds, point => protocol.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point] }));
    } finally {
      await protocol.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }).catch(() => undefined);
      await protocol.detach();
    }
  }

  private async move(from: { x: number; y: number }, to: { x: number; y: number }, milliseconds: number, send: (point: { x: number; y: number }) => Promise<unknown>): Promise<void> {
    for (let index = 1; index <= GESTURE_SEGMENTS; index += 1) {
      const progress = index / GESTURE_SEGMENTS;
      await send({ x: from.x + (to.x - from.x) * progress, y: from.y + (to.y - from.y) * progress });
      await delay(milliseconds / GESTURE_SEGMENTS);
    }
  }
}
