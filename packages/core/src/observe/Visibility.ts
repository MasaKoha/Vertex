const centerDivisor = 2;

/** 観測行に必要な可視性と遮蔽の情報。 */
export interface ElementVisibility {
  /** 自身または祖先が非表示か、描画面積がない。 */
  hidden: boolean;
  /** 矩形がビューポートと交差しない。 */
  offscreen: boolean;
  /** 中心点を覆う要素。遮蔽がなければ null。 */
  blocker: Element | null;
}

/** 祖先による非表示も含めて判定する。 */
export function isElementHidden(element: Element): boolean {
  const view = element.ownerDocument.defaultView;
  for (let current: Element | null = element; current; current = current.parentElement) {
    const style = view?.getComputedStyle(current);
    if (current.getAttribute('aria-hidden') === 'true' || current.hasAttribute('hidden')
      || current.matches('input[type="hidden"]') || style?.display === 'none'
      || style?.visibility === 'hidden' || style?.visibility === 'collapse') {
      return true;
    }
  }
  const rectangle = element.getBoundingClientRect();
  return rectangle.width <= 0 || rectangle.height <= 0;
}

/** ビューポート外と遮蔽を別々に扱い、遮蔽された行も観測に残す。 */
export function getVisibility(element: Element): ElementVisibility {
  const document = element.ownerDocument;
  const rectangle = element.getBoundingClientRect();
  const viewportWidth = document.defaultView?.innerWidth ?? document.documentElement.clientWidth;
  const viewportHeight = document.defaultView?.innerHeight ?? document.documentElement.clientHeight;
  const hidden = isElementHidden(element);
  const offscreen = !hidden && (rectangle.right <= 0 || rectangle.bottom <= 0
    || rectangle.left >= viewportWidth || rectangle.top >= viewportHeight);
  const centerHorizontal = rectangle.left + rectangle.width / centerDivisor;
  const centerVertical = rectangle.top + rectangle.height / centerDivisor;
  const centerInViewport = centerHorizontal >= 0 && centerHorizontal < viewportWidth
    && centerVertical >= 0 && centerVertical < viewportHeight;
  let blocker: Element | null = null;
  if (!hidden && !offscreen && centerInViewport && typeof document.elementFromPoint === 'function') {
    const hit = document.elementFromPoint(centerHorizontal, centerVertical);
    if (hit && !element.contains(hit)) {
      blocker = hit;
    }
  }
  return { hidden, offscreen, blocker };
}
