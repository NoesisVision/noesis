import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import type { ChildProcess } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ServerRegistration } from '#backend/boot/registration';
import { currentProcess, type ServerLock } from '#backend/boot/server-lock';
import { exitedProcess, runningProcess } from '../support/processes';

let dir: string;
let path: string;
const children: ChildProcess[] = [];

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'noesis-lock-'));
  path = join(dir, 'server.lock');
});

afterEach(async () => {
  for (const child of children.splice(0)) child.kill();
  await rm(dir, { recursive: true, force: true });
});

const stored = async (): Promise<ServerLock> =>
  JSON.parse(await readFile(path, 'utf8')) as ServerLock;

const exists = (file: string) =>
  stat(file).then(
    () => true,
    () => false,
  );

async function writeLock(lock: Partial<ServerLock>): Promise<void> {
  await writeFile(
    path,
    JSON.stringify({
      instance: 'theirs',
      startedAt: new Date().toISOString(),
      ...lock,
    }),
  );
}

async function foreignOwner() {
  const running = await runningProcess();
  children.push(running.child);
  return running.identity;
}

describe('ServerRegistration', () => {
  it('takes a free lock, without a port until it listens', async () => {
    const acquired = await ServerRegistration.acquire(path, 'mine');

    expect(acquired.held).toBe(true);
    expect(await stored()).toMatchObject({
      ...currentProcess(),
      instance: 'mine',
    });
    expect((await stored()).port).toBeUndefined();
  });

  it('adds the port and the version once it listens', async () => {
    const acquired = await ServerRegistration.acquire(path, 'mine');
    if (!acquired.held) throw new Error('not held');

    acquired.registration.publish({ port: 4321, version: '1.2.3' });

    expect(await stored()).toMatchObject({
      instance: 'mine',
      port: 4321,
      version: '1.2.3',
    });
  });

  it('retakes a lock whose pid is dead', async () => {
    await writeLock(await exitedProcess());

    const acquired = await ServerRegistration.acquire(path, 'mine');

    expect(acquired.held).toBe(true);
    expect((await stored()).instance).toBe('mine');
  });

  it('retakes a lock whose pid now names another process', async () => {
    const other = await foreignOwner();
    await writeLock({
      pid: other.pid,
      processStart: 'Mon Jan  1 00:00:00 2001',
    });

    const acquired = await ServerRegistration.acquire(path, 'mine');

    expect(acquired.held).toBe(true);
    expect((await stored()).instance).toBe('mine');
  });

  it('leaves a running owner the lock, whether or not it answers', async () => {
    // The owner is a `sleep`: it has no port and answers nothing.
    const owner = await foreignOwner();
    await writeLock({ ...owner, port: 1 });

    const acquired = await ServerRegistration.acquire(path, 'mine');

    expect(acquired).toEqual({
      held: false,
      owner: expect.objectContaining({
        pid: owner.pid,
        instance: 'theirs',
      }) as ServerLock,
    });
    expect((await stored()).instance).toBe('theirs');
  });

  it('takes a lock naming this very process as its own', async () => {
    await writeLock({ ...currentProcess(), port: 1 });

    const acquired = await ServerRegistration.acquire(path, 'mine');

    expect(acquired.held).toBe(true);
    expect((await stored()).instance).toBe('mine');
  });

  it('ends two daemons reclaiming one stale lock with exactly one holder', async () => {
    await writeLock(await exitedProcess());
    const a = await foreignOwner();
    const b = await foreignOwner();

    const results = await Promise.all([
      ServerRegistration.acquire(path, 'a', a),
      ServerRegistration.acquire(path, 'b', b),
    ]);

    expect(results.filter((result) => result.held)).toHaveLength(1);
    expect(['a', 'b']).toContain((await stored()).instance);
    expect(await exists(`${path}.reclaim`)).toBe(false);
  });

  it('removes a reclaim guard left by a dead owner', async () => {
    await writeLock(await exitedProcess());
    await writeFile(`${path}.reclaim`, JSON.stringify(await exitedProcess()));

    const acquired = await ServerRegistration.acquire(path, 'mine');

    expect(acquired.held).toBe(true);
    expect(await exists(`${path}.reclaim`)).toBe(false);
  });

  it('releases its own lock, and leaves alone one another instance took', async () => {
    const first = await ServerRegistration.acquire(path, 'mine');
    if (!first.held) throw new Error('not held');
    first.registration.release();
    expect(await exists(path)).toBe(false);

    const second = await ServerRegistration.acquire(path, 'mine');
    if (!second.held) throw new Error('not held');
    await writeLock({ ...(await foreignOwner()) });
    second.registration.release();

    expect((await stored()).instance).toBe('theirs');
  });
});
