import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { stat } from 'node:fs/promises';
import type {
  ConversationAnalysis,
  DocumentAnalysis,
} from '@repo/shared-contracts';
import { ChangeSlug } from '../../src/changes/change-slug.js';
import {
  DuplicateSourceError,
  InvalidImportError,
} from '../../src/imports/import.service.js';
import { type TestNoesis, testNoesis } from './test-noesis.js';

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
  return {
    conversation: {
      conversation_id: 'placeholder-conv',
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
        id: 'new-parent',
        parent_id: null,
        is_new: true,
        title: 'Booking',
        short_summary: 'Booking in general.',
        long_summary: 'Everything about booking.',
        items: [],
        decisions: [],
        reviewed: false,
        decisions_extracted: false,
      },
      {
        id: 'new-child',
        parent_id: 'new-parent',
        is_new: true,
        title: 'Slot holds',
        short_summary: 'How slots are held.',
        long_summary: 'Slots are held for ten minutes.',
        items: [fragmentRef('placeholder-conv')],
        decisions: [
          {
            title: 'Hold slots for ten minutes',
            status: 'accepted',
            context: {
              text: 'Double bookings happened.',
              text_locked: false,
              supporting_info: [fragmentRef('placeholder-conv')],
            },
            decision: {
              text: 'Ten minutes.',
              text_locked: false,
              rationale: 'Long enough to pay.',
              rationale_locked: false,
              supporting_info: [],
            },
            alternative_options: [],
          },
        ],
        reviewed: false,
        decisions_extracted: true,
      },
    ],
    ...overrides,
  };
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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
      `/.noesis/graph/changes/${CHANGE}/conversations/slot-holds-`,
    );
    expect((await stat(report.source.path)).isFile()).toBe(true);
    const stored = await t.conversationsRepository.findById(
      CHANGE,
      report.source.id,
    );
    expect(stored?.entity.conversation_id).toBe(report.source.id);
  });

  it('mints ids for new topics, resolves placeholders in parents and refs, and pins refs to the source hash', async () => {
    const report = await t.importService.importConversation(
      CHANGE,
      conversationPayload(),
    );

    expect(report.topics.created).toHaveLength(2);
    expect(report.topics.updated).toEqual([]);
    const topics = await t.topicsRepository.list();
    const parent = topics.find((s) => s.entity.title === 'Booking')?.entity;
    const child = topics.find((s) => s.entity.title === 'Slot holds')?.entity;
    expect(parent?.id).toMatch(UUID);
    expect(child?.parent_id).toBe(parent?.id ?? 'missing');
    const stored = await t.conversationsRepository.findById(
      CHANGE,
      report.source.id,
    );
    expect(child?.items).toEqual([
      {
        ...fragmentRef(report.source.id),
        source_sha: stored?.hash,
      },
    ]);
  });

  it('creates the decisions under their topic with minted ids', async () => {
    const report = await t.importService.importConversation(
      CHANGE,
      conversationPayload(),
    );

    expect(report.decisions.created).toHaveLength(1);
    const [decision] = await t.decisionsRepository.list();
    expect(decision?.entity.id).toMatch(UUID);
    expect(decision?.entity.title).toBe('Hold slots for ten minutes');
    const child = (await t.topicsRepository.list()).find(
      (s) => s.entity.title === 'Slot holds',
    );
    expect(decision?.entity.topic_id).toBe(child?.entity.id ?? 'missing');
    expect(decision?.entity.context.supporting_info[0]).toMatchObject({
      conversation_id: report.source.id,
    });
  });

  it('merges into an existing topic, keeping its locked fields and the union of items', async () => {
    await t.topicsRepository.write({
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
    const topic = (await t.topicsRepository.findById('topic-existing'))?.entity;
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
    expect(await t.conversationsRepository.list(CHANGE)).toEqual([]);
  });

  it('detects the same conversation imported again, in any change, and writes nothing', async () => {
    await t.createChange(OTHER);
    await t.importService.importConversation(CHANGE, conversationPayload());

    const again = t.importService.importConversation(
      OTHER,
      conversationPayload(),
    );

    await expect(again).rejects.toBeInstanceOf(DuplicateSourceError);
    expect(await t.conversationsRepository.list(OTHER)).toEqual([]);
    expect(await t.topicsRepository.list()).toHaveLength(2);
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
      `/.noesis/graph/changes/${CHANGE}/documents/booking-rules-`,
    );
    const [topic] = await t.topicsRepository.list();
    expect(topic?.entity.items[0]).toMatchObject({
      type: 'document_fragment_ref',
      document_id: report.source.id,
    });
  });
});
