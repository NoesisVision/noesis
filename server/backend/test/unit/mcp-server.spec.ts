import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createMcpServer } from '#backend/adapters/mcp/mcp-server';
import {
  MAX_WORKING_FILE_BYTES,
  SessionDir,
} from '#backend/adapters/mcp/session-dir';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import { DocumentId } from '#backend/app/information-sources/document-id';
import { designDocFixture } from '../fixtures/design-doc.fixture';
import { textOf } from '../support/service-process';
import { type TestNoesis, testNoesis } from './test-noesis';

// A linked InMemoryTransport pair speaks the 2025 era only; the modern
// revision is covered against the real stdio service in test/e2e.

let noesis: TestNoesis;
let session: SessionDir;
let client: Client;

beforeEach(async () => {
  noesis = await testNoesis();
  session = new SessionDir(noesis.noesis, noesis.root);
  await session.open();
  const server = createMcpServer({
    version: '0.0.0-test',
    noesis: noesis.noesis,
    session,
    changesService: noesis.changesService,
    designDocsService: noesis.designDocsService,
    documentsService: noesis.documentsService,
  });
  client = new Client({ name: 'mcp-spec', version: '0.0.0' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
});

afterEach(async () => {
  await client.close();
  await noesis.cleanup();
});

/** The working file the agent writes before calling a tool. */
async function workingFile(name: string, contents: unknown): Promise<string> {
  const path = join(session.path, name);
  await writeFile(
    path,
    typeof contents === 'string' ? contents : JSON.stringify(contents),
  );
  return path;
}

const CHANGE = '2026-01-01-payment-retry';
/** What the services mint from: `testNoesis` pins today to this day. */
const TODAY = '2026-09-24';
const DOCUMENT_ID = `${TODAY}-retry-interview`;

const document = {
  title: 'Retry interview',
  date: '2026-09-18',
  content: 'Support hears about double charges after a failed retry.',
};

const { id: _designDocId, ...designDoc } = designDocFixture;
const DESIGN_DOC_ID = DesignDocId.parse(`${TODAY}-partial-refunds-for-orders`);

async function call(name: string, args: Record<string, unknown>) {
  return client.callTool({ name, arguments: args });
}

describe('the MCP surface', () => {
  it('names the repository root and the scratch root, nothing per-process', () => {
    const instructions = client.getInstructions() ?? '';
    expect(instructions).toContain(noesis.root);
    expect(instructions).toContain('.noesis/sessions/');
    // A session path here would be stale on a modern stdio connection.
    expect(instructions).not.toContain(session.path);
  });

  it('advertises the live scratch directory on every tool that reads from it', async () => {
    const { tools } = await client.listTools();
    const writers = tools.filter((tool) => tool.name !== 'list_changes');
    expect(writers).toHaveLength(6);
    for (const tool of writers) {
      const path = tool.inputSchema.properties?.path as { description: string };
      expect(path.description).toContain(session.path);
    }
  });

  it('advertises every create as adding anew and every update as an idempotent overwrite', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools.filter((t) => t.name.startsWith('create_'))) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      });
    }
    for (const tool of tools.filter((t) => t.name.startsWith('update_'))) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      });
    }
  });

  it('offers exactly the seven tools, each with an input and an output schema', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'create_change',
      'create_design_doc_in_change',
      'create_document_in_change',
      'list_changes',
      'update_change',
      'update_design_doc_in_change',
      'update_document_in_change',
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema?.type).toBe('object');
      expect(tool.title).toBeString();
      expect(tool.description).toBeString();
    }
  });
});

describe('create_change', () => {
  const change = { name: 'Payment retry', key: 'NOE-142', type: 'feature' };

  it('creates the change at an id minted from today and the name', async () => {
    const path = await workingFile('change.json', change);

    const result = await call('create_change', { path });

    expect(result.isError).toBeFalsy();
    const id = `${TODAY}-payment-retry`;
    expect(result.structuredContent).toEqual({
      change: { id, ...change, status: 'discovery', description: '' },
    });
    expect(textOf(result)).toContain(`Created change ${id}`);
    expect(await noesis.changesService.list()).toHaveLength(1);
  });

  it('creates a new change on every call, never overwriting one', async () => {
    const path = await workingFile('change.json', change);
    await call('create_change', { path });

    const again = await call('create_change', { path });

    expect(again.structuredContent).toMatchObject({
      change: { id: `${TODAY}-payment-retry-2` },
    });
    expect(await noesis.changesService.list()).toHaveLength(2);
  });

  it('starts the change in discovery, whatever status the file names', async () => {
    const path = await workingFile('change.json', {
      ...change,
      status: 'done',
    });

    const result = await call('create_change', { path });

    expect(result.structuredContent).toMatchObject({
      change: { status: 'discovery' },
    });
  });

  it('answers a malformed change with the issues to fix, having written nothing', async () => {
    const path = await workingFile('change.json', { name: 'Payment retry' });

    const result = await call('create_change', { path });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('→ at type');
    expect(await noesis.changesService.list()).toEqual([]);
  });
});

