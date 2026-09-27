import { rmSync } from 'node:fs';
import { setTimeout as sleep } from 'node:timers/promises';
import {
  createJsonFile,
  writeJsonFile,
} from '#backend/platform/files/json-file';
import {
  currentProcess,
  isSameProcess,
  ownerRuns,
  parseJson,
  ProcessIdentity,
  readServerLock,
  readTextIfExists,
  ServerLock,
} from './server-lock';

/** How long a daemon that lost the reclaim guard waits before it reads the lock again. */
const RECLAIM_RETRY_MS = 100;

export type Acquisition =
  | { held: true; registration: ServerRegistration }
  | { held: false; owner: ServerLock };

/**
 * This daemon's claim on `.noesis/server.lock`, taken before it binds and
 * published once it listens. A lock is held while the process it names runs;
 * nothing else revokes it, so a daemon that is stuck still owns the
 * repository.
 */
export class ServerRegistration {
  private readonly path: string;
  private lock: ServerLock;

  private constructor(path: string, lock: ServerLock) {
    this.path = path;
    this.lock = lock;
  }

  /** Takes the lock, or names the running daemon that holds it. */
  static async acquire(
    path: string,
    instance: string,
    self: ProcessIdentity = currentProcess(),
  ): Promise<Acquisition> {
    const lock: ServerLock = {
      ...self,
      instance,
      startedAt: new Date().toISOString(),
    };
    const held = (): Acquisition => ({
      held: true,
      registration: new ServerRegistration(path, lock),
    });
    for (;;) {
      if (createJsonFile(path, ServerLock, lock)) return held();
      const text = readTextIfExists(path);
      // Released since the create refused: try again.
      if (text === null) continue;
      const stored = parseJson(ServerLock, text);
      // `bun --watch` restarts in place: same pid, same start.
      if (stored !== null && isSameProcess(stored, self)) {
        writeJsonFile(path, ServerLock, lock);
        return held();
      }
      if (stored !== null && ownerRuns(stored)) {
        return { held: false, owner: stored };
      }
      if (await reclaim(path, text, lock)) return held();
    }
  }

  get instance(): string {
    return this.lock.instance;
  }

  /** Holding the lock proves nobody else writes it. */
  publish(listening: { port: number; version: string }): void {
    this.lock = { ...this.lock, ...listening };
    writeJsonFile(this.path, ServerLock, this.lock);
  }

  /** Leaves alone a lock another daemon has taken since. */
  release(): void {
    if (readServerLock(this.path)?.instance !== this.lock.instance) return;
    // A benign race: another daemon cannot take a lock whose owner still runs.
    rmSync(this.path, { force: true });
  }
}

/**
 * Replaces the stale lock `judged` under a guard, so two daemons judging one
 * lock stale cannot both end up holding it. `false` sends the caller back to
 * reading the lock: the guard was taken, or the lock changed since.
 */
async function reclaim(
  path: string,
  judged: string,
  lock: ServerLock,
): Promise<boolean> {
  const guard = `${path}.reclaim`;
  const self: ProcessIdentity = {
    pid: lock.pid,
    processStart: lock.processStart,
  };
  if (!createJsonFile(guard, ProcessIdentity, self)) {
    await waitOrClearGuard(guard);
    return false;
  }
  try {
    if (readTextIfExists(path) !== judged) return false;
    rmSync(path, { force: true });
    return createJsonFile(path, ServerLock, lock);
  } finally {
    rmSync(guard, { force: true });
  }
}

/** A guard is held for milliseconds; only a crash mid-reclaim leaves one behind. */
async function waitOrClearGuard(guard: string): Promise<void> {
  const text = readTextIfExists(guard);
  if (text === null) return;
  const owner = parseJson(ProcessIdentity, text);
  if (owner === null || !ownerRuns(owner)) {
    if (readTextIfExists(guard) === text) rmSync(guard, { force: true });
    return;
  }
  await sleep(RECLAIM_RETRY_MS);
}
