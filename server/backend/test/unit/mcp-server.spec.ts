import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createMcpServer } from '#backend/adapters/mcp/mcp-server';
import { MAX_WORKING_FILE_BYTES } from '#backend/adapters/mcp/working-file';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import { DocumentId } from '#backend/app/information-sources/document-id';
import { SessionDir } from '#backend/platform/files/session-dir';
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

/** The working file the agent writes before adding a document. */
async function workingFile(name: string, contents: unknown): Promise<string> {
  const path = join(session.path, name);
  await writeFile(
    path,
    typeof contents === 'string' ? contents : JSON.stringify(contents),
  );
  return path;
}

const CHANGE = '2026-01-01-payment-retry';
const DOCUMENT_ID = '2026-09-18-retry-interview';

const document = {
  id: DOCUMENT_ID,
  title: 'Retry interview',
  date: '2026-09-18',
  content: 'Support hears about double charges after a failed retry.',
};

describe('the MCP surface', () => {
  it('names the repository root and the scratch root, nothing per-process', () => {
    const instructions = client.getInstructions() ?? '';
    expect(instructions).toContain(noesis.root);
    expect(instructions).toContain('.noesis/tmp/');
    // A session path here would be stale on a modern stdio connection.
    expect(instructions).not.toContain(session.path);
  });

  it('advertises the live scratch directory on the tool that reads from it', async () => {
    const { tools } = await client.listTools();
    const add = tools.find((tool) => tool.name === 'add_document_to_change');
    const path = add?.inputSchema.properties?.path as { description: string };
    expect(path.description).toContain(session.path);
  });

  it('advertises every add as an idempotent upsert that may overwrite', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools.filter((t) => t.name.startsWith('add_'))) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      });
    }
  });

  it('offers exactly the four tools, each with an input and an output schema', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'add_change',
      'add_design_doc_to_change',
      'add_document_to_change',
      'list_changes',
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema?.type).toBe('object');
      expect(tool.title).toBeString();
      expect(tool.description).toBeString();
    }
  });
});

describe('add_change', () => {
  const change = {
    id: CHANGE,
    name: 'Payment retry',
    key: 'NOE-142',
    type: 'feature',
  };

  it('creates the change the working file holds and answers with it', async () => {
    const path = await workingFile('change.json', change);

    const result = await client.callTool({
      name: 'add_change',
      arguments: { path },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      change: { ...change, status: 'discovery', description: '' },
      created: true,
    });
    expect(textOf(result)).toContain(`Created change ${CHANGE}`);
    expect(await noesis.changesService.list()).toHaveLength(1);
  });

  it('updates the change at an id already in use, and says so', async () => {
    await client.callTool({
      name: 'add_change',
      arguments: { path: await workingFile('change.json', change) },
    });

    const again = await client.callTool({
      name: 'add_change',
      arguments: {
        path: await workingFile('change.json', {
          ...change,
          name: 'Payment retries',
          status: 'design',
        }),
      },
    });

    expect(again.isError).toBeFalsy();
    expect(again.structuredContent).toMatchObject({
      change: { name: 'Payment retries', status: 'design' },
      created: false,
    });
    expect(textOf(again)).toContain(`Updated change ${CHANGE}`);
    expect(await noesis.changesService.list()).toHaveLength(1);
  });

  it('lets two changes share a tracker key', async () => {
    await client.callTool({
      name: 'add_change',
      arguments: { path: await workingFile('one.json', change) },
    });

    const other = await client.callTool({
      name: 'add_change',
      arguments: {
        path: await workingFile('two.json', {
          ...change,
          id: '2026-01-02-refund-retry',
        }),
      },
    });

    expect(other.isError).toBeFalsy();
    expect(await noesis.changesService.list()).toHaveLength(2);
  });

  it('refuses an id that is not a dated id, in-band', async () => {
    const path = await workingFile('change.json', {
      ...change,
      id: 'payment-retry',
    });

    const result = await client.callTool({
      name: 'add_change',
      arguments: { path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('$.id');
    expect(await noesis.changesService.list()).toEqual([]);
  });

  it('advertises the live scratch directory', async () => {
    const { tools } = await client.listTools();
    const add = tools.find((tool) => tool.name === 'add_change');
    const path = add?.inputSchema.properties?.path as { description: string };
    expect(path.description).toContain(session.path);
  });
});

describe('list_changes', () => {
  it('answers an empty list when there is no change yet', async () => {
    const result = await client.callTool({ name: 'list_changes' });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ changes: [] });
    expect(textOf(result)).toContain('add_change');
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

describe('add_document_to_change', () => {
  it('stores the document the working file holds', async () => {
    const change = await noesis.createChange(CHANGE);
    const path = await workingFile('document.json', document);

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change, path },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      document: { id: DOCUMENT_ID, title: document.title, date: document.date },
      created: true,
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

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: '2026-01-01-no-such-change', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "2026-01-01-no-such-change"');
    expect(textOf(result)).toContain('add_change');
  });

  it('reports a value that is not a change id at all', async () => {
    const path = await workingFile('document.json', document);

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: 'Payment Retry', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('not a change id');
  });

  it('refuses a path outside the scratch directory', async () => {
    await noesis.createChange(CHANGE);
    const outside = join(noesis.root, 'document.json');
    await writeFile(outside, JSON.stringify(document));

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: CHANGE, path: outside },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('.noesis/tmp/');
  });

  it('answers a malformed document with the issues to fix', async () => {
    await noesis.createChange(CHANGE);
    const path = await workingFile('document.json', {
      title: 'Retry interview',
      content: 42,
    });

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: CHANGE, path },
    });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('$.date');
    expect(text).toContain('$.content');
  });

  it('refuses a working file above the size limit without reading it', async () => {
    await noesis.createChange(CHANGE);
    const path = await workingFile(
      'huge.json',
      'x'.repeat(MAX_WORKING_FILE_BYTES + 1),
    );

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: CHANGE, path },
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

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: CHANGE, path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('$.date');
  });

  it('refuses a document without a dated id', async () => {
    await noesis.createChange(CHANGE);
    const { id: _, ...withoutId } = document;
    for (const bad of [withoutId, { ...document, id: 'retry-interview' }]) {
      const path = await workingFile('document.json', bad);

      const result = await client.callTool({
        name: 'add_document_to_change',
        arguments: { change: CHANGE, path },
      });

      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('$.id');
    }
  });

  it('takes any title, even one with no letter in it', async () => {
    const change = await noesis.createChange(CHANGE);
    const path = await workingFile('document.json', {
      ...document,
      title: '???',
    });

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change, path },
    });

    expect(result.isError).toBeFalsy();
  });

  it('answers a file that is not JSON in-band', async () => {
    await noesis.createChange(CHANGE);
    const path = await workingFile('document.json', 'not json at all');

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: CHANGE, path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('JSON');
  });

  it('updates the document at an id already in the change, and says so', async () => {
    const change = await noesis.createChange(CHANGE);
    await client.callTool({
      name: 'add_document_to_change',
      arguments: {
        change,
        path: await workingFile('document.json', document),
      },
    });

    const again = await client.callTool({
      name: 'add_document_to_change',
      arguments: {
        change,
        path: await workingFile('document.json', {
          ...document,
          title: 'Retry interview, revised',
        }),
      },
    });

    expect(again.isError).toBeFalsy();
    expect(again.structuredContent).toMatchObject({
      document: { id: DOCUMENT_ID, title: 'Retry interview, revised' },
      created: false,
    });
    expect(textOf(again)).toContain(`Updated document ${DOCUMENT_ID}`);
    expect(await noesis.documentsService.list(change)).toHaveLength(1);
  });
});

