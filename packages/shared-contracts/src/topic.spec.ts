import { describe, expect, it } from 'bun:test';
import { TopicSchema } from './topic.js';

describe('TopicSchema', () => {
  const minimal = {
    id: 't-1',
    title: 'Topic',
    short_summary: 's',
    long_summary: 'l',
    items: [],
  };

  it('defaults parent_id to null', () => {
    const result = TopicSchema.parse(minimal);
    expect(result.parent_id).toBeNull();
  });

  it('defaults every per-field lock to false', () => {
    const result = TopicSchema.parse(minimal);
    expect(result.title_locked).toBe(false);
    expect(result.short_summary_locked).toBe(false);
    expect(result.long_summary_locked).toBe(false);
  });

  it('preserves explicit locks', () => {
    const result = TopicSchema.parse({ ...minimal, title_locked: true });
    expect(result.title_locked).toBe(true);
  });
});
