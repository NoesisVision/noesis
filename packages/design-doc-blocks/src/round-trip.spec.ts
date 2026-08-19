import { describe, expect, it } from 'bun:test';
import { checkDesignDocument } from '@repo/shared-contracts';
import { designDocFixture } from '@repo/shared-contracts/design-doc.fixture';
import { blockGroup } from './block-specs.js';
import { toBlocks } from './blocks.js';
import { toDocument } from './to-document.js';

describe('toBlocks / toDocument', () => {
  it('round-trips the fixture document exactly', () => {
    const { blocks, sidecar } = toBlocks(designDocFixture);
    expect(toDocument(blocks, sidecar)).toEqual(designDocFixture);
  });

  it('projects to a document the integrity check accepts', () => {
    const { blocks, sidecar } = toBlocks(designDocFixture);
    const errors = toDocument(blocks, sidecar).id
      ? checkDesignDocument(toDocument(blocks, sidecar)).filter(
          (issue) => issue.severity === 'error',
        )
      : [];
    expect(errors).toEqual([]);
  });

  it('uses element ids as block ids, and stable slot ids for single fields', () => {
    const { blocks } = toBlocks(designDocFixture);
    const ids = blocks.map((b) => b.id);
    expect(ids).toContain('rule-hold');
    expect(ids).toContain('as-book-happy');
    expect(ids).toContain('slot:goal');
    expect(ids).toContain('slot:summary:uc-book');
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('keeps element order inside each schema array from block order', () => {
    const { blocks, sidecar } = toBlocks(designDocFixture);
    const ruleIds = blocks
      .filter((b) => b.type === 'rule')
      .map((b) => b.id)
      .reverse();
    const reordered = [...blocks].sort((a, b) => {
      if (a.type !== 'rule' || b.type !== 'rule') return 0;
      return ruleIds.indexOf(a.id) - ruleIds.indexOf(b.id);
    });
    const projected = toDocument(reordered, sidecar);
    expect(projected.useCases[0]?.rules.map((r) => r.id)).toEqual(ruleIds);
  });

  it('attaches elements to their use case by prop, not by position', () => {
    const { blocks, sidecar } = toBlocks(designDocFixture);
    // Move a rule of uc-book to the very end of the document.
    const rule = blocks.find((b) => b.id === 'rule-hold');
    if (rule === undefined) throw new Error('fixture rule missing');
    const moved = [...blocks.filter((b) => b.id !== 'rule-hold'), rule];
    const projected = toDocument(moved, sidecar);
    const bookRules = projected.useCases.find((u) => u.id === 'uc-book')?.rules;
    expect(bookRules?.some((r) => r.id === 'rule-hold')).toBe(true);
  });

  it('flattens styled inline runs to plain text', () => {
    const { blocks, sidecar } = toBlocks(designDocFixture);
    const styled = blocks.map((block) =>
      block.id === 'rule-hold'
        ? {
            ...block,
            content: [
              { type: 'text' as const, text: 'A hold expires ', styles: {} },
              {
                type: 'text' as const,
                text: 'after 10 minutes.',
                styles: { bold: true },
              },
            ],
          }
        : block,
    );
    const projected = toDocument(styled, sidecar);
    expect(
      projected.useCases[0]?.rules.find((r) => r.id === 'rule-hold')?.text,
    ).toBe('A hold expires after 10 minutes.');
  });

  it('scopes reorder groups per use case and per direction', () => {
    expect(blockGroup('rule', { useCaseId: 'uc-book' })).toBe('uc-book:rules');
    expect(
      blockGroup('fieldRow', { useCaseId: 'uc-book', direction: 'input' }),
    ).toBe('uc-book:fields:input');
    expect(
      blockGroup('fieldRow', { useCaseId: 'uc-book', direction: 'output' }),
    ).toBe('uc-book:fields:output');
    expect(blockGroup('scopeItem', { scope: 'out' })).toBe('scope:out');
    expect(blockGroup('goal', {})).toBe(null);
  });

  it('degrades an unreadable scenario payload instead of failing the projection', () => {
    const { blocks, sidecar } = toBlocks(designDocFixture);
    const broken = blocks.map((block) =>
      block.type === 'scenario' && block.id === 'as-book-happy'
        ? { ...block, props: { ...block.props, data: 'not json' } }
        : block,
    );
    const projected = toDocument(broken, sidecar);
    const scenario = projected.useCases
      .find((u) => u.id === 'uc-book')
      ?.acceptanceScenarios.find((s) => s.id === 'as-book-happy');
    expect(scenario).toBeDefined();
    expect(scenario?.steps).toEqual([]);
  });
});
