import { beforeEach, describe, expect, it } from 'bun:test';
import { PassThrough } from 'node:stream';
import { setTimeout as sleep } from 'node:timers/promises';
import { reset } from '@logtape/logtape';
import { HostWatch, type HostWatchOptions } from '#mcp/host-watch';

const TICK_MS = 20;

let reasons: string[];
let stdin: PassThrough;
let ppid: number;

beforeEach(async () => {
  await reset();
  reasons = [];
  stdin = new PassThrough();
  ppid = 4242;
});

function watch(options: Partial<HostWatchOptions> = {}): HostWatch {
  const watcher = new HostWatch({
    stdin,
    readPpid: () => ppid,
    ppidPollMs: 0,
    startupTimeoutMs: 0,
    onHostGone: (reason) => reasons.push(reason),
    ...options,
  });
  watcher.start();
  return watcher;
}

describe('HostWatch', () => {
  it('ends the session once on an error on stdin, and not again on end after it', async () => {
    watch();

    stdin.emit(
      'error',
      Object.assign(new Error('read ECONNRESET'), { code: 'ECONNRESET' }),
    );
    stdin.emit('end');
    await sleep(TICK_MS);

    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('ECONNRESET');
    expect(stdin.destroyed).toBe(true);
  });

  it('ends the session when stdin ends', async () => {
    watch();

    stdin.end();
    stdin.resume();
    await sleep(TICK_MS);

    expect(reasons).toEqual(['the MCP stream closed']);
  });

  it('ends the session when the parent changes, naming both pids', async () => {
    watch({ ppidPollMs: TICK_MS });

    ppid = 1;
    await sleep(TICK_MS * 3);

    expect(reasons).toHaveLength(1);
    expect(reasons[0]).toContain('4242');
    expect(reasons[0]).toContain('pid 1');
  });

  it('ends the session when the host sends nothing within the startup timeout', async () => {
    watch({ startupTimeoutMs: TICK_MS });

    await sleep(TICK_MS * 3);

    expect(reasons).toEqual([
      `the host sent nothing within ${TICK_MS} ms of the launch`,
    ]);
  });

  it('keeps the session once the host speaks', async () => {
    const watcher = watch({ startupTimeoutMs: TICK_MS * 2 });

    watcher.noticeInput();
    await sleep(TICK_MS * 4);

    expect(reasons).toEqual([]);
  });

  it('neither polls nor times out when both are 0', async () => {
    watch();

    ppid = 1;
    await sleep(TICK_MS * 3);

    expect(reasons).toEqual([]);
  });
});
