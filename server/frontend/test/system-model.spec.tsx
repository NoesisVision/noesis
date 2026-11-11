import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesignDocument } from '#backend/app/design-docs/design-doc.ts';
import { SystemModel } from '#backend/app/system-model/system-model.ts';
import { ModelReader } from '../src/features/design-docs/model-reader';
import { designOf } from '../src/features/system-model/system-model.model';
import { MantineProvider } from '../src/shared/design-system/provider';
// A copy of the discounts example's committed scan, kept with the specs so a
// new scan of the example, or an edit to it, leaves what they read alone.
import scanned from './fixtures/discounts-java.system-model.json';

const model = SystemModel.parse(scanned);
const document = designOf(model);
const OFFER = 'building_block|discounts.calculation.DiscountedOffer';

const reading = (selected: string | null, read = document) =>
  renderToStaticMarkup(
    <MantineProvider>
      <ModelReader
        document={read}
        selected={selected}
        query=""
        onSelect={() => {}}
        onQuery={() => {}}
      />
    </MantineProvider>,
  );

describe('The scanned model as a design', () => {
  it('is a design document the server itself would take', () => {
    expect(DesignDocument.safeParse(document).success).toBeTrue();
  });

  it('holds every element the scan found', () => {
    expect(document.modules.added).toHaveLength(model.modules.length);
    expect(document.buildingBlocks.added).toHaveLength(
      model.buildingBlocks.length,
    );
    expect(document.behaviors.added).toHaveLength(model.behaviors.length);
  });
});

describe('ModelReader', () => {
  const page = reading(OFFER);

  it('reads the element in hand, with its behaviors and properties', () => {
    expect(page).toMatch(/<h2[^>]*>.*DiscountedOffer.*<\/h2>/);
    expect(page).toContain('applyDiscount');
    expect(page).toContain('offerLevelDiscounts');
  });

  it('marks nothing as a change: the model is as it stands', () => {
    expect(page).not.toMatch(/>added</);
    expect(page).not.toMatch(/>modified</);
  });

  it("marks no rule or scenario as a change either, though the scan's come in as added", () => {
    const APPLY =
      'behavior|discounts.calculation.DiscountedOffer.applyDiscount';
    const RULE = 'rule|discounts.calculation.Discounts never go below zero';
    const ruled = designOf(
      SystemModel.parse({
        ...scanned,
        rules: [
          {
            id: RULE,
            name: 'Discounts never go below zero',
            kind: 'validation',
            source: { path: 'a.feature', startLine: 3 },
          },
        ],
        scenarios: [
          {
            id: `scenario|${RULE.slice(5)}.A big discount`,
            name: 'A big discount',
            steps: [
              {
                kind: 'when',
                text: 'a discount bigger than the price is applied',
              },
            ],
            source: { path: 'a.feature', startLine: 4 },
          },
        ],
        relations: [
          ...model.relations,
          { kind: 'governs', from: APPLY, to: RULE },
          {
            kind: 'illustrates',
            from: `scenario|${RULE.slice(5)}.A big discount`,
            to: RULE,
          },
        ],
      }),
    );

    const page = reading(APPLY, ruled);

    expect(page).toContain('Discounts never go below zero');
    expect(page).toContain('A big discount');
    expect(page).not.toMatch(/>added</);
  });

  it('offers nothing to move or write', () => {
    expect(page).not.toContain('draggable');
    expect(page).not.toContain('Edit the');
    expect(page).not.toContain('New scenario');
    expect(page).not.toContain('Delete the');
  });
});
