import { describe, expect, it } from 'bun:test';
import type { DesignDocumentInput } from '#backend/app/design-docs/design-doc.ts';
import { SystemModel } from '#backend/app/system-model/system-model.ts';
import {
  opensOnOf,
  overlayOf,
} from '../src/features/design-docs/design-doc-overlay';
import { explorationOf } from '../src/features/system-model/system-model-exploration';
import scanned from './fixtures/discounts-java.system-model.json';
// A copy of the discounts example's weather-based discount design, over the
// copy of its scan the other specs read.
import weather from './fixtures/discounts-weather-based-discount.design-doc.json';

const model = SystemModel.parse(scanned);
const design = weather as DesignDocumentInput;

const CALCULATION = 'module|discounts.calculation';
const CONDITIONS = 'building_block|discounts.calculation.Conditions';
const DISCOUNT = 'building_block|discounts.calculation.Discount';
const WEATHER_MODULE = 'module|discounts.weather';
const WEATHER = 'building_block|discounts.weather.Weather';
const GET_CURRENT = 'behavior|discounts.weather.WeatherProvider.getCurrent';
const PROVIDER = 'building_block|discounts.weather.WeatherProvider';

const blockOf = (overlaid: SystemModel, id: string) =>
  overlaid.buildingBlocks.find((block) => block.id === id);

/** A design that writes only what a case needs. */
const designOf = (content: Partial<DesignDocumentInput>): DesignDocumentInput =>
  ({ id: 'd', name: 'd', description: '', ...content }) as DesignDocumentInput;

describe('A design laid over the model', () => {
  const overlay = overlayOf(model, design);

  it('puts in what the design adds, marked added', () => {
    expect(blockOf(overlay.model, WEATHER)?.type).toBe('value_object');
    expect(overlay.changes.get(WEATHER)).toBe('added');
    expect(overlay.changes.get(WEATHER_MODULE)).toBe('added');
    expect(overlay.changes.get(GET_CURRENT)).toBe('added');
  });

  it("keeps the model's element where a modification writes nothing but its id", () => {
    expect(blockOf(overlay.model, CONDITIONS)).toEqual(
      blockOf(model, CONDITIONS),
    );
    expect(overlay.changes.get(CONDITIONS)).toBe('modified');
  });

  it('leaves what the design does not name as the model has it, unmarked', () => {
    expect(blockOf(overlay.model, DISCOUNT)).toEqual(blockOf(model, DISCOUNT));
    expect(overlay.changes.has(DISCOUNT)).toBe(false);
  });

  it('places what the design adds under its parent, as the ids say', () => {
    const elements = new Map(
      explorationOf(overlay.model).elements.map((each) => [each.id, each]),
    );
    expect(elements.get(WEATHER)?.container).toBe(WEATHER_MODULE);
    expect(elements.get(GET_CURRENT)?.container).toBe(PROVIDER);
  });

  it('writes the fields a modification gives over the model’s', () => {
    const { model: overlaid } = overlayOf(
      model,
      designOf({
        buildingBlocks: {
          modified: [{ id: CONDITIONS, type: { value: 'entity' } }] as never,
        },
      }),
    );
    const block = blockOf(overlaid, CONDITIONS);
    expect(block?.type).toBe('entity');
    expect(block?.name).toBe(blockOf(model, CONDITIONS)?.name ?? '');
  });

  it('keeps what the design removes, marked removed', () => {
    const { model: overlaid, changes } = overlayOf(
      model,
      designOf({ buildingBlocks: { removed: [DISCOUNT] } }),
    );
    expect(blockOf(overlaid, DISCOUNT)).toEqual(blockOf(model, DISCOUNT));
    expect(changes.get(DISCOUNT)).toBe('removed');
  });

  it('drops a relation the design removes, by its key', () => {
    const state = model.relations.find(
      (relation) => relation.kind === 'has_state',
    );
    if (state?.kind !== 'has_state') throw new Error('No state in the model');
    const { from, to, name } = state;
    const { model: overlaid } = overlayOf(
      model,
      designOf({
        relations: { removed: [{ kind: 'has_state', from, to, name }] },
      }),
    );
    const sameSlot = (relation: (typeof model.relations)[number]) =>
      relation.kind === 'has_state' &&
      relation.from === from &&
      relation.name === name;
    expect(overlaid.relations.some(sameSlot)).toBe(false);
    expect(overlaid.relations).toHaveLength(model.relations.length - 1);
  });

  it('keeps a removed element on its parent, as its id says', () => {
    const exposes = model.relations.find(
      (relation) => relation.kind === 'exposes' && relation.from === DISCOUNT,
    );
    if (exposes === undefined) throw new Error('No behavior on Discount');
    const { model: overlaid } = overlayOf(
      model,
      designOf({
        behaviors: { removed: [exposes.to] },
        relations: {
          removed: [{ kind: 'exposes', from: DISCOUNT, to: exposes.to }],
        },
      }),
    );
    const placed = explorationOf(overlaid).elements.find(
      ({ id }) => id === exposes.to,
    );
    expect(placed?.container).toBe(DISCOUNT);
  });

  it('conjures an ancestor no one holds, unmarked', () => {
    const empty = SystemModel.parse({
      id: model.id,
      name: 'empty',
      scanned_at: model.scanned_at,
    });
    const { model: overlaid, changes } = overlayOf(
      empty,
      designOf({
        buildingBlocks: {
          added: [
            {
              id: 'building_block|shop.orders.Order',
              name: { value: 'Order' },
              type: { value: 'aggregate' },
            },
          ] as never,
        },
      }),
    );
    expect(overlaid.modules.map(({ id }): string => id).sort()).toEqual([
      'module|shop',
      'module|shop.orders',
    ]);
    expect(changes.has('module|shop.orders')).toBe(false);
    const elements = new Map(
      explorationOf(overlaid).elements.map((each) => [each.id, each]),
    );
    expect(elements.get('building_block|shop.orders.Order')?.container).toBe(
      'module|shop.orders',
    );
    expect(elements.get('module|shop.orders')?.container).toBe('module|shop');
  });
});

