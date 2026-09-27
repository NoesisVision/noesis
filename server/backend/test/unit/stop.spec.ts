import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { type ChildProcess, spawn } from 'node:child_process';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import type { ProcessIdentity } from '#backend/boot/server-lock';
import { stopDaemon } from '#backend/boot/stop';
import { processStartOf } from '#backend/platform/process/process-identity';
import { runningProcess } from '../support/processes';

let dir: string;
let lockPath: string;
const children: ChildProcess[] = [];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'noesis-stop-'));
  lockPath = join(dir, 'server.lock');
});

afterEach(async () => {
  for (const child of children.splice(0)) child.kill('SIGKILL');
  await rm(dir, { recursive: true, force: true });
});

async function writeLock(owner: ProcessIdentity): Promise<void> {
  await writeFile(
    lockPath,
    JSON.stringify({
      ...owner,
      instance: 'daemon',
      startedAt: new Date().toISOString(),
      port: 1,
      version: '1.0.0',
    }),
  );
}

/** Stands in for a daemon: on SIGTERM it removes its lock and exits. */
async function fakeDaemon(): Promise<ChildProcess> {
  const child = spawn(
    process.execPath,
    [
      '-e',
      `process.on('SIGTERM', () => { require('node:fs').rmSync(${JSON.stringify(lockPath)}, { force: true }); process.exit(0); }); setInterval(() => {}, 1000);`,
    ],
    { stdio: 'ignore' },
  );
  children.push(child);
  await new Promise((resolve) => child.once('spawn', resolve));
  await sleep(200);
  return child;
}

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

describe('stopDaemon', () => {
  it('sends a running owner SIGTERM and waits for its lock to go', async () => {
    const daemon = await fakeDaemon();
    const pid = daemon.pid ?? 0;
    await writeLock({ pid, processStart: processStartOf(pid) ?? '' });

    const outcome = await stopDaemon(lockPath, 5_000);

    expect(outcome.kind).toBe('stopped');
    expect(await exists(lockPath)).toBe(false);
  });

  it('reports a lock whose pid names an unrelated process as stale, signalling nothing', async () => {
    const { child, identity } = await runningProcess();
    children.push(child);
    await writeLock({
      pid: identity.pid,
      processStart: 'Mon Jan  1 00:00:00 2001',
    });

    const outcome = await stopDaemon(lockPath, 1_000);
    await sleep(100);

    expect(outcome.kind).toBe('stale');
    expect(child.exitCode).toBeNull();
    expect(child.signalCode).toBeNull();
    expect(await exists(lockPath)).toBe(true);
  });

  it('reports a daemon that outlives the wait by its pid', async () => {
    const { child, identity } = await runningProcess();
    children.push(child);
    // Stopped, it cannot act on SIGTERM until the kill in `afterEach`.
    child.kill('SIGSTOP');
    await writeLock(identity);

    const outcome = await stopDaemon(lockPath, 300);

    expect(outcome).toMatchObject({
      kind: 'still-running',
      lock: { pid: identity.pid },
    });
  });

  it('says so when nothing runs', async () => {
    expect(await stopDaemon(lockPath)).toEqual({ kind: 'not-running' });
  });
});
