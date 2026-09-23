import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createMcpServer } from '#backend/adapters/mcp/mcp-server';
import { MAX_WORKING_FILE_BYTES } from '#backend/adapters/mcp/working-file';
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

const document = {
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

  it('offers exactly the four tools, each with an input and an output schema', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'add_design_doc_to_change',
      'add_document_to_change',
      'create_change',
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

describe('create_change', () => {
  it('creates the change and answers with it', async () => {
    const result = await client.callTool({
      name: 'create_change',
      arguments: { name: 'Payment retry', key: 'NOE-142', type: 'feature' },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      slug: 'payment-retry',
      name: 'Payment retry',
      key: 'NOE-142',
      type: 'feature',
      status: 'discovery',
    });
    expect(textOf(result)).toContain('payment-retry');
    expect(await noesis.changesService.list()).toHaveLength(1);
  });

  it('refuses a second change with the same name, in-band', async () => {
    const create = {
      name: 'Payment retry',
      type: 'feature' as const,
    };
    await client.callTool({ name: 'create_change', arguments: create });

    const again = await client.callTool({
      name: 'create_change',
      arguments: create,
    });

    expect(again.isError).toBe(true);
    expect(textOf(again)).toContain('payment-retry');
    expect(await noesis.changesService.list()).toHaveLength(1);
  });

  it('refuses a second change with the same tracker key, in-band', async () => {
    await client.callTool({
      name: 'create_change',
      arguments: { name: 'Payment retry', key: 'NOE-142', type: 'feature' },
    });

    const clash = await client.callTool({
      name: 'create_change',
      arguments: { name: 'Refund retry', key: 'NOE-142', type: 'fix' },
    });

    expect(clash.isError).toBe(true);
    expect(textOf(clash)).toContain('NOE-142');
  });
});

describe('list_changes', () => {
  it('answers an empty list when there is no change yet', async () => {
    const result = await client.callTool({ name: 'list_changes' });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ changes: [] });
    expect(textOf(result)).toContain('create_change');
  });

  it('lists every change with its slug, in the text as well', async () => {
    await client.callTool({
      name: 'create_change',
      arguments: { name: 'Payment retry', key: 'NOE-142', type: 'feature' },
    });
    await client.callTool({
      name: 'create_change',
      arguments: { name: 'Refund rounding', type: 'fix' },
    });

    const result = await client.callTool({ name: 'list_changes' });

    expect(result.isError).toBeFalsy();
    const { changes } = result.structuredContent as {
      changes: { slug: string }[];
    };
    expect(changes.map((change) => change.slug).sort()).toEqual([
      'payment-retry',
      'refund-rounding',
    ]);
    expect(changes).toEqual(await noesis.changesService.list());
    expect(textOf(result)).toContain('payment-retry [NOE-142]: Payment retry');
    expect(textOf(result)).toContain('refund-rounding: Refund rounding');
  });

  it('is advertised as read-only', async () => {
    const { tools } = await client.listTools();
    const list = tools.find((tool) => tool.name === 'list_changes');
    expect(list?.annotations?.readOnlyHint).toBe(true);
  });
});

