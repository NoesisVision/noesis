import { describe, expect, it } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { DesignDocument } from '#backend/app/design-docs/design-doc.ts';
import { SystemModel } from '#backend/app/system-model/system-model.ts';
import scanned from '../../../examples/discounts-java/.noesis/graph/system-models/2026-10-13_18-03_uncommitted.json';
import { ModelReader } from '../src/features/design-docs/model-reader';
import { designOf } from '../src/features/system-model/system-model.model';
import { MantineProvider } from '../src/shared/design-system/provider';

const model = SystemModel.parse(scanned);
const document = designOf(model);
const OFFER = 'building_block|discounts.calculation.DiscountedOffer';

const reading = (selected: string | null) =>
  renderToStaticMarkup(
    <MantineProvider>
      <ModelReader
        document={document}
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
    expect(document.behaviours.added).toHaveLength(model.behaviours.length);
  });
});

describe('ModelReader', () => {
  const page = reading(OFFER);

  it('reads the element in hand, with its behaviours and properties', () => {
    expect(page).toMatch(/<h2[^>]*>.*DiscountedOffer.*<\/h2>/);
    expect(page).toContain('applyDiscount');
    expect(page).toContain('offerLevelDiscounts');
  });

  it('marks nothing as a change: the model is as it stands', () => {
    expect(page).not.toMatch(/>added</);
    expect(page).not.toMatch(/>modified</);
  });

  it('offers nothing to move or write', () => {
    expect(page).not.toContain('draggable');
    expect(page).not.toContain('Edit the');
    expect(page).not.toContain('New scenario');
    expect(page).not.toContain('Delete the');
  });
});
