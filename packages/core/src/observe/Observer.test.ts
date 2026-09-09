import { afterEach, describe, expect, it, vi } from 'vitest';
import { installConsoleCounter } from '../console/ConsoleCounter';
import { readStates, registerState, unregisterState } from '../state/StateRegistry';
import { requireElement, setRectangle } from '../testing/DomGeometry.test-support';
import type { ObservationContext } from './ObservationContext';
import { observe } from './Observer';

afterEach(() => {
  Object.keys(readStates()).forEach(unregisterState);
});

describe('observe', () => {
  it('ヘッダー、指定名、表示文字、属性を設計書の順で整形する', () => {
    document.title = 'TRPG チュートリアル';
    document.body.innerHTML = `<h1>TRPG チュートリアル</h1><main><section><div><span>
      <input data-testid="dice-input" id="ignored" name="ignored" value="2d6">
      <button id="roll-button">振る</button><p>出目 3, 4 → 合計 7</p>
      <button name="install-button" disabled>ホーム画面に追加</button>
      <button>通知を受け取る</button><a href="/terms">利用規約</a>
      </span></div></section></main>`;
    requireElement('input').focus();
    expect(observe(document)).toBe([
      `url=${document.URL} title="TRPG チュートリアル" viewport=${window.innerWidth}x${window.innerHeight} focus=dice-input`,
      '[Heading] label:TRPG チュートリアル 「TRPG チュートリアル」',
      '    [Input] dice-input value="2d6" *focused',
      '    [Button] roll-button 「振る」',
      '    [Text] label:出目 3, 4 → 合計 7 「出目 3, 4 → 合計 7」',
      '    [Button] install-button 「ホーム画面に追加」 !disabled',
      '    [Button] label:通知を受け取る 「通知を受け取る」',
      '    [Link] label:利用規約 「利用規約」 href=/terms',
      'console: errors=0 warnings=0',
    ].join('\n'));
  });

  it.each(['main', 'nav', 'aside', 'header', 'footer', 'section', 'article', 'dialog open', 'form',
    'div role="region"', 'div role="dialog"', 'div role="tabpanel"'])('%s だけが深さを増やす', openingTag => {
    const tagName = openingTag.split(' ')[0];
    document.body.innerHTML = `<${openingTag}><div><span><button id="target">実行</button></span></div></${tagName}>`;
    expect(observe(document)).toContain('\n  [Button] target 「実行」\n');
  });

  it('value・checked・selected は変更後のプロパティと ARIA 状態を読む', () => {
    document.body.innerHTML = `<input id="text" value="old"><input id="check" type="checkbox" checked>
      <input id="radio" type="radio"><textarea id="area"></textarea>
      <select id="select"><option value="a">A</option><option value="b">B</option></select>
      <div role="option" id="option" aria-selected="true">候補</div>
      <div role="switch" id="switch" aria-checked="true" aria-disabled="true">切替</div>
      <div role="slider" id="slider" aria-valuenow="7"></div>`;
    requireElement<HTMLInputElement>('#text').value = 'new"\nline';
    requireElement<HTMLInputElement>('#check').checked = false;
    requireElement<HTMLInputElement>('#radio').checked = true;
    requireElement<HTMLTextAreaElement>('#area').value = '本文\n続き';
    requireElement<HTMLSelectElement>('#select').value = 'b';
    const observation = observe(document);
    expect(observation).toContain('[Input] text value="new\\\"line"');
    expect(observation).toContain('[Checkbox] check value="on"\n');
    expect(observation).toContain('[Radio] radio value="on" checked');
    expect(observation).toContain('[Input] area value="本文\\n続き"');
    expect(observation).toContain('[Select] select 「AB」 value="b"');
    expect(observation).toContain('[Select] option 「候補」 selected');
    expect(observation).toContain('[Checkbox] switch 「切替」 checked !disabled');
    expect(observation).toContain('[Input] slider value="7"');
  });

  it('visible は hidden と offscreen を省き、all は状態を付けて残す', () => {
    document.body.innerHTML = `<button id="visible">可視</button><button id="outside">画面外</button>
      <section style="display:none"><button id="hidden">非表示</button></section>`;
    setRectangle(requireElement('#outside'), window.innerWidth, 0, 100, 50);
    expect(observe(document)).toContain('[Button] visible');
    expect(observe(document)).not.toContain('[Button] outside');
    expect(observe(document)).not.toContain('[Button] hidden');
    const all = observe(document, { scope: 'all' });
    expect(all).toContain('[Button] outside 「画面外」 [offscreen]');
    expect(all).toContain('[Button] hidden 「非表示」 [hidden]');
  });

  it('遮蔽を表示し、focus はラベル指定にも対応する', () => {
    document.body.innerHTML = '<button>閉じる</button><div id="modal-backdrop"></div>';
    requireElement('button').focus();
    vi.mocked(document.elementFromPoint).mockReturnValue(requireElement('#modal-backdrop'));
    expect(observe(document)).toContain('focus=label:閉じる');
    expect(observe(document)).toContain('[Button] label:閉じる 「閉じる」 *focused blocked:modal-backdrop');
  });

  it('登録がなければ state 節を省き、値を観測時に読む', () => {
    expect(observe(document)).not.toContain('state:');
    let total = 7;
    registerState('dice.total', () => total);
    registerState('push.permission', () => 'default');
    registerState('nested', () => ({ rolls: [3, 4] }));
    expect(observe(document)).toContain('state:\n  dice.total=7\n  push.permission=default\n  nested={"rolls":[3,4]}');
    total = 9;
    expect(observe(document)).toContain('dice.total=9');
  });

  it('console の件数は観測ごとにリセットする', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const counter = installConsoleCounter();
    try {
      console.error('失敗');
      console.warn('警告');
      console.warn('警告');
      expect(observe(document)).toContain('console: errors=1 warnings=2');
      expect(observe(document)).toContain('console: errors=0 warnings=0');
    } finally {
      counter.dispose();
    }
  });

  it('初回は全行、以降は追加・削除・変更だけを返す', () => {
    const context: ObservationContext = {};
    document.body.innerHTML = '<button id="keep">前</button><p id="remove">消す</p>';
    const first = observe(document, { diffOnly: true }, context);
    expect(first.startsWith('url=')).toBe(true);
    expect(observe(document, { diffOnly: true }, context)).toBe('');
    requireElement('#keep').textContent = '後';
    requireElement('#remove').remove();
    document.body.insertAdjacentHTML('beforeend', '<p id="added">追加</p>');
    expect(observe(document, { diffOnly: true }, context)).toBe([
      '- [Text] remove 「消す」', '~ [Button] keep 「後」', '+ [Text] added 「追加」',
    ].join('\n'));
    expect(observe(document, { diffOnly: true }, context)).toBe('');
  });

  it('通常観測も比較基準となり、同名の要素や状態の変更を混同しない', () => {
    const context: ObservationContext = {};
    document.body.innerHTML = '<button id="same">実行</button><button id="same">実行</button>';
    registerState('total', () => 1);
    observe(document, {}, context);
    requireElement('button:last-child').textContent = '再実行';
    registerState('total', () => 2);
    expect(observe(document, { diffOnly: true }, context)).toBe('~ [Button] same 「再実行」\n~   total=2');
    unregisterState('total');
    expect(observe(document, { diffOnly: true }, context)).toBe('- state:\n-   total=2');
  });

  it('省略時の履歴は文書単位、明示した context は独立する', () => {
    observe(document);
    expect(observe(document, { diffOnly: true })).toBe('');
    expect(observe(document, { diffOnly: true }, {})).toMatch(/^url=/u);
    const otherDocument = document.implementation.createHTMLDocument('別');
    expect(observe(otherDocument, { diffOnly: true })).toMatch(/^url=/u);
  });

  it('native option の selected と fieldset 由来の disabled を反映する', () => {
    document.body.innerHTML = '<select><option data-testid="choice" selected>候補</option></select>'
      + '<fieldset disabled><input id="disabled-input"></fieldset>';
    expect(observe(document)).toContain('[Text] choice 「候補」 selected');
    expect(observe(document)).toContain('[Input] disabled-input value="" !disabled');
    requireElement<HTMLOptionElement>('option').selected = false;
    requireElement<HTMLSelectElement>('select').selectedIndex = -1;
    expect(observe(document)).not.toContain('「候補」 selected');
  });

  it('可視範囲の変化を追加・削除として扱う', () => {
    document.body.innerHTML = '<button id="target">対象</button>';
    const context: ObservationContext = {};
    observe(document, {}, context);
    setRectangle(requireElement('button'), 0, window.innerHeight, 100, 50);
    expect(observe(document, { diffOnly: true }, context)).toBe('- [Button] target 「対象」');
    expect(observe(document, { scope: 'all', diffOnly: true }, context))
      .toBe('+ [Button] target 「対象」 [offscreen]');
  });

  it('ヘッダーと console も差分比較し、カウンターのリセットも差分へ載せる', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const counter = installConsoleCounter();
    const context: ObservationContext = {};
    try {
      observe(document, {}, context);
      document.title = '更新';
      console.warn('警告');
      const difference = observe(document, { diffOnly: true }, context);
      expect(difference).toMatch(/^~ url=/u);
      expect(difference).toContain('title="更新"');
      expect(difference).toContain('~ console: errors=0 warnings=1');
      expect(observe(document, { diffOnly: true }, context)).toBe('~ console: errors=0 warnings=0');
    } finally {
      counter.dispose();
    }
  });
});
