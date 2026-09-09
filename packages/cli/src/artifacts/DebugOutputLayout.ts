import { resolve, join } from 'node:path';
import { randomUUID } from 'node:crypto';

/** 利用側の作業ディレクトリに成果物を集約する。 */
export class DebugOutputLayout {
  private readonly root: string;

  /** 作業ディレクトリを固定する。 */
  constructor(workingDirectory = process.cwd()) {
    this.root = resolve(workingDirectory, 'DebugOutput');
  }

  /** 成果物名からディレクトリ移動を排除する。 */
  static validateName(name: string): string {
    if (!/^[A-Za-z0-9_-]+$/.test(name)) {
      throw new Error('name は英数字・_・- のみ指定できます');
    }
    return name;
  }

  /** シナリオ名は日本語を許可し、パス区切りだけを拒否する。 */
  static validateDirectoryName(name: string): string {
    if (name.length === 0 || name === '.' || name === '..' || /[/\\\u0000]/u.test(name)) {
      throw new Error('シナリオ名にパス区切り・空文字・.・.. は使えません');
    }
    return name;
  }

  /** 同時発生でも衝突しない保存名。 */
  static identifier(): string {
    return `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID()}`;
  }

  /** 既定のメールボックス。 */
  mailbox(): string { return join(this.root, 'agent-mailbox'); }
  /** 撮影先。 */
  capture(name: string, directory?: string): string {
    return join(directory === undefined ? join(this.root, 'captures') : resolve(directory), `${DebugOutputLayout.validateName(name)}.png`);
  }
  /** シナリオの成果物ディレクトリ。 */
  scenario(name: string, directory?: string): string {
    return directory === undefined ? join(this.root, 'scenarios', DebugOutputLayout.validateDirectoryName(name)) : resolve(directory);
  }
  /** 操作記録のディレクトリ。 */
  session(identifier: string): string { return join(this.root, 'agent', DebugOutputLayout.validateName(identifier)); }
  /** 未処理例外のディレクトリ。 */
  forensics(): string { return join(this.root, 'forensics', DebugOutputLayout.identifier()); }
}
