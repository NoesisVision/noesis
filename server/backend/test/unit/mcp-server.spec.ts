// Drives createMcpServer through a real MCP client over an in-memory
// transport, over a throwaway `.noesis/`. Pins the R4 shape of decision 68:
// payloads travel as working-file paths under `.noesis/tmp/`, validation is a
// tool whose output the agent can act on, and failures come back in-band
// (isError) — never as protocol-level errors the model cannot read.
import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { writeFile } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import { SessionDir } from '../../src/files/session-dir.js';
import { contractNames } from '../../src/mcp/contracts/registry.js';
import { createMcpServer } from '../../src/mcp/mcp-server.js';
import { SearchService } from '../../src/ui/search/search.service.js';
import { type TestNoesis, testNoesis } from './test-noesis.js';

const CHANGE = 'booking';

let t: TestNoesis;
let session: SessionDir;
let client: Client;

beforeEach(async () => {
  t = await testNoesis();
  session = new SessionDir(t.noesis);
  await session.open();
  await t.changesService.create(CHANGE);

  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  const server = createMcpServer({
    repositoryRoot: t.root,
    session,
    changesService: t.changesService,
    designDocsService: t.designDocsService,
    importService: t.importService,
    searchService: new SearchService([
      async (q) => [{ type: 'topic', id: 't-1', title: `Hit for ${q}` }],
    ]),
  });
  await server.connect(serverTransport);
  client = new Client({ name: 'mcp-server-spec', version: '0.0.0' });
  await client.connect(clientTransport);
});

afterEach(async () => {
  await client?.close();
  await t?.cleanup();
});

function textOf(result: Awaited<ReturnType<Client['callTool']>>): string {
  const [content] = result.content as { type: string; text: string }[];
  return content?.text ?? '';
}

