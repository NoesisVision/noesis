import { describe, expect, it } from 'bun:test';
import type {
  Badge,
  DrawnElement,
} from '../src/features/system-model/system-model-exploration';
import {
  chipsOf,
  signatureLinesOf,
} from '../src/features/system-model/ui/exploration/badge-rows';
import { cardSizeOf } from '../src/features/system-model/ui/exploration/layout-exploration';

const CALCULATE = 'behavior|discounts.DiscountCalculation.calculate';
const slot = (
  relation: Badge['relation'],
  name: string,
  typeName: string,
  cardinality: Badge['cardinality'] = '1',
): Badge => ({
  relation,
  holder: CALCULATE,
  name,
  type: `building_block|discounts.${typeName}` as Badge['type'],
  typeName,
  cardinality,
  position: relation === 'input' ? 1 : null,
  onDiagram: false,
});
const offer = slot('input', 'offer', 'Offer');
const user = slot('input', 'user', 'UserId');
const result = slot('output', 'result', 'DiscountedOffer');
const amounts = slot('state', 'discountAmounts', 'DiscountAmount', '*');
const calculate = {
  id: CALCULATE,
  name: 'calculate',
  kind: 'behavior',
  parent: null,
} as unknown as DrawnElement;

describe('the looks a card’s badges take', () => {
  it('writes a signature as the code declares it, inputs on one line while they fit', () => {
    const lines = signatureLinesOf('calculate', [result, offer, user, amounts]);
    expect(lines).toEqual([
      ['calculate(', offer, ', ', user, ')'],
      ['→ ', result],
      [amounts],
    ]);
  });

  it('puts the inputs one to a line once they no longer fit on one', () => {
    const many = ['first', 'second', 'third', 'fourth'].map((name) =>
      slot('input', `${name}Argument`, 'AVeryLongTypeName'),
    );
    const lines = signatureLinesOf('calculate', many);
    expect(lines[0]).toEqual(['calculate(']);
    expect(lines.slice(1, -1)).toHaveLength(many.length);
    expect(lines.at(-1)).toEqual([')']);
    expect(lines[1]).toEqual(['  ', many[0]!, ',']);
    expect(lines[4]).toEqual(['  ', many[3]!]);
  });

  it('flows chips inputs first, then output, then state', () => {
    expect(chipsOf([amounts, result, offer])).toEqual([offer, result, amounts]);
  });

  it('makes each card the room its look draws the badges in', () => {
    const badges = new Map([[CALCULATE, [offer, user, result]]]);
    const labels = cardSizeOf(calculate, { badges });
    const signature = cardSizeOf(calculate, { badges, look: 'signature' });
    const chips = cardSizeOf(calculate, { badges, look: 'chips' });
    // Labels: a row of inputs, a row for the output, 38px a line.
    expect(labels.height).toBe(50 + 2 * 38 - 4 + 10);
    // Signature: two lines of 20px in a box 9px each side.
    expect(signature.height).toBe(50 + 2 * 20 + 18 + 10);
    // Chips: lines of 28px, as many as the width wraps them into.
    expect((chips.height - 50 - 10 + 4) % 28).toBe(0);
    expect(labels).not.toEqual(signature);
  });
});
