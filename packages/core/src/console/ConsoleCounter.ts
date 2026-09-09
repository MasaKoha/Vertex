import type { ConsoleCounts } from './ConsoleCounts';

/** コンソールの計数とラップ解除の寿命を管理する。 */
export interface ConsoleCounter {
  /** 件数を取り出し、次の観測に向けてゼロへ戻す。 */
  takeCounts(): ConsoleCounts;
  /** 元のコンソールへ戻す。複数回呼んでも安全。 */
  dispose(): void;
}

const counters = new WeakMap<Console, ConsoleCounter>();

/** 同じコンソールの二重ラップを防ぎ、元の出力も維持する。 */
export function installConsoleCounter(targetConsole: Console = console): ConsoleCounter {
  const existing = counters.get(targetConsole);
  if (existing) {
    return existing;
  }
  let errors = 0;
  let warnings = 0;
  const originalError = targetConsole.error;
  const originalWarning = targetConsole.warn;
  const wrappedError = (...arguments_: unknown[]): void => {
    errors += 1;
    originalError.apply(targetConsole, arguments_);
  };
  const wrappedWarning = (...arguments_: unknown[]): void => {
    warnings += 1;
    originalWarning.apply(targetConsole, arguments_);
  };
  const counter: ConsoleCounter = {
    takeCounts() {
      const counts = { errors, warnings };
      errors = 0;
      warnings = 0;
      return counts;
    },
    dispose() {
      if (targetConsole.error === wrappedError) { targetConsole.error = originalError; }
      if (targetConsole.warn === wrappedWarning) { targetConsole.warn = originalWarning; }
      if (counters.get(targetConsole) === counter) { counters.delete(targetConsole); }
    },
  };
  targetConsole.error = wrappedError;
  targetConsole.warn = wrappedWarning;
  counters.set(targetConsole, counter);
  return counter;
}

/** 未導入ならゼロ件として観測し、自動ラップによる副作用を避ける。 */
export function takeConsoleCounts(targetConsole: Console = console): ConsoleCounts {
  return counters.get(targetConsole)?.takeCounts() ?? { errors: 0, warnings: 0 };
}
