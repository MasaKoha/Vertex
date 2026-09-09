import { act, createElement, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { Root } from 'react-dom/client';
import type { VertexGlobal } from '@vertex/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useVertexState } from './useVertexState';

interface StateProbeProperties {
  stateKey: string;
  value: unknown;
}

function StateProbe({ stateKey, value }: StateProbeProperties): null {
  useVertexState(stateKey, value);
  return null;
}

let root: Root;
let container: HTMLDivElement;
let stateGetters: Map<string, () => unknown>;
let vertex: VertexGlobal;

beforeEach(() => {
  vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
  container = document.createElement('div');
  document.body.append(container);
  root = createRoot(container);
  stateGetters = new Map();
  vertex = {
    observe: () => '', find: () => '', resolve: () => null, audit: () => [],
    registerState: vi.fn((key: string, getter: () => unknown) => { stateGetters.set(key, getter); }),
    unregisterState: vi.fn((key: string) => { stateGetters.delete(key); }),
  };
  window.__vertex = vertex;
});

afterEach(async () => {
  await act(() => { root.unmount(); });
  container.remove();
  delete window.__vertex;
  vi.unstubAllGlobals();
});

describe('useVertexState', () => {
  it('登録・値更新・アンマウント時の解除を行う', async () => {
    await act(() => { root.render(createElement(StateProbe, { stateKey: 'total', value: 7 })); });
    expect(stateGetters.get('total')?.()).toBe(7);
    await act(() => { root.render(createElement(StateProbe, { stateKey: 'total', value: 9 })); });
    expect(stateGetters.get('total')?.()).toBe(9);
    await act(() => { root.render(null); });
    expect(stateGetters.size).toBe(0);
    expect(vertex.unregisterState).toHaveBeenCalledWith('total');
  });

  it('キー変更で以前の登録を解除する', async () => {
    await act(() => { root.render(createElement(StateProbe, { stateKey: 'before', value: 1 })); });
    await act(() => { root.render(createElement(StateProbe, { stateKey: 'after', value: 2 })); });
    expect(stateGetters.has('before')).toBe(false);
    expect(stateGetters.get('after')?.()).toBe(2);
  });

  it('未注入なら何もしない', async () => {
    delete window.__vertex;
    await act(() => { root.render(createElement(StateProbe, { stateKey: 'total', value: 7 })); });
    expect(vertex.registerState).not.toHaveBeenCalled();
    await act(() => { root.render(null); });
    expect(vertex.unregisterState).not.toHaveBeenCalled();
  });

  it('StrictMode の再実行後も登録が残り、最後に解除される', async () => {
    await act(() => {
      root.render(createElement(StrictMode, null, createElement(StateProbe, { stateKey: 'total', value: undefined })));
    });
    expect(stateGetters.has('total')).toBe(true);
    expect(stateGetters.get('total')?.()).toBeUndefined();
    await act(() => { root.render(null); });
    expect(stateGetters.size).toBe(0);
  });

  it('API が差し替わっても登録先のインスタンスを解除する', async () => {
    await act(() => { root.render(createElement(StateProbe, { stateKey: 'total', value: 1 })); });
    const replacement = { ...vertex, unregisterState: vi.fn() };
    window.__vertex = replacement;
    await act(() => { root.render(null); });
    expect(vertex.unregisterState).toHaveBeenCalledWith('total');
    expect(replacement.unregisterState).not.toHaveBeenCalled();
  });
});
