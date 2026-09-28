import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { configure, type LogRecord, reset } from '@logtape/logtape';
import type { ServerContext } from '@modelcontextprotocol/server';
import { logged } from '#backend/adapters/in/mcp/tool-handler';
import { success } from '#backend/adapters/in/mcp/tool-result';
import { ChangeId } from '#backend/app/changes/change-id';
import { InvalidDesignDocError } from '#backend/app/design-docs/invalid-design-doc-error';
import { NotFoundError } from '#backend/app/not-found-error';
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

  it('answers a missing entity with where to find its id, logging nothing', async () => {
    const change = ChangeId.parse('2026-01-01-booking');
    const handler = logged('a_tool', async () => {
      throw new NotFoundError('document', '2026-01-01-notes', change);
    });

    const result = await handler({}, ctx);

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(
      'No document "2026-01-01-notes" in change "2026-01-01-booking".',
    );
    expect(textOf(result)).toContain('create_document_in_change');
    expect(records).toEqual([]);
  });

  it('answers a design document that breaks its rules with each field to fix', async () => {
    const handler = logged('a_tool', async () => {
      throw new InvalidDesignDocError([
        {
          path: 'modules.removed[module|sales]',
          reason: 'changedInGreenField',
        },
      ]);
    });

    const result = await handler({}, ctx);

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('fix each field and call again');
    expect(textOf(result)).toContain(
      '- modules.removed[module|sales]: nothing is scanned yet',
    );
    expect(records).toEqual([]);
  });
});
