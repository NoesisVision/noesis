import { describe, expect, it } from 'bun:test';
import { BuildingBlockKind } from '#backend/app/system-model/system-model.ts';
import {
  compareSiblings,
  drawsDiagram,
  type OutlineNode,
  patternLabelOf,
} from '../src/features/design-docs/ui/model-tree/model-outline';

describe('patternLabelOf', () => {
  it('writes out the vocabulary the model spells in lower case', () => {
    expect(patternLabelOf('application_service')).toBe('Application Service');
    expect(patternLabelOf('aggregate')).toBe('Aggregate');
    expect(patternLabelOf('value_object')).toBe('Value Object');
    expect(patternLabelOf(null)).toBeNull();
  });

  it('leaves a word already written that way as it is', () => {
    expect(patternLabelOf('command')).toBe('Command');
  });
});

describe('drawsDiagram', () => {
  it.each([
    '```mermaid\nflowchart TD\n```',
    'Before.\n\n  ```mermaid\n  flowchart TD\n  ```',
    '~~~mermaid\nflowchart TD\n~~~',
  ])('finds a fence in %j', (description) => {
    expect(drawsDiagram(description)).toBe(true);
  });

  it.each([null, undefined, '', 'mermaid is a word here', '`mermaid`'])(
    'finds none in %j',
    (description) => {
      expect(drawsDiagram(description)).toBe(false);
    },
  );
});

describe('compareSiblings', () => {
  const node = (over: Partial<OutlineNode>): OutlineNode => ({
    path: over.name ?? '',
    parentPath: 'module|sales',
    elementId: null,
    kind: 'property',
    name: '',
    depth: 1,
    change: 'added',
    pattern: null,
    patternLabel: null,
    hasDiagram: false,
    ...over,
  });

  it('reads a property type that looks like a pattern as a type, not a rank', () => {
    const zeta = node({ name: 'zeta', pattern: 'aggregate' });
    const alpha = node({ name: 'alpha', pattern: 'Money' });
    expect([zeta, alpha].sort(compareSiblings).map((n) => n.name)).toEqual([
      'alpha',
      'zeta',
    ]);
  });

  it('ranks building blocks by the order a reader meets them', () => {
    const aggregate = node({
      kind: 'building_block',
      name: 'Zeta',
      pattern: 'aggregate',
    });
    const service = node({
      kind: 'building_block',
      name: 'Alpha',
      pattern: 'application_service',
    });
    expect(
      [aggregate, service].sort(compareSiblings).map((n) => n.name),
    ).toEqual(['Alpha', 'Zeta']);
  });

  it('ranks every kind of building block, adapters round the boundary', () => {
    const blocks = BuildingBlockKind.options
      .toReversed()
      .map((pattern) =>
        node({ kind: 'building_block', name: pattern, pattern }),
      );
    expect(blocks.sort(compareSiblings).map((n) => n.pattern)).toEqual([
      'in_adapter',
      'application_service',
      'domain_service',
      'repository',
      'factory',
      'external_integration',
      'out_adapter',
      'technical_service',
      'aggregate',
      'entity',
      'value_object',
      'command',
      'query',
      'event',
    ]);
  });
});
