import { readFile } from 'node:fs/promises';
import { CommandArguments } from '../dispatch/CommandArguments.js';
import { ActionCommand } from '../actions/ActionCommand.js';

/** ファイル境界で検証された再生シナリオ。 */
export class ScenarioFile {
  /** シナリオ名。 */
  readonly name: string;
  /** 実行時に作り直す画面プロファイル。 */
  readonly viewport: 'desktop' | 'mobile';
  /** 失敗後に残りを中止するか。 */
  readonly stopOnFail: boolean;
  /** 成果物の保存先上書き。 */
  readonly outputDirectory: string | undefined;
  /** 順に実行する手。 */
  readonly steps: CommandArguments[];

  private constructor(parameters: CommandArguments) {
    this.name = parameters.string('name', 'scenario');
    const viewport = parameters.string('viewport', 'desktop');
    if (viewport !== 'desktop' && viewport !== 'mobile') { throw new Error('viewport は desktop / mobile です'); }
    this.viewport = viewport;
    this.stopOnFail = parameters.boolean('stopOnFail', true);
    this.outputDirectory = parameters.values['outputDirectory'] === undefined ? undefined : parameters.string('outputDirectory');
    const steps = parameters.values['steps'];
    if (!Array.isArray(steps)) { throw new Error('scenario.steps は配列が必要です'); }
    this.steps = steps.map(step => {
      const parameters = CommandArguments.parse(step);
      new ActionCommand(parameters.values);
      return parameters;
    });
  }

  /** JSON ファイルを読み込む。 */
  static async load(path: string): Promise<ScenarioFile> {
    return new ScenarioFile(CommandArguments.parse(JSON.parse(await readFile(path, 'utf8'))));
  }
}
