import { describe, expect, it, vi } from 'vitest';
import { installConsoleCounter, takeConsoleCounts } from './ConsoleCounter';

describe('ConsoleCounter', () => {
  it('元の引数と this を保って出力し、取り出した件数をリセットする', () => {
    const originalError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const originalWarning = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const counter = installConsoleCounter();
    try {
      const detail = { reason: '失敗' };
      console.error('本文', detail);
      console.warn('警告');
      expect(originalError).toHaveBeenCalledWith('本文', detail);
      expect(originalError.mock.contexts[0]).toBe(console);
      expect(originalWarning).toHaveBeenCalledWith('警告');
      expect(counter.takeCounts()).toEqual({ errors: 1, warnings: 1 });
      expect(counter.takeCounts()).toEqual({ errors: 0, warnings: 0 });
    } finally {
      counter.dispose();
      expect(console.error).toBe(originalError);
      expect(console.warn).toBe(originalWarning);
      vi.restoreAllMocks();
    }
  });

  it('二重導入せず、古い dispose は新しい計数を解除しない', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const first = installConsoleCounter();
    expect(installConsoleCounter()).toBe(first);
    first.dispose();
    const second = installConsoleCounter();
    try {
      first.dispose();
      console.warn('一度');
      expect(takeConsoleCounts()).toEqual({ errors: 0, warnings: 1 });
    } finally {
      second.dispose();
      vi.restoreAllMocks();
    }
  });

  it('後から他のツールが置き換えたラップは破棄しない', () => {
    const originalError = console.error;
    const counter = installConsoleCounter();
    const replacement = vi.fn();
    console.error = replacement;
    try {
      counter.dispose();
      expect(console.error).toBe(replacement);
      expect(takeConsoleCounts()).toEqual({ errors: 0, warnings: 0 });
    } finally {
      console.error = originalError;
    }
  });
});
