import { describe, expect, it } from 'bun:test';
import { ReactFlowProvider } from '@xyflow/react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SystemModel } from '#backend/app/system-model/system-model.ts';
import {
  DesignDocumentContext,
  ElementSearch,
} from '../src/features/design-docs/element-reader';
import {
  choiceWithin,
  elementSectionsOf,
  explorationOf,
  graphOf,
  hiddenBy,
  kindWordOf,
  neighboursOf,
  NO_PICKS,
  NOTHING_CHOSEN,
  picked,
  RELATIONS,
  type RelationKind,
  rearrangedBy,
  relatedTo,
  removalOf,
} from '../src/features/system-model/system-model-exploration';
import { designOf } from '../src/features/system-model/system-model.model';
import { ElementNode } from '../src/features/system-model/ui/exploration/element-node';
import { ExplorationPicker } from '../src/features/system-model/ui/exploration/exploration-picker';
import { ExplorationReadingContext } from '../src/features/system-model/ui/exploration/exploration-reading';
import { layoutExploration } from '../src/features/system-model/ui/exploration/layout-exploration';
import {
  arrangeWithin,
  placeLocally,
} from '../src/features/system-model/ui/exploration/place-locally';
import { VisibilityPanel } from '../src/features/system-model/ui/exploration/visibility-panel';
import { MantineProvider } from '../src/shared/design-system/provider';

const source = { path: 'X.java', line: null };
const model = {
  id: '01a15509-0909-725f-8ab8-25ab23fc10d3',
  name: 'shop',
  scanned_at: '2026-10-19T10:00:00Z',
  modules: [
    { id: 'module|shop', name: 'shop', description: null, rules: [], source },
    {
      id: 'module|shop.orders',
      name: 'orders',
      description: null,
      rules: [],
      source,
    },
  ],
  buildingBlocks: [
    {
      id: 'building_block|shop.orders.Order',
      name: 'Order',
      type: 'aggregate',
      description: null,
      implements: [],
      properties: [
        {
          name: 'lines',
          type: { collectionOf: 'building_block|shop.orders.Line' },
          description: null,
          optional: false,
        },
        {
          name: 'id',
          type: 'primitive|uuid',
          description: null,
          optional: false,
        },
      ],
      rules: [],
      scenarios: [],
      source,
    },
    {
      id: 'building_block|shop.orders.Line',
      name: 'Line',
      type: 'value_object',
      description: null,
      implements: [],
      properties: [],
      rules: [],
      scenarios: [],
      source,
    },
  ],
  behaviours: [
    {
      id: 'behavior|shop.orders.Order.place',
      buildingBlockId: 'building_block|shop.orders.Order',
      name: 'place',
      type: 'Command',
      description: null,
      visibility: { kind: 'private' },
      input: [
        {
          name: 'line',
          type: 'building_block|shop.orders.Line',
          description: null,
          optional: false,
        },
      ],
      output: [],
      rules: [],
      scenarios: [],
      source,
    },
  ],
} as unknown as SystemModel;

const exploration = explorationOf(model);
const draw = (
  relations: RelationKind[],
  containment: 'nested' | 'edges',
  hidden: string[] = [],
) =>
  graphOf(exploration, {
    hidden: new Set(hidden),
    relations: new Set(relations),
    containment,
  });

