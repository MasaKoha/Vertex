import { afterEach, beforeEach, vi } from 'vitest';

const defaultWidth = 100;
const defaultHeight = 50;
let rectangles = new WeakMap<Element, DOMRect>();

beforeEach(() => {
  document.head.innerHTML = '';
  document.body.innerHTML = '';
  rectangles = new WeakMap();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
    return rectangles.get(this) ?? new DOMRect(0, 0, defaultWidth, defaultHeight);
  });
  Object.defineProperty(document, 'elementFromPoint', { configurable: true, value: vi.fn(() => null) });
});

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, 'elementFromPoint');
});

/** jsdom が持たない描画結果をテストごとに指定する。 */
export function setRectangle(element: Element, left: number, top: number, width: number, height: number): void {
  rectangles.set(element, new DOMRect(left, top, width, height));
}

/** fixture の欠落をテストの準備段階で検出する。 */
export function requireElement<ElementType extends Element = HTMLElement>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (!element) {
    throw new Error(`fixture に要素がありません: ${selector}`);
  }
  return element;
}
