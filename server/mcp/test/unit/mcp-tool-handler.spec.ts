import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { configure, type LogRecord, reset } from '@logtape/logtape';
import type { ServerContext } from '@modelcontextprotocol/server';
import { BackendError } from '#mcp/backend/backend-error';
import { logged } from '#mcp/server/tool-handler';
import { success } from '#mcp/server/tool-result';
import { WorkingFileError } from '#mcp/session/working-file-error';
import { textOf } from '../support/tool-result';

// The wrapper only hands it on, so its contents do not matter here.
const ctx = {} as ServerContext;

let records: LogRecord[];

beforeEach(async () => {
  records = [];
  await configure({
    reset: true,
    sinks: { memory: (record) => records.push(record) },
    loggers: [
      { category: 'noesis', sinks: ['memory'], lowestLevel: 'debug' },
      { category: ['logtape', 'meta'], sinks: [], lowestLevel: 'warning' },
    ],
  });
});

afterEach(() => reset());

describe('logged', () => {
  it('passes a result through untouched', async () => {
    const handler = logged('a_tool', async () => success('done', { ok: true }));

    const result = await handler({}, ctx);

    expect(result).toEqual({
      content: [{ type: 'text', text: 'done' }],
      structuredContent: { ok: true },
    });
    expect(records).toEqual([]);
  });

  it('hands the SDK context on to the tool', async () => {
    let seen: ServerContext | undefined;
    const handler = logged('a_tool', async (_input: object, given) => {
      seen = given;
      return success('done', {});
    });

    await handler({}, ctx);

    expect(seen).toBe(ctx);
  });

  it('answers an unforeseen failure in-band and logs it', async () => {
    const handler = logged('a_tool', async () => {
      throw new Error('the disk went away');
    });

    const result = await handler({}, ctx);

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('a_tool failed: the disk went away');
    expect(textOf(result)).toContain('.noesis/logs/');
    const [record] = records;
    expect(record?.level).toBe('error');
    expect(record?.properties).toMatchObject({ tool: 'a_tool' });
    expect(String(record?.properties.error)).toContain('the disk went away');
  });

  it('answers a working file it cannot read in-band, without logging it', async () => {
    const handler = logged('a_tool', async () => {
      throw new WorkingFileError('change', 'No file at /x.json.');
    });

    const result = await handler({}, ctx);

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(
      'Could not read the change:\nNo file at /x.json.',
    );
    expect(records).toEqual([]);
  });

  it('answers a backend that cannot serve in-band with its own advice, without logging it', async () => {
    const error = BackendError.otherVersion('1.0.0', '2.0.0');
    const handler = logged('a_tool', async () => {
      throw error;
    });

    const result = await handler({}, ctx);

    expect(result.isError).toBe(true);
    expect(textOf(result)).toBe(error.message);
    expect(textOf(result)).toContain('noesis stop');
    expect(textOf(result)).not.toContain('not a foreseen failure');
    expect(records).toEqual([]);
  });
});