describe('update_change', () => {
  it('replaces the change at its id, which a rename leaves as it was', async () => {
    const id = await noesis.createChange(CHANGE, { name: 'Payment retry' });
    const path = await workingFile('change.json', {
      name: 'Payment retries',
      type: 'feature',
      status: 'design',
    });

    const result = await call('update_change', { id, path });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      change: { id: CHANGE, name: 'Payment retries', status: 'design' },
    });
    expect(textOf(result)).toContain(`Updated change ${CHANGE}`);
    expect(await noesis.changesService.list()).toHaveLength(1);
  });

  it('answers an id that names no change in-band, having created nothing', async () => {
    const path = await workingFile('change.json', {
      name: 'Payment retry',
      type: 'fix',
    });

    const result = await call('update_change', { id: CHANGE, path });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`No change "${CHANGE}"`);
    expect(textOf(result)).toContain('list_changes');
    expect(await noesis.changesService.list()).toEqual([]);
  });

  it('refuses an id that is not a dated id', async () => {
    const path = await workingFile('change.json', {
      name: 'Payment retry',
      type: 'fix',
    });

    const result = await call('update_change', { id: 'payment-retry', path });

    expect(result.isError).toBe(true);
    expect(await noesis.changesService.list()).toEqual([]);
  });
});

describe('list_changes', () => {
  it('answers an empty list when there is no change yet', async () => {
    const result = await client.callTool({ name: 'list_changes' });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ changes: [] });
    expect(textOf(result)).toContain('create_change');
  });

  it('lists every change with its id, newest first, in the text as well', async () => {
    await noesis.createChange(CHANGE, {
      name: 'Payment retry',
      key: 'NOE-142',
    });
    await noesis.createChange('2026-01-02-refund-rounding', {
      name: 'Refund rounding',
    });

    const result = await client.callTool({ name: 'list_changes' });

    expect(result.isError).toBeFalsy();
    const { changes } = result.structuredContent as {
      changes: { id: string }[];
    };
    expect(changes.map((change) => change.id)).toEqual([
      '2026-01-02-refund-rounding',
      CHANGE,
    ]);
    expect(changes).toEqual(await noesis.changesService.list());
    expect(textOf(result)).toContain(`${CHANGE} [NOE-142]: Payment retry`);
    expect(textOf(result)).toContain(
      '2026-01-02-refund-rounding: Refund rounding',
    );
  });

  it('is advertised as read-only', async () => {
    const { tools } = await client.listTools();
    const list = tools.find((tool) => tool.name === 'list_changes');
    expect(list?.annotations?.readOnlyHint).toBe(true);
  });
});

