import { describe, expect, it } from 'bun:test';
import { byRelation } from '#backend/app/scanners/system-model-builders/relation-order';
import { Relation } from '#backend/app/system-model/system-model';

const ORDER = 'building_block|sales.orders.Order';
const LINE = 'building_block|sales.orders.Line';
const PLACE = 'behavior|sales.orders.Order.place';
const CANCEL = 'behavior|sales.orders.Order.cancel';
const PAY = 'behavior|sales.orders.Order.pay';

const sorted = (relations: unknown[]) =>
  relations.map((relation) => Relation.parse(relation)).sort(byRelation);

describe('The order of relations', () => {
  it('sorts by kind first', () => {
    const exposes = { kind: 'exposes', from: ORDER, to: PLACE };
    const extendsLine = { kind: 'extends', from: ORDER, to: LINE };

    expect<unknown>(sorted([extendsLine, exposes])).toEqual([
      exposes,
      extendsLine,
    ]);
  });

  it('then by holder', () => {
    const fromOrder = { kind: 'extends', from: ORDER, to: LINE };
    const fromLine = { kind: 'extends', from: LINE, to: ORDER };

    expect<unknown>(sorted([fromOrder, fromLine])).toEqual([
      fromLine,
      fromOrder,
    ]);
  });

  it('then by position, so a signature reads in its order', () => {
    const input = (name: string, position: number) => ({
      kind: 'has_input',
      from: PLACE,
      to: 'primitive|string',
      name,
      cardinality: '1',
      position,
    });

    expect<unknown>(sorted([input('a', 2), input('z', 1)])).toEqual([
      input('z', 1),
      input('a', 2),
    ]);
  });

  it('then by target', () => {
    const exposes = (to: string) => ({ kind: 'exposes', from: ORDER, to });

    expect<unknown>(sorted([exposes(PLACE), exposes(CANCEL)])).toEqual([
      exposes(CANCEL),
      exposes(PLACE),
    ]);
  });

  it('then by name', () => {
    const state = (name: string) => ({
      kind: 'has_state',
      from: ORDER,
      to: 'primitive|string',
      name,
      cardinality: '1',
    });

    expect<unknown>(sorted([state('total'), state('note')])).toEqual([
      state('note'),
      state('total'),
    ]);
  });

  it('then by order', () => {
    const invokes = (order: number) => ({
      kind: 'behavior_invokes_behavior',
      from: PLACE,
      to: PAY,
      order,
    });

    expect<unknown>(sorted([invokes(2), invokes(1)])).toEqual([
      invokes(1),
      invokes(2),
    ]);
  });
});
