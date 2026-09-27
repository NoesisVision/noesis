import { afterAll, describe, expect, it } from 'bun:test';
import {
  mkdtemp,
  readFile,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reset, withContext } from '@logtape/logtape';
import {
  configureLogging,
  LOG_MAX_AGE_MS,
  logFileName,
} from '#backend/platform/logging/logging';
import { serverLogger } from '#backend/platform/logging/server-logger';

const DAY_MS = 24 * 60 * 60 * 1000;

const logDir = await mkdtemp(join(tmpdir(), 'noesis-logs-'));

afterAll(async () => {
  await reset();
  await rm(logDir, { recursive: true, force: true });
});

const exists = (path: string) =>
  stat(path).then(
    () => true,
    () => false,
  );

async function oldLog(name: string, ageMs: number): Promise<string> {
  const path = join(logDir, name);
  await writeFile(path, '{}\n');
  const when = new Date(Date.now() - ageMs);
  await utimes(path, when, when);
  return path;
}

describe('logging', () => {
  it('writes JSON lines to .noesis/logs/noesis-<session>.log with category, properties and request context', async () => {
    await configureLogging({
      logDir,
      sessionId: 'abc',
      production: true,
      level: 'warning',
    });
    const log = serverLogger('spec');

    log.info('below the level, not written');
    withContext({ requestId: 'req-1', tool: 'list-changes' }, () => {
      log.warn('indexed {files} files', { files: 3 });
    });

    const lines = (await readFile(join(logDir, logFileName('abc')), 'utf8'))
      .trim()
      .split('\n')
      .map((line) => JSON.parse(line));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatchObject({
      level: 'WARN',
      logger: 'noesis.server.spec',
      message: 'indexed 3 files',
      properties: { files: 3, requestId: 'req-1', tool: 'list-changes' },
    });
    expect(typeof lines[0]['@timestamp']).toBe('string');
  });

  it('sweeps logs of sessions older than the max age, keeps younger ones and other files', async () => {
    await reset();
    const old = await oldLog(logFileName('old'), LOG_MAX_AGE_MS + DAY_MS);
    const young = await oldLog(logFileName('young'), DAY_MS);
    const stray = await oldLog('notes.txt', LOG_MAX_AGE_MS + DAY_MS);

    await configureLogging({
      logDir,
      sessionId: 'me',
      production: true,
      level: 'info',
    });

    expect(await exists(old)).toBe(false);
    expect(await exists(young)).toBe(true);
    expect(await exists(stray)).toBe(true);
  });
});
