import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SystemModel } from '#backend/app/system-model/system-model.ts';
import {
  explorationOf,
  relationsOfType,
  slotKeyOf,
  type WalkStep,
  walkChange,
  walkKeyOf,
  walkOf,
} from '../src/features/system-model/system-model-exploration';
import { SlotExplorer } from '../src/features/system-model/ui/exploration/slot-explorer';
import {
  recallSlotView,
  rememberSlotView,
  type SlotView,
} from '../src/features/system-model/ui/exploration/slot-view';
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

const explorer = (
  path: readonly WalkStep[],
  onGoTo?: () => void,
  view?: SlotView,
) =>
  renderToStaticMarkup(
    <MantineProvider>
      <SlotExplorer
        path={path}
        onPath={() => {}}
        slots={slots}
        elements={elements}
        onGoTo={onGoTo}
        view={view}
        onView={view === undefined ? undefined : () => {}}
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

describe('the columns a walk leaves', () => {
  const [root, products, amounts, applied] = round;
  const offer = walk(root!, 'offerLevelDiscounts');

  it('folds the columns past a step gone back to', () => {
    const change = walkChange(round, round.slice(0, 2));
    expect(change.folds).toEqual([2, 3, 4]);
    expect(change.enters.size).toBe(0);
  });

  it('grows a column the walk goes on into at its end', () => {
    const change = walkChange(round.slice(0, 2), round.slice(0, 3));
    expect(change.folds).toEqual([]);
    expect([...change.enters.values()]).toEqual(['grows']);
  });

  it('swaps in place a column taken by another slot, folding only what lies past the new end', () => {
    // From five columns to two: the second is another, the rest fold.
    const change = walkChange(round, offer);
    expect(change.folds).toEqual([2, 3, 4]);
    expect(change.enters.get(walkKeyOf(offer, 1))).toBe('swaps');
    // Two columns either side: nothing grows or folds, the strip stands still.
    const across = walkChange(round.slice(0, 2), offer);
    expect(across.folds).toEqual([]);
    expect([...across.enters.values()]).toEqual(['swaps']);
  });

  it('swaps a new column in where one is still folding away', () => {
    const change = walkChange(round.slice(0, 1), offer, new Set([1]));
    expect([...change.enters.values()]).toEqual(['swaps']);
  });

  it('keys a column by the way to it, the same whichever walk reaches it so', () => {
    expect(walkKeyOf(round, 1)).toBe(walkKeyOf([root!, products!], 1));
    expect(walkKeyOf(round, 2)).not.toBe(walkKeyOf(offer, 1));
    // The same type reached by another way is another column.
    expect(walkKeyOf([root!, products!, amounts!, applied!], 3)).not.toBe(
      walkKeyOf(round, 4),
    );
  });
});

describe('the walk drawn from a badge', () => {
  it('heads it with its type as a card names it, what it is, and the path as dotted steps', () => {
    const html = explorer(round);
    // Its kind's icon, then its name: not the slot, which the badge says.
    expect(html).toMatch(
      /<svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg><span[^>]*><span[^>]*>DiscountedOffer<\/span><\/span>/s,
    );
    expect(html).not.toMatch(/>result: </);
    expect(html).toMatch(/<\/div><span[^>]*>Value Object<\/span>/);
    expect(html).not.toContain('Output ·');
    expect(html).toMatch(/<nav[^>]*aria-label="Path"/);
    // Every step but the last goes back to it.
    expect(html).toContain('aria-label="Back to products: DiscountedProduct"');
    expect(html).toContain('aria-label="Back to appliedDiscount: Discount"');
    expect(html).toMatch(
      /<span[^>]*aria-current="location"[^>]*>result<\/span>/,
    );
  });

  it('offers the way to the type’s own card when it has one, and says where it goes', () => {
    const html = explorer(round, () => {});
    // An icon after the type, named for where it goes; no words beside it.
    expect(html).toMatch(
      /DiscountedOffer<\/span><\/span><button[^>]*aria-label="Go to DiscountedOffer on the diagram"[^>]*>.*?tabler-icon-arrow-up-right/s,
    );
    expect(html).not.toMatch(/>Go to DiscountedOffer on the diagram</);
    expect(explorer(round)).not.toContain('on the diagram');
  });

  it('draws a column a step, the row it went on by marked', () => {
    const html = explorer(round);
    expect(html.match(/data-column="/g)).toHaveLength(5);
    expect(html).toContain('aria-label="DiscountedProduct, Value Object"');
    expect(html).toMatch(
      /<button[^>]*aria-current="true"[^>]*aria-label="state products: DiscountedProduct, many"/,
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

  it('draws no relation the type has no slot of, and says a type holds nothing', () => {
    // Offer has state but exposes no behavior: no input or output is drawn.
    const offer = explorer(walk(slotOf(CALCULATE, 'offer')));
    expect(offer).toMatch(/<ul[^>]*aria-label="state"/);
    expect(offer).not.toMatch(/aria-label="(input|output)"/);

    // Product holds nothing: its column is its header alone.
    const product = explorer(walk(slotOf(CALCULATE, 'offer'), 'products'));
    expect(product).toContain('aria-label="Product, Value Object"');
    expect(product).toContain('Value Object · nothing inside');
    expect(product).not.toContain('—');
  });

  it('draws a slot as a card, its name over its type, and a primitive as one that leads nowhere', () => {
    const html = explorer(round);
    expect(html).toMatch(
      /<button[^>]*aria-label="state products: DiscountedProduct, many"[^>]*>.*?>products<\/span><span[^>]*><span[^>]*>DiscountedProduct<\/span><span[^>]*>, many<\/span><span[^>]*data-cardinality="\*"[^>]*><svg[^>]*tabler-icon-asterisk/s,
    );
    // Many is its mark, never `[*]` written after the type.
    expect(html).not.toContain('[*]');
    // A behavior's slot is named with its behavior.
    expect(html).toContain('>apply · result<');

    const user = explorer([slotOf(CALCULATE, 'user')]);
    expect(user).toMatch(/<li><span[^>]*data-leaf[^>]*>/);
    expect(user).not.toMatch(/<button[^>]*aria-label="state id: uuid"/);
  });
});

describe('the views the walk is drawn in', () => {
  it('offers its four views at the title’s end, the one in use chosen', () => {
    const html = explorer(round, undefined, 'tree');
    expect(html).toMatch(/aria-label="Walk as" role="radiogroup"/);
    for (const view of ['Columns', 'Tree', 'One at a time', 'Nested cards'])
      expect(html).toContain(view);
    expect(html).toMatch(/<input[^>]*checked=""[^>]*value="tree"/);
  });

  it('draws a tree as the model tree does, open along the walk so far', () => {
    const html = explorer(round, undefined, 'tree');
    expect(html).not.toContain('data-column=');
    expect(html).toMatch(
      /<ul role="tree"[^>]*aria-label="What DiscountedOffer relates to"/,
    );
    // A relation is an item of its own, open, its slots in a group under it.
    expect(html).toMatch(
      /<li role="treeitem"[^>]*aria-expanded="true"[^>]*aria-label="state, 2"/,
    );
    // Open along result › products › discountAmounts › appliedDiscount › result.
    expect(html).toMatch(
      /<li role="treeitem"[^>]*aria-expanded="true"[^>]*aria-label="state products: DiscountedProduct, many"/,
    );
    expect(html).toMatch(
      /<li role="treeitem"[^>]*aria-expanded="true"[^>]*aria-label="state appliedDiscount: Discount"/,
    );
    // A slot not on the walk is shut.
    expect(html).toMatch(
      /<li role="treeitem"[^>]*aria-expanded="false"[^>]*aria-label="state offerLevelDiscounts: DiscountAmount, many"/,
    );
    // Only the first row is reached by Tab; the keys move along the rest.
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
  });

  it('draws one type at a time under the path, its slots as cards', () => {
    const html = explorer(round.slice(0, 2), undefined, 'drill');
    expect(html).toMatch(/<nav[^>]*aria-label="Path"/);
    expect(html).toMatch(
      /<section[^>]*aria-label="DiscountedProduct, Value Object"/,
    );
    expect(html).toContain(
      'aria-label="state discountAmounts: DiscountAmount, many"',
    );
    // Only the type the walk is at: none of DiscountedOffer's own slots.
    expect(html).not.toContain('offerLevelDiscounts');
  });

  it('draws cards nested in cards, open along the walk so far', () => {
    const html = explorer(round.slice(0, 3), undefined, 'nested');
    expect(html).toMatch(
      /<div[^>]*data-open="true"[^>]*><button[^>]*aria-expanded="true"[^>]*aria-label="state products: DiscountedProduct, many"/,
    );
    expect(html).toMatch(
      /<button[^>]*aria-expanded="false"[^>]*aria-label="state offerLevelDiscounts: DiscountAmount, many"/,
    );
    // Inside products, its own discountAmounts, opened too.
    expect(html).toMatch(
      /<button[^>]*aria-expanded="true"[^>]*aria-label="state discountAmounts: DiscountAmount, many"/,
    );
  });
});

describe('the view kept for the session', () => {
  const kept = new Map<string, string>();
  const before: unknown = Reflect.get(globalThis, 'window');
  const had = 'window' in globalThis;
  const storage = {
    getItem: (key: string) => kept.get(key) ?? null,
    setItem: (key: string, value: string) => void kept.set(key, value),
  };

  it('opens in columns until another view is chosen, then in the one chosen', () => {
    Reflect.set(globalThis, 'window', { sessionStorage: storage });
    try {
      expect(recallSlotView()).toBe('columns');
      rememberSlotView('nested');
      expect(recallSlotView()).toBe('nested');
      kept.set('noesis.systemModel.exploration.slotView', 'sideways');
      expect(recallSlotView()).toBe('columns');
    } finally {
      if (had) Reflect.set(globalThis, 'window', before);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });

  it('opens in columns where there is no storage', () => {
    Reflect.set(globalThis, 'window', {});
    try {
      expect(recallSlotView()).toBe('columns');
      expect(() => rememberSlotView('tree')).not.toThrow();
    } finally {
      if (had) Reflect.set(globalThis, 'window', before);
      else Reflect.deleteProperty(globalThis, 'window');
    }
  });
});
