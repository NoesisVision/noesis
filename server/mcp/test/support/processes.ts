import { spawn } from 'node:child_process';
import type { ProcessIdentity } from '#backend/boot/server-lock';

/** Who a process that has exited was: its pid names nothing now. */
export async function exitedProcess(): Promise<ProcessIdentity> {
  const child = spawn('true', { stdio: 'ignore' });
  await new Promise((resolve) => child.once('exit', resolve));
  return { pid: child.pid ?? 0, processStart: 'Thu Jan  1 00:00:00 1970' };
}
