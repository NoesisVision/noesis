import { type ChildProcess, spawn } from 'node:child_process';
import { resolve } from 'node:path';

const serverRoot = resolve(import.meta.dir, '..');

const backend = spawn(process.execPath, ['run', 'dev'], {
  cwd: resolve(serverRoot, 'backend'),
  stdio: 'inherit',
});
const frontend = spawn(process.execPath, ['run', 'dev'], {
  cwd: resolve(serverRoot, 'frontend'),
  stdio: 'inherit',
});

const children = [backend, frontend];
let shuttingDown = false;

function terminate(signal: NodeJS.Signals = 'SIGTERM'): void {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const child of children) {
    if (child.exitCode === null && child.signalCode === null)
      child.kill(signal);
  }
}

function watch(child: ChildProcess, name: string): void {
  child.once('error', (error) => {
    console.error(`[dev] ${name} failed to start:`, error);
    process.exitCode = 1;
    terminate();
  });
  child.once('exit', (code, signal) => {
    if (shuttingDown) return;
    if (code !== 0) {
      console.error(
        `[dev] ${name} exited ${signal === null ? `with code ${code}` : `from ${signal}`}`,
      );
      process.exitCode = code ?? 1;
    }
    terminate();
  });
}

watch(backend, 'backend');
watch(frontend, 'frontend');

process.once('SIGINT', () => terminate('SIGINT'));
process.once('SIGTERM', () => terminate('SIGTERM'));

await Promise.all(
  children.map(
    (child) =>
      new Promise<void>((resolveExit) => child.once('close', resolveExit)),
  ),
);
