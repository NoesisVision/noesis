import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SystemModel } from '#backend/app/system-model/system-model.ts';
import {
  explorationOf,
  relationsOfType,
  slotKeyOf,
  type WalkStep,
  walkOf,
} from '../src/features/system-model/system-model-exploration';
import { SlotExplorer } from '../src/features/system-model/ui/exploration/slot-explorer';
import { MantineProvider } from '../src/shared/design-system/provider';
// A copy of the discounts example's committed scan, kept with the specs.
import scanned from './fixtures/discounts-java.system-model.json';

const exploration = explorationOf(SystemModel.parse(scanned));
const { slots } = exploration;
const elements = new Map(exploration.elements.map((each) => [each.id, each]));

const CALCULATE =
  'behavior|discounts.calculation.DiscountCalculation.calculate';
const DISCOUNTED_OFFER = 'building_block|discounts.calculation.DiscountedOffer';

/** The slot of `holder` named `name`, as a badge on its card starts a walk. */
const slotOf = (holder: string, name: string): WalkStep =>
  slots.of.get(holder)!.find((one) => one.name === name)!;

/** A walk from `root` on by the slots named, each among its type's relations. */
const walk = (root: WalkStep, ...names: string[]): WalkStep[] => {
  const path = [root];
  for (const name of names) {
    const { state, input, output } = relationsOfType(slots, path.at(-1)!.type);
    path.push(
      [...state, ...input, ...output].find((one) => one.name === name)!,
    );
  }
  return path;
};

// calculate's result: DiscountedOffer › products › discountAmounts ›
// appliedDiscount › apply's result, round to DiscountedOffer again.
const round = walk(
  slotOf(CALCULATE, 'result'),
  'products',
  'discountAmounts',
  'appliedDiscount',
  'result',
);

const explorer = (path: readonly WalkStep[]) =>
  renderToStaticMarkup(
    <MantineProvider>
      <SlotExplorer
        path={path}
        onPath={() => {}}
        slots={slots}
        elements={elements}
      />
    </MantineProvider>,
  );

describe('a walk through the types a slot leads to', () => {
  it('has a column for each step, and the slot it went on by', () => {
    const columns = walkOf(slots, round);
    expect(columns.map(({ step }) => step.typeName)).toEqual([
      'DiscountedOffer',
      'DiscountedProduct',
      'DiscountAmount',
      'Discount',
      'DiscountedOffer',
    ]);
    expect(columns[0]!.next).toBe(slotKeyOf(round[1]!));
    expect(columns.at(-1)!.next).toBeNull();
  });

  it('knows the types it passed through, so a slot leading round is told apart', () => {
    const discount = walkOf(slots, round)[3]!;
    expect(discount.relations.output[0]).toMatchObject({
      name: 'result',
      type: DISCOUNTED_OFFER,
    });
    expect(discount.through.has(DISCOUNTED_OFFER)).toBeTrue();
  });
});

describe('the walk drawn from a badge', () => {
  it('heads it with the badge’s slot, what it is, and the path as dotted steps', () => {
    const html = explorer(round);
    expect(html).toMatch(/result: <b>DiscountedOffer<\/b>/);
    expect(html).toContain('Output · Value Object');
    expect(html).toMatch(/<nav[^>]*aria-label="Path"/);
    // Every step but the last goes back to it.
    expect(html).toContain('aria-label="Back to products: DiscountedProduct"');
    expect(html).toContain('aria-label="Back to appliedDiscount: Discount"');
    expect(html).toMatch(
      /<span[^>]*aria-current="location"[^>]*>result<\/span>/,
    );
  });

  it('draws a column a step, the row it went on by marked', () => {
    const html = explorer(round);
    expect(html.match(/data-column="/g)).toHaveLength(5);
    expect(html).toContain('aria-label="DiscountedProduct, Value Object"');
    expect(html).toMatch(
      /<button[^>]*aria-current="true"[^>]*aria-label="state products: DiscountedProduct \[\*\]"/,
    );
  });

  it('groups a type’s rows by relation, its behaviors’ named, and marks a type already passed through', () => {
    const html = explorer(round);
    expect(html).toMatch(/<ul[^>]*aria-label="input"/);
    expect(html).toContain(
      'aria-label="output apply result: DiscountedOffer, already on the path"',
    );
    expect(html).toContain('apply ·');
  });

  it('shows an empty state as a dash, and a primitive as words that lead nowhere', () => {
    const offer = walk(slotOf(CALCULATE, 'offer'), 'products');
    const empty = explorer(offer);
    expect(empty).toContain('aria-label="Product, Value Object"');
    expect(empty).toMatch(/state<span[^>]*>—<\/span>/);

    const user = explorer([slotOf(CALCULATE, 'user')]);
    expect(user).toMatch(/<li><span[^>]*data-leaf[^>]*>/);
    expect(user).not.toMatch(/<button[^>]*aria-label="state id: uuid"/);
  });
});
