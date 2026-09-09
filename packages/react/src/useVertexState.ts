import { useEffect } from 'react';
import type { VertexGlobal } from '@vertex/core';

/** 注入済みのページでのみ、コミット済みの値を観測へ公開する。 */
export function useVertexState(key: string, value: unknown): void {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const vertex: VertexGlobal | undefined = window.__vertex;
    if (!vertex) {
      return;
    }
    vertex.registerState(key, () => value);
    return () => vertex.unregisterState(key);
  }, [key, value]);
}
