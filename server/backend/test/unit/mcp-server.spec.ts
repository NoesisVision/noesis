// Pins decision D3: payloads travel as working-file paths under
// `.noesis/tmp/`, and failures come back in-band (isError), never as
// protocol-level errors the model cannot read.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createMcpServer } from '#backend/adapters/mcp/mcp-server';
import { ScannerService } from '#backend/adapters/scanner/scanner.service';
import { ChangeSlug } from '#backend/app/changes/change-slug';
import { designDocFixture } from '#backend/app/design-docs/model/design-doc.fixture';
import { SearchService } from '#backend/app/search/search.service';
import { SessionDir } from '#backend/platform/files/session-dir';
import { textOf } from '../support/service-process';
import { all, type TestNoesis, testNoesis } from './test-noesis';

const CHANGE = 'booking';
const SLUG = ChangeSlug.parse(CHANGE);

let t: TestNoesis;
let session: SessionDir;
let client: Client;

beforeEach(async () => {
  t = await testNoesis();
  session = new SessionDir(t.noesis, t.root);
  await session.open();
  await t.changesService.create({ name: CHANGE, key: '', type: 'chore' });

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createMcpServer({
    repositoryRoot: t.root,
    session,
    changesService: t.changesService,
    designDocsService: t.designDocsService,
    searchService: new SearchService([
      async (q) => [{ type: 'design-doc', id: 'd-1', title: `Hit for ${q}` }],
    ]),
    scannerService: new ScannerService(t.root, t.systemModels),
  });
  await server.connect(serverTransport);
  client = new Client({ name: 'mcp-server-spec', version: '0.0.0' });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client?.close();
  await t?.cleanup();
});

async function working(name: string, content: unknown): Promise<string> {
  const path = join(session.path, name);
  await writeFile(
    path,
    typeof content === 'string' ? content : JSON.stringify(content),
  );
  return path;
}

const brokenFixture = {
  ...designDocFixture,
  // Both use cases point at an application service that no longer exists.
  buildingBlocks: designDocFixture.buildingBlocks.filter(
    (b) => b.id !== 'svc-booking',
  ),
};

