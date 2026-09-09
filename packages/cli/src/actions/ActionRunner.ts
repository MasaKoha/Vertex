import { BrowserSession } from '../browser/BrowserSession.js';
import { WaitDefaults } from '../browser/WaitDefaults.js';
import { CommandArguments } from '../dispatch/CommandArguments.js';
import type { CommandResponse } from '../dispatch/Response.js';
import { ExpectEvaluator } from '../expect/ExpectEvaluator.js';
import { SessionRecorder } from '../session/SessionRecorder.js';
import { ActionCommand } from './ActionCommand.js';
import { ActionExecutor } from './ActionExecutor.js';
import { ActionExecutionError } from './ActionExecutionError.js';

/** 各手の準備・実行・静止・観測・事後条件・記録を順序付ける。 */
export class ActionRunner {
  /** 行動の状態と記録先を受け取る。 */
  constructor(private readonly session: BrowserSession, private readonly recorder: SessionRecorder) {}

  /** 複数手は最初の失敗で打ち切る。 */
  async run(parameters: CommandArguments): Promise<CommandResponse> {
    const steps = parameters.values['steps'];
    if (steps === undefined) { return this.step(parameters); }
    if (!Array.isArray(steps) || steps.length === 0) { throw new Error('steps は空でない配列が必要です'); }
    let response: CommandResponse = { ok: true, op: 'act', elapsedMs: 0 };
    let waitedMs = 0;
    let settled = true;
    for (const step of steps) {
      const values = CommandArguments.parse(step).values;
      response = await this.step(new CommandArguments({ ...parameters.values, ...values, steps: undefined }));
      waitedMs += response.waitedMs ?? 0;
      settled = settled && (response.settled ?? true);
      if (!response.ok) { break; }
    }
    return { ...response, waitedMs, settled };
  }

  /** 一手ごとの証拠を記録する。 */
  async step(parameters: CommandArguments): Promise<CommandResponse> {
    const started = Date.now();
    const action = new ActionCommand(CommandArguments.parse(parameters.values['action'] ?? parameters.values).values);
    const reason = action.string('reason', '');
    const conditions = parameters.values['expect'] ?? action.values['expect'] ?? [];
    if (!Array.isArray(conditions)) { throw new Error('expect は配列が必要です'); }
    const quietMilliseconds = parameters.number('settleMilliseconds', WaitDefaults.settleMilliseconds);
    const errorsBefore = this.session.console.errorCount;
    let response: CommandResponse = { ok: false, op: 'act', elapsedMs: 0, ready: false, settled: false, waitedMs: 0 };
    try {
      await this.session.page.evaluate(() => window.__vertex!.observe());
      const readiness = await new ActionExecutor(this.session).execute(action, parameters.number('readyTimeoutMilliseconds', WaitDefaults.readyTimeoutMilliseconds, 1));
      response = { ...response, ...readiness };
      const settlement = await this.session.settleWaiter.wait(quietMilliseconds, parameters.number('settleTimeoutMilliseconds', WaitDefaults.settleTimeoutMilliseconds, 1));
      response = { ...response, settled: settlement.settled, waitedMs: readiness.waitedMs + settlement.waitedMs };
      const difference = await this.session.page.evaluate(() => window.__vertex!.observe({ diffOnly: true }));
      const text = await this.session.page.evaluate(() => window.__vertex!.observe());
      const expectations = await new ExpectEvaluator().evaluate(this.session.page, conditions, { text, difference, errorsBefore, errorsAfter: this.session.console.errorCount });
      response = { ...response, ...expectations, text, ok: expectations.expectOk };
    } catch (exception) {
      if (exception instanceof ActionExecutionError) {
        response.ready = exception.ready;
        response.waitedMs = exception.waitedMs;
      }
      response.error = String(exception);
      response.expectOk = false;
      response.expectFailures = ['操作を完了できなかったため事後条件を確認できません'];
      if (!response.ready) { response.waitedMs = Date.now() - started; }
      response.text = await this.observeAfterFailure();
    }
    response.elapsedMs = Date.now() - started;
    const { expect: omittedExpect, steps: omittedSteps, action: omittedAction, ...recordedAction } = action.values;
    await this.recorder.record({ action: recordedAction, expect: conditions, expectOk: response.expectOk ?? false, reason, elapsedMs: response.elapsedMs, settleMilliseconds: quietMilliseconds });
    return response;
  }

  private async observeAfterFailure(): Promise<string> {
    try { return await this.session.page.evaluate(() => window.__vertex!.observe()); }
    catch { return '観測を取得できません'; }
  }
}
