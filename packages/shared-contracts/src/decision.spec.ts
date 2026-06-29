import { describe, expect, it } from 'bun:test';
import { DecisionSchema } from './decision.js';

describe('DecisionSchema', () => {
  const minimal = {
    id: 'd-1',
    topic_id: 't-1',
    title: 'Use X',
    status: 'accepted' as const,
    context: { text: 'why', supporting_info: [] },
    decision: { text: 'use X', rationale: 'because', supporting_info: [] },
    alternative_options: [],
  };

  it('defaults per-field locks across the nested slots to false', () => {
    const result = DecisionSchema.parse(minimal);
    expect(result.title_locked).toBe(false);
    expect(result.status_locked).toBe(false);
    expect(result.context.text_locked).toBe(false);
    expect(result.decision.text_locked).toBe(false);
    expect(result.decision.rationale_locked).toBe(false);
  });

  it('rejects an unknown status', () => {
    const result = DecisionSchema.safeParse({
      ...minimal,
      status: 'rejected',
    });
    expect(result.success).toBe(false);
  });

  it('keeps supporting_info on every option', () => {
    const ref = {
      type: 'conversation_fragment_ref' as const,
      conversation_id: 'c1',
      turn_index: 0,
      fragment_index: 0,
    };
    const result = DecisionSchema.parse({
      ...minimal,
      alternative_options: [
        { text: 'use Y', rationale: 'alt', supporting_info: [ref] },
      ],
    });
    expect(result.alternative_options[0]?.supporting_info).toEqual([ref]);
  });
});