describe('What a design speaks of', () => {
  it('is every card it names, and nothing it leaves alone', () => {
    const { designed } = overlayOf(model, design);
    for (const id of [WEATHER, GET_CURRENT, CONDITIONS, WEATHER_MODULE])
      expect(designed.has(id)).toBe(true);
    expect(designed.has(DISCOUNT)).toBe(false);
  });

  it('takes in what a changed relation hangs from, never a rule', () => {
    const { designed } = overlayOf(
      model,
      designOf({
        relations: {
          added: [{ kind: 'extends', from: DISCOUNT, to: CONDITIONS }],
        },
      }),
    );
    expect([...designed]).toEqual([DISCOUNT]);
  });
});

describe('What the exploration of a design opens on', () => {
  const overlay = overlayOf(model, design);
  const { added } = opensOnOf(overlay).picks;

  it('draws every element the design names, and what holds it', () => {
    for (const id of [WEATHER, GET_CURRENT, PROVIDER, CONDITIONS, CALCULATION])
      expect(added.has(id)).toBe(true);
    expect(added.has('module|discounts')).toBe(true);
  });

  it('draws nothing else of the model', () => {
    expect(added.has(DISCOUNT)).toBe(false);
  });

  it('draws the element a changed relation hangs from', () => {
    const { picks } = opensOnOf(
      overlayOf(
        model,
        designOf({
          relations: {
            added: [
              {
                kind: 'extends',
                from: DISCOUNT,
                to: CONDITIONS,
              },
            ],
          },
        }),
      ),
    );
    expect(picks.added.has(DISCOUNT)).toBe(true);
    expect(picks.added.has(CONDITIONS)).toBe(false);
  });
});
