import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { stat } from 'node:fs/promises';
import type {
  ConversationAnalysis,
  DocumentAnalysis,
} from '@repo/shared-contracts';
import { conversationAnalysisFixture } from '@repo/shared-contracts/conversation-analysis.fixture';
import { sha256 } from '@repo/shared-vo';
import { ChangeSlug } from '../../src/app/changes/change-slug.js';
import {
  DuplicateSourceError,
  InvalidImportError,
} from '../../src/infra/mcp/import.service.js';
import { all, put, type TestNoesis, testNoesis } from './test-noesis.js';

const CHANGE = ChangeSlug.parse('booking');
const OTHER = ChangeSlug.parse('other');

let t: TestNoesis;

beforeEach(async () => {
  t = await testNoesis();
  await t.createChange(CHANGE);
});

afterEach(() => t.cleanup());

const fragmentRef = (conversationId: string) => ({
  type: 'conversation_fragment_ref' as const,
  conversation_id: conversationId,
  turn_index: 0,
  fragment_index: 0,
});

function conversationPayload(
  overrides: Partial<ConversationAnalysis> = {},
): ConversationAnalysis {
  return { ...conversationAnalysisFixture, ...overrides };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

const conversationsOf = (slug: ChangeSlug) =>
  t.changesRepository.children(slug).conversations;

describe('ImportService.importConversation', () => {
  it('writes the conversation under a content-hash id and reports its path', async () => {
    const report = await t.importService.importConversation(
      CHANGE,
      conversationPayload(),
    );

    expect(report.source.kind).toBe('conversation');
    expect(report.source.id).toMatch(UUID);
    expect(report.source.id).not.toBe('placeholder-conv');
    expect(report.source.path).toContain(
      `/.noesis/graph/changes/${CHANGE}/conversations/${report.source.id}/data.json`,
    );
    expect((await stat(report.source.path)).isFile()).toBe(true);
    const stored = await conversationsOf(CHANGE).get(report.source.id);
    expect(stored?.conversation_id).toBe(report.source.id);
  });

  it('mints ids for new topics, resolves placeholders in parents and refs, and pins refs to the source hash', async () => {
    const report = await t.importService.importConversation(
      CHANGE,
      conversationPayload(),
    );

    expect(report.topics.created).toHaveLength(2);
    expect(report.topics.updated).toEqual([]);
    const topics = await all(t.topics);
    const parent = topics.find((s) => s.title === 'Booking');
    const child = topics.find((s) => s.title === 'Slot holds');
    expect(parent?.id).toMatch(UUID);
    expect(child?.parent_id).toBe(parent?.id ?? 'missing');
    const stored = await conversationsOf(CHANGE).get(report.source.id);
    expect(child?.items).toEqual([
      {
        ...fragmentRef(report.source.id),
        source_sha: sha256(JSON.stringify(stored)),
      },
    ]);
  });

  it('creates the decisions under their topic with minted ids', async () => {
    const report = await t.importService.importConversation(
      CHANGE,
      conversationPayload(),
    );

    expect(report.decisions.created).toHaveLength(1);
    const [decision] = await all(t.decisions);
    expect(decision?.id).toMatch(UUID);
    expect(decision?.title).toBe('Hold slots for ten minutes');
    const child = (await all(t.topics)).find((s) => s.title === 'Slot holds');
    expect(decision?.topic_id).toBe(child?.id ?? 'missing');
    expect(decision?.context.supporting_info[0]).toMatchObject({
      conversation_id: report.source.id,
    });
  });

  it('merges into an existing topic, keeping its locked fields and the union of items', async () => {
    await put(t.topics, {
      id: 'topic-existing',
      parent_id: null,
      title: 'Slot holds (person wrote this)',
      title_locked: true,
      short_summary: 'Old short.',
      short_summary_locked: false,
      long_summary: 'Old long, hand-edited.',
      long_summary_locked: true,
      items: [fragmentRef('other-conversation')],
    });
    const payload = conversationPayload({
      topics: [
        {
          id: 'topic-existing',
          parent_id: null,
          is_new: false,
          title: 'Slot holds',
          short_summary: 'New short.',
          long_summary: 'New long.',
          items: [fragmentRef('placeholder-conv')],
          decisions: [],
          reviewed: false,
          decisions_extracted: false,
        },
      ],
    });

    const report = await t.importService.importConversation(CHANGE, payload);

    expect(report.topics.updated).toEqual(['topic-existing']);
    const topic = await t.topics.get('topic-existing');
    expect(topic?.title).toBe('Slot holds (person wrote this)');
    expect(topic?.title_locked).toBe(true);
    expect(topic?.short_summary).toBe('New short.');
    expect(topic?.long_summary).toBe('Old long, hand-edited.');
    expect(topic?.items.map((i) => i.type)).toHaveLength(2);
    expect(topic?.items[0]).toEqual(fragmentRef('other-conversation'));
    expect(topic?.items[1]).toMatchObject({
      conversation_id: report.source.id,
    });
  });

  it('rejects an existing-topic id the wiki does not have, before writing anything', async () => {
    const payload = conversationPayload({
      topics: [
        {
          id: 'ghost',
          parent_id: null,
          is_new: false,
          title: 'Ghost',
          short_summary: '',
          long_summary: '',
          items: [],
          decisions: [],
          reviewed: false,
          decisions_extracted: false,
        },
      ],
    });

    const attempt = t.importService.importConversation(CHANGE, payload);

    await expect(attempt).rejects.toBeInstanceOf(InvalidImportError);
    await expect(attempt).rejects.toMatchObject({
      issues: [expect.objectContaining({ path: '$.topics[0].id' })],
    });
    expect(await Array.fromAsync(conversationsOf(CHANGE).keys())).toEqual([]);
  });

  it('detects the same conversation imported again, in any change, and writes nothing', async () => {
    await t.createChange(OTHER);
    await t.importService.importConversation(CHANGE, conversationPayload());

    const again = t.importService.importConversation(
      OTHER,
      conversationPayload(),
    );

    await expect(again).rejects.toBeInstanceOf(DuplicateSourceError);
    expect(await Array.fromAsync(conversationsOf(OTHER).keys())).toEqual([]);
    expect(await all(t.topics)).toHaveLength(2);
  });

  it('rejects a payload that fails the contract with the validator issues', async () => {
    const attempt = t.importService.importConversation(CHANGE, {
      topics: 'nope',
    });
    await expect(attempt).rejects.toBeInstanceOf(InvalidImportError);
    await expect(attempt).rejects.toMatchObject({
      contract: 'conversation-analysis',
    });
  });
});

describe('ImportService.importDocument', () => {
  const documentPayload: DocumentAnalysis = {
    document: {
      document_id: 'placeholder-doc',
      title: 'Booking rules',
      date: '2026-09-01',
      fragments: [
        {
          index: 0,
          section_path: ['Rules'],
          kind: 'paragraph',
          text: 'A slot is held for ten minutes.',
          categories: ['Information'],
        },
      ],
      section_tree: [
        {
          level: 1,
          title: 'Rules',
          path: ['Rules'],
          fragment_indices: [0],
          children: [],
        },
      ],
    },
    topics: [
      {
        id: 'new-1',
        parent_id: null,
        is_new: true,
        title: 'Slot holds',
        short_summary: 'How slots are held.',
        long_summary: 'Ten minutes.',
        items: [
          {
            type: 'document_fragment_ref',
            document_id: 'placeholder-doc',
            fragment_index: 0,
          },
        ],
        decisions: [],
        reviewed: false,
        decisions_extracted: false,
      },
    ],
  };

  it('writes the document under a content-hash id and rewrites the refs', async () => {
    const report = await t.importService.importDocument(
      CHANGE,
      documentPayload,
    );

    expect(report.source.kind).toBe('document');
    expect(report.source.path).toContain(
      `/.noesis/graph/changes/${CHANGE}/documents/${report.source.id}/data.json`,
    );
    const [topic] = await all(t.topics);
    expect(topic?.items[0]).toMatchObject({
      type: 'document_fragment_ref',
      document_id: report.source.id,
    });
  });
});