describe('createMcpServer', () => {
  it('states the repository root and the session scratch directory in its instructions', () => {
    const instructions = client.getInstructions() ?? '';
    expect(instructions).toContain(t.root);
    expect(instructions).toContain(session.path);
  });

  it('advertises the tool set with schemas from their argument contracts', async () => {
    const { tools } = await client.listTools();
    expect(tools.map((tool) => tool.name).sort()).toEqual([
      'create-design-doc',
      'list-changes',
      'list-design-docs',
      'scan-system-model',
      'search-knowledge-graph',
      'update-design-doc',
    ]);
    const create = tools.find((tool) => tool.name === 'create-design-doc');
    if (!create) throw new Error('create-design-doc is not advertised');
    expect(create.inputSchema.required).toEqual(['change', 'path']);
  });

  // The validating tool was dropped (decision D3): every tool that reads a
  // working file reports its own issues, so there is nothing to run first.
  describe('working files', () => {
    it('lists shape issues with path, expected, found and fix, and writes nothing', async () => {
      const path = await working('doc.json', {
        ...designDocFixture,
        useCases: 'not-a-list',
      });
      const result = await client.callTool({
        name: 'create-design-doc',
        arguments: { change: CHANGE, path },
      });
      expect(result.isError).toBe(true);
      const text = textOf(result);
      expect(text).toContain('Invalid design-document: 1 issue.');
      expect(text).toContain('$.useCases');
      expect(text).toContain('expected: array');
      expect(text).toContain('found:    "not-a-list"');
      expect(text).toContain('Replace "$.useCases" with an array');
      expect(await t.designDocsService.list(SLUG)).toEqual([]);
    });

    it('reports unreadable JSON as an issue at the document root', async () => {
      const path = await working('doc.json', '{ not json');
      const result = await client.callTool({
        name: 'create-design-doc',
        arguments: { change: CHANGE, path },
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('expected: a valid JSON document');
    });

    it('accepts a path relative to the repository root', async () => {
      const path = await working('doc.json', designDocFixture);
      const result = await client.callTool({
        name: 'create-design-doc',
        arguments: { change: CHANGE, path: relative(t.root, path) },
      });
      expect(result.isError).toBeFalsy();
      expect(await t.designDocsService.list(SLUG)).toHaveLength(1);
    });

    it('refuses a file outside .noesis/tmp/', async () => {
      const outside = join(t.root, 'doc.json');
      await writeFile(outside, JSON.stringify(designDocFixture));
      const result = await client.callTool({
        name: 'create-design-doc',
        arguments: { change: CHANGE, path: outside },
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain(session.path);
    });

    it('refuses a missing file', async () => {
      const result = await client.callTool({
        name: 'create-design-doc',
        arguments: { change: CHANGE, path: join(session.path, 'nope.json') },
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('No file at');
    });
  });

  describe('create-design-doc', () => {
    it('creates the document from the working file and names it', async () => {
      const path = await working('doc.json', designDocFixture);
      const result = await client.callTool({
        name: 'create-design-doc',
        arguments: { change: CHANGE, path },
      });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain('"Appointment booking"');

      const listed = await t.designDocsService.list(SLUG);
      expect(listed).toHaveLength(1);
      expect(textOf(result)).toContain(listed[0]?.id ?? 'no id');
    });

    it('rejects a file whose integrity is broken, and writes nothing', async () => {
      const path = await working('doc.json', brokenFixture);
      const result = await client.callTool({
        name: 'create-design-doc',
        arguments: { change: CHANGE, path },
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('Invalid design-document');
      expect(textOf(result)).toContain('svc-booking');
      expect(await t.designDocsService.list(SLUG)).toEqual([]);
    });

    it('names the existing changes when the change does not exist', async () => {
      const path = await working('doc.json', designDocFixture);
      const result = await client.callTool({
        name: 'create-design-doc',
        arguments: { change: 'nope', path },
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('No change "nope"');
      expect(textOf(result)).toContain(`Existing changes: ${CHANGE}`);
    });
  });

  it('returns an in-band error listing available tools for an unknown tool', async () => {
    const result = await client.callTool({
      name: 'no-such-tool',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('Available tools: list-changes');
  });

  describe('list-changes / list-design-docs', () => {
    it('lists the change slugs', async () => {
      const result = await client.callTool({
        name: 'list-changes',
        arguments: {},
      });
      expect(textOf(result)).toBe(`Changes: ${CHANGE}.`);
    });

    it('lists design documents with id and relative path', async () => {
      await t.designDocsService.create(SLUG, designDocFixture);
      const result = await client.callTool({
        name: 'list-design-docs',
        arguments: { change: CHANGE },
      });
      const line = textOf(result);
      expect(line).toContain('Appointment booking');
      expect(line).toContain(`.noesis/graph/changes/${CHANGE}/design-docs/`);
    });
  });

  describe('update-design-doc', () => {
    it('replaces the document under its id', async () => {
      const created = await t.designDocsService.create(SLUG, designDocFixture);
      const path = await working('doc.json', {
        ...designDocFixture,
        name: 'Renamed booking',
      });
      const result = await client.callTool({
        name: 'update-design-doc',
        arguments: { change: CHANGE, id: created.id, path },
      });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain('"Renamed booking"');
      const listed = await t.designDocsService.list(SLUG);
      expect(listed.map((d) => [d.id, d.name])).toEqual([
        [created.id, 'Renamed booking'],
      ]);
    });

    it('refuses an unknown id in-band', async () => {
      const path = await working('doc.json', designDocFixture);
      const result = await client.callTool({
        name: 'update-design-doc',
        arguments: { change: CHANGE, id: 'nope', path },
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('No design document "nope"');
    });
  });

  describe('scan-system-model', () => {
    it('writes a system-model file per unit and names it', async () => {
      await mkdir(join(t.root, 'pkg', 'src'), { recursive: true });
      await writeFile(
        join(t.root, 'pkg', 'package.json'),
        JSON.stringify({ name: '@acme/pkg' }),
      );
      await writeFile(
        join(t.root, 'pkg', 'src', 'booking.service.ts'),
        'export class BookingService {\n  book(): void {}\n}\n',
      );

      const result = await client.callTool({
        name: 'scan-system-model',
        arguments: {},
      });

      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain(
        '@acme/pkg  1 building block(s)  .noesis/graph/system-model/',
      );
      expect(await all(t.systemModels)).toHaveLength(1);
    });
  });

  describe('search-knowledge-graph', () => {
    it('lists hits as type, id and title', async () => {
      const result = await client.callTool({
        name: 'search-knowledge-graph',
        arguments: { query: 'slots' },
      });
      expect(textOf(result)).toBe('design-doc  d-1  Hit for slots');
    });
  });

  it('returns a descriptive in-band error for missing arguments', async () => {
    const result = await client.callTool({
      name: 'create-design-doc',
      arguments: {},
    });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('path');
  });
});
