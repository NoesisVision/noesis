import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { MermaidSource } from '#backend/app/design-docs/mermaid-source';

describe('The source of a Mermaid diagram', () => {
  it.each([
    'sequenceDiagram\n  A->>B: hello',
    'flowchart TD\n  A --> B',
    'graph LR',
    'stateDiagram-v2\n  [*] --> Draft',
    'C4Context\n  title Shop',
    'xychart-beta',
    '  sequenceDiagram',
    '%% who calls whom\nsequenceDiagram\n  A->>B: hello',
    '%%{init: {"theme": "base"}}%%\n\nsequenceDiagram',
    '---\ntitle: Refunds\n---\nsequenceDiagram\n  A->>B: hello',
  ])('opens with the kind of diagram it draws: %p', (source) => {
    expect(MermaidSource.safeParse(source).success).toBe(true);
  });

  it.each([
    '',
    '   ',
    '```mermaid\nsequenceDiagram\n```',
    '~~~mermaid\nflowchart TD\n~~~',
    'The refund flow: sequenceDiagram',
    'notADiagram\n  A --> B',
  ])('is refused without one, or wrapped in a fence: %p', (source) => {
    expect(MermaidSource.safeParse(source).success).toBe(false);
  });

  it('tells an agent the rule in its JSON Schema', () => {
    const schema = z.toJSONSchema(MermaidSource, { io: 'input' });

    expect(schema).toMatchObject({ type: 'string' });
    expect(new RegExp(String(schema.pattern)).test('sequenceDiagram')).toBe(
      true,
    );
    expect(schema.description).toContain('without the fence');
  });
});