describe('add_design_doc_to_change', () => {
  const designDoc = designDocFixture;
  const id = DesignDocId.parse(designDocFixture.id);

  it('stores the design document the working file holds, under its own id', async () => {
    const change = await noesis.createChange(CHANGE);
    const path = await workingFile('design-doc.json', designDoc);

    const result = await client.callTool({
      name: 'add_design_doc_to_change',
      arguments: { change, path },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      designDoc: { id, name: designDoc.name.value, implemented: false },
      created: true,
    });
    expect(textOf(result)).toContain(`Created design document ${id}`);
    const stored = await noesis.designDocsService.findById(change, id);
    expect(stored?.summary.name).toBe(designDoc.name.value);
  });

  it('updates the design document at an id already in the change', async () => {
    const change = await noesis.createChange(CHANGE);
    const path = await workingFile('design-doc.json', designDoc);
    await client.callTool({
      name: 'add_design_doc_to_change',
      arguments: { change, path },
    });

    const again = await client.callTool({
      name: 'add_design_doc_to_change',
      arguments: { change, path },
    });

    expect(again.isError).toBeFalsy();
    expect(again.structuredContent).toMatchObject({ created: false });
    expect(textOf(again)).toContain(`Updated design document ${id}`);
    expect(await noesis.designDocsService.list(change)).toHaveLength(1);
  });

  it('refuses a design document without a dated id', async () => {
    await noesis.createChange(CHANGE);
    const { id: _, ...withoutId } = designDoc;
    const path = await workingFile('design-doc.json', withoutId);

    const result = await client.callTool({
      name: 'add_design_doc_to_change',
      arguments: { change: CHANGE, path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('$.id');
  });

  it('advertises the live scratch directory', async () => {
    const { tools } = await client.listTools();
    const add = tools.find((tool) => tool.name === 'add_design_doc_to_change');
    const path = add?.inputSchema.properties?.path as { description: string };
    expect(path.description).toContain(session.path);
  });

  it('reports an unknown change in-band', async () => {
    const path = await workingFile('design-doc.json', designDoc);

    const result = await client.callTool({
      name: 'add_design_doc_to_change',
      arguments: { change: '2026-01-01-no-such-change', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "2026-01-01-no-such-change"');
    expect(textOf(result)).toContain('add_change');
  });

  it('reports a value that is not a change id at all', async () => {
    const path = await workingFile('design-doc.json', designDoc);

    const result = await client.callTool({
      name: 'add_design_doc_to_change',
      arguments: { change: 'Payment Retry', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('not a change id');
  });

  it('refuses a path outside the scratch directory', async () => {
    await noesis.createChange(CHANGE);
    const outside = join(noesis.root, 'design-doc.json');
    await writeFile(outside, JSON.stringify(designDoc));

    const result = await client.callTool({
      name: 'add_design_doc_to_change',
      arguments: { change: CHANGE, path: outside },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('.noesis/tmp/');
  });

  it('answers a malformed design document with the issues to fix', async () => {
    const change = await noesis.createChange(CHANGE);
    const path = await workingFile('design-doc.json', {
      ...designDoc,
      name: 'Partial refunds',
      buildingBlocks: { added: [{ id: 'not an id' }] },
    });

    const result = await client.callTool({
      name: 'add_design_doc_to_change',
      arguments: { change: CHANGE, path },
    });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('$.name');
    expect(text).toContain('$.buildingBlocks');
    expect(await noesis.designDocsService.list(change)).toEqual([]);
  });
});
