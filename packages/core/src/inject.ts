import { audit } from './audit/LayoutAuditor';
import { installConsoleCounter } from './console/ConsoleCounter';
import { find } from './find/ElementFinder';
import type { ObservationContext } from './observe/ObservationContext';
import { observe } from './observe/Observer';
import { resolve } from './resolve/TargetResolver';
import { registerState, unregisterState } from './state/StateRegistry';
import type { VertexGlobal } from './VertexGlobal';

// 再注入で hook の登録状態やコンソールのラップを失わないよう既存インスタンスを保つ。
if (!window.__vertex) {
  const observationContext: ObservationContext = {};
  const document = window.document;
  installConsoleCounter(window.console);
  const vertex: VertexGlobal = {
    observe: options => observe(document, options, observationContext),
    find: query => find(document, query),
    resolve: target => resolve(document, target),
    audit: () => audit(document),
    registerState,
    unregisterState,
  };
  window.__vertex = vertex;
}
