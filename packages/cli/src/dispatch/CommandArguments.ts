/** 外部 JSON の型と範囲を境界で検証する。 */
export class CommandArguments {
  /** JSON オブジェクト以外は受け付けない。 */
  constructor(readonly values: Record<string, unknown>) {}

  /** 未知の入力をオブジェクトとして検証する。 */
  static parse(value: unknown): CommandArguments {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
      throw new Error('引数は JSON オブジェクトで指定してください');
    }
    return new CommandArguments(value as Record<string, unknown>);
  }

  /** 文字列を取り出す。 */
  string(key: string, fallback?: string): string {
    const value = this.values[key] ?? fallback;
    if (typeof value !== 'string') {
      throw new Error(`${key} は文字列が必要です`);
    }
    return value;
  }

  /** 有限の数値を取り出す。 */
  number(key: string, fallback: number, minimum = 0): number {
    const value = this.values[key] ?? fallback;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < minimum) {
      throw new Error(`${key} は ${minimum} 以上の有限数が必要です`);
    }
    return value;
  }

  /** 真偽値を取り出す。 */
  boolean(key: string, fallback = false): boolean {
    const value = this.values[key] ?? fallback;
    if (typeof value !== 'boolean') {
      throw new Error(`${key} は真偽値が必要です`);
    }
    return value;
  }
}
