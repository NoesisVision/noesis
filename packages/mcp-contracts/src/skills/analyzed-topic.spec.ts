import { describe, expect, it } from 'bun:test';
import {
  AnalyzedDecisionSchema,
  AnalyzedTopicSchema,
} from './analyzed-topic.js';

describe('AnalyzedDecisionSchema', () => {
  const conversationRef = {
    type: 'conversation_fragment_ref' as const,
    conversation_id: 'c1',
    turn_index: 0,
    fragment_index: 0,
  };

  it('fills id with a uuid when omitted', () => {
    const result = AnalyzedDecisionSchema.parse({
      title: 't',
      status: 'accepted',
      context: { text: '', supporting_info: [] },
      decision: { text: '', rationale: '', supporting_info: [] },
      alternative_options: [],
    });
    expect(result.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('accepts supporting_info references attached to every slot', () => {
    const result = AnalyzedDecisionSchema.parse({
      title: 't',
      status: 'accepted',
      context: { text: '', supporting_info: [conversationRef] },
      decision: {
        text: '',
        rationale: '',
        supporting_info: [conversationRef],
      },
      alternative_options: [
        { text: 'x', rationale: '', supporting_info: [conversationRef] },
      ],
    });
    expect(result.context.supporting_info).toEqual([conversationRef]);
    expect(result.decision.supporting_info).toEqual([conversationRef]);
    expect(result.alternative_options[0]?.supporting_info).toEqual([
      conversationRef,
    ]);
  });
});

describe('AnalyzedTopicSchema', () => {
  it('defaults parent_id to null and is_new to false', () => {
    const result = AnalyzedTopicSchema.parse({
      id: 't-1',
      title: 'Topic',
      short_summary: 's',
      long_summary: 'l',
      items: [],
    });
    expect(result.parent_id).toBeNull();
    expect(result.is_new).toBe(false);
    expect(result.decisions).toEqual([]);
    expect(result.reviewed).toBe(false);
    expect(result.decisions_extracted).toBe(false);
  });

  it('accepts an explicit parent_id and is_new', () => {
    const result = AnalyzedTopicSchema.parse({
      id: 't-2',
      parent_id: 't-1',
      is_new: true,
      title: 'Child',
      short_summary: 's',
      long_summary: 'l',
      items: [],
    });
    expect(result.parent_id).toBe('t-1');
    expect(result.is_new).toBe(true);
  });
});
