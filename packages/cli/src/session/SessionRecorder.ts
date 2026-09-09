import { mkdir, appendFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DebugOutputLayout } from '../artifacts/DebugOutputLayout.js';
import type { RecordedAction } from './RecordedAction.js';

/** begin と end の間だけ各手を JSONL へ記録する。 */
export class SessionRecorder {
  private identifier: string | undefined;
  private recording = false;
  private metadata: { viewport: 'desktop' | 'mobile'; url: string } | undefined;

  /** 保存先の規則を受け取る。 */
  constructor(private readonly layout: DebugOutputLayout) {}
  /** 最後のセッションを終了後も保持する。 */
  get session(): string | undefined { return this.identifier; }
  /** 書き出し元のディレクトリ。 */
  get directory(): string {
    if (!this.identifier) { throw new Error('session.begin を先に実行してください'); }
    return this.layout.session(this.identifier);
  }

  /** 新しい記録を開始する。 */
  async begin(options: { viewport: 'desktop' | 'mobile'; url: string }): Promise<string> {
    if (this.recording) { await this.end(); }
    this.identifier = DebugOutputLayout.identifier();
    this.metadata = options;
    await mkdir(this.directory, { recursive: true });
    await writeFile(join(this.directory, 'actions.jsonl'), '', 'utf8');
    await this.writeMetadata('recording');
    this.recording = true;
    return this.identifier;
  }

  /** 記録中の手だけ追記する。 */
  async record(action: RecordedAction): Promise<void> {
    if (!this.recording) { return; }
    await appendFile(join(this.directory, 'actions.jsonl'), `${JSON.stringify(action)}\n`, 'utf8');
  }

  /** 記録を終了し、export に必要な情報を残す。 */
  async end(): Promise<void> {
    if (!this.recording) { return; }
    this.recording = false;
    await this.writeMetadata('ended');
  }

  private async writeMetadata(status: string): Promise<void> {
    await writeFile(join(this.directory, 'session.json'), JSON.stringify({ session: this.identifier, ...this.metadata, status }, null, 2), 'utf8');
  }
}
