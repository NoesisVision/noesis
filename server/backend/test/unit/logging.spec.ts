import { afterAll, describe, expect, it } from 'bun:test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { reset, withContext } from '@logtape/logtape';
import {
  configureLogging,
  LOG_FILE_NAME,
  parseLogLevel,
  serverLogger,
} from '../../src/platform/logging/logging.js';

const logDir = await mkdtemp(join(tmpdir(), 'noesis-logs-'));

afterAll(async () => {
  await reset();
  await rm(logDir, { recursive: true, force: true });
});

describe('logging', () => {
  it('parses NOESIS_LOG_LEVEL and falls back to info', () => {
    expect(parseLogLevel('debug')).toBe('debug');
    expect(parseLogLevel('warning')).toBe('warning');
    expect(parseLogLevel('loud')).toBe('info');
    expect(parseLogLevel(undefined)).toBe('info');
  });

  it('writes JSON lines to .noesis/logs/noesis.log with category, properties and request context', async () => {
    await configureLogging({ logDir, production: true, level: 'warning' });
    const log = serverLogger('spec');

    log.info('below the level, not written');
    withContext({ requestId: 'req-1', tool: 'list-changes' }, () => {
      log.warn('indexed {files} files', { files: 3 });
    });

    const lines = (await readFile(join(logDir, LOG_FILE_NAME), 'utf8'))
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
});
