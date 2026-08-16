import { describe, expect, it } from 'bun:test';
import { designDocFixture } from './design-doc.fixture.js';
import {
  DesignDocCommentSchema,
  DesignDocProposalSchema,
  DesignDocSuggestionSchema,
} from './design-doc-collaboration.js';
import { elementRef, resolveRef, slotRef } from './design-doc-ref.js';

const author = { id: 'u-maya', name: 'Maya Ruiz', role: 'Product' };

describe('DesignDocCommentSchema', () => {
  it('opens unresolved, with no replies', () => {
    const comment = DesignDocCommentSchema.parse({
      id: 'c-1',
      documentId: designDocFixture.id,
      anchor: { ref: elementRef('rule-hold'), quote: '10 minutes' },
      author,
      body: 'Is ten minutes enough on mobile?',
      createdAt: '2026-08-14T09:00:00Z',
    });

    expect(comment.resolved).toBe(false);
    expect(comment.replies).toEqual([]);
    expect(comment.mentions).toEqual([]);
  });
});

describe('DesignDocSuggestionSchema', () => {
  it('starts pending, so nothing is applied behind the author’s back', () => {
    const suggestion = DesignDocSuggestionSchema.parse({
      id: 'sg-1',
      documentId: designDocFixture.id,
      anchor: { ref: elementRef('rule-hold'), quote: '10 minutes' },
      replacement: '15 minutes',
      author,
      createdAt: '2026-08-14T09:00:00Z',
    });

    expect(suggestion.status).toBe('pending');
    expect(suggestion.note).toBe('');
  });
});

describe('anchors', () => {
  it('resolve in the document they name', () => {
    const refs = [
      elementRef('rule-hold'),
      elementRef('sc-in-2'),
      elementRef('st-2'),
      slotRef(designDocFixture.id, 'goal'),
      slotRef('uc-book', 'output', 'summary'),
      slotRef('uc-book', 'rules'),
    ];

    for (const ref of refs) {
      expect(resolveRef(designDocFixture, ref)).toBeDefined();
    }
  });

  it('keeps pointing at the element when the document around it moves', () => {
    // A rule dragged to the top of its list, and the whole use case reordered:
    // an element ref names neither position nor containment, so it still holds.
    const moved = structuredClone(designDocFixture);
    const useCase = moved.useCases[0];
    if (useCase) useCase.rules.reverse();
    moved.useCases.reverse();

    const ref = elementRef('rule-hold');
    expect(resolveRef(moved, ref)).toEqual(resolveRef(designDocFixture, ref));
  });

  it('does not resolve once the element is gone', () => {
    const without = structuredClone(designDocFixture);
    const useCase = without.useCases[0];
    if (useCase) useCase.rules = [];

    expect(resolveRef(without, elementRef('rule-hold'))).toBeUndefined();
  });
});

describe('DesignDocProposalSchema', () => {
  it('carries a whole document, an impact summary and its challenges', () => {
    const proposal = DesignDocProposalSchema.parse({
      id: 'p-1',
      documentId: designDocFixture.id,
      trigger: 'source_scan',
      createdAt: '2026-08-15T07:00:00Z',
      rationale: 'The 15 August scan adds a deposit ledger.',
      document: designDocFixture,
      impact: {
        added: [{ ref: elementRef('uc-refund'), label: 'Refund deposit' }],
        specificationOnly: [
          {
            ref: slotRef('uc-book', 'summary'),
            label: 'Summary reworded',
            note: 'No codebase delta.',
          },
        ],
      },
      challengedDecisions: [
        {
          ref: elementRef('rule-hold'),
          humanDecision: 'A hold expires after 10 minutes.',
          agentPosition: 'A hold should expire after 15 minutes.',
          reasoning: 'Card entry on mobile regularly runs past ten minutes.',
        },
      ],
    });

    expect(proposal.status).toBe('pending');
    expect(proposal.document.id).toBe(designDocFixture.id);
    expect(proposal.impact.changed).toEqual([]);
    expect(proposal.impact.removed).toEqual([]);
    expect(proposal.impact.added[0]?.note).toBe('');
    expect(proposal.challengedDecisions).toHaveLength(1);
  });
});
