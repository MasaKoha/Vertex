const stateGetters = new Map<string, () => unknown>();

/** 同じキーの再登録は getter を置き換え、観測時に最新値を読む。 */
export function registerState(key: string, getter: () => unknown): void {
  stateGetters.set(key, getter);
}

/** アプリ状態が不要になったときに登録を破棄する。 */
export function unregisterState(key: string): void {
  stateGetters.delete(key);
}

/** 状態スナップショットを返す。getter の例外は呼び出し元へ伝播する。 */
export function readStates(): Record<string, unknown> {
  return Object.fromEntries(Array.from(stateGetters, ([key, getter]) => [key, getter()]));
}