describe('the exploration of a system model', () => {
  it('finds containment in the ids and the block a behaviour is on', () => {
    expect(
      exploration.elements.map(({ id, container }) => [id, container]),
    ).toEqual([
      ['module|shop', null],
      ['module|shop.orders', 'module|shop'],
      ['building_block|shop.orders.Order', 'module|shop.orders'],
      ['building_block|shop.orders.Line', 'module|shop.orders'],
      ['behavior|shop.orders.Order.place', 'building_block|shop.orders.Order'],
    ]);
  });

  it('finds use in property and parameter types, through collections, never of primitives', () => {
    expect(exploration.uses).toEqual([
      ['building_block|shop.orders.Order', 'building_block|shop.orders.Line'],
      ['behavior|shop.orders.Order.place', 'building_block|shop.orders.Line'],
    ]);
  });

  it('nests elements in their nearest shown container', () => {
    const graph = draw(['contains', 'uses'], 'nested', ['module']);
    expect(graph.elements.map(({ id, parent }) => [id, parent])).toEqual([
      ['building_block|shop.orders.Order', null],
      ['building_block|shop.orders.Line', null],
      ['behavior|shop.orders.Order.place', 'building_block|shop.orders.Order'],
    ]);
    expect(graph.relations.map(({ kind }) => kind)).toEqual(['uses', 'uses']);
  });

  it('draws containment as edges both ways, one per relation asked for', () => {
    const graph = draw(['contains', 'isPartOf'], 'edges', [
      'aggregate',
      'value_object',
      'Command',
    ]);
    expect(graph.elements.every(({ parent }) => parent === null)).toBe(true);
    expect(graph.relations.map(({ id }) => id)).toEqual([
      'contains:module|shop->module|shop.orders',
      'isPartOf:module|shop.orders->module|shop',
    ]);
  });

  it('leaves out a relation to a hidden element rather than moving it', () => {
    const graph = draw(['uses'], 'edges', ['value_object']);
    expect(graph.relations).toEqual([]);
  });

  it('groups what may be hidden by kind of element', () => {
    expect(elementSectionsOf(exploration)).toEqual([
      { title: 'Modules', groups: [{ group: 'module', count: 2 }] },
      {
        title: 'Building blocks',
        groups: [
          { group: 'aggregate', count: 1 },
          { group: 'value_object', count: 1 },
        ],
      },
      { title: 'Behaviours', groups: [{ group: 'Command', count: 1 }] },
    ]);
  });
});

it('lays out every relation and every kind in the visibility panel, the one the scan holds nothing for switched off', () => {
  expect(
    RELATIONS.filter(({ implemented }) => !implemented).map(({ kind }) => kind),
  ).toEqual(['invokes']);
  const html = renderToStaticMarkup(
    <MantineProvider>
      <VisibilityPanel
        relations={new Set(['contains'])}
        onRelations={() => {}}
        sections={elementSectionsOf(exploration)}
        veiled={new Set(['value_object'])}
        onVeil={() => {}}
        onClose={() => {}}
      />
    </MantineProvider>,
  );
  expect(html).toMatch(/<h2[^>]*>Visibility<\/h2>/);
  expect(html).toContain('aria-label="Close the visibility panel"');
  for (const label of ['Contains', 'Is part of', 'Uses', 'Invokes'])
    expect(html).toContain(`>${label}<`);
  expect(html).toContain('Not implemented');
  expect(html).toContain('Value Object');
  expect(html).toContain('Module');
});

