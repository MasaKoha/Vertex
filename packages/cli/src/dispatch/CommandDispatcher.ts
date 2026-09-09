import type { FindQuery, ObserveOptions } from '@vertex/core';
import { BrowserSession } from '../browser/BrowserSession.js';
import { ForensicsRecorder } from '../browser/ForensicsRecorder.js';
import { DebugOutputLayout } from '../artifacts/DebugOutputLayout.js';
import { PageCapturer } from '../capture/PageCapturer.js';
import { SessionRecorder } from '../session/SessionRecorder.js';
import { ScenarioExporter } from '../session/ScenarioExporter.js';
import { ScenarioRunner } from '../scenario/ScenarioRunner.js';
import { ActionRunner } from '../actions/ActionRunner.js';
import { CommandArguments } from './CommandArguments.js';
import type { CommandResponse } from './Response.js';

const OPERATIONS = ['ping', 'ops', 'observe', 'find', 'act', 'capture', 'logs', 'forensics.latest', 'audit', 'scenario.run', 'scenario.status', 'session.begin', 'session.end', 'session.export'];
const DEFAULT_LOG_COUNT = 40;
const ELEMENT_KINDS = ['Button', 'Link', 'Input', 'Text', 'Heading', 'Checkbox', 'Radio', 'Select', 'Image', 'Alert'];

/** CLI とメールボックスの操作を同じ応答へ変換する。 */
export class CommandDispatcher {
  private readonly forensics: ForensicsRecorder;
  private readonly recorder: SessionRecorder;
  private readonly actions: ActionRunner;
  private readonly scenarios: ScenarioRunner;
  private queue: Promise<unknown> = Promise.resolve();

  /** 診断購読はブラウザを開く前に開始する。 */
  constructor(private readonly session: BrowserSession, private readonly layout: DebugOutputLayout) {
    this.forensics = new ForensicsRecorder(session, layout);
    this.recorder = new SessionRecorder(layout);
    this.actions = new ActionRunner(session, this.recorder);
    this.scenarios = new ScenarioRunner(session, layout, this.actions);
  }

  /** status 以外を直列化し、失敗も JSON として返す。 */
  async dispatch(op: string, args: unknown): Promise<CommandResponse> {
    if (op === 'scenario.status') { return this.scenarios.status(); }
    const operation = this.queue.then(() => this.respond(op, args));
    this.queue = operation.catch(() => undefined);
    return operation;
  }

  /** 操作と成果物の書き込みを完了して購読を解除する。 */
  async dispose(): Promise<void> {
    await this.queue;
    await this.recorder.end();
    await this.forensics.dispose();
  }

  private async respond(op: string, args: unknown): Promise<CommandResponse> {
    const started = Date.now();
    try {
      const result = await this.execute(op, CommandArguments.parse(args));
      return { ok: true, ...result, op, elapsedMs: Date.now() - started };
    } catch (exception) {
      return { ok: false, op, error: String(exception), elapsedMs: Date.now() - started };
    }
  }

  private async execute(op: string, parameters: CommandArguments): Promise<Partial<CommandResponse>> {
    switch (op) {
      case 'ping': {
        const viewport = this.session.page.viewportSize();
        return { text: `url=${this.session.page.url()} viewport=${viewport?.width ?? 0}x${viewport?.height ?? 0} uptimeMs=${this.session.uptimeMilliseconds}` };
      }
      case 'ops': return { text: OPERATIONS.join('\n') };
      case 'observe': return this.observe(parameters);
      case 'find': return this.find(parameters);
      case 'act': return this.actions.run(parameters);
      case 'capture': return this.capture(parameters);
      case 'logs': {
        const level = parameters.string('level', 'all');
        if (level !== 'all' && level !== 'error') { throw new Error('level は all / error です'); }
        return { text: this.session.console.logs(parameters.number('count', DEFAULT_LOG_COUNT), level) };
      }
      case 'forensics.latest': return this.forensics.latest();
      case 'audit': {
        const findings = await this.session.page.evaluate(() => window.__vertex!.audit());
        return { text: findings.map(finding => `${finding.kind} ${finding.target}: ${finding.detail}`).join('\n'), warningCount: findings.length };
      }
      case 'scenario.run': return this.scenarios.run(parameters);
      case 'session.begin': return this.begin(parameters);
      case 'session.end':
        await this.recorder.end();
        await this.forensics.flush();
        await this.session.close();
        return this.recorder.session === undefined ? {} : { session: this.recorder.session };
      case 'session.export': return { path: await new ScenarioExporter().export(this.recorder.directory, parameters.string('name')), session: this.recorder.session! };
      default: throw new Error(`不明な op: ${op}`);
    }
  }

  private async observe(parameters: CommandArguments): Promise<Partial<CommandResponse>> {
    const options: ObserveOptions = { scope: this.scope(parameters), diffOnly: parameters.boolean('diffOnly') };
    const text = await this.session.page.evaluate(options => window.__vertex!.observe(options), options);
    if (parameters.values['capture'] === undefined) { return { text }; }
    return { text, ...await new PageCapturer(this.layout).capture(this.session.page, { name: parameters.string('capture') }) };
  }

  private async find(parameters: CommandArguments): Promise<Partial<CommandResponse>> {
    const query: FindQuery = { label: parameters.string('label'), scope: this.scope(parameters) };
    if (parameters.values['kind'] !== undefined) {
      const kind = parameters.string('kind');
      if (!ELEMENT_KINDS.includes(kind)) { throw new Error('不明な要素 kind です'); }
      query.kind = kind as FindQuery['kind'] & string;
    }
    return { text: await this.session.page.evaluate(query => window.__vertex!.find(query), query) };
  }

  private async capture(parameters: CommandArguments): Promise<Partial<CommandResponse>> {
    return new PageCapturer(this.layout).capture(this.session.page, {
      name: parameters.string('name', DebugOutputLayout.identifier()), fullPage: parameters.boolean('fullPage'),
      ...(parameters.values['directory'] === undefined ? {} : { directory: parameters.string('directory') }),
    });
  }

  private async begin(parameters: CommandArguments): Promise<Partial<CommandResponse>> {
    const options = CommandArguments.parse(parameters.values['options'] ?? {});
    const viewport = options.string('viewport', this.session.viewport);
    if (viewport !== 'desktop' && viewport !== 'mobile') { throw new Error('viewport は desktop / mobile です'); }
    await this.forensics.flush();
    await this.session.open({ viewport, ...(options.values['url'] === undefined ? {} : { url: options.string('url') }) });
    return { session: await this.recorder.begin({ viewport, url: this.session.page.url() }) };
  }

  private scope(parameters: CommandArguments): 'visible' | 'all' {
    const scope = parameters.string('scope', 'visible');
    if (scope !== 'visible' && scope !== 'all') { throw new Error('scope は visible / all です'); }
    return scope;
  }
}
