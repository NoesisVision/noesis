import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { createMcpServer } from '#backend/adapters/in/mcp/mcp-server';
import { SessionDir } from '#backend/adapters/in/mcp/session-dir';
import type { SessionFiles } from '#backend/adapters/in/mcp/session-files';
import { NoesisSystemModelsRepository } from '#backend/adapters/out/store/system-models.repository';
import { DesignDocId } from '#backend/app/design-docs/design-doc-id';
import { DocumentId } from '#backend/app/information-sources/document-id';
import { scanSystemModelHandler } from '#backend/app/system-model/scan-system-model';
import { SystemModel } from '#backend/app/system-model/system-model';
import { SystemModelId } from '#backend/app/system-model/system-model-id';
import { MAX_WORKING_FILE_BYTES } from '#backend/platform/files/working-file-limit';
import {
  designDocFixture,
  greenFieldDesignDocFixture,
} from '../fixtures/design-doc.fixture';
import { textOf } from '../support/service-process';
import { type TestNoesis, testNoesis } from './test-noesis';

// A linked InMemoryTransport pair speaks the 2025 era only; the modern
// revision is covered against the real stdio service in test/e2e.

let noesis: TestNoesis;
let files: SessionFiles;
let client: Client;

beforeEach(async () => {
  noesis = await testNoesis();
  files = await new SessionDir(noesis.noesis).open();
  const server = createMcpServer({
    ...noesis,
    version: '0.0.0-test',
    noesis: noesis.noesis,
    sessionFiles: files,
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
  const path = join(files.dir, name);
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

const { id: _designDocId, ...designDoc } = greenFieldDesignDocFixture;
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
    expect(instructions).not.toContain(files.dir);
  });

  it('advertises the live scratch directory on every tool that reads from it', async () => {
    const { tools } = await client.listTools();
    const writers = tools.filter(
      (tool) =>
        ![
          'list_changes',
          'delete_change',
          'list_documents_in_change',
          'get_document_in_change',
          'scan_system_model',
          'get_newest_system_model',
        ].includes(tool.name),
    );
    expect(writers).toHaveLength(6);
    for (const tool of writers) {
      const path = tool.inputSchema.properties?.path as { description: string };
      expect(path.description).toContain(files.dir);
    }
  });

  it('advertises every create as adding anew, and every update and delete as idempotent and destructive', async () => {
    const { tools } = await client.listTools();
    for (const tool of tools.filter((t) => t.name.startsWith('create_'))) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
      });
    }
    for (const tool of tools.filter((t) => /^(update|delete)_/.test(t.name))) {
      expect(tool.annotations).toMatchObject({
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
      });
    }
  });

  it('offers exactly the twelve tools, each with an input and an output schema', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'create_change',
      'create_design_doc_in_change',
      'create_document_in_change',
      'delete_change',
      'get_document_in_change',
      'get_newest_system_model',
      'list_changes',
      'list_documents_in_change',
      'scan_system_model',
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
    expect(await noesis.listChanges.handle()).toHaveLength(1);
  });

  it('creates a new change on every call, never overwriting one', async () => {
    const path = await workingFile('change.json', change);
    await call('create_change', { path });

    const again = await call('create_change', { path });

    expect(again.structuredContent).toMatchObject({
      change: { id: `${TODAY}-payment-retry-2` },
    });
    expect(await noesis.listChanges.handle()).toHaveLength(2);
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
    expect(await noesis.listChanges.handle()).toEqual([]);
  });
});

describe('update_change', () => {
  it('replaces the change at its id, which a rename leaves as it was', async () => {
    const id = await noesis.writeChange(CHANGE, { name: 'Payment retry' });
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
    expect(await noesis.listChanges.handle()).toHaveLength(1);
  });

  it('answers an id that names no change in-band, having created nothing', async () => {
    const path = await workingFile('change.json', {
      name: 'Payment retry',
      type: 'fix',
      status: 'design',
    });

    const result = await call('update_change', { id: CHANGE, path });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`No change "${CHANGE}"`);
    expect(textOf(result)).toContain('list_changes');
    expect(await noesis.listChanges.handle()).toEqual([]);
  });

  it('refuses a file without a status, leaving the stored one as it was', async () => {
    const id = await noesis.writeChange(CHANGE, { status: 'design' });
    const path = await workingFile('change.json', {
      name: 'Payment retry',
      type: 'fix',
    });

    const result = await call('update_change', { id, path });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('→ at status');
    expect((await noesis.findChange.handle({ id })).status).toBe('design');
  });

  it('refuses an id that is not a dated id', async () => {
    const path = await workingFile('change.json', {
      name: 'Payment retry',
      type: 'fix',
    });

    const result = await call('update_change', { id: 'payment-retry', path });

    expect(result.isError).toBe(true);
    expect(await noesis.listChanges.handle()).toEqual([]);
  });
});

