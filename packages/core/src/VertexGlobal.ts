import type { AuditFinding } from './audit/AuditFinding';
import type { FindQuery } from './find/FindQuery';
import type { ObserveOptions } from './observe/ObserveOptions';

/** 注入したページ内で利用する Vertex の契約。 */
export interface VertexGlobal {
  /** UI と登録状態をテキストで観測する。 */
  observe(options?: ObserveOptions): string;
  /** ラベルから操作候補を列挙する。 */
  find(query: FindQuery): string;
  /** 指定名から最初の要素を解決する。 */
  resolve(target: string): Element | null;
  /** レイアウト上の問題を列挙する。 */
  audit(): AuditFinding[];
  /** 観測時に評価するアプリ状態を登録する。 */
  registerState(key: string, getter: () => unknown): void;
  /** 不要になったアプリ状態を解除する。 */
  unregisterState(key: string): void;
}

declare global {
  interface Window {
    /** 注入されていないページには存在しない。 */
    __vertex?: VertexGlobal;
  }
}
