import { CommandArguments } from '../dispatch/CommandArguments.js';

const ACTION_NAMES = ['click', 'tap', 'doubleClick', 'rightClick', 'pointer', 'hover', 'text', 'type', 'key', 'focus', 'scroll', 'scrollTo', 'select', 'set', 'drag', 'swipe', 'navigate', 'back'] as const;

/** 行動の主語彙を一つに限定する。 */
export class ActionCommand extends CommandArguments {
  /** 実行する行動名。 */
  readonly name: typeof ACTION_NAMES[number] | 'reason';

  /** reason だけの記録も一手として認める。 */
  constructor(values: Record<string, unknown>) {
    super(values);
    const names = ACTION_NAMES.filter(name => values[name] !== undefined);
    if (names.length === 0 && typeof values['reason'] === 'string') { this.name = 'reason'; return; }
    if (names.length !== 1) { throw new Error('一手には行動を一つ指定してください'); }
    this.name = names[0]!;
  }

  /** 要素操作の場合だけ指定名を返す。 */
  target(): string | undefined {
    const namedActions = ['click', 'tap', 'doubleClick', 'rightClick', 'focus', 'scrollTo'];
    if (namedActions.includes(this.name)) { return this.string(this.name); }
    if (this.name === 'hover' && typeof this.values['hover'] === 'string') { return this.string('hover'); }
    if (this.values['target'] !== undefined) { return this.string('target'); }
    return undefined;
  }
}
