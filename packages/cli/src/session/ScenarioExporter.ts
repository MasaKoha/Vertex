import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DebugOutputLayout } from '../artifacts/DebugOutputLayout.js';
import type { RecordedAction } from './RecordedAction.js';

/** 記録した手と未達条件をシナリオ JSON に保存する。 */
export class ScenarioExporter {
  /** 終了済みのセッションも書き出せる。 */
  async export(directory: string, name: string): Promise<string> {
    DebugOutputLayout.validateDirectoryName(name);
    const metadata = JSON.parse(await readFile(join(directory, 'session.json'), 'utf8')) as { viewport: string; url: string };
    const lines = (await readFile(join(directory, 'actions.jsonl'), 'utf8')).split('\n').filter(line => line.length > 0);
    const records = lines.map(line => JSON.parse(line) as RecordedAction);
    const steps: Record<string, unknown>[] = records.map(record => ({
      ...record.action, expect: record.expect, reason: record.reason, settleMilliseconds: record.settleMilliseconds,
      ...(!record.expectOk ? { comment: '元の実行では未達' } : {}),
    }));
    // context 再作成後も開始地点を復元できるよう最初の URL を記録する。
    steps.unshift({ navigate: metadata.url, expect: [], reason: '記録開始時の URL を復元', settleMilliseconds: 0 });
    const path = join(directory, 'scenario.json');
    await writeFile(path, JSON.stringify({ name, viewport: metadata.viewport, stopOnFail: true, steps }, null, 2), 'utf8');
    return path;
  }
}