describe('placing the exploration', () => {
  /* ELK runs in a worker where `self` is and `document` is not, as under
     Bun; a page has a document, so it lays out in place, as here. */
  const place = async (
    direction: 'vertical' | 'horizontal',
    algorithm: 'layered' | 'tree' | 'force' | 'compact' = 'layered',
  ) => {
    const stubbed = !('document' in globalThis);
    if (stubbed) Object.assign(globalThis, { document: {} });
    try {
      return await layoutExploration(
        draw(['contains', 'uses'], 'nested'),
        algorithm,
        direction,
      );
    } finally {
      if (stubbed) Reflect.deleteProperty(globalThis, 'document');
    }
  };
  const ORDER = 'building_block|shop.orders.Order';
  const LINE = 'building_block|shop.orders.Line';
  const PLACE = 'behavior|shop.orders.Order.place';

  it('puts a container before what it holds, sized around it', async () => {
    const { elements } = await place('vertical');
    const ids = elements.map(({ element }) => element.id);
    expect(ids.indexOf('module|shop')).toBeLessThan(
      ids.indexOf('module|shop.orders'),
    );
    expect(ids.indexOf(ORDER)).toBeLessThan(ids.indexOf(PLACE));
    const order = elements.find(({ element }) => element.id === ORDER);
    const behaviour = elements.find(({ element }) => element.id === PLACE);
    expect(order?.holds).toBe(true);
    expect(behaviour?.holds).toBe(false);
    expect(order!.width).toBeGreaterThan(behaviour!.width);
  });

  it('runs the uses edge down or across, as asked', async () => {
    const at = (placed: Awaited<ReturnType<typeof place>>, id: string) =>
      placed.elements.find(({ element }) => element.id === id)!;
    const down = await place('vertical');
    const across = await place('horizontal');
    expect(at(down, LINE).y).toBeGreaterThan(at(down, ORDER).y);
    expect(at(across, LINE).x).toBeGreaterThan(at(across, ORDER).x);
  });

  it("routes every edge at right angles, across containers, in the canvas's pixels", async () => {
    const { routes } = await place('vertical');
    const route = routes.get(`uses:${ORDER}->${LINE}`)!;
    expect(routes.size).toBe(2);
    expect(route.length).toBeGreaterThanOrEqual(2);
    for (const [index, point] of route.slice(1).entries()) {
      const before = route[index]!;
      expect(point.x === before.x || point.y === before.y).toBe(true);
    }
  });

  it('places with every algorithm, and only the layered one routes', async () => {
    for (const algorithm of ['tree', 'force', 'compact'] as const) {
      const { elements, routes } = await place('vertical', algorithm);
      expect(elements).toHaveLength(5);
      expect(routes.size).toBe(0);
    }
  });
});

describe('the selection', () => {
  it('joins an element to what its drawn relations and its nesting join it to', () => {
    const graph = draw(['contains', 'uses'], 'nested');
    const { relations, elements } = relatedTo(
      graph,
      'building_block|shop.orders.Order',
    );
    expect([...relations]).toEqual([
      'uses:building_block|shop.orders.Order->building_block|shop.orders.Line',
    ]);
    expect([...elements].sort()).toEqual([
      'behavior|shop.orders.Order.place',
      'building_block|shop.orders.Line',
      'module|shop.orders',
    ]);
    expect(relatedTo(graph, null).elements.size).toBe(0);
  });

  it('names what an element is in words', () => {
    const [module, , order, , behaviour] = exploration.elements;
    expect([module, order, behaviour].map((each) => kindWordOf(each!))).toEqual(
      ['Module', 'Building block · Aggregate', 'Behaviour · Command'],
    );
  });

  it('draws a card as a button that says where it stands to the selection', () => {
    const graph = draw(['uses'], 'edges');
    const line = graph.elements.find(
      ({ id }) => id === 'building_block|shop.orders.Line',
    )!;
    const Node = ElementNode as unknown as (props: {
      id: string;
      data: unknown;
    }) => React.ReactNode;
    const html = renderToStaticMarkup(
      <MantineProvider>
        <ReactFlowProvider>
          <DesignDocumentContext.Provider value={designOf(model)}>
            <ExplorationReadingContext.Provider
              value={{
                selected: new Set(['building_block|shop.orders.Order']),
                related: new Set([line.id]),
                onSelect: () => {},
                drawn: new Set([line.id]),
                neighbours: neighboursOf(exploration),
                elements: new Map(
                  exploration.elements.map((each) => [each.id, each]),
                ),
                onShow: () => {},
                onArrange: () => {},
                onRemoveAlone: () => {},
              }}
            >
              <Node
                id={line.id}
                data={{
                  placed: {
                    element: line,
                    holds: false,
                    x: 0,
                    y: 0,
                    width: 150,
                    height: 52,
                  },
                  direction: 'vertical',
                }}
              />
            </ExplorationReadingContext.Provider>
          </DesignDocumentContext.Provider>
        </ReactFlowProvider>
      </MantineProvider>,
    );
    expect(html).toMatch(/<button[^>]*data-state="related"/);
    expect(html).toContain(
      'aria-label="Line, Building block · Value Object, related to the selection"',
    );
    expect(html).toContain('aria-pressed="false"');
    // Its buttons are there whether or not it is in hand.
    expect(html).toContain('aria-label="More for Line"');
    // What it can bring is in its menu, not on the card.
    expect(html).not.toContain('aria-label="Show what Line is part of"');
    expect(html).toContain('aria-label="Remove Line from the view"');
  });
});

