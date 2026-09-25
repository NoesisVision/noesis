import { describe, expect, it } from 'bun:test';
import {
  compareSiblings,
  drawsDiagram,
  type OutlineNode,
  patternLabelOf,
} from '../src/shared/ui/model-tree/model-outline';

describe('patternLabelOf', () => {
  it('spells a pattern the way a reader types it', () => {
    expect(patternLabelOf('application_service')).toBe('application service');
    expect(patternLabelOf('Command')).toBe('Command');
    expect(patternLabelOf(null)).toBeNull();
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
});
