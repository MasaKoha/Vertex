import { describe, expect, it } from 'vitest';
import { requireElement, setRectangle } from '../testing/DomGeometry.test-support';
import { audit } from './LayoutAuditor';

function setHorizontalDimensions(element: Element, scrollWidth: number, clientWidth: number): void {
  Object.defineProperties(element, {
    scrollWidth: { configurable: true, value: scrollWidth },
    clientWidth: { configurable: true, value: clientWidth },
  });
}

describe('audit', () => {
  it('横スクロールはページのスクロール要素を一件報告する', () => {
    const scrollingElement = document.documentElement;
    scrollingElement.id = 'page';
    setHorizontalDimensions(scrollingElement, 500, 390);
    try {
      expect(audit(document)).toEqual([{ kind: 'horizontalScroll', target: 'page', detail: 'scrollWidth=500 clientWidth=390' }]);
      setHorizontalDimensions(scrollingElement, 390, 390);
      expect(audit(document)).toEqual([]);
    } finally {
      scrollingElement.removeAttribute('id');
      Reflect.deleteProperty(scrollingElement, 'scrollWidth');
      Reflect.deleteProperty(scrollingElement, 'clientWidth');
    }
  });

  it.each([[43, 50, true], [50, 43, true], [44, 44, false], [100, 50, false]])
  ('タップ矩形 %sx%s の 44px 境界を判定する', (width, height, expected) => {
    document.body.innerHTML = '<button data-testid="tap">実行</button>';
    setRectangle(requireElement('button'), 0, 0, width, height);
    const findings = audit(document);
    expect(findings.some(finding => finding.kind === 'smallTapTarget')).toBe(expected);
    if (expected) {
      expect(findings).toEqual([{ kind: 'smallTapTarget', target: 'tap', detail: `width=${width} height=${height} minimum=44` }]);
    }
  });

  it('操作可能な兄弟の正の面積の交差だけを一組一件報告する', () => {
    document.body.innerHTML = '<button id="first">前</button><a id="second" href="/">後</a><p id="text">文字</p>';
    setRectangle(requireElement('#first'), 0, 0, 60, 60);
    setRectangle(requireElement('#second'), 30, 30, 60, 60);
    expect(audit(document)).toEqual([{ kind: 'overlap', target: 'first', detail: 'with=second width=30 height=30' }]);
    setRectangle(requireElement('#second'), 60, 0, 60, 60);
    expect(audit(document)).toEqual([]);
  });

  it('別の親に属する矩形の交差と親子の交差は対象外', () => {
    document.body.innerHTML = '<section><button>前</button></section><section><button>後</button></section>';
    expect(audit(document)).toEqual([]);
    document.body.innerHTML = '<div role="button"><button>子</button></div>';
    expect(audit(document)).toEqual([]);
  });

  it('hidden と disabled は操作対象の監査から除き、画面外は含める', () => {
    document.body.innerHTML = '<button hidden>非表示</button><button disabled>無効</button><button aria-disabled="true">無効</button><button id="outside">画面外</button>';
    for (const element of document.querySelectorAll('button')) {
      setRectangle(element, 0, window.innerHeight, 20, 20);
    }
    expect(audit(document)).toEqual([{ kind: 'smallTapTarget', target: 'outside', detail: 'width=20 height=20 minimum=44' }]);
  });

  it('文字要素の横はみ出しを検出し、空のコンテナーを除く', () => {
    document.body.innerHTML = '<p id="text">長い文章</p><h2 id="heading">見出し</h2><div id="layout"></div><p id="hidden" hidden>非表示</p>';
    for (const element of document.querySelectorAll('body *')) {
      setHorizontalDimensions(element, 200, 100);
    }
    expect(audit(document)).toEqual([
      { kind: 'textOverflow', target: 'text', detail: 'scrollWidth=200 clientWidth=100' },
      { kind: 'textOverflow', target: 'heading', detail: 'scrollWidth=200 clientWidth=100' },
    ]);
  });

  it('role 操作要素も監査する', () => {
    document.body.innerHTML = '<div role="slider" id="slider"></div>';
    setRectangle(requireElement('#slider'), 0, 0, 20, 100);
    expect(audit(document)[0]?.kind).toBe('smallTapTarget');
  });

  it('観測では省く span の直接の文字も、はみ出しを監査する', () => {
    document.body.innerHTML = '<div id="layout"><span id="text">長い文字</span></div>';
    setHorizontalDimensions(requireElement('#layout'), 200, 100);
    setHorizontalDimensions(requireElement('#text'), 200, 100);
    expect(audit(document)).toEqual([{ kind: 'textOverflow', target: 'text', detail: 'scrollWidth=200 clientWidth=100' }]);
  });
});