/** A working file in this session's scratch directory, as the agent would write it. */
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
      'import-conversation',
      'import-document',
      'list-changes',
      'list-design-docs',
      'search-knowledge-graph',
      'update-design-doc',
      'validate',
    ]);
    const validate = tools.find((tool) => tool.name === 'validate');
    if (!validate) throw new Error('validate is not advertised');
    expect(validate.inputSchema.required).toEqual(['contract', 'path']);
    const properties = validate.inputSchema.properties as Record<
      string,
      { enum?: string[] }
    >;
    expect(properties.contract?.enum).toEqual(contractNames);
  });

  describe('validate', () => {
    it('passes a clean file', async () => {
      const path = await working('doc.json', designDocFixture);
      const result = await client.callTool({
        name: 'validate',
        arguments: { contract: 'design-document', path },
      });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toBe('Valid design-document: no issues.');
    });

    it('accepts a path relative to the repository root', async () => {
      const path = await working('doc.json', designDocFixture);
      const result = await client.callTool({
        name: 'validate',
        arguments: {
          contract: 'design-document',
          path: relative(t.root, path),
        },
      });
      expect(textOf(result)).toBe('Valid design-document: no issues.');
    });

    it('lists shape issues with path, expected, found and fix', async () => {
      const path = await working('doc.json', {
        ...designDocFixture,
        useCases: 'not-a-list',
      });
      const result = await client.callTool({
        name: 'validate',
        arguments: { contract: 'design-document', path },
      });
      // A file with issues is a successful validation, not a tool failure.
      expect(result.isError).toBeFalsy();
      const text = textOf(result);
      expect(text).toContain('Invalid design-document: 1 issue.');
      expect(text).toContain('$.useCases');
      expect(text).toContain('expected: array');
      expect(text).toContain('found:    "not-a-list"');
      expect(text).toContain('Replace "$.useCases" with an array');
    });

    it('lists integrity issues once the shape parses', async () => {
      const path = await working('doc.json', brokenFixture);
      const result = await client.callTool({
        name: 'validate',
        arguments: { contract: 'design-document', path },
      });
      expect(textOf(result)).toContain('svc-booking');
    });

    it('reports unreadable JSON as an issue at the document root', async () => {
      const path = await working('doc.json', '{ not json');
      const result = await client.callTool({
        name: 'validate',
        arguments: { contract: 'design-document', path },
      });
      expect(result.isError).toBeFalsy();
      expect(textOf(result)).toContain('expected: a valid JSON document');
    });

    it('refuses a file outside .noesis/tmp/', async () => {
      const outside = join(t.root, 'doc.json');
      await writeFile(outside, JSON.stringify(designDocFixture));
      const result = await client.callTool({
        name: 'validate',
        arguments: { contract: 'design-document', path: outside },
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain(session.path);
    });

    it('refuses a missing file', async () => {
      const result = await client.callTool({
        name: 'validate',
        arguments: {
          contract: 'design-document',
          path: join(session.path, 'nope.json'),
        },
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('No file at');
    });

    it('rejects an unknown contract name in-band', async () => {
      const path = await working('doc.json', designDocFixture);
      const result = await client.callTool({
        name: 'validate',
        arguments: { contract: 'no-such-contract', path },
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('contract');
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

      const listed = await t.designDocsService.list(CHANGE);
      expect(listed).toHaveLength(1);
      expect(textOf(result)).toContain(listed[0]?.id ?? 'no id');
    });

    it('rejects an invalid file with the same issue list validate gives, and writes nothing', async () => {
      const path = await working('doc.json', brokenFixture);
      const result = await client.callTool({
        name: 'create-design-doc',
        arguments: { change: CHANGE, path },
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('Invalid design-document');
      expect(textOf(result)).toContain('svc-booking');
      expect(await t.designDocsService.list(CHANGE)).toEqual([]);
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
    expect(textOf(result)).toContain('Available tools: validate, list-changes');
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
      await t.designDocsService.createSample(CHANGE);
      const result = await client.callTool({
        name: 'list-design-docs',
        arguments: { change: CHANGE },
      });
      const line = textOf(result);
      expect(line).toContain('Appointment booking');
      expect(line).toContain(`.noesis/changes/${CHANGE}/design-docs/`);
    });
  });

  describe('update-design-doc', () => {
    it('replaces the document under its id', async () => {
      const created = await t.designDocsService.createSample(CHANGE);
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
      const listed = await t.designDocsService.list(CHANGE);
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

  describe('import-conversation', () => {
    const payload = {
      conversation: {
        conversation_id: 'placeholder',
        time: '2026-09-12T10:00:00Z',
        main_topic: 'Slot holds',
        turns: [
          {
            index: 0,
            speaker: 'Ada',
            time: '10:00',
            fragments: [
              {
                index: 0,
                sentences: ['Hold a slot for ten minutes.'],
                categories: ['Decision'],
              },
            ],
          },
        ],
      },
      topics: [
        {
          id: 'new-1',
          is_new: true,
          title: 'Slot holds',
          short_summary: 'How slots are held.',
          long_summary: 'Slots are held for ten minutes.',
          items: [
            {
              type: 'conversation_fragment_ref',
              conversation_id: 'placeholder',
              turn_index: 0,
              fragment_index: 0,
            },
          ],
          decisions: [
            {
              title: 'Hold slots for ten minutes',
              status: 'accepted',
              context: { text: 'Double bookings.', supporting_info: [] },
              decision: {
                text: 'Ten minutes.',
                rationale: 'Long enough.',
                supporting_info: [],
              },
              alternative_options: [],
            },
          ],
        },
      ],
    };

    it('writes the source and the wiki, and reports what it did', async () => {
      const path = await working('analysis.json', payload);
      const result = await client.callTool({
        name: 'import-conversation',
        arguments: { change: CHANGE, path },
      });
      expect(result.isError).toBeFalsy();
      const report = textOf(result);
      expect(report).toContain(
        `Imported the conversation as .noesis/changes/${CHANGE}/conversations/slot-holds-`,
      );
      expect(report).toMatch(/Topics created: [0-9a-f-]{36}\./);
      expect(report).toMatch(/Decisions created: [0-9a-f-]{36}\./);
      expect(await t.topicsRepository.list()).toHaveLength(1);
      expect(await t.decisionsRepository.list()).toHaveLength(1);
    });

    it('reports a duplicate source in-band and writes nothing', async () => {
      const path = await working('analysis.json', payload);
      await client.callTool({
        name: 'import-conversation',
        arguments: { change: CHANGE, path },
      });
      const again = await client.callTool({
        name: 'import-conversation',
        arguments: { change: CHANGE, path },
      });
      expect(again.isError).toBe(true);
      expect(textOf(again)).toContain('was imported before as .noesis/');
      expect(await t.topicsRepository.list()).toHaveLength(1);
    });

    it('rejects a payload that fails the contract with the issue list', async () => {
      const path = await working('analysis.json', { topics: [] });
      const result = await client.callTool({
        name: 'import-conversation',
        arguments: { change: CHANGE, path },
      });
      expect(result.isError).toBe(true);
      expect(textOf(result)).toContain('Invalid conversation-analysis');
      expect(textOf(result)).toContain('$.conversation');
    });
  });

  describe('search-knowledge-graph', () => {
    it('lists hits as type, id and title', async () => {
      const result = await client.callTool({
        name: 'search-knowledge-graph',
        arguments: { query: 'slots' },
      });
      expect(textOf(result)).toBe('topic  t-1  Hit for slots');
    });
  });

  it('returns a descriptive in-band error for missing arguments', async () => {
    const result = await client.callTool({ name: 'validate', arguments: {} });
    expect(result.isError).toBe(true);
    expect(textOf(result)).toContain('path');
  });
});
