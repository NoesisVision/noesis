import { describe, expect, it } from 'bun:test';
import {
  NAMED_SLOT_KINDS,
  relationKeyOf,
} from '#backend/app/design-docs/relation-key';

const ORDERS = 'module|sales.orders';
const ORDER = 'building_block|sales.orders.Order';
const PLACE = 'behavior|sales.orders.Order.place';
const CANCEL = 'behavior|sales.orders.Order.cancel';

const contains = {
  kind: 'module_contains_block',
  from: ORDERS,
  to: ORDER,
} as const;
const state = {
  kind: 'has_state',
  from: ORDER,
  to: 'primitive|decimal',
  name: 'total',
  cardinality: '1',
} as const;
const input = {
  kind: 'has_input',
  from: PLACE,
  to: 'primitive|uuid',
  name: 'customerId',
  cardinality: '1',
  position: 1,
} as const;
const output = {
  kind: 'has_output',
  from: PLACE,
  to: ORDER,
  name: 'result',
  cardinality: '1',
} as const;
const invokes = { kind: 'invokes', from: CANCEL, to: PLACE, order: 1 } as const;
const collaborator = {
  kind: 'has_collaborator',
  from: ORDER,
  to: 'building_block|sales.orders.Orders',
  name: 'orders',
  cardinality: '1',
} as const;

describe('The key a design knows a relation by', () => {
  it('is its kind and ends, or, for a named slot, its holder and name', () => {
    expect(relationKeyOf(contains)).toBe(relationKeyOf({ ...contains }));
    expect(relationKeyOf(state)).toBe(
      relationKeyOf({ ...state, to: 'primitive|integer' }),
    );
    expect(relationKeyOf(collaborator)).toBe(
      relationKeyOf({ ...collaborator, to: 'building_block|sales.Archive' }),
    );
    expect(relationKeyOf(state)).not.toBe(
      relationKeyOf({ ...state, name: 'count' }),
    );
    const optionalInput = { ...input, cardinality: '0..1' };
    expect(relationKeyOf(input)).toBe(relationKeyOf(optionalInput));
    expect(relationKeyOf(output)).toBe(
      relationKeyOf({ ...output, to: 'primitive|boolean' }),
    );
    expect(relationKeyOf(contains)).not.toBe(
      relationKeyOf({ ...contains, to: CANCEL }),
    );
    const laterCall = { ...invokes, order: 3 };
    expect(relationKeyOf(invokes)).toBe(relationKeyOf(laterCall));
    expect(relationKeyOf({ ...state, kind: 'has_input' })).not.toBe(
      relationKeyOf(state),
    );
  });

  it('reads the same off a removal key, which has only what names the relation', () => {
    expect(
      relationKeyOf({ kind: 'has_state', from: ORDER, name: 'total' }),
    ).toBe(relationKeyOf(state));
    expect(
      relationKeyOf({ kind: 'module_contains_block', from: ORDERS, to: ORDER }),
    ).toBe(relationKeyOf(contains));
  });

  it('names the slots of the model: state, collaborators, inputs and the output', () => {
    expect([...NAMED_SLOT_KINDS].sort()).toEqual([
      'has_collaborator',
      'has_input',
      'has_output',
      'has_state',
    ]);
  });
});
