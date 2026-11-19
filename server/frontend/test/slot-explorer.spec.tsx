import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { SystemModel } from '#backend/app/system-model/system-model.ts';
import {
  explorationOf,
  relationsOfType,
  type WalkStep,
  walkKeyOf,
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

/** The slot of `holder` named `name`, as a badge on its card opens a tree. */
const slotOf = (holder: string, name: string): WalkStep =>
  slots.of.get(holder)!.find((one) => one.name === name)!;

/** A way from `root` on by the slots named, each among its type's relations. */
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

const explorer = (root: WalkStep, onGoTo?: () => void) =>
  renderToStaticMarkup(
    <MantineProvider>
      <SlotExplorer
        root={root}
        slots={slots}
        elements={elements}
        onGoTo={onGoTo}
      />
    </MantineProvider>,
  );

describe('the keys of the slots a tree opens', () => {
  const [root, products, amounts, applied] = round;
  const offer = walk(root!, 'offerLevelDiscounts');

  it('keys a slot by the way to it, the same whichever way reaches it so', () => {
    expect(walkKeyOf(round, 1)).toBe(walkKeyOf([root!, products!], 1));
    expect(walkKeyOf(round, 2)).not.toBe(walkKeyOf(offer, 1));
    // The same type reached by another way is another slot of the tree.
    expect(walkKeyOf([root!, products!, amounts!, applied!], 3)).not.toBe(
      walkKeyOf(round, 4),
    );
  });

  it('keys a slot under the one it was opened from, so shutting that shuts it', () => {
    expect(walkKeyOf(round, 2).startsWith(walkKeyOf(round, 1))).toBeTrue();
  });
});

describe('the popup a badge opens', () => {
  it('heads it with its type as a card names it and what it is', () => {
    const html = explorer(round[0]!);
    // Its kind's icon, then its name: not the slot, which the badge says.
    expect(html).toMatch(
      /<svg[^>]*aria-hidden="true"[^>]*>.*?<\/svg><span[^>]*><span[^>]*>DiscountedOffer<\/span><\/span>/s,
    );
    expect(html).not.toMatch(/>result: </);
    expect(html).toMatch(/<\/div><span[^>]*>Value Object<\/span>/);
    expect(html).not.toContain('Output ·');
  });

  it('offers the way to the type’s own card when it has one, and says where it goes', () => {
    const html = explorer(round[0]!, () => {});
    // An icon after the type, named for where it goes; no words beside it.
    expect(html).toMatch(
      /DiscountedOffer<\/span><\/span><button[^>]*aria-label="Go to DiscountedOffer on the diagram"[^>]*>.*?tabler-icon-arrow-up-right/s,
    );
    expect(html).not.toMatch(/>Go to DiscountedOffer on the diagram</);
    expect(explorer(round[0]!)).not.toContain('on the diagram');
  });

  it('draws the tree alone: no switch of views, no path, no columns', () => {
    const html = explorer(round[0]!);
    expect(html).not.toContain('role="radiogroup"');
    expect(html).not.toMatch(/<nav[^>]*aria-label="Path"/);
    expect(html).not.toContain('data-column=');
  });
});

describe('the tree of what a type relates to', () => {
  it('is drawn as the model tree is, a relation an item of its own, open', () => {
    const html = explorer(round[0]!);
    expect(html).toMatch(
      /<ul role="tree"[^>]*aria-label="What DiscountedOffer relates to"/,
    );
    expect(html).toMatch(
      /<li role="treeitem"[^>]*aria-expanded="true"[^>]*aria-label="state, 2"/,
    );
    // Only the first row is reached by Tab; the keys move along the rest.
    expect(html.match(/tabindex="0"/g)).toHaveLength(1);
  });

  it('opens with every slot shut, one that leads on a row that opens', () => {
    const html = explorer(round[0]!);
    expect(html).toMatch(
      /<li role="treeitem"[^>]*aria-expanded="false"[^>]*aria-label="state products: DiscountedProduct, many"/,
    );
    expect(html).toMatch(
      /<li role="treeitem"[^>]*aria-expanded="false"[^>]*aria-label="state offerLevelDiscounts: DiscountAmount, many"/,
    );
    // What a slot's type relates to is drawn once the reader opens it.
    expect(html).not.toContain('discountAmounts');
  });

  it('draws a slot as its name and its type, many as a mark', () => {
    const html = explorer(round[0]!);
    expect(html).toMatch(
      />products<\/span><span[^>]*><span[^>]*>DiscountedProduct<\/span><span[^>]*>, many<\/span><span[^>]*data-cardinality="\*"[^>]*><svg[^>]*tabler-icon-asterisk/s,
    );
    // Many is its mark, never `[*]` written after the type.
    expect(html).not.toContain('[*]');
  });

  it('names a behavior’s slot with its behavior, unmarked while its type is not on the way to it', () => {
    // Discount's apply gives a DiscountedOffer back.
    const html = explorer(round[3]!);
    expect(html).toMatch(/aria-label="output, \d+"/);
    expect(html).toContain('>apply · result<');
    expect(html).toContain('aria-label="output apply result: DiscountedOffer"');
    expect(html).not.toContain('already on the path');
  });

  it('draws no relation the type has no slot of, and says a type holds nothing', () => {
    // Offer has state but exposes no behavior: no input or output is drawn.
    const offer = explorer(slotOf(CALCULATE, 'offer'));
    expect(offer).toMatch(/aria-label="state, \d+"/);
    expect(offer).not.toMatch(/aria-label="(input|output), \d+"/);

    // Product holds nothing.
    const [, products] = walk(slotOf(CALCULATE, 'offer'), 'products');
    const product = explorer(products!);
    expect(product).toContain('nothing inside');
    expect(product).not.toContain('role="treeitem"');
  });

  it('draws a primitive as a row that opens nothing', () => {
    const user = explorer(slotOf(CALCULATE, 'user'));
    expect(user).toMatch(
      /<li role="treeitem"(?![^>]*aria-expanded)[^>]*aria-label="state id: uuid"/,
    );
  });
});
