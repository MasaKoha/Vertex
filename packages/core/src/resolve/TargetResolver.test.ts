import { describe, expect, it } from 'vitest';
import { getTargetName } from '../observe/TargetName';
import { requireElement } from '../testing/DomGeometry.test-support';
import { resolve } from './TargetResolver';

describe('resolve と指定名', () => {
  it('data-testid → id → name の優先順で文書順より属性を優先する', () => {
    document.body.innerHTML = '<button name="target"></button><button id="target"></button><button data-testid="target"></button>';
    expect(resolve(document, 'target')).toBe(requireElement('[data-testid]'));
    requireElement('[data-testid]').remove();
    expect(resolve(document, 'target')).toBe(requireElement('[id]'));
    requireElement('[id]').remove();
    expect(resolve(document, 'target')).toBe(requireElement('[name]'));
  });

  it('同じ属性名は最初の要素を返す', () => {
    document.body.innerHTML = '<button id="same">前</button><button id="same">後</button>';
    expect(resolve(document, 'same')).toBe(requireElement('button'));
  });

  it.each([
    ['<button>ダイスを振る</button>', '振る'], ['<button aria-label="保存する"></button>', '保存'],
    ['<input placeholder="名前を入力">', '名前'], ['<img alt="背景画像">', '背景'],
    ['<input value="現在値">', '在値'], ['<p>任意の文字</p>', '任意'],
  ])('%s のラベルを部分一致で検索する', (markup, label) => {
    document.body.innerHTML = markup;
    expect(resolve(document, `label:${label}`)).toBe(requireElement('body > *'));
    expect(resolve(document, label)).toBeNull();
  });

  it('変更後の value と空白を正規化したラベルに一致する', () => {
    document.body.innerHTML = '<input value="初期"><button>実行\n  する</button>';
    requireElement<HTMLInputElement>('input').value = '変更後';
    expect(resolve(document, 'label:変更後')).toBe(requireElement('input'));
    expect(resolve(document, 'label:実行 する')).toBe(requireElement('button'));
  });

  it('特殊文字を含む名前をセレクターとして解釈しない', () => {
    document.body.innerHTML = '<button></button>';
    const button = requireElement('button');
    const target = 'a"[b]:c\\d';
    button.setAttribute('data-testid', target);
    expect(resolve(document, target)).toBe(button);
    expect(getTargetName(button)).toBe(target);
  });

  it('label: で始まる明示名をラベル照合より優先する', () => {
    document.body.innerHTML = '<button>実行</button><input id="label:実行">';
    expect(resolve(document, 'label:実行')).toBe(requireElement('input'));
  });

  it.each(['missing', 'label:見つからない', '', 'label:', 'label:  '])('%s がなければ null', target => {
    document.body.innerHTML = '<button>実行</button>';
    expect(resolve(document, target)).toBeNull();
  });

  it('指定名は空の属性を飛ばして最後は label: を使う', () => {
    document.body.innerHTML = '<button data-testid="first" id="second" name="third">表示</button>';
    const button = requireElement('button');
    expect(getTargetName(button)).toBe('first');
    button.setAttribute('data-testid', '');
    expect(getTargetName(button)).toBe('second');
    button.removeAttribute('id');
    expect(getTargetName(button)).toBe('third');
    button.removeAttribute('name');
    expect(getTargetName(button)).toBe('label:表示');
  });

  it('部分一致する見出しより完全一致するボタンを優先する', () => {
    document.body.innerHTML = '<section><h2>ダイスを振る</h2><button id="roll">振る</button></section>';
    expect(resolve(document, 'label:振る')).toBe(requireElement('#roll'));
    expect(resolve(document, 'label:ダイスを振る')).toBe(requireElement('h2'));
  });

  it('完全一致が無ければ部分一致でも操作できる要素を優先する', () => {
    document.body.innerHTML = '<section><h2>保存の設定</h2><button id="save">保存する</button></section>';
    expect(resolve(document, 'label:保存')).toBe(requireElement('#save'));
  });

  it('非表示要素も指定名で解決し、ラベルは観測対象の要素だけに一致する', () => {
    document.body.innerHTML = '<main><button hidden id="target">実行</button></main>';
    expect(resolve(document, 'target')).toBe(requireElement('button'));
    expect(resolve(document, 'label:実行')).toBe(requireElement('#target'));
  });
});
