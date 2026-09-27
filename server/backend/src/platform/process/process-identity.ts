import { spawnSync } from 'node:child_process';

/** Signal 0 checks without sending: `ESRCH` is no such process, `EPERM` one that is not ours. */
export function processRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

/**
 * When the process at `pid` started, as `ps` prints it, or `null` when no
 * process has that pid. A pid is reused after a reboot or once its process is
 * gone; the pair of pid and start time is not.
 */
export function processStartOf(pid: number): string | null {
  const ps = spawnSync('ps', ['-o', 'lstart=', '-p', String(pid)], {
    encoding: 'utf8',
  });
  const start = ps.status === 0 ? ps.stdout.trim() : '';
  return start === '' ? null : start;
}

/** The process at `pid` runs, and is the one that started at `start`. */
export function sameProcessRuns(pid: number, start: string): boolean {
  return processRunning(pid) && processStartOf(pid) === start;
}
