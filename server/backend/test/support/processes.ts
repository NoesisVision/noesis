import { type ChildProcess, spawn } from 'node:child_process';
import type { ProcessIdentity } from '#backend/boot/server-lock';
import { processStartOf } from '#backend/platform/process/process-identity';

/** A process that runs until killed, and who it is. */
export async function runningProcess(): Promise<{
  child: ChildProcess;
  identity: ProcessIdentity;
}> {
  const child = spawn('sleep', ['60'], { stdio: 'ignore' });
  await new Promise((resolve) => child.once('spawn', resolve));
  const pid = child.pid ?? 0;
  return { child, identity: { pid, processStart: processStartOf(pid) ?? '' } };
}

/** Who a process that has exited was: its pid names nothing now. */
export async function exitedProcess(): Promise<ProcessIdentity> {
  const child = spawn('true', { stdio: 'ignore' });
  await new Promise((resolve) => child.once('exit', resolve));
  return { pid: child.pid ?? 0, processStart: 'Thu Jan  1 00:00:00 1970' };
}