describe('create_document_in_change', () => {
  it('stores the document the working file holds, at a minted id', async () => {
    const change = await noesis.createChange(CHANGE);
    const path = await workingFile('document.json', document);

    const result = await call('create_document_in_change', { change, path });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      document: { id: DOCUMENT_ID, title: document.title, date: document.date },
    });
    expect(textOf(result)).toContain(`Created document ${DOCUMENT_ID}`);
    const stored = await noesis.documentsService.findById(
      change,
      DocumentId.parse(DOCUMENT_ID),
    );
    expect(stored?.document.content).toBe(document.content);
  });

  it('reports an unknown change in-band and writes nothing', async () => {
    const path = await workingFile('document.json', document);

    const result = await call('create_document_in_change', {
      change: '2026-01-01-no-such-change',
      path,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "2026-01-01-no-such-change"');
    expect(textOf(result)).toContain('create_change');
  });

  it('reports a value that is not a change id at all', async () => {
    const path = await workingFile('document.json', document);

    const result = await call('create_document_in_change', {
      change: 'Payment Retry',
      path,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('not a change id');
  });

  it('refuses a path outside the scratch directory', async () => {
    await noesis.createChange(CHANGE);
    const outside = join(noesis.root, 'document.json');
    await writeFile(outside, JSON.stringify(document));

    const result = await call('create_document_in_change', {
      change: CHANGE,
      path: outside,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('.noesis/sessions/');
  });

  it('answers a malformed document with the issues to fix', async () => {
    await noesis.createChange(CHANGE);
    const path = await workingFile('document.json', {
      title: 'Retry interview',
      content: 42,
    });

    const result = await call('create_document_in_change', {
      change: CHANGE,
      path,
    });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('→ at date');
    expect(text).toContain('→ at content');
  });

  it('refuses a working file above the size limit without reading it', async () => {
    await noesis.createChange(CHANGE);
    const path = await workingFile(
      'huge.json',
      'x'.repeat(MAX_WORKING_FILE_BYTES + 1),
    );

    const result = await call('create_document_in_change', {
      change: CHANGE,
      path,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(String(MAX_WORKING_FILE_BYTES));
  });

  it('refuses a date that is not an ISO 8601 date', async () => {
    await noesis.createChange(CHANGE);
    const path = await workingFile('document.json', {
      ...document,
      date: 'last Tuesday',
    });

    const result = await call('create_document_in_change', {
      change: CHANGE,
      path,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('→ at date');
  });

  it('takes any title, even one with no letter in it', async () => {
    const change = await noesis.createChange(CHANGE);
    const path = await workingFile('document.json', {
      ...document,
      title: '???',
    });

    const result = await call('create_document_in_change', { change, path });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      document: { id: `${TODAY}-untitled` },
    });
  });

  it('answers a file that is not JSON in-band', async () => {
    await noesis.createChange(CHANGE);
    const path = await workingFile('document.json', 'not json at all');

    const result = await call('create_document_in_change', {
      change: CHANGE,
      path,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('JSON');
  });
});

describe('update_document_in_change', () => {
  it('replaces the document at its id, which a new title leaves as it was', async () => {
    const change = await noesis.createChange(CHANGE);
    await call('create_document_in_change', {
      change,
      path: await workingFile('document.json', document),
    });

    const result = await call('update_document_in_change', {
      change,
      id: DOCUMENT_ID,
      path: await workingFile('document.json', {
        ...document,
        title: 'Retry interview, revised',
      }),
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      document: { id: DOCUMENT_ID, title: 'Retry interview, revised' },
    });
    expect(textOf(result)).toContain(`Updated document ${DOCUMENT_ID}`);
    expect(await noesis.documentsService.list(change)).toHaveLength(1);
  });

  it('answers an id that names no document in-band, having created nothing', async () => {
    const change = await noesis.createChange(CHANGE);

    const result = await call('update_document_in_change', {
      change,
      id: DOCUMENT_ID,
      path: await workingFile('document.json', document),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`No document "${DOCUMENT_ID}"`);
    expect(textOf(result)).toContain('create_document_in_change');
    expect(await noesis.documentsService.list(change)).toEqual([]);
  });

  it('reports an unknown change in-band', async () => {
    const result = await call('update_document_in_change', {
      change: '2026-01-01-no-such-change',
      id: DOCUMENT_ID,
      path: await workingFile('document.json', document),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "2026-01-01-no-such-change"');
  });
});

describe('create_design_doc_in_change', () => {
  it('stores the design document the working file holds, at a minted id', async () => {
    const change = await noesis.createChange(CHANGE);
    const path = await workingFile('design-doc.json', designDoc);

    const result = await call('create_design_doc_in_change', { change, path });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      designDoc: {
        id: DESIGN_DOC_ID,
        name: designDoc.name.value,
        implemented: false,
      },
    });
    expect(textOf(result)).toContain(
      `Created design document ${DESIGN_DOC_ID}`,
    );
    const stored = await noesis.designDocsService.findById(
      change,
      DESIGN_DOC_ID,
    );
    expect(stored?.summary.name).toBe(designDoc.name.value);
  });

  it('reports an unknown change in-band', async () => {
    const path = await workingFile('design-doc.json', designDoc);

    const result = await call('create_design_doc_in_change', {
      change: '2026-01-01-no-such-change',
      path,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "2026-01-01-no-such-change"');
    expect(textOf(result)).toContain('create_change');
  });

  it('reports a value that is not a change id at all', async () => {
    const path = await workingFile('design-doc.json', designDoc);

    const result = await call('create_design_doc_in_change', {
      change: 'Payment Retry',
      path,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('not a change id');
  });

  it('refuses a path outside the scratch directory', async () => {
    await noesis.createChange(CHANGE);
    const outside = join(noesis.root, 'design-doc.json');
    await writeFile(outside, JSON.stringify(designDoc));

    const result = await call('create_design_doc_in_change', {
      change: CHANGE,
      path: outside,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('.noesis/sessions/');
  });

  it('answers a malformed design document with the issues to fix', async () => {
    const change = await noesis.createChange(CHANGE);
    const path = await workingFile('design-doc.json', {
      ...designDoc,
      name: 'Partial refunds',
      buildingBlocks: { added: [{ id: 'not an id' }] },
    });

    const result = await call('create_design_doc_in_change', {
      change: CHANGE,
      path,
    });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('→ at name');
    expect(text).toContain('→ at buildingBlocks');
    expect(await noesis.designDocsService.list(change)).toEqual([]);
  });
});

describe('update_design_doc_in_change', () => {
  it('replaces the design document at its id', async () => {
    const change = await noesis.createChange(CHANGE);
    const path = await workingFile('design-doc.json', designDoc);
    await call('create_design_doc_in_change', { change, path });

    const result = await call('update_design_doc_in_change', {
      change,
      id: DESIGN_DOC_ID,
      path: await workingFile('design-doc.json', {
        ...designDoc,
        implemented: true,
      }),
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      designDoc: { id: DESIGN_DOC_ID, implemented: true },
    });
    expect(textOf(result)).toContain(
      `Updated design document ${DESIGN_DOC_ID}`,
    );
    expect(await noesis.designDocsService.list(change)).toHaveLength(1);
  });

  it('answers an id that names no design document in-band', async () => {
    const change = await noesis.createChange(CHANGE);

    const result = await call('update_design_doc_in_change', {
      change,
      id: DESIGN_DOC_ID,
      path: await workingFile('design-doc.json', designDoc),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`No design document "${DESIGN_DOC_ID}"`);
    expect(await noesis.designDocsService.list(change)).toEqual([]);
  });
});
