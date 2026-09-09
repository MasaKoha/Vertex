import { describe, expect, it } from 'vitest';
import { requireElement, setRectangle } from '../testing/DomGeometry.test-support';
import { find } from './ElementFinder';

describe('find', () => {
  it('観測と同じ行を文書順で返し、推奨指定を引用符で囲む', () => {
    document.body.innerHTML = '<main><button data-testid="save">保存</button><a href="/saved">保存済み</a><p>保存結果</p></main>';
    expect(find(document, { label: '保存' })).toBe([
      '  [Button] save 「保存」 → click:"save"',
      '  [Link] label:保存済み 「保存済み」 href=/saved → click:"label:保存済み"',
      '  [Text] label:保存結果 「保存結果」 → click:"label:保存結果"',
    ].join('\n'));
    expect(find(document, { label: '保存', kind: 'Button' })).toBe('  [Button] save 「保存」 → click:"save"');
  });

  it('aria-label・placeholder・alt・変更後 value を検索できる', () => {
    document.body.innerHTML = '<button aria-label="対象"></button><input placeholder="対象"><img alt="対象"><input id="value">';
    requireElement<HTMLInputElement>('#value').value = '対象';
    expect(find(document, { label: '対象' }).split('\n')).toHaveLength(4);
  });

  it('既定は可視範囲で、all は hidden と offscreen も返す', () => {
    document.body.innerHTML = '<button id="hidden" hidden>対象</button><button id="outside">対象</button>';
    setRectangle(requireElement('#outside'), 0, window.innerHeight, 100, 50);
    expect(find(document, { label: '対象' })).toBe('');
    const all = find(document, { label: '対象', scope: 'all' });
    expect(all).toContain('[hidden] → click:"hidden"');
    expect(all).toContain('[offscreen] → click:"outside"');
  });

  it('指定名の引用符をエスケープし、不一致と空の検索は空文字を返す', () => {
    document.body.innerHTML = '<button>対象</button>';
    requireElement('button').setAttribute('id', 'quote"name');
    expect(find(document, { label: '対象' })).toContain('→ click:"quote\\"name"');
    expect(find(document, { label: 'なし' })).toBe('');
    expect(find(document, { label: '' })).toBe('');
  });
});
