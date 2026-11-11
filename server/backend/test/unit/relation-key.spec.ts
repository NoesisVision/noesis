import { describe, expect, it } from 'bun:test';
import {
  NAMED_SLOT_KINDS,
  relationKeyOf,
} from '#backend/app/design-docs/relation-key';

const ORDER = 'building_block|sales.orders.Order';
const PLACE = 'behavior|sales.orders.Order.place';

describe('The key of a relation', () => {
  it('knows the named slots from the schemas', () => {
    expect([...NAMED_SLOT_KINDS].sort()).toEqual([
      'has_collaborator',
      'has_input',
      'has_output',
      'has_state',
    ]);
  });

  it('keys a named slot by its holder and name, whatever it points at', () => {
    const slot = { kind: 'has_state', from: ORDER, name: 'total' };

    expect(relationKeyOf({ ...slot, to: 'primitive|decimal' })).toBe(
      relationKeyOf({ ...slot, to: 'primitive|integer' }),
    );
    expect(relationKeyOf({ ...slot, to: 'primitive|decimal' })).toBe(
      `has_state|${ORDER}|#total`,
    );
    expect(relationKeyOf(slot)).toBe(`has_state|${ORDER}|#total`);
  });

  it('keys two slots of one type apart', () => {
    const slot = { kind: 'has_input', from: PLACE, to: 'primitive|string' };

    expect(relationKeyOf({ ...slot, name: 'first' })).not.toBe(
      relationKeyOf({ ...slot, name: 'last' }),
    );
  });

  it('keys an edge by its target', () => {
    expect(relationKeyOf({ kind: 'exposes', from: ORDER, to: PLACE })).toBe(
      `exposes|${ORDER}|${PLACE}`,
    );
    expect(
      relationKeyOf({
        kind: 'extends',
        from: ORDER,
        to: 'building_block|sales.shared.Auditable',
      }),
    ).not.toBe(relationKeyOf({ kind: 'extends', from: ORDER, to: PLACE }));
  });
});
