import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BrowserSession } from '../browser/BrowserSession.js';
import { WaitDefaults } from '../browser/WaitDefaults.js';
import { DebugOutputLayout } from '../artifacts/DebugOutputLayout.js';
import { ActionRunner } from '../actions/ActionRunner.js';
import { PageCapturer } from '../capture/PageCapturer.js';
import { CommandArguments } from '../dispatch/CommandArguments.js';
import type { CommandResponse } from '../dispatch/Response.js';
import { ScenarioFile } from './ScenarioFile.js';

/** シナリオの実行状態とステップ別成果物を保持する。 */
export class ScenarioRunner {
  private latest: CommandResponse = { ok: true, op: 'scenario.status', elapsedMs: 0, status: 'idle' };

  /** 行動処理は対話操作と共用する。 */
  constructor(private readonly session: BrowserSession, private readonly layout: DebugOutputLayout, private readonly actions: ActionRunner) {}

  /** 直前の実行状況を返す。 */
  status(): CommandResponse { return { ...this.latest, op: 'scenario.status' }; }

  /** タイムアウト時は context を終了して未完了操作を中断する。 */
  async run(parameters: CommandArguments): Promise<CommandResponse> {
    const started = Date.now();
    const scenario = await ScenarioFile.load(parameters.string('path'));
    const name = parameters.string('name', scenario.name);
    DebugOutputLayout.validateDirectoryName(name);
    const directory = this.layout.scenario(name, scenario.outputDirectory);
    await mkdir(directory, { recursive: true });
    const timeout = parameters.number('timeoutMilliseconds', WaitDefaults.scenarioTimeoutMilliseconds, 1);
    const results: CommandResponse[] = [];
    let timedOut = false;
    let closing = Promise.resolve();
    this.latest = { ok: true, op: 'scenario.run', elapsedMs: 0, status: 'running', failedSteps: 0, warningCount: 0 };
    const timer = setTimeout(() => { timedOut = true; closing = this.session.close(); }, timeout);
    try {
      await this.session.open({ viewport: scenario.viewport });
      for (const step of scenario.steps) {
        if (timedOut) { break; }
        const result = await this.runStep(step, directory, results.length);
        results.push(result);
        this.latest = { ...this.latest, failedSteps: results.filter(result => !result.ok).length, elapsedMs: Date.now() - started };
        if (!result.ok && scenario.stopOnFail) { break; }
      }
    } catch (exception) {
      results.push({ ok: false, op: 'act', error: String(exception), elapsedMs: Date.now() - started, waitedMs: 0 });
    } finally { clearTimeout(timer); await closing; }
    if (timedOut && results.every(result => result.ok)) {
      results.push({ ok: false, op: 'act', error: 'シナリオがタイムアウトしました', elapsedMs: Date.now() - started, waitedMs: 0 });
    }
    const failedSteps = results.filter(result => !result.ok).length;
    const warningCount = results.reduce((count, result) => count + (result.warningCount ?? 0), 0);
    const path = join(directory, 'result.json');
    this.latest = { ok: failedSteps === 0, op: 'scenario.run', elapsedMs: Date.now() - started, status: timedOut ? 'timedOut' : 'completed', verdict: failedSteps === 0 ? 'pass' : 'fail', failedSteps, warningCount, path };
    await writeFile(path, JSON.stringify({ ...this.latest, name, steps: results }, null, 2), 'utf8');
    return { ...this.latest };
  }

  private async runStep(step: CommandArguments, directory: string, index: number): Promise<CommandResponse> {
    const result = await this.actions.step(step);
    result.warningCount = result.settled === false ? 1 : 0;
    try {
      if (step.values['capture'] !== undefined) {
        Object.assign(result, await new PageCapturer(this.layout).capture(this.session.page, { name: step.string('capture'), directory }));
      }
      if (step.boolean('audit')) {
        const findings = await this.session.page.evaluate(() => window.__vertex!.audit());
        result.warningCount += findings.length;
        await writeFile(join(directory, `audit-${index + 1}.json`), JSON.stringify(findings, null, 2), 'utf8');
      }
    } catch (exception) { result.ok = false; result.error = String(exception); }
    return result;
  }
}
