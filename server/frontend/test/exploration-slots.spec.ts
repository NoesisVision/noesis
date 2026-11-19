import { describe, expect, it } from 'bun:test';
import { SystemModel } from '#backend/app/system-model/system-model.ts';
import {
  relationsOfType,
  slotsOf,
} from '../src/features/system-model/system-model-exploration';
// A copy of the discounts example's committed scan, kept with the specs.
import scanned from './fixtures/discounts-java.system-model.json';

const model = SystemModel.parse(scanned);
const slots = slotsOf(model);

const CALCULATE =
  'behavior|discounts.calculation.DiscountCalculation.calculate';
const IS_APPLICABLE =
  'behavior|discounts.calculation.PotentialDiscount.isApplicableFor';
const DISCOUNT = 'building_block|discounts.calculation.Discount';
const DISCOUNTED_OFFER = 'building_block|discounts.calculation.DiscountedOffer';
const OFFER = 'building_block|discounts.offers.Offer';
const PRODUCT = 'building_block|discounts.offers.Product';
const USER_ID = 'building_block|discounts.users.UserId';

/** A slot as a reader sees it: relation, name, type and how many. */
const read = (
  list: readonly {
    relation: string;
    name: string;
    typeName: string;
    cardinality: string;
  }[],
) =>
  list.map(
    ({ relation, name, typeName, cardinality }) =>
      `${relation} ${name}: ${typeName} ${cardinality}`,
  );

describe("The model's slots", () => {
  it("reads a behavior's inputs in their order, then its output", () => {
    expect(read(slots.of.get(CALCULATE) ?? [])).toEqual([
      'input offer: Offer 1',
      'input user: UserId 1',
      'output result: DiscountedOffer 1',
    ]);
    expect(
      (slots.of.get(CALCULATE) ?? []).map(({ position }) => position),
    ).toEqual([1, 2, null]);
  });

  it("reads a block's state in the model's order", () => {
    expect(read(slots.of.get(DISCOUNTED_OFFER) ?? [])).toEqual([
      'state offerLevelDiscounts: DiscountAmount *',
      'state products: DiscountedProduct *',
    ]);
  });

  it('keeps a slot typed by a primitive, named by the primitive', () => {
    expect(read(slots.of.get(IS_APPLICABLE) ?? []).at(-1)).toBe(
      'output result: boolean 1',
    );
    expect(slots.of.get(USER_ID)?.[0]).toMatchObject({
      type: 'primitive|uuid',
      typeName: 'uuid',
    });
  });

  it('holds nothing for a block with no slots', () => {
    expect(slots.of.get(PRODUCT)).toBeUndefined();
  });
});

describe('What a type relates to', () => {
  it("is a value object's state alone when it exposes no behavior", () => {
    const relations = relationsOfType(slots, OFFER);
    expect(read(relations.state)).toEqual(['state products: Product *']);
    expect(relations).toMatchObject({ input: [], output: [], behaves: false });
  });

  it("is its state, then its behaviors' inputs and outputs, behavior by behavior", () => {
    const relations = relationsOfType(slots, DISCOUNTED_OFFER);
    expect(read(relations.state)).toEqual([
      'state offerLevelDiscounts: DiscountAmount *',
      'state products: DiscountedProduct *',
    ]);
    const named = (list: typeof relations.input) =>
      list.map((one) => `${one.behavior.name} · ${one.name}: ${one.typeName}`);
    expect(named(relations.input)).toEqual([
      'applyDiscount · discount: Discount',
      'createFrom · offer: Offer',
    ]);
    expect(named(relations.output)).toEqual([
      'applyDiscount · result: DiscountedOffer',
      'createFrom · result: DiscountedOffer',
    ]);
  });

  it("is a service's behaviors' inputs and outputs, each naming its behavior", () => {
    const relations = relationsOfType(slots, DISCOUNT);
    expect(relations.state).toEqual([]);
    expect(relations.behaves).toBeTrue();
    const named = (list: typeof relations.input) =>
      list.map((one) => `${one.behavior.name} · ${one.name}: ${one.typeName}`);
    expect(named(relations.input)).toEqual([
      'apply · discountedOffer: DiscountedOffer',
    ]);
    expect(named(relations.output)).toEqual([
      'apply · result: DiscountedOffer',
    ]);
  });

  it('is nothing for an empty block or a primitive', () => {
    for (const type of [PRODUCT, 'primitive|boolean'])
      expect(relationsOfType(slots, type)).toEqual({
        state: [],
        input: [],
        output: [],
        behaves: false,
      });
  });

  it('leads from a type back round to itself, so it can be walked without end', () => {
    // DiscountedOffer › products › discountAmounts › appliedDiscount › apply › result
    const step = (type: string, name: string) => {
      const { state, output } = relationsOfType(slots, type);
      const next = [...state, ...output].find((one) => one.name === name);
      if (next === undefined) throw new Error(`${name} is not under ${type}`);
      return next.type;
    };
    let type: string = DISCOUNTED_OFFER;
    for (const name of [
      'products',
      'discountAmounts',
      'appliedDiscount',
      'result',
    ])
      type = step(type, name);
    expect(type).toBe(DISCOUNTED_OFFER);
  });
});