describe('delete_change', () => {
  it('deletes the change with everything it holds', async () => {
    const id = await noesis.writeChange(CHANGE, { name: 'Payment retry' });
    await noesis.writeDesignDoc(id, designDocFixture);

    const result = await client.callTool({
      name: 'delete_change',
      arguments: { id },
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      change: { id: CHANGE, name: 'Payment retry' },
    });
    expect(textOf(result)).toContain(`Deleted change ${CHANGE}`);
    expect(await noesis.listChanges.handle()).toEqual([]);
  });

  it('answers an id that names no change in-band', async () => {
    const result = await client.callTool({
      name: 'delete_change',
      arguments: { id: CHANGE },
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`No change "${CHANGE}"`);
    expect(textOf(result)).toContain('list_changes');
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
    await noesis.writeChange(CHANGE, {
      name: 'Payment retry',
      key: 'NOE-142',
    });
    await noesis.writeChange('2026-01-02-refund-rounding', {
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
    expect(changes).toEqual(await noesis.listChanges.handle());
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

describe('scan_system_model', () => {
  const found = SystemModel.omit({ id: true }).parse({
    name: 'shop',
    scanned_at: '2026-09-29T08:00:00.000Z',
    modules: [
      {
        id: 'module|sales.orders',
        name: 'orders',
        source: { path: 'src/sales/orders' },
      },
    ],
  });

  /** A client whose server scans with a scanner that finds `found`. */
  async function scanningClient(): Promise<Client> {
    const systemModels = new NoesisSystemModelsRepository(noesis.noesis);
    const server = createMcpServer({
      ...noesis,
      version: '0.0.0-test',
      noesis: noesis.noesis,
      sessionFiles: files,
      scanSystemModel: scanSystemModelHandler(
        { scan: () => Promise.resolve(found) },
        systemModels,
      ),
    });
    const scanning = new Client({ name: 'mcp-spec', version: '0.0.0' });
    const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
    await Promise.all([
      server.connect(serverSide),
      scanning.connect(clientSide),
    ]);
    return scanning;
  }

  it('stores the model the scanner finds at a minted id and answers with it counted', async () => {
    const scanning = await scanningClient();

    const result = await scanning.callTool({ name: 'scan_system_model' });
    await scanning.close();

    expect(result.isError).toBeFalsy();
    const { systemModel } = result.structuredContent as {
      systemModel: Record<string, unknown>;
    };
    const id = SystemModelId.parse(systemModel.id);
    expect(systemModel).toEqual({
      id,
      name: 'shop',
      scanned_at: found.scanned_at,
      modules: 1,
      buildingBlocks: 0,
      behaviours: 0,
    });
    expect(textOf(result)).toContain(`Scanned shop (${id}): 1 modules`);
    expect(
      await new NoesisSystemModelsRepository(noesis.noesis).list(),
    ).toEqual([{ ...found, id }]);
  });

  it('answers a failed scan in-band', async () => {
    const change = await noesis.writeChange(CHANGE);
    await noesis.writeDesignDoc(change, {
      id: `${TODAY}-rename-sales`,
      name: 'Rename sales',
      description: 'Renames a module no design added.',
      modules: {
        modified: [{ id: 'module|sales', name: { value: 'selling' } }],
      },
      implemented: true,
    });

    const result = await client.callTool({ name: 'scan_system_model' });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(
      'modules.modified[module|sales] is not there',
    );
  });

  it('is advertised as adding a scan on every call', async () => {
    const { tools } = await client.listTools();
    const scan = tools.find((tool) => tool.name === 'scan_system_model');
    expect(scan?.annotations).toMatchObject({
      readOnlyHint: false,
      destructiveHint: false,
      idempotentHint: false,
    });
  });
});

describe('get_newest_system_model', () => {
  const OLDER = '01a0d22d-7f47-76b9-abd4-bd21d66a1d17';
  const NEWER = '01a0d22e-0000-7000-8000-000000000000';
  const scan = (id: string, name: string) =>
    SystemModel.parse({ id, name, scanned_at: '2026-09-29T08:00:00.000Z' });

  it('answers null, pointing to the scan, when nothing is scanned yet', async () => {
    const result = await client.callTool({ name: 'get_newest_system_model' });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ systemModel: null });
    expect(textOf(result)).toContain('scan_system_model');
  });

  it('answers the model scanned last, whole', async () => {
    const systemModels = new NoesisSystemModelsRepository(noesis.noesis);
    const newest = scan(NEWER, 'shop');
    await systemModels.create(newest);
    await systemModels.create(scan(OLDER, 'billing'));

    const result = await client.callTool({ name: 'get_newest_system_model' });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ systemModel: newest });
    expect(textOf(result)).toContain(`System model shop (${NEWER})`);
  });

  it('is advertised as read-only', async () => {
    const { tools } = await client.listTools();
    const get = tools.find((tool) => tool.name === 'get_newest_system_model');
    expect(get?.annotations?.readOnlyHint).toBe(true);
  });
});

describe('create_document_in_change', () => {
  it('stores the document the working file holds, at a minted id', async () => {
    const change = await noesis.writeChange(CHANGE);
    const path = await workingFile('document.json', document);

    const result = await call('create_document_in_change', { change, path });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      document: { id: DOCUMENT_ID, title: document.title, date: document.date },
    });
    expect(textOf(result)).toContain(`Created document ${DOCUMENT_ID}`);
    const stored = await noesis.findDocument.handle({
      change,
      id: DocumentId.parse(DOCUMENT_ID),
    });
    expect(stored.content).toBe(document.content);
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
    expect(textOf(result)).toContain('Invalid change id');
  });

  it('refuses a path outside the scratch directory', async () => {
    await noesis.writeChange(CHANGE);
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
    await noesis.writeChange(CHANGE);
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
    await noesis.writeChange(CHANGE);
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
    await noesis.writeChange(CHANGE);
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
    const change = await noesis.writeChange(CHANGE);
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
    await noesis.writeChange(CHANGE);
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
    const change = await noesis.writeChange(CHANGE);
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
    expect(await noesis.listDocumentsInChange.handle({ change })).toHaveLength(
      1,
    );
  });

  it('answers an id that names no document in-band, having created nothing', async () => {
    const change = await noesis.writeChange(CHANGE);

    const result = await call('update_document_in_change', {
      change,
      id: DOCUMENT_ID,
      path: await workingFile('document.json', document),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`No document "${DOCUMENT_ID}"`);
    expect(textOf(result)).toContain('create_document_in_change');
    expect(await noesis.listDocumentsInChange.handle({ change })).toEqual([]);
  });

  it('reports an unknown change in-band, with where to find its id', async () => {
    const result = await call('update_document_in_change', {
      change: '2026-01-01-no-such-change',
      id: DOCUMENT_ID,
      path: await workingFile('document.json', document),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "2026-01-01-no-such-change"');
    expect(textOf(result)).toContain('list_changes');
  });

  it('answers a file it cannot read as unreadable, not as invalid', async () => {
    const change = await noesis.writeChange(CHANGE);

    const result = await call('update_document_in_change', {
      change,
      id: DOCUMENT_ID,
      path: join(files.dir, 'missing.json'),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toStartWith('Could not read the document:');
    expect(textOf(result)).toContain('No file at');
  });
});

describe('list_documents_in_change', () => {
  it('answers an empty list, pointing to the create, when the change has none', async () => {
    const change = await noesis.writeChange(CHANGE);

    const result = await call('list_documents_in_change', { change });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ documents: [] });
    expect(textOf(result)).toContain('create_document_in_change');
  });

  it('lists every document with its id, oldest first, without its content', async () => {
    const change = await noesis.writeChange(CHANGE);
    await noesis.writeDocument(change, {
      ...document,
      id: '2026-01-02-refund-notes',
      title: 'Refund notes',
    });
    await noesis.writeDocument(change, {
      ...document,
      id: '2026-01-01-retry-interview',
    });

    const result = await call('list_documents_in_change', { change });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      documents: [
        {
          id: '2026-01-01-retry-interview',
          title: document.title,
          date: document.date,
        },
        {
          id: '2026-01-02-refund-notes',
          title: 'Refund notes',
          date: document.date,
        },
      ],
    });
    expect(textOf(result)).toContain(
      `- 2026-01-01-retry-interview: Retry interview (${document.date})`,
    );
  });

  it('reports an unknown change in-band, with where to find its id', async () => {
    const result = await call('list_documents_in_change', {
      change: '2026-01-01-no-such-change',
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "2026-01-01-no-such-change"');
    expect(textOf(result)).toContain('list_changes');
  });

  it('is advertised as read-only', async () => {
    const { tools } = await client.listTools();
    const list = tools.find((tool) => tool.name === 'list_documents_in_change');
    expect(list?.annotations?.readOnlyHint).toBe(true);
  });
});

describe('get_document_in_change', () => {
  it('answers the document whole, its content verbatim', async () => {
    const change = await noesis.writeChange(CHANGE);
    await noesis.writeDocument(change, { ...document, id: DOCUMENT_ID });

    const result = await call('get_document_in_change', {
      change,
      id: DOCUMENT_ID,
    });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      document: { ...document, id: DOCUMENT_ID },
    });
    expect(textOf(result)).toContain(`Document ${DOCUMENT_ID}`);
  });

  it('answers an id that names no document in-band, with where to find it', async () => {
    const change = await noesis.writeChange(CHANGE);

    const result = await call('get_document_in_change', {
      change,
      id: DOCUMENT_ID,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`No document "${DOCUMENT_ID}"`);
    expect(textOf(result)).toContain('list_documents_in_change');
  });

  it('reports an unknown change in-band', async () => {
    const result = await call('get_document_in_change', {
      change: '2026-01-01-no-such-change',
      id: DOCUMENT_ID,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "2026-01-01-no-such-change"');
  });

  it('is advertised as read-only', async () => {
    const { tools } = await client.listTools();
    const get = tools.find((tool) => tool.name === 'get_document_in_change');
    expect(get?.annotations?.readOnlyHint).toBe(true);
  });
});

describe('create_design_doc_in_change', () => {
  it('stores the design document the working file holds, at a minted id', async () => {
    const change = await noesis.writeChange(CHANGE);
    const path = await workingFile('design-doc.json', designDoc);

    const result = await call('create_design_doc_in_change', { change, path });

    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({
      designDoc: {
        id: DESIGN_DOC_ID,
        name: designDoc.name,
        implemented: false,
      },
    });
    expect(textOf(result)).toContain(
      `Created design document ${DESIGN_DOC_ID}`,
    );
    const stored = await noesis.findDesignDoc.handle({
      change,
      id: DESIGN_DOC_ID,
    });
    expect(stored.name).toBe(designDoc.name);
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
    expect(textOf(result)).toContain('Invalid change id');
  });

  it('refuses a path outside the scratch directory', async () => {
    await noesis.writeChange(CHANGE);
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
    const change = await noesis.writeChange(CHANGE);
    const path = await workingFile('design-doc.json', {
      ...designDoc,
      name: 42,
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
    expect(await noesis.listDesignDocsInChange.handle({ change })).toEqual([]);
  });

  it('refuses a working file that names an id: the server mints it', async () => {
    const change = await noesis.writeChange(CHANGE);
    const path = await workingFile('design-doc.json', {
      ...designDoc,
      id: '2020-01-01-chosen-by-agent',
    });

    const result = await call('create_design_doc_in_change', { change, path });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Unrecognized key: "id"');
    expect(await noesis.listDesignDocsInChange.handle({ change })).toEqual([]);
  });

  it('refuses a key the design document does not know, rather than dropping it', async () => {
    const change = await noesis.writeChange(CHANGE);
    const path = await workingFile('design-doc.json', {
      ...designDoc,
      modules: { added: [], removed: [], modified: [], renamed: [] },
    });

    const result = await call('create_design_doc_in_change', { change, path });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Unrecognized key: "renamed"');
    expect(textOf(result)).toContain('→ at modules');
  });

  it('answers a design document that breaks its rules with each field to fix', async () => {
    const change = await noesis.writeChange(CHANGE);
    const { id: _id, ...reviewed } = designDocFixture;
    const path = await workingFile('design-doc.json', reviewed);

    const result = await call('create_design_doc_in_change', { change, path });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('fix each field and call again');
    expect(text).toContain(
      '- modules.removed[module|sales.credit-notes]: nothing is scanned yet',
    );
    expect(text).toContain(
      '- modules.modified[module|sales.orders].definition: write every field as the agent',
    );
    expect(await noesis.listDesignDocsInChange.handle({ change })).toEqual([]);
  });
});

describe('update_design_doc_in_change', () => {
  it('replaces the design document at its id', async () => {
    const change = await noesis.writeChange(CHANGE);
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
    expect(await noesis.listDesignDocsInChange.handle({ change })).toHaveLength(
      1,
    );
  });

  it('answers a version that breaks the rules with each field to fix, keeping the stored one', async () => {
    const change = await noesis.writeChange(CHANGE);
    await call('create_design_doc_in_change', {
      change,
      path: await workingFile('design-doc.json', designDoc),
    });
    const stored = await noesis.findDesignDoc.handle({
      change,
      id: DESIGN_DOC_ID,
    });

    const result = await call('update_design_doc_in_change', {
      change,
      id: DESIGN_DOC_ID,
      path: await workingFile('design-doc.json', {
        ...designDoc,
        behaviours: { removed: ['behavior|sales.orders.Order.cancel'] },
      }),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(
      '- behaviours.removed[behavior|sales.orders.Order.cancel]: nothing is scanned yet',
    );
    expect(
      await noesis.findDesignDoc.handle({ change, id: DESIGN_DOC_ID }),
    ).toEqual(stored);
  });

  it('answers an id that names no design document in-band', async () => {
    const change = await noesis.writeChange(CHANGE);

    const result = await call('update_design_doc_in_change', {
      change,
      id: DESIGN_DOC_ID,
      path: await workingFile('design-doc.json', designDoc),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`No design document "${DESIGN_DOC_ID}"`);
    expect(await noesis.listDesignDocsInChange.handle({ change })).toEqual([]);
  });
});
