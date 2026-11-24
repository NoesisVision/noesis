import { describe, expect, it } from 'bun:test';
import type {
  Badge,
  DrawnElement,
} from '../src/features/system-model/system-model-exploration';
import {
  NO_OUTPUT,
  signatureLinesOf,
} from '../src/features/system-model/ui/exploration/badge-signature';
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

describe('a card’s badges, written as its signature', () => {
  it('writes a behavior’s signature without its name, its output by type', () => {
    expect(signatureLinesOf([result, offer, user])).toEqual([
      [
        '(',
        { badge: offer, named: true },
        ', ',
        { badge: user, named: true },
        ') → ',
        { badge: result, named: false },
      ],
    ]);
  });

  it('marks where the output would be on a behavior that gives nothing back', () => {
    expect(signatureLinesOf([offer], true)).toEqual([
      ['(', { badge: offer, named: true }, ') → ', NO_OUTPUT],
    ]);
    // With no input either, it is still written: `() → void`.
    expect(signatureLinesOf([], true)).toEqual([['(', ') → ', NO_OUTPUT]]);
    // One whose output is not known to be missing ends at its bracket.
    expect(signatureLinesOf([offer])).toEqual([
      ['(', { badge: offer, named: true }, ')'],
    ]);
  });

  it('writes state a field to a line, each named', () => {
    expect(signatureLinesOf([amounts])).toEqual([
      [{ badge: amounts, named: true }],
    ]);
  });

  it('puts the inputs one to a line once they no longer fit on one', () => {
    const many = ['first', 'second', 'third', 'fourth'].map((name) =>
      slot('input', `${name}Argument`, 'AVeryLongTypeName'),
    );
    const lines = signatureLinesOf([...many, result]);
    expect(lines[0]).toEqual(['(']);
    expect(lines.slice(1, -1)).toHaveLength(many.length);
    expect(lines[1]).toEqual(['  ', { badge: many[0]!, named: true }, ',']);
    expect(lines[4]).toEqual(['  ', { badge: many[3]!, named: true }]);
    expect(lines.at(-1)).toEqual([') → ', { badge: result, named: false }]);
  });

  it('makes a card the room its signature takes', () => {
    const badges = new Map([[CALCULATE, [offer, user, result]]]);
    // One line of 20px in a box 9px each side, under the card's name.
    expect(cardSizeOf(calculate, { badges }).height).toBe(32 + 20 + 18 + 10);
  });

  it('makes a behavior with no slot at all room to say it gives nothing back', () => {
    const none = { badges: new Map() };
    expect(cardSizeOf(calculate, none).height).toBe(56);
    expect(
      cardSizeOf(calculate, { ...none, noOutput: new Set([CALCULATE]) }).height,
    ).toBe(32 + 20 + 18 + 10);
  });
});