it('picks from the tree without a tick box on any row', () => {
  const html = renderToStaticMarkup(
    <MantineProvider>
      <ElementSearch document={designOf(model)} onPick={() => {}} />
    </MantineProvider>,
  );
  expect(html).toMatch(/aria-label="The model"/);
  expect(html).not.toContain('aria-checked');
  expect(html).not.toContain('CheckboxIndicator');
});

it('leaves out what is drawn, but greys the way down to what is not', () => {
  const drawn = new Set([
    'module|shop',
    'module|shop.orders',
    'building_block|shop.orders.Order',
    'building_block|shop.orders.Line',
  ]);
  const html = renderToStaticMarkup(
    <MantineProvider>
      <ElementSearch
        document={designOf(model)}
        isDrawn={(id) => drawn.has(id)}
        onPick={() => {}}
      />
    </MantineProvider>,
  );
  const row = (path: string) =>
    html.split('<li').find((chunk) => chunk.includes(`data-path="${path}"`));
  expect(row('building_block|shop.orders.Line')).toBeUndefined();
  for (const path of ['module|shop', 'module|shop.orders']) {
    expect(row(path)).toContain('aria-disabled="true"');
    expect(row(path)).toContain('On the diagram');
  }
});

it('lays out the whole model under a box that filters it', () => {
  const html = renderToStaticMarkup(
    <MantineProvider>
      <ElementSearch
        document={designOf(model)}
        isShown={() => true}
        onShow={() => {}}
      />
    </MantineProvider>,
  );
  expect(html).toMatch(/<input[^>]*aria-label="Filter the model"/);
  expect(html).toMatch(
    /role="tree"[^>]*aria-label="The model"|aria-label="The model"[^>]*role="tree"/,
  );
});

describe('elements put in or taken out one by one', () => {
  it('draws an element added though its kind is hidden, and leaves out one removed', () => {
    let picks = picked(NO_PICKS, 'building_block|shop.orders.Line', true);
    picks = picked(picks, 'behavior|shop.orders.Order.place', false);
    const graph = graphOf(exploration, {
      hidden: new Set(['value_object']),
      relations: new Set(['contains', 'uses']),
      containment: 'nested',
      picks,
    });
    const ids = graph.elements.map(({ id }) => id);
    expect(ids).toContain('building_block|shop.orders.Line');
    expect(ids).not.toContain('behavior|shop.orders.Order.place');
  });

  it('keeps the latest word on an element', () => {
    const picks = picked(picked(NO_PICKS, 'x', true), 'x', false);
    expect([...picks.added]).toEqual([]);
    expect([...picks.removed]).toEqual(['x']);
  });
});

describe('what the reader chose to draw', () => {
  it('hides every group until some are chosen', () => {
    const groups = elementSectionsOf(exploration).flatMap(({ groups }) =>
      groups.map(({ group }) => group),
    );
    expect([...hiddenBy(NOTHING_CHOSEN, exploration)].sort()).toEqual(
      [...groups].sort(),
    );
    expect(
      hiddenBy(
        { ...NOTHING_CHOSEN, shown: new Set(['value_object']) },
        exploration,
      ),
    ).not.toContain('value_object');
  });

  it('forgets what a later scan no longer finds', () => {
    const choice = choiceWithin(
      {
        shown: new Set(['value_object', 'gone_kind']),
        picks: {
          added: new Set([
            'building_block|shop.orders.Line',
            'building_block|gone.Thing',
          ]),
          removed: new Set(['behavior|gone.Thing.run']),
        },
      },
      exploration,
    );
    expect([...choice.shown]).toEqual(['value_object']);
    expect([...choice.picks.added]).toEqual([
      'building_block|shop.orders.Line',
    ]);
    expect([...choice.picks.removed]).toEqual([]);
  });
});

