import { afterEach, describe, expect, it, vi } from 'vitest';
import { installConsoleCounter } from './console/ConsoleCounter';
import { readStates, unregisterState } from './state/StateRegistry';
import { requireElement } from './testing/DomGeometry.test-support';

afterEach(() => {
  installConsoleCounter().dispose();
  Object.keys(readStates()).forEach(unregisterState);
  delete window.__vertex;
});

describe('inject', () => {
  it('ページ内の全 API を束ね、観測履歴と状態を保持する', async () => {
    document.body.innerHTML = '<button id="roll">振る</button>';
    await import('./inject');
    const vertex = window.__vertex;
    expect(vertex).toBeDefined();
    if (!vertex) {
      throw new Error('注入されていません');
    }
    vertex.registerState('dice.total', () => 7);
    expect(vertex.observe()).toContain('dice.total=7');
    expect(vertex.observe({ diffOnly: true })).toBe('');
    expect(vertex.resolve('roll')).toBe(requireElement('button'));
    expect(vertex.find({ label: '振る' })).toContain('→ click:"roll"');
    expect(vertex.audit()).toEqual([]);
    vertex.unregisterState('dice.total');
    expect(vertex.observe()).not.toContain('state:');
  });

  it('再注入で既存 API と状態を置き換えない', async () => {
    const existing = {
      observe: vi.fn(() => '既存'), find: vi.fn(() => ''), resolve: vi.fn(() => null),
      audit: vi.fn(() => []), registerState: vi.fn(), unregisterState: vi.fn(),
    };
    window.__vertex = existing;
    vi.resetModules();
    await import('./inject');
    expect(window.__vertex).toBe(existing);
  });
});
