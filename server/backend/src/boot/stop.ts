import { setTimeout as sleep } from 'node:timers/promises';
import { ownerRuns, readServerLock, type ServerLock } from './server-lock';
import { locateRepository } from './workspace';

const STOP_TIMEOUT_MS = 10_000;
const POLL_MS = 50;

export type StopOutcome =
  | { kind: 'not-running' }
  /** The lock names a process that no longer runs; nothing was touched. */
  | { kind: 'stale'; lock: ServerLock }
  | { kind: 'stopped'; lock: ServerLock }
  | { kind: 'still-running'; lock: ServerLock };

/**
 * Ends the daemon `server.lock` names with SIGTERM and waits for it to
 * release the lock. A lock whose owner is gone is only reported: its pid may
 * name an unrelated process by now, which must get no signal.
 */
export async function stopDaemon(
  lockPath: string,
  timeoutMs = STOP_TIMEOUT_MS,
): Promise<StopOutcome> {
  const lock = readServerLock(lockPath);
  if (lock === null) return { kind: 'not-running' };
  if (!ownerRuns(lock)) return { kind: 'stale', lock };
  process.kill(lock.pid, 'SIGTERM');
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (readServerLock(lockPath)?.instance !== lock.instance) {
      return { kind: 'stopped', lock };
    }
    await sleep(POLL_MS);
  }
  return { kind: 'still-running', lock };
}

/** `noesis stop`: for the repository around the working directory, or `NOESIS_ROOT`. */
export async function stop(): Promise<void> {
  const { noesis } = locateRepository();
  const outcome = await stopDaemon(noesis.serverLockPath);
  console.error(describe(outcome, noesis.root));
  process.exit(outcome.kind === 'still-running' ? 1 : 0);
}

function describe(outcome: StopOutcome, root: string): string {
  switch (outcome.kind) {
    case 'not-running':
      return `No Noesis daemon runs for ${root}.`;
    case 'stale':
      return `The lock names pid ${outcome.lock.pid}, which no longer runs; nothing was stopped or removed. The next daemon reclaims it.`;
    case 'stopped':
      return `Stopped the Noesis daemon for ${root} (pid ${outcome.lock.pid}).`;
    case 'still-running':
      return `The Noesis daemon (pid ${outcome.lock.pid}) still runs ${STOP_TIMEOUT_MS / 1000} seconds after SIGTERM.`;
  }
}
