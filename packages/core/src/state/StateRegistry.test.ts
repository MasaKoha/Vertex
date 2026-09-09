import { afterEach, describe, expect, it } from 'vitest';
import { formatStateValue } from './StateFormatter';
import { readStates, registerState, unregisterState } from './StateRegistry';

afterEach(() => {
  Object.keys(readStates()).forEach(unregisterState);
});

describe('StateRegistry', () => {
  it('登録時には評価せず、毎回 getter を評価する', () => {
    let reads = 0;
    registerState('reads', () => ++reads);
    expect(reads).toBe(0);
    expect(readStates()).toEqual({ reads: 1 });
    expect(readStates()).toEqual({ reads: 2 });
  });

  it('再登録で置換し、未登録キーの解除も安全に行う', () => {
    registerState('value', () => 1);
    registerState('value', () => 2);
    expect(readStates()).toEqual({ value: 2 });
    unregisterState('value');
    unregisterState('unknown');
    expect(readStates()).toEqual({});
  });

  it('特殊なキーでもプロトタイプを書き換えない', () => {
    registerState('__proto__', () => '安全');
    const states = readStates();
    expect(Object.getPrototypeOf(states)).toBe(Object.prototype);
    expect(Object.hasOwn(states, '__proto__')).toBe(true);
    expect(states['__proto__']).toBe('安全');
  });

  it.each([[undefined, 'undefined'], [null, 'null'], [true, 'true'], [7, '7'],
    [7n, '7'], ['改行\nあり', '改行\\nあり'], [{ nested: [1] }, '{"nested":[1]}']])
  ('状態 %s を一行へ整形する', (value, expected) => {
    expect(formatStateValue(value)).toBe(expected);
  });

  it('循環参照を持つ状態でも他の観測を失わない', () => {
    const value: Record<string, unknown> = {};
    value['self'] = value;
    expect(formatStateValue(value)).toBe('[unserializable]');
  });

  it('getter の例外を呼び出し元へ返す', () => {
    registerState('failure', () => { throw new Error('読み取り失敗'); });
    try {
      expect(readStates).toThrow('読み取り失敗');
    } finally {
      unregisterState('failure');
    }
  });
});
