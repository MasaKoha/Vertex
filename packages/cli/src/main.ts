import { resolve } from 'node:path';
import { BrowserSession } from './browser/BrowserSession.js';
import { DebugOutputLayout } from './artifacts/DebugOutputLayout.js';
import { CommandDispatcher } from './dispatch/CommandDispatcher.js';
import { MailboxServer } from './mailbox/MailboxServer.js';
import type { CommandResponse } from './dispatch/Response.js';

const USAGE = 'vertex serve --url <URL> [--mailbox <dir>] [--viewport desktop|mobile] [--headed]\nvertex <op> [\'<json>\'] [--url <URL>] [--viewport desktop|mobile] [--headed]';

function parseArguments(tokens: string[]): { operation: string; arguments: unknown; url: string; viewport: 'desktop' | 'mobile'; headed: boolean; mailbox?: string } {
  const operation = tokens[0];
  if (!operation) { throw new Error(USAGE); }
  const options: Record<string, string> = {};
  let headed = false;
  let payload: string | undefined;
  for (let index = 1; index < tokens.length; index += 1) {
    const token = tokens[index]!;
    if (token === '--headed') { headed = true; continue; }
    if (['--url', '--mailbox', '--viewport'].includes(token)) {
      const value = tokens[index + 1];
      if (!value || value.startsWith('--')) { throw new Error(`${token} の値がありません`); }
      options[token] = value;
      index += 1;
      continue;
    }
    if (token.startsWith('--') || payload !== undefined) { throw new Error(`不明な引数: ${token}`); }
    payload = token;
  }
  const viewport = options['--viewport'] ?? 'desktop';
  if (viewport !== 'desktop' && viewport !== 'mobile') { throw new Error('viewport は desktop / mobile です'); }
  if (operation === 'serve' && !options['--url']) { throw new Error('serve には --url が必要です'); }
  return { operation, arguments: JSON.parse(payload ?? '{}') as unknown, url: options['--url'] ?? process.env['VERTEX_URL'] ?? 'about:blank', viewport, headed,
    ...(options['--mailbox'] === undefined ? {} : { mailbox: options['--mailbox'] }) };
}

async function main(): Promise<void> {
  if (process.argv.includes('--help')) { process.stdout.write(`${USAGE}\n`); return; }
  const options = parseArguments(process.argv.slice(2));
  const layout = new DebugOutputLayout();
  const session = new BrowserSession();
  const dispatcher = new CommandDispatcher(session, layout);
  let server: MailboxServer | undefined;
  try {
    await session.open({ url: options.url, viewport: options.viewport, headed: options.headed });
    if (options.operation !== 'serve') {
      const response = await dispatcher.dispatch(options.operation, options.arguments);
      process.stdout.write(`${JSON.stringify(response)}\n`);
      process.exitCode = response.ok ? 0 : 1;
      return;
    }
    const directory = resolve(options.mailbox ?? process.env['VERTEX_MAILBOX'] ?? layout.mailbox());
    server = new MailboxServer(directory, dispatcher);
    await server.start();
    process.stderr.write(`Vertex mailbox: ${directory}\n`);
    await new Promise<void>(complete => {
      const stop = (): void => {
        process.off('SIGINT', stop);
        process.off('SIGTERM', stop);
        complete();
      };
      process.once('SIGINT', stop);
      process.once('SIGTERM', stop);
    });
  } finally {
    try { await server?.stop(); }
    finally {
      try { await dispatcher.dispose(); }
      finally { await session.close(); }
    }
  }
}

await main().catch(exception => {
  const response: CommandResponse = { ok: false, op: process.argv[2] ?? 'unknown', error: String(exception), elapsedMs: 0 };
  process.stdout.write(`${JSON.stringify(response)}\n`);
  process.exitCode = 1;
});
