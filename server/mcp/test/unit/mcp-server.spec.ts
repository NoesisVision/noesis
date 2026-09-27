import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport } from '@modelcontextprotocol/server';
import { NoesisDir } from '#backend/platform/files/noesis-dir';
import { MAX_WORKING_FILE_BYTES } from '#backend/platform/files/working-file-limit';
import { createMcpServer } from '#mcp/server/mcp-server';
import { SessionDir } from '#mcp/session/session-dir';
import type { SessionFiles } from '#mcp/session/session-files';
import { StubUi } from '../support/stub-ui';
import { textOf } from '../support/tool-result';

// The tools read a working file and forward one call to the backend's `/ui`
// routes; what those routes do is the backend's to test. Here a stub answers
// them. A linked InMemoryTransport pair speaks the 2025 era only; the modern
// revision is covered against the real stdio service in test/e2e.

let root: string;
let files: SessionFiles;
let stub: StubUi;
let client: Client;

beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), 'noesis-mcp-'));
  const noesis = new NoesisDir(root);
  await noesis.ensureInitialized();
  files = await new SessionDir(noesis).open();
  stub = new StubUi();
  const server = createMcpServer({
    version: '0.0.0-test',
    noesis,
    sessionFiles: files,
    api: stub.api,
  });
  client = new Client({ name: 'mcp-spec', version: '0.0.0' });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
});