describe('the way into the picker', () => {
  const picker = (drawn: number) =>
    renderToStaticMarkup(
      <MantineProvider>
        <ExplorationPicker
          opened={false}
          onOpened={() => {}}
          drawn={drawn}
          total={exploration.elements.length}
          document={designOf(model)}
          isShown={() => false}
          onShow={() => {}}
          onClear={() => {}}
        />
      </MantineProvider>,
    );

  it('starts an empty canvas from its middle', () => {
    const html = picker(0);
    expect(html).toContain('Start exploration');
    expect(html).not.toContain('aria-label="Add to the exploration"');
  });

  it('adds to a drawn one from the plus at its foot', () => {
    const html = picker(3);
    expect(html).not.toContain('Start exploration');
    expect(html).toMatch(/<button[^>]*aria-label="Add to the exploration"/);
  });
});

describe('whom each element reaches', () => {
  const neighbours = neighboursOf(exploration);

  it('reads containment and use from both sides', () => {
    const order = neighbours.get('building_block|shop.orders.Order')!;
    expect(order.isPartOf).toEqual(['module|shop.orders']);
    expect(order.uses).toContain('building_block|shop.orders.Line');
    expect(neighbours.get('building_block|shop.orders.Line')!.usedBy).toContain(
      'building_block|shop.orders.Order',
    );
    expect(neighbours.get('module|shop.orders')!.contains).toContain(
      'building_block|shop.orders.Order',
    );
  });
});

