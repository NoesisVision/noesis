import { describe, expect, it } from 'bun:test';
import { DesignDocSchema } from './design-doc.js';

describe('DesignDocFileSchema', () => {
  const minimal = {
    id: 'dd-1',
    name: 'Ordering',
    description: 'The ordering context',
  };

  it('defaults locks, actors, implemented and date', () => {
    const result = DesignDocSchema.parse(minimal);
    expect(result.name_locked).toBe(false);
    expect(result.description_locked).toBe(false);
    expect(result.actors).toEqual([]);
    expect(result.implemented).toBe(false);
    expect(result.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('fills changeset slots with empty added/removed/modified when present', () => {
    const result = DesignDocSchema.parse({
      ...minimal,
      boundedContexts: {},
    });
    expect(result.boundedContexts).toEqual({
      added: [],
      removed: [],
      modified: [],
    });
  });

  it('round-trips a nested bounded context with per-level locks', () => {
    const result = DesignDocSchema.parse({
      ...minimal,
      boundedContexts: {
        added: [
          {
            name: 'Ordering',
            name_locked: true,
            modules: {
              added: [{ name: 'Cart', description_locked: true }],
            },
          },
        ],
      },
    });
    const context = result.boundedContexts?.added[0];
    expect(context?.name_locked).toBe(true);
    expect(context?.modules?.added[0]?.name).toBe('Cart');
    expect(context?.modules?.added[0]?.description_locked).toBe(true);
  });
});