afterEach(async () => {
  await client.close();
  await stub.stop();
  await rm(root, { recursive: true, force: true });
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

async function call(name: string, args: Record<string, unknown> = {}) {
  return client.callTool({ name, arguments: args });
}

const CHANGE = '2026-01-01-payment-retry';
const DOCUMENT_ID = '00000000-0000-7000-8000-000000001001';
const DESIGN_DOC_ID = '00000000-0000-7000-8000-000000000001';

const summary = {
  id: CHANGE,
  name: 'Payment retry',
  key: 'NOE-142',
  type: 'feature',
  status: 'discovery',
  description: '',
};

const document = {
  title: 'Retry interview',
  date: '2026-09-18',
  content: 'Support hears about double charges after a failed retry.',
};

const designDoc = {
  name: 'Partial refunds for orders',
  description: 'Refund single order lines.',
  modules: {
    added: [
      {
        id: 'module|sales.refunds',
        name: { value: 'refunds' },
        description: { value: 'Giving money back.' },
      },
    ],
  },
};

const changeNotFound = (id: string) => ({
  error: 'change_not_found',
  entity: 'change',
  id,
});

describe('the MCP surface', () => {
  it('names the repository root and the scratch root, nothing per-process', () => {
    const instructions = client.getInstructions() ?? '';
    expect(instructions).toContain(root);
    expect(instructions).toContain('.noesis/sessions/');
    // A session path here would be stale on a modern stdio connection.
    expect(instructions).not.toContain(files.dir);
  });

  it('advertises the live scratch directory on every tool that reads from it', async () => {
    const { tools } = await client.listTools();
    const writers = tools.filter((tool) => tool.name !== 'list_changes');
    expect(writers).toHaveLength(6);
    for (const tool of writers) {
      const path = tool.inputSchema.properties?.path as { description: string };
      expect(path.description).toContain(files.dir);
    }
  });

  it('advertises every create as adding anew and every update as an idempotent overwrite', async () => {
    const { tools } = await client.listTools();
    const creates = tools.filter((t) => /^(create|add)_/.test(t.name));
    expect(creates).toHaveLength(3);
    for (const tool of creates) {
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
      'add_design_doc_to_change',
      'add_source_document_to_change',
      'create_change',
      'list_changes',
      'update_change',
      'update_design_doc_in_change',
      'update_source_document_in_change',
    ]);
    for (const tool of tools) {
      expect(tool.inputSchema.type).toBe('object');
      expect(tool.outputSchema?.type).toBe('object');
      expect(tool.title).toBeString();
      expect(tool.description).toBeString();
    }
  });

  it('answers a failure the backend could not foresee in-band, as unforeseen', async () => {
    stub.answer(500, { error: 'internal' });

    const result = await call('list_changes');

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('not a foreseen failure');
  });
});

describe('create_change', () => {
  const change = { name: 'Payment retry', key: 'NOE-142', type: 'feature' };

  it('posts the working file and answers the change the backend created', async () => {
    stub.answer(201, { change: summary });

    const result = await call('create_change', {
      path: await workingFile('change.json', change),
    });

    expect(stub.received).toEqual([
      {
        method: 'POST',
        path: '/ui/changes',
        body: { ...change, description: '' },
      },
    ]);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ change: summary });
    expect(textOf(result)).toContain(`Created change ${CHANGE}`);
  });

  it('answers a malformed change with the issues to fix, sending nothing', async () => {
    const result = await call('create_change', {
      path: await workingFile('change.json', { name: 'Payment retry' }),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('→ at type');
    expect(stub.received).toEqual([]);
  });
});

describe('update_change', () => {
  const file = { name: 'Payment retries', type: 'feature', status: 'design' };

  it('patches the change at its id with the working file', async () => {
    stub.answer(200, {
      change: { ...summary, name: 'Payment retries', status: 'design' },
    });

    const result = await call('update_change', {
      id: CHANGE,
      path: await workingFile('change.json', file),
    });

    expect(stub.received).toEqual([
      {
        method: 'PATCH',
        path: `/ui/changes/${CHANGE}`,
        body: { ...file, key: '', description: '' },
      },
    ]);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toMatchObject({
      change: { id: CHANGE, name: 'Payment retries', status: 'design' },
    });
    expect(textOf(result)).toContain(`Updated change ${CHANGE}`);
  });

  it('answers an id that names no change in-band, pointing at list_changes', async () => {
    stub.answer(404, changeNotFound(CHANGE));

    const result = await call('update_change', {
      id: CHANGE,
      path: await workingFile('change.json', file),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`No change "${CHANGE}"`);
    expect(textOf(result)).toContain('list_changes');
  });

  it('refuses a file without a status, sending nothing', async () => {
    const result = await call('update_change', {
      id: CHANGE,
      path: await workingFile('change.json', {
        name: 'Payment retry',
        type: 'fix',
      }),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('→ at status');
    expect(stub.received).toEqual([]);
  });

  it('refuses an id that is not a dated id, sending nothing', async () => {
    const result = await call('update_change', {
      id: 'payment-retry',
      path: await workingFile('change.json', file),
    });

    expect(result.isError).toBe(true);
    expect(stub.received).toEqual([]);
  });
});

describe('list_changes', () => {
  it('answers an empty list when there is no change yet, pointing at create_change', async () => {
    stub.answer(200, { changes: [] });

    const result = await call('list_changes');

    expect(stub.received).toEqual([
      { method: 'GET', path: '/ui/changes', body: undefined },
    ]);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ changes: [] });
    expect(textOf(result)).toContain('create_change');
  });

  it('lists each change with its entries, in the text as well', async () => {
    const changes = [
      {
        ...summary,
        entries: [
          {
            kind: 'design-doc',
            id: DESIGN_DOC_ID,
            name: designDoc.name,
            implemented: false,
          },
          {
            kind: 'source-document',
            id: DOCUMENT_ID,
            title: document.title,
            date: document.date,
          },
        ],
      },
      {
        ...summary,
        id: '2025-12-31-refund-rounding',
        name: 'Refund rounding',
        key: '',
        entries: [],
      },
    ];
    stub.answer(200, { changes });

    const result = await call('list_changes');

    expect(result.structuredContent).toEqual({ changes });
    const text = textOf(result);
    expect(text).toContain('2 changes, newest day first');
    expect(text).toContain(`${CHANGE} [NOE-142]: Payment retry`);
    expect(text).toContain('2025-12-31-refund-rounding: Refund rounding');
    expect(text).toContain(
      `design document ${DESIGN_DOC_ID}: Partial refunds for orders (not implemented)`,
    );
    expect(text).toContain(`source document ${DOCUMENT_ID}: ${document.title}`);
  });

  it('is advertised as read-only', async () => {
    const { tools } = await client.listTools();
    const list = tools.find((tool) => tool.name === 'list_changes');
    expect(list?.annotations?.readOnlyHint).toBe(true);
  });
});

describe('add_source_document_to_change', () => {
  const added = { id: DOCUMENT_ID, title: document.title, date: document.date };

  it('posts the working file into the change and answers the minted id', async () => {
    stub.answer(201, { sourceDocument: added });

    const result = await call('add_source_document_to_change', {
      change: CHANGE,
      path: await workingFile('document.json', document),
    });

    expect(stub.received).toEqual([
      {
        method: 'POST',
        path: `/ui/changes/${CHANGE}/source-documents`,
        body: document,
      },
    ]);
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ sourceDocument: added });
    expect(textOf(result)).toContain(`Added source document ${DOCUMENT_ID}`);
  });

  it('reports an unknown change in-band, pointing at create_change', async () => {
    stub.answer(404, changeNotFound('2026-01-01-no-such-change'));

    const result = await call('add_source_document_to_change', {
      change: '2026-01-01-no-such-change',
      path: await workingFile('document.json', document),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "2026-01-01-no-such-change"');
    expect(textOf(result)).toContain('create_change');
  });

  it('reports a value that is not a change id at all, sending nothing', async () => {
    const result = await call('add_source_document_to_change', {
      change: 'Payment Retry',
      path: await workingFile('document.json', document),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Invalid change id');
    expect(stub.received).toEqual([]);
  });

  it('refuses a path outside the scratch directory', async () => {
    const outside = join(root, 'document.json');
    await writeFile(outside, JSON.stringify(document));

    const result = await call('add_source_document_to_change', {
      change: CHANGE,
      path: outside,
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('.noesis/sessions/');
    expect(stub.received).toEqual([]);
  });

  it('answers a malformed document with the issues to fix', async () => {
    const result = await call('add_source_document_to_change', {
      change: CHANGE,
      path: await workingFile('document.json', {
        title: 'Retry interview',
        content: 42,
      }),
    });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('→ at date');
    expect(text).toContain('→ at content');
    expect(stub.received).toEqual([]);
  });

  it('refuses a working file above the size limit without reading it', async () => {
    const result = await call('add_source_document_to_change', {
      change: CHANGE,
      path: await workingFile(
        'huge.json',
        'x'.repeat(MAX_WORKING_FILE_BYTES + 1),
      ),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(String(MAX_WORKING_FILE_BYTES));
    expect(stub.received).toEqual([]);
  });

  it('refuses a date that is not an ISO 8601 date', async () => {
    const result = await call('add_source_document_to_change', {
      change: CHANGE,
      path: await workingFile('document.json', {
        ...document,
        date: 'last Tuesday',
      }),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('→ at date');
  });

  it('answers a file that is not JSON in-band', async () => {
    const result = await call('add_source_document_to_change', {
      change: CHANGE,
      path: await workingFile('document.json', 'not json at all'),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('JSON');
  });
});

describe('update_source_document_in_change', () => {
  it('puts the working file at the document id', async () => {
    const revised = { ...document, title: 'Retry interview, revised' };
    stub.answer(200, {
      sourceDocument: {
        id: DOCUMENT_ID,
        title: revised.title,
        date: revised.date,
      },
    });

    const result = await call('update_source_document_in_change', {
      change: CHANGE,
      id: DOCUMENT_ID,
      path: await workingFile('document.json', revised),
    });

    expect(stub.received).toEqual([
      {
        method: 'PUT',
        path: `/ui/changes/${CHANGE}/source-documents/${DOCUMENT_ID}`,
        body: revised,
      },
    ]);
    expect(result.structuredContent).toMatchObject({
      sourceDocument: { id: DOCUMENT_ID, title: revised.title },
    });
    expect(textOf(result)).toContain(`Updated source document ${DOCUMENT_ID}`);
  });

  it('answers an id that names no document in-band, pointing at the add tool', async () => {
    stub.answer(404, {
      error: 'not_found',
      entity: 'source document',
      id: DOCUMENT_ID,
      change: CHANGE,
    });

    const result = await call('update_source_document_in_change', {
      change: CHANGE,
      id: DOCUMENT_ID,
      path: await workingFile('document.json', document),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(
      `No source document "${DOCUMENT_ID}" in change "${CHANGE}"`,
    );
    expect(textOf(result)).toContain('add_source_document_to_change');
  });

  it('reports an unknown change in-band, without offering to add a document', async () => {
    stub.answer(404, changeNotFound('2026-01-01-no-such-change'));

    const result = await call('update_source_document_in_change', {
      change: '2026-01-01-no-such-change',
      id: DOCUMENT_ID,
      path: await workingFile('document.json', document),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('No change "2026-01-01-no-such-change"');
    expect(textOf(result)).toContain('list_changes');
    expect(textOf(result)).not.toContain('add the');
  });

  it('answers a file it cannot read as unreadable, not as invalid', async () => {
    const result = await call('update_source_document_in_change', {
      change: CHANGE,
      id: DOCUMENT_ID,
      path: join(files.dir, 'missing.json'),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toStartWith('Could not read the source document:');
    expect(textOf(result)).toContain('No file at');
    expect(stub.received).toEqual([]);
  });
});

describe('add_design_doc_to_change', () => {
  const added = { id: DESIGN_DOC_ID, name: designDoc.name, implemented: false };

  it('posts the working file into the change and answers the minted id', async () => {
    stub.answer(201, { designDoc: added });

    const result = await call('add_design_doc_to_change', {
      change: CHANGE,
      path: await workingFile('design-doc.json', designDoc),
    });

    expect(stub.received).toHaveLength(1);
    expect(stub.received[0]).toMatchObject({
      method: 'POST',
      path: `/ui/changes/${CHANGE}/design-docs`,
      body: { name: designDoc.name, description: designDoc.description },
    });
    expect(result.isError).toBeFalsy();
    expect(result.structuredContent).toEqual({ designDoc: added });
    expect(textOf(result)).toContain(`Added design document ${DESIGN_DOC_ID}`);
  });

  it('reports a value that is not a change id at all, sending nothing', async () => {
    const result = await call('add_design_doc_to_change', {
      change: 'Payment Retry',
      path: await workingFile('design-doc.json', designDoc),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Invalid change id');
    expect(stub.received).toEqual([]);
  });

  it('answers a malformed design document with the issues to fix, sending nothing', async () => {
    const result = await call('add_design_doc_to_change', {
      change: CHANGE,
      path: await workingFile('design-doc.json', {
        ...designDoc,
        name: 42,
        buildingBlocks: { added: [{ id: 'not an id' }] },
      }),
    });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('→ at name');
    expect(text).toContain('→ at buildingBlocks');
    expect(stub.received).toEqual([]);
  });

  it('refuses a working file that names an id: the server mints it', async () => {
    const result = await call('add_design_doc_to_change', {
      change: CHANGE,
      path: await workingFile('design-doc.json', {
        ...designDoc,
        id: DESIGN_DOC_ID,
      }),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Unrecognized key: "id"');
    expect(stub.received).toEqual([]);
  });

  it('refuses a key the design document does not know, rather than dropping it', async () => {
    const result = await call('add_design_doc_to_change', {
      change: CHANGE,
      path: await workingFile('design-doc.json', {
        ...designDoc,
        modules: { added: [], removed: [], modified: [], renamed: [] },
      }),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Unrecognized key: "renamed"');
    expect(textOf(result)).toContain('→ at modules');
  });

  it('answers a design document that breaks its rules with each field to fix', async () => {
    stub.answer(422, {
      error: 'invalid_design_doc',
      violations: [
        {
          path: 'modules.removed[module|sales.credit-notes]',
          reason: 'changedInGreenField',
        },
        {
          path: 'modules.modified[module|sales.orders].description',
          reason: 'humanAuthor',
        },
      ],
    });

    const result = await call('add_design_doc_to_change', {
      change: CHANGE,
      path: await workingFile('design-doc.json', designDoc),
    });

    expect(result.isError).toBe(true);
    const text = textOf(result);
    expect(text).toContain('fix each field and call again');
    expect(text).toContain(
      '- modules.removed[module|sales.credit-notes]: nothing is scanned yet',
    );
    expect(text).toContain(
      '- modules.modified[module|sales.orders].description: write every field as the agent',
    );
  });
});

describe('update_design_doc_in_change', () => {
  it('puts the working file at the design document id', async () => {
    stub.answer(200, {
      designDoc: { id: DESIGN_DOC_ID, name: designDoc.name, implemented: true },
    });

    const result = await call('update_design_doc_in_change', {
      change: CHANGE,
      id: DESIGN_DOC_ID,
      path: await workingFile('design-doc.json', {
        ...designDoc,
        implemented: true,
      }),
    });

    expect(stub.received[0]).toMatchObject({
      method: 'PUT',
      path: `/ui/changes/${CHANGE}/design-docs/${DESIGN_DOC_ID}`,
      body: { implemented: true },
    });
    expect(result.structuredContent).toMatchObject({
      designDoc: { id: DESIGN_DOC_ID, implemented: true },
    });
    expect(textOf(result)).toContain(
      `Updated design document ${DESIGN_DOC_ID}`,
    );
  });

  it('answers an id that names no design document in-band', async () => {
    stub.answer(404, {
      error: 'not_found',
      entity: 'design document',
      id: DESIGN_DOC_ID,
      change: CHANGE,
    });

    const result = await call('update_design_doc_in_change', {
      change: CHANGE,
      id: DESIGN_DOC_ID,
      path: await workingFile('design-doc.json', designDoc),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain(`No design document "${DESIGN_DOC_ID}"`);
    expect(textOf(result)).toContain('add_design_doc_to_change');
  });
});

describe('a write that lost a race', () => {
  it('answers in-band, saying to read the change again and retry', async () => {
    stub.answer(409, { error: 'conflict', entity: 'change', id: CHANGE });

    const result = await call('add_source_document_to_change', {
      change: CHANGE,
      path: await workingFile('document.json', document),
    });

    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Nothing was written');
    expect(textOf(result)).toContain('list_changes');
  });
});