describe('placing a change from one card', () => {
  const element = (id: string, parent: string | null = null) => ({
    id,
    kind: 'building_block' as const,
    name: id,
    pattern: null,
    container: parent,
    parent,
  });
  const at = (
    each: ReturnType<typeof element>,
    x: number,
    y: number,
    width = 150,
    height = 52,
    holds = false,
  ) => ({ element: each, holds, x, y, width, height });
  const graphOf = (...elements: ReturnType<typeof element>[]) => ({
    elements,
    relations: [],
  });
  const apart = (
    a: { x: number; y: number; width: number; height: number },
    b: { x: number; y: number; width: number; height: number },
  ) =>
    a.x + a.width <= b.x ||
    b.x + b.width <= a.x ||
    a.y + a.height <= b.y ||
    b.y + b.height <= a.y;

  it('takes a card off and leaves the rest where they stand', () => {
    const [a, b, c] = [element('A'), element('B'), element('C')];
    const placed = placeLocally(
      [at(a, 0, 0), at(b, 200, 0), at(c, 400, 0)],
      graphOf(a, c),
      'B',
    )!;
    expect(placed.map(({ element: { id }, x, y }) => [id, x, y])).toEqual([
      ['A', 0, 0],
      ['C', 400, 0],
    ]);
  });

  it('sets a new card beside the one it came from, on nothing else', () => {
    const [a, b, c] = [element('A'), element('B'), element('C')];
    const placed = placeLocally(
      [at(a, 0, 0), at(b, 182, 0)],
      graphOf(a, b, c),
      'A',
    )!;
    const byId = new Map(placed.map((each) => [each.element.id, each]));
    expect(byId.get('A')).toMatchObject({ x: 0, y: 0 });
    expect(byId.get('B')).toMatchObject({ x: 182, y: 0 });
    const added = byId.get('C')!;
    expect(apart(added, byId.get('A')!)).toBe(true);
    expect(apart(added, byId.get('B')!)).toBe(true);
    expect(Math.hypot(added.x, added.y)).toBeLessThan(300);
  });

  it('sets a new card down where it was asked for, centred there', () => {
    const [a, b] = [element('A'), element('B')];
    const placed = placeLocally([at(a, 0, 0)], graphOf(a, b), {
      x: 600,
      y: 400,
    })!;
    const added = placed.find(({ element: { id } }) => id === 'B')!;
    expect(added.x + added.width / 2).toBe(600);
    expect(added.y + added.height / 2).toBe(400);
  });

  it('moves a card asked for where another stands to beside it', () => {
    const [a, b] = [element('A'), element('B')];
    const placed = placeLocally([at(a, 0, 0)], graphOf(a, b), {
      x: 75,
      y: 26,
    })!;
    const byId = new Map(placed.map((each) => [each.element.id, each]));
    expect(apart(byId.get('B')!, byId.get('A')!)).toBe(true);
  });

  it('nests a card in its container, which grows and pushes its neighbour aside', () => {
    const box = element('Box');
    const next = element('Next');
    const kid = element('Kid', 'Box');
    const placed = placeLocally(
      [at(box, 0, 0), at(next, 182, 0)],
      graphOf(box, next, kid),
      'Box',
    )!;
    const byId = new Map(placed.map((each) => [each.element.id, each]));
    const grown = byId.get('Box')!;
    expect(grown.holds).toBe(true);
    // Relative to the container, below its name.
    expect(byId.get('Kid')).toMatchObject({ x: 16, y: 60 });
    expect(grown.width).toBeGreaterThanOrEqual(150 + 32);
    expect(apart(grown, byId.get('Next')!)).toBe(true);
    // Containers come before what they hold, as React Flow needs.
    expect(
      placed.findIndex(({ element: { id } }) => id === 'Box'),
    ).toBeLessThan(placed.findIndex(({ element: { id } }) => id === 'Kid'));
  });

  it('sets out what a frame holds anew, fits the frame to it, and pushes its neighbour aside', () => {
    const box = element('Box');
    const next = element('Next');
    const [one, two] = [element('One', 'Box'), element('Two', 'Box')];
    const placed = arrangeWithin(
      [
        at(box, 0, 0, 200, 200, true),
        at(one, 16, 60),
        at(two, 16, 140),
        at(next, 232, 0),
      ],
      graphOf(box, next, one, two),
      'Box',
      [at(one, 0, 0), at(two, 182, 0)],
    )!;
    const byId = new Map(placed.map((each) => [each.element.id, each]));
    expect(byId.get('One')).toMatchObject({ x: 16, y: 60 });
    expect(byId.get('Two')).toMatchObject({ x: 198, y: 60 });
    const frame = byId.get('Box')!;
    expect(frame).toMatchObject({ x: 0, y: 0, width: 16 + 182 + 150 + 16 });
    expect(apart(frame, byId.get('Next')!)).toBe(true);
  });
});

describe('what goes when an element is taken off', () => {
  it('takes what is drawn inside a container with it, nested', () => {
    const nested = graphOf(exploration, {
      hidden: new Set(),
      relations: new Set(['contains']),
      containment: 'nested',
    });
    const gone = removalOf(nested, ['module|shop.orders']);
    expect(gone).toContain('module|shop.orders');
    expect(gone).toContain('building_block|shop.orders.Order');
  });

  it('takes only what was named when containment is drawn as edges', () => {
    const flat = graphOf(exploration, {
      hidden: new Set(),
      relations: new Set(['contains']),
      containment: 'edges',
    });
    expect(removalOf(flat, ['module|shop.orders'])).toEqual([
      'module|shop.orders',
    ]);
  });
});

describe('what is arranged again when a group goes', () => {
  const nested = graphOf(exploration, {
    hidden: new Set(),
    relations: new Set(['contains']),
    containment: 'nested',
  });

  it('arranges the container a group leaves', () => {
    // Order holds its behaviour, and is drawn inside the orders module.
    expect(rearrangedBy(nested, ['building_block|shop.orders.Order'])).toEqual([
      'module|shop.orders',
    ]);
  });

  it('leaves a container as it was when only a card goes, or it goes too', () => {
    expect(rearrangedBy(nested, ['building_block|shop.orders.Line'])).toEqual(
      [],
    );
    expect(
      rearrangedBy(nested, [
        'building_block|shop.orders.Order',
        'module|shop.orders',
      ]),
    ).toEqual(['module|shop']);
  });
});