describe('add_document_to_change', () => {
  it('stores the document the working file holds', async () => {
    const change = await noesis.createChange('payment-retry');
    const path = await workingFile('document.json', document);

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change, path },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      id: 'retry-interview',
      title: document.title,
      date: document.date,
      path: expect.stringContaining('payment-retry'),
    });
    const stored = await noesis.documentsService.findById(
      change,
      DocumentId.parse('retry-interview'),
    );
    expect(stored?.document.content).toBe(document.content);
  });

  it('reports an unknown change in-band and writes nothing', async () => {
    const path = await workingFile('document.json', document);

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: 'no-such-change', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "no-such-change"');
    expect(textOf(result)).toContain('create_change');
  });

  it('reports a value that is not a slug at all', async () => {
    const path = await workingFile('document.json', document);

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: 'Payment Retry', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('not a change slug');
  });

  it('refuses a path outside the scratch directory', async () => {
    await noesis.createChange('payment-retry');
    const outside = join(noesis.root, 'document.json');
    await writeFile(outside, JSON.stringify(document));

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: 'payment-retry', path: outside },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('.noesis/tmp/');
  });

  it('answers a malformed document with the issues to fix', async () => {
    await noesis.createChange('payment-retry');
    const path = await workingFile('document.json', {
      title: 'Retry interview',
      content: 42,
    });

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: 'payment-retry', path },
    });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('$.date');
    expect(text).toContain('$.content');
  });

  it('refuses a working file above the size limit without reading it', async () => {
    await noesis.createChange('payment-retry');
    const path = await workingFile(
      'huge.json',
      'x'.repeat(MAX_WORKING_FILE_BYTES + 1),
    );

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: 'payment-retry', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(String(MAX_WORKING_FILE_BYTES));
  });

  it('refuses a date that is not an ISO 8601 date', async () => {
    await noesis.createChange('payment-retry');
    const path = await workingFile('document.json', {
      ...document,
      date: 'last Tuesday',
    });

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: 'payment-retry', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('$.date');
  });

  it('refuses a title the id cannot be derived from', async () => {
    await noesis.createChange('payment-retry');
    const path = await workingFile('document.json', {
      ...document,
      title: '???',
    });

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: 'payment-retry', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('$.title');
  });

  it('answers a file that is not JSON in-band', async () => {
    await noesis.createChange('payment-retry');
    const path = await workingFile('document.json', 'not json at all');

    const result = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: 'payment-retry', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('JSON');
  });

  it('refuses a second document with the same title', async () => {
    await noesis.createChange('payment-retry');
    const path = await workingFile('document.json', document);
    await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: 'payment-retry', path },
    });

    const again = await client.callTool({
      name: 'add_document_to_change',
      arguments: { change: 'payment-retry', path },
    });

    expect(again.isError).toBe(true);
    expect(textOf(again)).toContain(document.title);
  });
});

describe('add_design_doc_to_change', () => {
  const { id: _id, ...designDoc } = designDocFixture;

  it('stores the design document the working file holds, under a minted id', async () => {
    const change = await noesis.createChange('payment-retry');
    const path = await workingFile('design-doc.json', designDoc);

    const result = await client.callTool({
      name: 'add_design_doc_to_change',
      arguments: { change, path },
    });

    expect(result.isError).toBeFalsy();
    const { id } = result.structuredContent as { id: string };
    expect(id).not.toBe(designDocFixture.id);
    expect(result.structuredContent).toEqual({
      id,
      name: designDoc.name.value,
      implemented: false,
      path: expect.stringContaining('payment-retry'),
    });
    expect(textOf(result)).toContain(id);
    const stored = await noesis.designDocsService.findById(change, id);
    expect(stored?.summary.name).toBe(designDoc.name.value);
  });

  it('ignores an id the working file carries', async () => {
    const change = await noesis.createChange('payment-retry');
    const path = await workingFile('design-doc.json', designDocFixture);

    const result = await client.callTool({
      name: 'add_design_doc_to_change',
      arguments: { change, path },
    });

    expect(result.isError).toBeFalsy();
    const { id } = result.structuredContent as { id: string };
    expect(id).not.toBe(designDocFixture.id);
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
      arguments: { change: 'no-such-change', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "no-such-change"');
    expect(textOf(result)).toContain('create_change');
  });

  it('reports a value that is not a slug at all', async () => {
    const path = await workingFile('design-doc.json', designDoc);

    const result = await client.callTool({
      name: 'add_design_doc_to_change',
      arguments: { change: 'Payment Retry', path },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('not a change slug');
  });

  it('refuses a path outside the scratch directory', async () => {
    await noesis.createChange('payment-retry');
    const outside = join(noesis.root, 'design-doc.json');
    await writeFile(outside, JSON.stringify(designDoc));

    const result = await client.callTool({
      name: 'add_design_doc_to_change',
      arguments: { change: 'payment-retry', path: outside },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('.noesis/tmp/');
  });

  it('answers a malformed design document with the issues to fix', async () => {
    const change = await noesis.createChange('payment-retry');
    const path = await workingFile('design-doc.json', {
      ...designDoc,
      name: 'Partial refunds',
      buildingBlocks: { added: [{ id: 'not an id' }] },
    });

    const result = await client.callTool({
      name: 'add_design_doc_to_change',
      arguments: { change: 'payment-retry', path },
    });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('$.name');
    expect(text).toContain('$.buildingBlocks');
    expect(await noesis.designDocsService.list(change)).toEqual([]);
  });
});
