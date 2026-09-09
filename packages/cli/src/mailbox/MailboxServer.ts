import { watch } from 'node:fs';
import type { FSWatcher } from 'node:fs';
import { mkdir, readdir, readFile, rename, unlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { CommandDispatcher } from '../dispatch/CommandDispatcher.js';
import { CommandArguments } from '../dispatch/CommandArguments.js';
import type { CommandResponse } from '../dispatch/Response.js';

const POLL_MILLISECONDS = 100;
const REQUEST_PATTERN = /^req-([A-Za-z0-9_-]+)\.json$/;

/** watch の取りこぼしをポーリングで補完するメールボックス。 */
export class MailboxServer {
  private watcher: FSWatcher | undefined;
  private timer: ReturnType<typeof setInterval> | undefined;
  private scanning = false;
  private running = false;
  private readonly inFlight = new Map<string, Promise<void>>();

  /** 同一ディレクトリを監視するサーバーは一つに限定する。 */
  constructor(private readonly directory: string, private readonly dispatcher: CommandDispatcher) {}

  /** マーカーを置いて継続監視を開始する。 */
  async start(): Promise<void> {
    if (this.running) { return; }
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, '.enabled'), '', { flag: 'a' });
    this.running = true;
    this.timer = setInterval(() => { void this.scan(); }, POLL_MILLISECONDS);
    try {
      this.watcher = watch(this.directory, () => { void this.scan(); });
      this.watcher.on('error', exception => { this.watchFailed(exception); });
    } catch (exception) { this.watchFailed(exception); }
    await this.scan();
  }

  private watchFailed(exception: unknown): void {
    this.watcher?.close();
    this.watcher = undefined;
    process.stderr.write(`mailbox watch: ${String(exception)}（ポーリングを継続します）\n`);
  }

  /** 新規受付を止め、受付済み要求の公開を待つ。 */
  async stop(): Promise<void> {
    this.running = false;
    this.watcher?.close();
    this.watcher = undefined;
    clearInterval(this.timer);
    this.timer = undefined;
    await Promise.all(this.inFlight.values());
  }

  private async scan(): Promise<void> {
    if (!this.running || this.scanning) { return; }
    this.scanning = true;
    try {
      const names = (await readdir(this.directory)).sort();
      for (const name of names) {
        if (!this.running) { break; }
        const match = REQUEST_PATTERN.exec(name);
        if (!match || this.inFlight.has(name)) { continue; }
        const operation = this.process(name, match[1]!).catch(exception => { process.stderr.write(`mailbox: ${String(exception)}\n`); }).finally(() => { this.inFlight.delete(name); });
        this.inFlight.set(name, operation);
      }
    } catch (exception) { process.stderr.write(`mailbox scan: ${String(exception)}\n`); }
    finally { this.scanning = false; }
  }

  private async process(name: string, identifier: string): Promise<void> {
    const requestPath = join(this.directory, name);
    const responsePath = join(this.directory, `res-${identifier}.json`);
    let operation = 'unknown';
    let response: CommandResponse;
    try {
      const request = CommandArguments.parse(JSON.parse(await readFile(requestPath, 'utf8')));
      operation = request.string('op');
      const parameters = JSON.parse(request.string('args')) as unknown;
      response = await this.dispatcher.dispatch(operation, parameters);
    } catch (exception) { response = { ok: false, op: operation, error: String(exception), elapsedMs: 0 }; }
    const temporaryPath = `${responsePath}.${randomUUID()}.tmp`;
    try {
      await writeFile(temporaryPath, JSON.stringify(response), { encoding: 'utf8', flag: 'wx' });
      await rename(temporaryPath, responsePath);
      await unlink(requestPath);
    } finally { await unlink(temporaryPath).catch(() => undefined); }
  }
}
