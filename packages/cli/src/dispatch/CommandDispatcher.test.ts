import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { BrowserSession } from '../browser/BrowserSession.js';
import { DebugOutputLayout } from '../artifacts/DebugOutputLayout.js';
import { CommandDispatcher } from './CommandDispatcher.js';
import { MailboxServer } from '../mailbox/MailboxServer.js';

const FIXTURE_URL = new URL('../../fixtures/controls.html', import.meta.url).href;
const BLANK_URL = new URL('../../fixtures/blank.html', import.meta.url).href;
const PYTHON_CLIENT = fileURLToPath(new URL('../../../../tools/vertex_client.py', import.meta.url));
const invokeProcess = promisify(execFile);
const SHORT_READY_TIMEOUT = 100;
const MAILBOX_TIMEOUT_SECONDS = '10';

describe('CLI の操作契約', () => {
  let directory: string;
  let session: BrowserSession;
  let dispatcher: CommandDispatcher;
  let mailbox: MailboxServer | undefined;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'vertex-cli-'));
    session = new BrowserSession();
    dispatcher = new CommandDispatcher(session, new DebugOutputLayout(directory));
    await session.open({ url: FIXTURE_URL });
  });

  afterEach(async () => {
    await mailbox?.stop();
    mailbox = undefined;
    await dispatcher.dispose();
    await session.close();
    await rm(directory, { recursive: true, force: true });
  });

  it('core を注入し、観測・検索・差分を返す', async () => {
    const response = await dispatcher.dispatch('observe', {});
    expect(response.ok).toBe(true);
    expect(response.text).toContain('[Heading]');
    expect(response.text).toContain('操作テスト');
    expect(response.text).toContain('counter=0');
    const found = await dispatcher.dispatch('find', { label: '反映', kind: 'Button' });
    expect(found.text).toContain('→ click:"apply"');
    await session.page.evaluate(() => { document.getElementById('result')!.textContent = '差分の証拠'; });
    expect((await dispatcher.dispatch('observe', { diffOnly: true })).text).toContain('~ ');
    expect((await dispatcher.dispatch('ping', {})).text).toContain('viewport=1280x800');
    expect((await dispatcher.dispatch('ops', {})).text?.split('\n')).toHaveLength(14);
  });

  it('click/text/key と事後条件を順番に評価し、未達で後続を止める', async () => {
    const response = await dispatcher.dispatch('act', { steps: [
      { text: 'テスト入力', target: 'entry', expect: [{ kind: 'focused', target: 'entry' }] },
      { key: 'Enter', expect: [{ kind: 'textVisible', value: 'キー:Enter' }] },
      { click: 'apply', expect: [
        { kind: 'textVisible', value: '結果:テスト入力' },
        { kind: 'state', key: 'counter', op: 'eq', value: '1' },
        { kind: 'changed', target: 'result' },
        { kind: 'noException' },
      ] },
    ] });
    expect(response).toMatchObject({ ok: true, ready: true, settled: true, expectOk: true });
    expect(response.waitedMs).toBeGreaterThanOrEqual(0);
    const failed = await dispatcher.dispatch('act', { steps: [
      { reason: '未達で停止を確認', expect: [{ kind: 'exists', target: 'missing' }] },
      { click: 'apply' },
    ] });
    expect(failed).toMatchObject({ ok: false, expectOk: false });
    expect((await dispatcher.dispatch('observe', {})).text).toContain('counter=1');
  });

  it('popup の初期スクリプトにも core を注入する', async () => {
    const opened = session.page.waitForEvent('popup');
    await session.page.evaluate(url => { window.open(url); }, FIXTURE_URL);
    const popup = await opened;
    await popup.waitForLoadState('domcontentloaded');
    expect(await popup.evaluate(() => window.__vertex!.observe())).toContain('counter=0');
    expect((await dispatcher.dispatch('observe', {})).text).toContain('操作テスト');
    await popup.close();
    expect((await dispatcher.dispatch('ping', {})).ok).toBe(true);
  });

  it('全事後条件と比較演算子を評価する', async () => {
    await dispatcher.dispatch('act', { action: { focus: 'entry' } });
    const conditions = [
      { kind: 'textVisible', value: '未入力' }, { kind: 'textAbsent', value: '存在しない文字' },
      { kind: 'exists', target: 'apply' }, { kind: 'absent', target: 'missing' },
      { kind: 'enabled', target: 'apply' }, { kind: 'disabled', target: 'disabled' },
      { kind: 'focused', target: 'entry' }, { kind: 'unchecked', target: 'check' },
      { kind: 'urlIs', value: FIXTURE_URL }, { kind: 'urlContains', value: 'controls.html' },
      { kind: 'state', key: 'counter', op: 'ne', value: '1' },
      { kind: 'state', key: 'counter', op: 'contains', value: '0' },
      { kind: 'state', key: 'counter', op: 'lt', value: '1' },
      { kind: 'state', key: 'counter', op: 'le', value: '0' },
      { kind: 'state', key: 'counter', op: 'gt', value: '-1' },
      { kind: 'state', key: 'counter', op: 'ge', value: '0' }, { kind: 'noException' },
    ];
    expect(await dispatcher.dispatch('act', { action: { reason: '状態の確認' }, expect: conditions })).toMatchObject({ ok: true, expectOk: true });
    expect(await dispatcher.dispatch('act', { action: { set: true, target: 'check', value: true }, expect: [{ kind: 'checked', target: 'check' }] })).toMatchObject({ ok: true });
    await session.page.goto(BLANK_URL);
    expect(await dispatcher.dispatch('act', { action: { reason: '空のページを監査' }, expect: [{ kind: 'auditClean' }] })).toMatchObject({ ok: true });
  });

  it('準備待ちで遮蔽・disabled を実行せず、静止タイムアウトを返す', async () => {
    expect(await dispatcher.dispatch('act', { action: { click: 'disabled' }, readyTimeoutMilliseconds: SHORT_READY_TIMEOUT })).toMatchObject({ ok: false, ready: false });
    await session.page.evaluate(() => {
      const overlay = document.createElement('div');
      overlay.id = 'overlay';
      document.body.append(overlay);
    });
    expect(await dispatcher.dispatch('act', { action: { click: 'apply' }, readyTimeoutMilliseconds: SHORT_READY_TIMEOUT })).toMatchObject({ ok: false, ready: false });
    await session.page.evaluate(() => {
      document.getElementById('overlay')!.remove();
      document.getElementById('apply')!.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 1000, iterations: Infinity });
    });
    const unsettled = await dispatcher.dispatch('act', { action: { reason: 'アニメーション待ち' }, settleTimeoutMilliseconds: SHORT_READY_TIMEOUT });
    expect(unsettled).toMatchObject({ ok: true, settled: false });
  });

  it('シナリオの viewport・撮影・監査・未達結果を保存する', async () => {
    const path = join(directory, 'tour.json');
    const outputDirectory = join(directory, 'scenario-output');
    await writeFile(path, JSON.stringify({ name: 'tour', viewport: 'mobile', outputDirectory, stopOnFail: true, steps: [
      { navigate: FIXTURE_URL },
      { text: '再生', target: 'entry' },
      { click: 'apply', expect: [{ kind: 'textVisible', value: '結果:再生' }], capture: 'applied', audit: true },
      { reason: '未達', expect: [{ kind: 'exists', target: 'missing' }] },
      { click: 'apply' },
    ] }));
    expect(await dispatcher.dispatch('scenario.run', { path })).toMatchObject({ ok: false, verdict: 'fail', failedSteps: 1, status: 'completed' });
    const result = JSON.parse(await readFile(join(outputDirectory, 'result.json'), 'utf8')) as { steps: { waitedMs: number }[]; warningCount: number };
    expect(result.steps).toHaveLength(4);
    expect(result.steps.every(step => step.waitedMs >= 0)).toBe(true);
    expect(result.warningCount).toBeGreaterThanOrEqual(0);
    expect(await readdir(outputDirectory)).toEqual(expect.arrayContaining(['applied.png', 'audit-3.json', 'result.json']));
    expect(session.page.viewportSize()).toEqual({ width: 390, height: 664 });
    expect(await session.page.evaluate(() => navigator.maxTouchPoints)).toBeGreaterThan(0);
    expect(await dispatcher.dispatch('scenario.status', {})).toMatchObject({ verdict: 'fail', failedSteps: 1 });
  });

  it('残りの入力語彙と座標操作を実行する', async () => {
    const response = await dispatcher.dispatch('act', { steps: [
      { focus: 'entry' }, { type: 'abc' }, { hover: 'apply' },
      { doubleClick: 'apply', expect: [{ kind: 'textVisible', value: 'ダブルクリック' }] },
      { rightClick: 'apply', expect: [{ kind: 'textVisible', value: '右クリック' }] },
      { select: true, target: 'choice', item: '次' },
      { set: true, target: 'range', value: 50 },
      { set: true, target: 'radio', value: true, expect: [{ kind: 'checked', target: 'radio' }] },
      { set: true, target: 'radio', value: false, expect: [{ kind: 'unchecked', target: 'radio' }] },
      { set: true, target: 'switch', value: true, expect: [{ kind: 'checked', target: 'switch' }] },
      { hover: { x: 20, y: 20 } }, { pointer: true, x: 20, y: 20 },
      { drag: true, from: { x: 20, y: 20 }, to: { x: 40, y: 40 }, milliseconds: 0 },
      { scroll: true, deltaY: 100 }, { scrollTo: 'distant' },
      { navigate: BLANK_URL }, { back: true, expect: [{ kind: 'urlIs', value: FIXTURE_URL }] },
    ] });
    expect(response).toMatchObject({ ok: true, ready: true });
  });

  it('mobile で tap と実タッチ swipe を実行する', async () => {
    await dispatcher.dispatch('session.begin', { options: { viewport: 'mobile', url: FIXTURE_URL } });
    expect(await dispatcher.dispatch('act', { action: { tap: 'apply' }, expect: [{ kind: 'state', key: 'counter', value: '1' }] })).toMatchObject({ ok: true });
    expect(await dispatcher.dispatch('act', { action: { swipe: true, from: { x: 200, y: 300 }, to: 'up' }, expect: [{ kind: 'state', key: 'touches', op: 'ge', value: '2' }] })).toMatchObject({ ok: true });
  });

  it('シナリオ成功とタイムアウトを保存し、後続へ操作を漏らさない', async () => {
    const path = join(directory, 'deadline.json');
    await writeFile(path, JSON.stringify({ name: 'passing', steps: [{ navigate: FIXTURE_URL, expect: [{ kind: 'exists', target: 'apply' }] }] }));
    expect(await dispatcher.dispatch('scenario.run', { path })).toMatchObject({ ok: true, verdict: 'pass', failedSteps: 0 });
    await writeFile(path, JSON.stringify({ name: 'deadline', steps: [
      { click: 'missing', readyTimeoutMilliseconds: 10000 }, { click: 'apply' },
    ] }));
    const timeoutMilliseconds = 1500;
    expect(await dispatcher.dispatch('scenario.run', { path, timeoutMilliseconds })).toMatchObject({ ok: false, status: 'timedOut', verdict: 'fail', failedSteps: 1 });
    const saved = JSON.parse(await readFile(join(directory, 'DebugOutput/scenarios/deadline/result.json'), 'utf8')) as { steps: unknown[] };
    expect(saved.steps).toHaveLength(1);
    expect(await dispatcher.dispatch('session.begin', { options: { url: FIXTURE_URL } })).toMatchObject({ ok: true });
    expect((await dispatcher.dispatch('observe', {})).text).toContain('counter=0');
  });

  it('操作中の console.error を noException の失敗として返す', async () => {
    await session.page.evaluate(() => {
      document.getElementById('apply')!.addEventListener('click', () => { console.error('action-error'); });
    });
    expect(await dispatcher.dispatch('act', { action: { click: 'apply' }, expect: [{ kind: 'noException' }] })).toMatchObject({ ok: false, expectOk: false });
    expect((await dispatcher.dispatch('logs', { level: 'error', count: 1 })).text).toContain('action-error');
  });

  it('セッションの各手を記録し、未達のコメントを付けて書き出す', async () => {
    const begun = await dispatcher.dispatch('session.begin', { options: { url: FIXTURE_URL } });
    await dispatcher.dispatch('act', { action: { click: 'apply', reason: '記録確認' }, expect: [{ kind: 'exists', target: 'missing' }] });
    await dispatcher.dispatch('session.end', {});
    const exported = await dispatcher.dispatch('session.export', { name: 'recording' });
    expect(exported).toMatchObject({ ok: true, session: begun.session });
    const scenario = JSON.parse(await readFile(exported.path!, 'utf8')) as { steps: Record<string, unknown>[] };
    expect(scenario.steps[0]).toMatchObject({ navigate: FIXTURE_URL });
    expect(scenario.steps[1]).toMatchObject({ click: 'apply', reason: '記録確認', comment: '元の実行では未達' });
    const logPath = join(directory, 'DebugOutput', 'agent', begun.session!, 'actions.jsonl');
    expect(JSON.parse((await readFile(logPath, 'utf8')).trim())).toMatchObject({ action: { click: 'apply' }, expectOk: false, reason: '記録確認', elapsedMs: expect.any(Number) });
  });

  it('Python クライアントと往復し、要求・応答を削除する', async () => {
    const mailboxDirectory = join(directory, 'mailbox');
    mailbox = new MailboxServer(mailboxDirectory, dispatcher);
    await mailbox.start();
    const invocation = await invokeProcess('python3', [PYTHON_CLIENT, 'observe', '--mailbox', mailboxDirectory, '--timeout', MAILBOX_TIMEOUT_SECONDS]);
    expect(JSON.parse(invocation.stdout)).toMatchObject({ ok: true, op: 'observe', text: expect.stringContaining('操作テスト') });
    await expect.poll(async () => (await readdir(mailboxDirectory)).sort()).toEqual(['.enabled']);
    await writeFile(join(mailboxDirectory, 'req-invalid.json'), JSON.stringify({ op: 'act', args: '{' }));
    await expect.poll(async () => readdir(mailboxDirectory)).toContain('res-invalid.json');
    expect(JSON.parse(await readFile(join(mailboxDirectory, 'res-invalid.json'), 'utf8'))).toMatchObject({ ok: false, op: 'act' });
  });

  it('PNG の実画素から白紙を区別する', async () => {
    const populated = await dispatcher.dispatch('capture', { name: 'controls' });
    expect(populated).toMatchObject({ ok: true, blank: false, width: 1280, height: 800 });
    await session.page.goto(BLANK_URL);
    expect(await dispatcher.dispatch('capture', { name: 'white' })).toMatchObject({ ok: true, blank: true, width: 1280, height: 800 });
    expect(await readFile(populated.path!)).toEqual(expect.any(Buffer));
  });

  it('未処理例外の PNG・観測・例外文を保存する', async () => {
    const errorEvent = session.page.waitForEvent('pageerror');
    await session.page.evaluate(() => { setTimeout(() => { throw new Error('forensics-test'); }, 0); });
    await errorEvent;
    const response = await dispatcher.dispatch('forensics.latest', {});
    expect(response.ok).toBe(true);
    expect(await readdir(response.path!)).toEqual(expect.arrayContaining(['capture.png', 'observation.txt', 'exception.txt']));
    expect(await readFile(join(response.path!, 'exception.txt'), 'utf8')).toContain('forensics-test');
    expect((await dispatcher.dispatch('logs', { level: 'error' })).text).toContain('forensics-test');
  });
});
