import { describe, expect, it } from 'bun:test';
import { InformationFragmentRefSchema } from './information-fragment.js';

describe('InformationFragmentRefSchema', () => {
  it('accepts a conversation fragment ref with an optional source_sha', () => {
    const result = InformationFragmentRefSchema.parse({
      type: 'conversation_fragment_ref',
      conversation_id: 'c1',
      turn_index: 1,
      fragment_index: 2,
      source_sha: 'abc',
    });
    expect(result.type).toBe('conversation_fragment_ref');
  });

  it('accepts a document fragment ref without a source_sha', () => {
    const result = InformationFragmentRefSchema.parse({
      type: 'document_fragment_ref',
      document_id: 'doc1',
      fragment_index: 0,
    });
    expect(result.type).toBe('document_fragment_ref');
  });

  it('rejects an unknown ref type', () => {
    const result = InformationFragmentRefSchema.safeParse({
      type: 'mystery_ref',
    });
    expect(result.success).toBe(false);
  });
});
