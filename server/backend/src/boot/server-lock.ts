import { readFileSync } from 'node:fs';
import { z } from 'zod';
import {
  processStartOf,
  sameProcessRuns,
} from '#backend/platform/process/process-identity';

/**
 * `.noesis/server.lock`: which process serves this repository. Written
 * without `port` and `version` while the daemon starts, rewritten with them
 * once it listens.
 */
export const ServerLock = z.object({
  pid: z.int().positive(),
  processStart: z.string().min(1),
  instance: z.string().min(1),
  startedAt: z.iso.datetime(),
  port: z.int().min(1).max(65535).optional(),
  version: z.string().optional(),
});
export type ServerLock = z.infer<typeof ServerLock>;

/** Who a lock or a reclaim guard names: a pid, and when that process started. */
export const ProcessIdentity = ServerLock.pick({
  pid: true,
  processStart: true,
});
export type ProcessIdentity = z.infer<typeof ProcessIdentity>;

export function currentProcess(): ProcessIdentity {
  const processStart = processStartOf(process.pid);
  if (processStart === null) {
    throw new Error(`ps does not know this process (pid ${process.pid}).`);
  }
  return { pid: process.pid, processStart };
}

/** Held while the process it names runs: its pid alone may name another one by now. */
export function ownerRuns(owner: ProcessIdentity): boolean {
  return sameProcessRuns(owner.pid, owner.processStart);
}

export function isSameProcess(a: ProcessIdentity, b: ProcessIdentity): boolean {
  return a.pid === b.pid && a.processStart === b.processStart;
}

/** `null` when there is no lock, or none this version can read. */
export function readServerLock(path: string): ServerLock | null {
  const text = readTextIfExists(path);
  return text === null ? null : parseJson(ServerLock, text);
}

export function parseJson<T>(schema: z.ZodType<T>, text: string): T | null {
  try {
    const parsed = schema.safeParse(JSON.parse(text));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export function readTextIfExists(path: string): string | null {
  try {
    return readFileSync(path, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
