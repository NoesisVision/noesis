import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { configure, type LogRecord, reset } from '@logtape/logtape';
import type { ServerContext } from '@modelcontextprotocol/server';
import { logged } from '#backend/adapters/in/mcp/tool-handler';
import { success } from '#backend/adapters/in/mcp/tool-result';
import { textOf } from '../support/service-process';

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
});
