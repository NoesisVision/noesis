import { describe, expect, it } from 'bun:test';
import { ReactFlowProvider } from '@xyflow/react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SystemModel } from '#backend/app/system-model/system-model.ts';
import {
  DesignDocumentContext,
  ElementSearch,
} from '../src/features/design-docs/element-reader';
import {
  chainOf,
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
  relatedTo,
  removalOf,
} from '../src/features/system-model/system-model-exploration';
import { designOf } from '../src/features/system-model/system-model.model';
import { ElementNode } from '../src/features/system-model/ui/exploration/element-node';
import { ExplorationPicker } from '../src/features/system-model/ui/exploration/exploration-picker';
import {
  ExplorationReadingContext,
  pathTo,
} from '../src/features/system-model/ui/exploration/exploration-reading';
import { layoutExploration } from '../src/features/system-model/ui/exploration/layout-exploration';
import {
  arrangeWithin,
  landsIn,
  movedTo,
  placeLocally,
  refusingFrames,
} from '../src/features/system-model/ui/exploration/place-locally';
import { VisibilityPanel } from '../src/features/system-model/ui/exploration/visibility-panel';
import { MantineProvider } from '../src/shared/design-system/provider';
import { borderTowards } from '../src/shared/ui/diagram-canvas/floating-edge';

const source = { path: 'X.java', startLine: null, endLine: null };

/** The model with each module and block containing what its id says it does, as a scan writes it, beside the relations it is given. */
function contained<
  Model extends {
    modules: { id: string }[];
    buildingBlocks: { id: string }[];
    behaviors: { id: string }[];
    relations?: unknown[];
  },
>(model: Model): Model {
  const under = (ids: string[], parent: string, kind: string) =>
    ids
      .filter((id) => {
        const path = id.slice(id.indexOf('|') + 1);
        return (
          path.slice(0, path.lastIndexOf('.')) ===
          parent.slice(parent.indexOf('|') + 1)
        );
      })
      .map((to) => ({ kind, from: parent, to }));
  const moduleIds = model.modules.map(({ id }) => id);
  const blockIds = model.buildingBlocks.map(({ id }) => id);
  const behaviorIds = model.behaviors.map(({ id }) => id);
  return {
    ...model,
    relations: [
      ...model.modules.flatMap((module) => [
        ...under(moduleIds, module.id, 'module_contains_module'),
        ...under(blockIds, module.id, 'module_contains_block'),
      ]),
      ...model.buildingBlocks.flatMap((block) =>
        under(behaviorIds, block.id, 'exposes'),
      ),
      ...(model.relations ?? []),
    ],
  };
}

/** A named slot of a scan: a piece of state, an input, an output. */
const slot = (
  kind: 'has_state' | 'has_input' | 'has_output',
  from: string,
  name: string,
  to: string,
  cardinality: '1' | '0..1' | '*' = '1',
) => ({
  kind,
  from,
  name,
  to,
  cardinality,
  ...(kind === 'has_input' ? { position: 1 } : {}),
});

const model = contained({
  id: '01a15509-0909-725f-8ab8-25ab23fc10d3',
  name: 'shop',
  scanned_at: '2026-10-19T10:00:00Z',
  rules: [],
  scenarios: [],
  actors: [],
  manualProcesses: [],
  deployableUnits: [],
  libraries: [],
  layers: [],
  deploymentContainers: [],
  modules: [
    { id: 'module|shop', name: 'shop', description: null, source },
    {
      id: 'module|shop.orders',
      name: 'orders',
      description: null,
      source,
    },
  ],
  buildingBlocks: [
    {
      id: 'building_block|shop.orders.Order',
      name: 'Order',
      type: 'aggregate',
      description: null,
      source,
    },
    {
      id: 'building_block|shop.orders.Line',
      name: 'Line',
      type: 'value_object',
      description: null,
      source,
    },
  ],
  behaviors: [
    {
      id: 'behavior|shop.orders.Order.place',
      name: 'place',
      description: null,
      source,
    },
  ],
  relations: [
    slot(
      'has_state',
      'building_block|shop.orders.Order',
      'lines',
      'building_block|shop.orders.Line',
      '*',
    ),
    slot(
      'has_state',
      'building_block|shop.orders.Order',
      'id',
      'primitive|uuid',
    ),
    slot(
      'has_input',
      'behavior|shop.orders.Order.place',
      'line',
      'building_block|shop.orders.Line',
    ),
  ],
}) as unknown as SystemModel;

const exploration = explorationOf(model);
const draw = (relations: RelationKind[], hidden: string[] = []) =>
  graphOf(exploration, {
    hidden: new Set(hidden),
    relations: new Set(relations),
  });

describe('the exploration of a system model', () => {
  it('finds containment in the ids and the block a behavior is on', () => {
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

  it('reads state and input apart, whatever their cardinality, never of primitives', () => {
    expect(exploration.edges.state).toEqual([
      ['building_block|shop.orders.Order', 'building_block|shop.orders.Line'],
    ]);
    expect(exploration.edges.input).toEqual([
      ['behavior|shop.orders.Order.place', 'building_block|shop.orders.Line'],
    ]);
    expect(exploration.edges.output).toEqual([]);
  });

  it('reads each cardinality a pair holds once, in the order the model lists them', () => {
    expect(
      exploration.cardinalities.get(
        'state:building_block|shop.orders.Order->building_block|shop.orders.Line',
      ),
    ).toEqual(['*']);
    const ORDER = 'building_block|shop.orders.Order';
    const LINE = 'building_block|shop.orders.Line';
    const read = explorationOf({
      ...model,
      relations: [
        ...model.relations,
        slot('has_state', ORDER, 'first', LINE),
        slot('has_state', ORDER, 'spare', LINE, '0..1'),
        slot('has_state', ORDER, 'more', LINE, '*'),
      ],
    } as unknown as SystemModel);
    expect(read.edges.state).toEqual([[ORDER, LINE]]);
    expect(read.cardinalities.get(`state:${ORDER}->${LINE}`)).toEqual([
      '*',
      '1',
      '0..1',
    ]);
  });

  it('draws what a block extends as an edge of its own, and the calls in their order', () => {
    const [order] = model.buildingBlocks;
    const place = model.behaviors[0]!;
    const behaviorOn = (id: string) => ({ ...place, id, name: id });
    const read = explorationOf({
      ...model,
      behaviors: [
        place,
        behaviorOn('behavior|shop.orders.Line.check'),
        behaviorOn('behavior|shop.orders.Line.price'),
      ],
      relations: [
        ...model.relations,
        {
          kind: 'extends',
          from: 'building_block|shop.orders.Line',
          to: order!.id,
        },
        {
          kind: 'behavior_invokes_behavior',
          from: place.id,
          to: 'behavior|shop.orders.Line.price',
          order: 2,
        },
        {
          kind: 'behavior_invokes_behavior',
          from: place.id,
          to: 'behavior|shop.orders.Line.check',
          order: 1,
        },
      ],
    } as unknown as SystemModel);
    expect(read.edges.extends).toEqual([
      ['building_block|shop.orders.Line', 'building_block|shop.orders.Order'],
    ]);
    expect(read.edges.invokes.map(([, called]) => called)).toEqual([
      'behavior|shop.orders.Line.check',
      'behavior|shop.orders.Line.price',
    ]);
    const graph = graphOf(read, {
      hidden: new Set(),
      relations: new Set(['extends']),
    });
    expect(graph.relations.map(({ id }) => id)).toEqual([
      'extends:building_block|shop.orders.Line->building_block|shop.orders.Order',
    ]);
    expect(
      neighboursOf(read).get('building_block|shop.orders.Order')!.extendedBy,
    ).toEqual(['building_block|shop.orders.Line']);
  });

  it('draws what a block works with, once a pair, only between blocks it knows', () => {
    const repository = {
      id: 'building_block|shop.orders.Orders',
      name: 'Orders',
      type: 'repository',
      description: null,
      source,
    };
    const collaborator = (name: string, to: string) => ({
      ...slot('has_state', 'building_block|shop.orders.Order', name, to),
      kind: 'has_collaborator',
    });
    const read = explorationOf({
      ...model,
      buildingBlocks: [...model.buildingBlocks, repository],
      relations: [
        ...model.relations,
        collaborator('orders', repository.id),
        collaborator('archive', repository.id),
        collaborator('payments', 'building_block|shop.payments.Payments'),
      ],
    } as unknown as SystemModel);
    expect(read.edges.collaborator).toEqual([
      ['building_block|shop.orders.Order', repository.id],
    ]);
    const graph = graphOf(read, {
      hidden: new Set(),
      relations: new Set(['collaborator']),
    });
    expect(graph.relations.map(({ id }) => id)).toEqual([
      `collaborator:building_block|shop.orders.Order->${repository.id}`,
    ]);
    const neighbours = neighboursOf(read);
    expect(
      neighbours.get('building_block|shop.orders.Order')!.worksWith,
    ).toEqual([repository.id]);
    expect(neighbours.get(repository.id)!.collaboratorOf).toEqual([
      'building_block|shop.orders.Order',
    ]);
  });

  describe('what the code is built into, runs on and is cut in', () => {
    const ORDER = 'building_block|shop.orders.Order';
    const LINE = 'building_block|shop.orders.Line';
    const element = (id: string) => ({
      id,
      name: id.slice(id.indexOf('|') + 1),
      description: null,
      source,
    });
    const read = explorationOf({
      ...model,
      deployableUnits: [element('deployable_unit|Shop.Api')],
      libraries: [element('library|shop-domain')],
      layers: [element('layer|domain')],
      deploymentContainers: [element('deployment_container|Orders cluster')],
      relations: [
        ...model.relations,
        {
          kind: 'unit_contains_module',
          from: 'deployable_unit|Shop.Api',
          to: 'module|shop.orders',
        },
        {
          kind: 'library_contains_block',
          from: 'library|shop-domain',
          to: LINE,
        },
        { kind: 'layer_contains_block', from: 'layer|domain', to: ORDER },
        { kind: 'layer_contains_block', from: 'layer|domain', to: LINE },
        {
          kind: 'layer_contains_block',
          from: 'layer|domain',
          to: 'building_block|shop.payments.Payment',
        },
        {
          kind: 'container_contains_unit',
          from: 'deployment_container|Orders cluster',
          to: 'deployable_unit|Shop.Api',
        },
      ],
    } as unknown as SystemModel);

    it('draws each as a card in no module, named as the build names it', () => {
      const drawn = read.elements.filter(({ kind }) =>
        [
          'deployable_unit',
          'library',
          'layer',
          'deployment_container',
        ].includes(kind),
      );
      expect(
        drawn.map((each) => [each.name, kindWordOf(each), each.container]),
      ).toEqual([
        ['Shop.Api', 'Deployable Unit', null],
        ['shop-domain', 'Library', null],
        ['domain', 'Layer', null],
        ['Orders cluster', 'Deployment Container', null],
      ]);
    });

    it('joins them by edges, never by nesting, only to what the model lists', () => {
      expect(read.edges.ships).toEqual([
        ['deployable_unit|Shop.Api', 'module|shop.orders'],
      ]);
      expect(read.edges.provides).toEqual([['library|shop-domain', LINE]]);
      expect(read.edges.places).toEqual([
        ['layer|domain', ORDER],
        ['layer|domain', LINE],
      ]);
      expect(read.edges.runs).toEqual([
        ['deployment_container|Orders cluster', 'deployable_unit|Shop.Api'],
      ]);
      const block = read.elements.find(({ id }) => id === ORDER)!;
      expect(block.container).toBe('module|shop.orders');
    });

    it('reaches each way', () => {
      const neighbours = neighboursOf(read);
      expect(neighbours.get(ORDER)!.placedIn).toEqual(['layer|domain']);
      expect(neighbours.get(LINE)!.providedBy).toEqual(['library|shop-domain']);
      expect(neighbours.get('module|shop.orders')!.shippedIn).toEqual([
        'deployable_unit|Shop.Api',
      ]);
      expect(neighbours.get('deployable_unit|Shop.Api')!.runsOn).toEqual([
        'deployment_container|Orders cluster',
      ]);
      expect(neighbours.get('layer|domain')!.places).toEqual([ORDER, LINE]);
    });

    it('lists their kinds in the filter only when the model holds them', () => {
      expect(elementSectionsOf(read).map(({ title }) => title)).toEqual(
        expect.arrayContaining([
          'Deployable Units',
          'Libraries',
          'Layers',
          'Deployment Containers',
        ]),
      );
      expect(
        elementSectionsOf(exploration).map(({ title }) => title),
      ).not.toContain('Layers');
    });
  });

  it('nests elements in their nearest shown container', () => {
    const graph = draw(['contains', 'state', 'input'], ['module']);
    expect(graph.elements.map(({ id, parent }) => [id, parent])).toEqual([
      ['building_block|shop.orders.Order', null],
      ['building_block|shop.orders.Line', null],
      ['behavior|shop.orders.Order.place', 'building_block|shop.orders.Order'],
    ]);
    expect(graph.relations.map(({ kind }) => kind)).toEqual(['state', 'input']);
  });

  it('draws containment either way round as nesting, never as an edge', () => {
    for (const relation of ['contains', 'isPartOf'] as const) {
      const graph = draw([relation], ['aggregate', 'value_object', 'behavior']);
      expect(graph.elements.map(({ id, parent }) => [id, parent])).toEqual([
        ['module|shop', null],
        ['module|shop.orders', 'module|shop'],
      ]);
      expect(graph.relations).toEqual([]);
    }
  });

  it('leaves out a relation to a hidden element rather than moving it', () => {
    const graph = draw(['state', 'input'], ['value_object']);
    expect(graph.relations).toEqual([]);
  });

  it('draws a call between behaviors as an edge, and reads it from both sides', () => {
    // The order's place calls a check on its line, as a scanner records it.
    const check = {
      ...model.behaviors[0]!,
      id: 'behavior|shop.orders.Line.check',
      name: 'check',
    };
    const calling = explorationOf({
      ...model,
      behaviors: [model.behaviors[0]!, check],
      relations: [
        ...model.relations,
        {
          kind: 'behavior_invokes_behavior',
          from: model.behaviors[0]!.id,
          to: check.id,
          order: 1,
        },
      ],
    } as unknown as SystemModel);
    expect(calling.edges.invokes).toEqual([
      ['behavior|shop.orders.Order.place', 'behavior|shop.orders.Line.check'],
    ]);
    const graph = graphOf(calling, {
      hidden: new Set(),
      relations: new Set(['invokes']),
    });
    expect(
      graph.relations
        .filter(({ kind }) => kind === 'invokes')
        .map(({ id }) => id),
    ).toEqual([
      'invokes:behavior|shop.orders.Order.place->behavior|shop.orders.Line.check',
    ]);
    const neighbours = neighboursOf(calling);
    expect(neighbours.get('behavior|shop.orders.Order.place')!.invokes).toEqual(
      ['behavior|shop.orders.Line.check'],
    );
    expect(
      neighbours.get('behavior|shop.orders.Line.check')!.invokedBy,
    ).toEqual(['behavior|shop.orders.Order.place']);
  });

  it('draws an actor and a manual process, which performs and invokes join', () => {
    const ACTOR = 'actor|Customer';
    const PROCESS = 'manual_process|Place an order';
    const PLACE = 'behavior|shop.orders.Order.place';
    const people = explorationOf({
      ...model,
      actors: [{ id: ACTOR, name: 'Customer', description: null, source }],
      manualProcesses: [
        { id: PROCESS, name: 'Place an order', description: null, source },
      ],
      relations: [
        ...model.relations,
        { kind: 'performs', from: ACTOR, to: PROCESS },
        {
          kind: 'process_invokes_behavior',
          from: PROCESS,
          to: PLACE,
          order: 1,
        },
      ],
    } as unknown as SystemModel);
    expect(
      people.elements
        .filter(({ kind }) => kind === 'actor' || kind === 'manual_process')
        .map(({ id, container }) => [id, container]),
    ).toEqual([
      [ACTOR, null],
      [PROCESS, null],
    ]);
    expect(people.edges.performs).toEqual([[ACTOR, PROCESS]]);
    expect(people.edges.invokes).toEqual([[PROCESS, PLACE]]);
    expect(elementSectionsOf(people).map(({ title }) => title)).toEqual([
      'Modules',
      'Building Blocks',
      'Behaviors',
      'Actors',
      'Manual Processes',
    ]);
    expect(neighboursOf(people).get(PROCESS)!.performedBy).toEqual([ACTOR]);
    expect(
      chainOf(
        neighboursOf(people),
        new Map(people.elements.map((each) => [each.id, each])),
        PROCESS,
        'invokes',
      ),
    ).toEqual([PLACE]);
  });

  it('draws no edge between a card and the frame it is drawn inside', () => {
    // The order's place takes an order: its input is the block it belongs to.
    const own = explorationOf({
      ...model,
      relations: [
        ...model.relations,
        slot(
          'has_input',
          'behavior|shop.orders.Order.place',
          'order',
          'building_block|shop.orders.Order',
        ),
      ],
    } as unknown as SystemModel);
    const id =
      'input:behavior|shop.orders.Order.place->building_block|shop.orders.Order';
    const nested = graphOf(own, {
      hidden: new Set(),
      relations: new Set(['contains', 'input']),
    });
    expect(nested.relations.map(({ id }) => id)).not.toContain(id);
    // Not nested, the two are cards apart, and the edge is drawn.
    const apart = graphOf(own, {
      hidden: new Set(),
      relations: new Set(['input']),
    });
    expect(apart.relations.map(({ id }) => id)).toContain(id);
  });

  it('groups what may be hidden by kind of element', () => {
    expect(elementSectionsOf(exploration)).toEqual([
      { title: 'Modules', groups: [{ group: 'module', count: 2 }] },
      {
        title: 'Building Blocks',
        groups: [
          { group: 'aggregate', count: 1 },
          { group: 'value_object', count: 1 },
        ],
      },
      { title: 'Behaviors', groups: [{ group: 'behavior', count: 1 }] },
    ]);
  });
});

it('lays out every relation and every kind in the visibility panel', () => {
  expect(RELATIONS.map(({ kind }) => kind)).toEqual([
    'contains',
    'isPartOf',
    'state',
    'input',
    'output',
    'extends',
    'collaborator',
    'invokes',
    'performs',
    'ships',
    'provides',
    'places',
    'runs',
  ]);
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
  for (const label of [
    'Contains',
    'Is part of',
    'State',
    'Input',
    'Output',
    'Extends',
    'Invokes',
    'Performs',
  ])
    expect(html).toContain(`>${label}<`);
  expect(html).not.toContain('Not implemented');
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
        draw(['contains', 'state', 'input']),
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
    const behavior = elements.find(({ element }) => element.id === PLACE);
    expect(order?.holds).toBe(true);
    expect(behavior?.holds).toBe(false);
    expect(order!.width).toBeGreaterThan(behavior!.width);
  });

  it('runs the state edge down or across, as asked', async () => {
    const at = (placed: Awaited<ReturnType<typeof place>>, id: string) =>
      placed.elements.find(({ element }) => element.id === id)!;
    const down = await place('vertical');
    const across = await place('horizontal');
    expect(at(down, LINE).y).toBeGreaterThan(at(down, ORDER).y);
    expect(at(across, LINE).x).toBeGreaterThan(at(across, ORDER).x);
  });

  it('places with every algorithm', async () => {
    for (const algorithm of ['tree', 'force', 'compact'] as const) {
      const { elements } = await place('vertical', algorithm);
      expect(elements).toHaveLength(5);
    }
  });
});

describe('a floating edge', () => {
  // As React Flow keeps a card: where it stands on the canvas, and its size.
  const card = (x: number, y: number, width = 100, height = 50) =>
    ({
      internals: { positionAbsolute: { x, y } },
      measured: { width, height },
    }) as unknown as Parameters<typeof borderTowards>[0];

  it('meets a card where the line between the two centres crosses its border', () => {
    const left = card(0, 0);
    // Straight across: the middle of the facing sides.
    expect(borderTowards(left, card(300, 0))).toEqual({ x: 100, y: 25 });
    expect(borderTowards(card(300, 0), left)).toEqual({ x: 300, y: 25 });
    // Straight down: the middle of the bottom.
    expect(borderTowards(left, card(0, 200))).toEqual({ x: 50, y: 50 });
  });

  it('meets it at a corner when the other lies along its diagonal', () => {
    expect(borderTowards(card(0, 0), card(200, 100))).toEqual({
      x: 100,
      y: 50,
    });
  });
});

describe('the selection', () => {
  it('joins an element to what its drawn relations and its nesting join it to', () => {
    const graph = draw(['contains', 'state', 'input']);
    const { relations, elements } = relatedTo(
      graph,
      'building_block|shop.orders.Order',
    );
    expect([...relations]).toEqual([
      'state:building_block|shop.orders.Order->building_block|shop.orders.Line',
    ]);
    expect([...elements].sort()).toEqual([
      'behavior|shop.orders.Order.place',
      'building_block|shop.orders.Line',
      'module|shop.orders',
    ]);
    expect(relatedTo(graph, null).elements.size).toBe(0);
  });

  it('names what an element is in words', () => {
    const [module, , order, , behavior] = exploration.elements;
    expect([module, order, behavior].map((each) => kindWordOf(each!))).toEqual([
      'Module',
      'Building Block · Aggregate',
      'Behavior',
    ]);
  });

  it('draws a card as a button that says where it stands to the selection', () => {
    const graph = draw(['state', 'input']);
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
                path: new Set(),
                onSelect: () => {},
                onLetGo: () => {},
                drawn: new Set([line.id]),
                neighbours: neighboursOf(exploration),
                elements: new Map(
                  exploration.elements.map((each) => [each.id, each]),
                ),
                onShow: () => {},
                onDraw: () => {},
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
      'aria-label="Line, Building Block · Value Object, related to the selection"',
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
      relations: new Set(['contains', 'state', 'input']),
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

describe('slots drawn on the cards that hold them', () => {
  const ORDER = 'building_block|shop.orders.Order';
  const LINE = 'building_block|shop.orders.Line';
  const PLACE = 'behavior|shop.orders.Order.place';
  const onCards = (
    relations: RelationKind[],
    { from = exploration, picks = NO_PICKS } = {},
  ) =>
    graphOf(from, {
      hidden: new Set(),
      relations: new Set(relations),
      picks,
      slots: 'cards',
    });
  const ids = (graph: ReturnType<typeof onCards>) =>
    graph.elements.map(({ id }) => id);
  const kinds = (graph: ReturnType<typeof onCards>) =>
    graph.relations.map(({ kind }) => kind);
  /** A card's badges as a reader sees them, ↗ for a type still on the diagram. */
  const badges = (graph: ReturnType<typeof onCards>, id: string) =>
    (graph.badges.get(id) ?? []).map(
      ({ relation, name, typeName, cardinality, onDiagram }) =>
        `${relation} ${name}: ${typeName} ${cardinality}${onDiagram ? ' ↗' : ''}`,
    );
  /** The shop with these relations besides its own. */
  const shopWith = (...relations: object[]) =>
    explorationOf({
      ...model,
      relations: [...model.relations, ...relations],
    } as SystemModel);

  it('draws slots as edges, with no badges, unless asked otherwise', () => {
    const graph = draw(['contains', 'state', 'input']);
    expect(ids(graph)).toContain(LINE);
    expect(kinds(graph)).toEqual(['state', 'input']);
    expect(graph.badges.size).toBe(0);
  });

  it('takes off a card that is there only as a slot’s type, and its edges', () => {
    const graph = onCards(['contains', 'state', 'input', 'output']);
    expect(ids(graph)).not.toContain(LINE);
    expect(ids(graph)).toEqual(expect.arrayContaining([ORDER, PLACE]));
    expect(kinds(graph)).toEqual([]);
  });

  it('puts every slot on the card that holds it, a primitive’s too', () => {
    const graph = onCards(['contains', 'state', 'input', 'output']);
    expect(badges(graph, ORDER)).toEqual([
      'state lines: Line *',
      'state id: uuid 1',
    ]);
    expect(badges(graph, PLACE)).toEqual(['input line: Line 1']);
  });

  it('keeps a type the reader added, with no edge to it, and marks its badges', () => {
    const graph = onCards(['contains', 'state', 'input'], {
      picks: picked(NO_PICKS, LINE, true),
    });
    expect(ids(graph)).toContain(LINE);
    expect(kinds(graph)).toEqual([]);
    expect(badges(graph, ORDER)[0]).toBe('state lines: Line * ↗');
    expect(badges(graph, PLACE)).toEqual(['input line: Line 1 ↗']);
  });

  it('keeps a type joined by a relation that is no slot', () => {
    const graph = onCards(['contains', 'state', 'input', 'extends'], {
      from: shopWith({ kind: 'extends', from: LINE, to: ORDER }),
    });
    expect(ids(graph)).toContain(LINE);
    expect(kinds(graph)).toEqual(['extends']);
  });

  it('keeps a type drawn round what it holds, and takes it off when nothing is drawn inside', () => {
    const total = 'behavior|shop.orders.Line.total';
    const from = explorationOf({
      ...model,
      behaviors: [
        ...model.behaviors,
        { id: total, name: 'total', description: null, source },
      ],
      relations: [
        ...model.relations,
        { kind: 'exposes', from: LINE, to: total },
      ],
    } as SystemModel);
    expect(ids(onCards(['contains', 'state', 'input'], { from }))).toContain(
      LINE,
    );
    expect(ids(onCards(['state', 'input'], { from }))).not.toContain(LINE);
  });

  it('carries only the slots of the relations asked for, and keeps a type no slot drawn names', () => {
    const inputs = onCards(['contains', 'input']);
    expect(badges(inputs, ORDER)).toEqual([]);
    expect(badges(inputs, PLACE)).toEqual(['input line: Line 1']);
    expect(ids(inputs)).not.toContain(LINE);

    const none = onCards(['contains']);
    expect(none.badges.size).toBe(0);
    expect(ids(none)).toContain(LINE);
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
          onPick={() => {}}
          onAddAll={() => {}}
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

  it('reads containment and state from both sides', () => {
    const order = neighbours.get('building_block|shop.orders.Order')!;
    expect(order.isPartOf).toEqual(['module|shop.orders']);
    expect(order.hasState).toContain('building_block|shop.orders.Line');
    expect(
      neighbours.get('building_block|shop.orders.Line')!.stateOf,
    ).toContain('building_block|shop.orders.Order');
    expect(
      neighbours.get('building_block|shop.orders.Line')!.inputOf,
    ).toContain('behavior|shop.orders.Order.place');
    expect(neighbours.get('module|shop.orders')!.contains).toContain(
      'building_block|shop.orders.Order',
    );
  });
});

describe('a chain followed up to the next of its type', () => {
  const block = (name: string, type: string) => ({
    ...model.buildingBlocks[1]!,
    id: `building_block|shop.orders.${name}`,
    name,
    type,
  });
  const behavior = (on: string, name: string) => ({
    ...model.behaviors[0]!,
    id: `behavior|shop.orders.${on}.${name}`,
    name,
  });
  const holds = (name: string, held: string) =>
    slot(
      'has_state',
      `building_block|shop.orders.${name}`,
      held,
      `building_block|shop.orders.${held}`,
    );
  const calls = (caller: string, called: string) => ({
    kind: 'behavior_invokes_behavior',
    from: `behavior|shop.orders.${caller}`,
    to: `behavior|shop.orders.${called}`,
    order: 1,
  });
  const chained = explorationOf(
    contained({
      ...model,
      buildingBlocks: [
        block('Price', 'value_object'),
        block('Product', 'entity'),
        block('Money', 'value_object'),
        block('Currency', 'value_object'),
        block('Pricing', 'domain_service'),
      ],
      behaviors: [
        behavior('Price', 'apply'),
        behavior('Pricing', 'quote'),
        behavior('Pricing', 'round'),
        behavior('Money', 'round'),
        behavior('Currency', 'scale'),
      ],
      relations: [
        holds('Price', 'Product'),
        holds('Product', 'Money'),
        holds('Money', 'Currency'),
        calls('Price.apply', 'Pricing.quote'),
        calls('Pricing.quote', 'Pricing.round'),
        calls('Pricing.round', 'Money.round'),
        calls('Money.round', 'Currency.scale'),
      ],
    }) as unknown as SystemModel,
  );
  const neighbours = neighboursOf(chained);
  const elements = new Map(chained.elements.map((each) => [each.id, each]));
  const follow = (
    id: string,
    reach: 'hasState' | 'invokes' | 'invokedBy',
    depth?: number,
  ) =>
    chainOf(neighbours, elements, id, reach, depth).map((each) =>
      each.replace(/^\w+\|shop\.orders\./, ''),
    );

  it('follows state through other types and stops at the first of its own', () => {
    expect(follow('building_block|shop.orders.Price', 'hasState')).toEqual([
      'Product',
      'Money',
    ]);
  });

  it('follows a block’s calls from its behaviors to a behavior on a block of its type', () => {
    expect(follow('building_block|shop.orders.Price', 'invokes')).toEqual([
      'Price.apply',
      'Pricing.quote',
      'Pricing.round',
      'Money.round',
      'Money',
    ]);
  });

  it('goes no further than the depth, from the block’s own behaviors', () => {
    expect(follow('building_block|shop.orders.Price', 'invokes', 2)).toEqual([
      'Price.apply',
      'Pricing.quote',
      'Pricing.round',
    ]);
    expect(follow('building_block|shop.orders.Price', 'hasState', 1)).toEqual([
      'Product',
    ]);
  });

  it('follows a behavior’s calls up to the next behavior of its type', () => {
    expect(follow('behavior|shop.orders.Currency.scale', 'invokedBy')).toEqual([
      'Money.round',
    ]);
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
    // As tall as a card is drawn.
    height = 56,
    holds = false,
  ) => ({ element: each, holds, x, y, width, height });
  const graphOf = (...elements: ReturnType<typeof element>[]) => ({
    elements,
    relations: [],
    badges: new Map(),
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

  it('puts a card asked for outside its module among what that holds, not out at the point', () => {
    const mod = element('Module');
    const held = element('Held', 'Module');
    const kid = element('Kid', 'Module');
    const placed = placeLocally(
      [at(mod, 0, 0, 400, 200, true), at(held, 24, 60)],
      graphOf(mod, held, kid),
      { x: 1500, y: 900 },
    )!;
    const byId = new Map(placed.map((each) => [each.element.id, each]));
    const frame = byId.get('Module')!;
    // Positions inside a module are its own: the new card stands beside
    // the one already there, and the module grows only to hold it.
    const added = byId.get('Kid')!;
    expect(apart(added, byId.get('Held')!)).toBe(true);
    expect(Math.hypot(added.x - 24, added.y - 60)).toBeLessThan(300);
    expect(frame.width).toBeLessThan(600);
    expect(frame.height).toBeLessThan(400);
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
  it('drops a card out of its frame still in it, the frame grown round what it holds', () => {
    const box = element('Box');
    const next = element('Next');
    const [kid, other] = [element('Kid', 'Box'), element('Other', 'Box')];
    const placed = movedTo(
      [
        at(box, 0, 0, 200, 140, true),
        at(kid, 16, 60),
        at(other, 16, 60 + 52 + 32),
        at(next, 232, 0),
      ],
      graphOf(box, next, kid, other),
      'Kid',
      { x: 260, y: 200 },
    )!;
    const byId = new Map(placed.map((each) => [each.element.id, each]));
    const frame = byId.get('Box')!;
    // Its corner where it was, down to the one let go of at 200, which
    // stands where it was dropped; a card is 56 high.
    expect(frame).toMatchObject({ x: 0, y: 0 });
    expect(byId.get('Kid')).toMatchObject({ x: 260, y: 200 });
    expect(frame.width).toBe(260 + 150 + 16);
    expect(frame.height).toBe(200 + 56 + 40);
    // What the frame then reaches is pushed aside.
    expect(apart(frame, byId.get('Next')!)).toBe(true);
  });

  it('moves what a dropped card lies on off it, each the way it lies, and on', () => {
    // As in the Orders module: a factory let go of over the invoicing
    // details, down to its left, and the repository, up to its right.
    const orders = element('Orders');
    const invoicing = element('Invoicing', 'Orders');
    const factory = element('Factory', 'Orders');
    const made = element('Made', 'Factory');
    const repository = element('Repository', 'Orders');
    const saved = element('Saved', 'Repository');
    const beyond = element('Beyond', 'Orders');
    const placed = movedTo(
      [
        at(orders, 0, 0, 1200, 600, true),
        at(invoicing, 90, 385, 283, 56),
        at(factory, 20, 60, 395, 341, true),
        at(made, 16, 60, 300, 56),
        at(repository, 595, 72, 352, 250, true),
        at(saved, 16, 60, 216, 56),
        // Just right of the repository: in its way once it moves.
        at(beyond, 960, 72, 150, 56),
      ],
      graphOf(orders, invoicing, factory, made, repository, saved, beyond),
      'Factory',
      { x: 290, y: 97 },
    )!;
    const byId = new Map(placed.map((each) => [each.element.id, each]));
    // On the canvas: the Orders frame is fitted round them again too.
    const frame = byId.get('Orders')!;
    const on = (id: string) => {
      const one = byId.get(id)!;
      return { ...one, x: frame.x + one.x, y: frame.y + one.y };
    };
    // The one let go of stays where it was let go of.
    expect(on('Factory')).toMatchObject({ x: 290, y: 97 });
    // The invoicing details go left, the repository right, neither up or down.
    expect(on('Invoicing').x).toBeLessThan(90);
    expect(on('Invoicing').y).toBe(385);
    expect(on('Repository').x).toBeGreaterThan(595);
    expect(on('Repository').y).toBe(72);
    // And what the repository then reached went on before it.
    expect(on('Beyond').x).toBeGreaterThan(960);
    for (const [a, b] of [
      ['Factory', 'Invoicing'],
      ['Factory', 'Repository'],
      ['Repository', 'Beyond'],
    ] as const)
      expect(apart(on(a), on(b))).toBe(true);
  });

  it('grows a frame right and down for what is added in it, its corner kept', () => {
    const box = element('Box');
    const [one, two] = [element('One', 'Box'), element('Two', 'Box')];
    const added = [
      element('Three', 'Box'),
      element('Four', 'Box'),
      element('Five', 'Box'),
    ];
    // A frame with its room full, the reader adding three more from it.
    const placed = placeLocally(
      [
        at(box, 100, 100, 16 + 150 + 32 + 150 + 16, 60 + 56 + 40, true),
        at(one, 16, 60, 150, 56),
        at(two, 16 + 150 + 32, 60, 150, 56),
      ],
      graphOf(box, one, two, ...added),
      'Box',
    )!;
    const byId = new Map(placed.map((each) => [each.element.id, each]));
    expect(byId.get('Box')).toMatchObject({ x: 100, y: 100 });
    for (const { id } of added) {
      const card = byId.get(id)!;
      // Inside its room: right of its left padding, below its name.
      expect(card.x).toBeGreaterThanOrEqual(16);
      expect(card.y).toBeGreaterThanOrEqual(60);
    }
  });

  it('puts what a frame contains where the frame was right-clicked', () => {
    const box = element('Box');
    const [one, two] = [element('One', 'Box'), element('Two', 'Box')];
    const placed = placeLocally(
      [at(box, 100, 100, 600, 400, true), at(one, 16, 60)],
      graphOf(box, one, two),
      { x: 100 + 400, y: 100 + 300 },
    )!;
    const byId = new Map(placed.map((each) => [each.element.id, each]));
    // Centred on the click — a new card 180 wide, 56 high — in the frame,
    // which keeps its place and size.
    expect(byId.get('Two')).toMatchObject({ x: 400 - 90, y: 300 - 28 });
    expect(byId.get('Box')).toMatchObject({ x: 100, y: 100, width: 600 });
  });

  describe('dropped in another module', () => {
    // A frame drawn round one card, standing where it is put.
    const frameAt = (
      name: string,
      x: number,
      y: number,
      w: number,
      h: number,
    ) => {
      const frame = element(name);
      const kid = element(`${name}.kid`, name);
      return {
        elements: [frame, kid],
        placed: [at(frame, x, y, w, h, true), at(kid, 16, 60, 150, 56)],
      };
    };
    const absolute = (
      placed: readonly {
        element: { id: string; parent: string | null };
        x: number;
        y: number;
        width: number;
        height: number;
      }[],
      id: string,
    ): { x: number; y: number; width: number; height: number } => {
      const byId = new Map(placed.map((each) => [each.element.id, each]));
      const one = byId.get(id)!;
      const parent = one.element.parent;
      if (parent === null) return one;
      const round = absolute(placed, parent);
      return { ...one, x: one.x + round.x, y: one.y + round.y };
    };
    const inside = (
      frame: { x: number; y: number; width: number; height: number },
      card: { x: number; y: number; width: number; height: number },
    ) => {
      const x = card.x + card.width / 2;
      const y = card.y + card.height / 2;
      return (
        x >= frame.x &&
        x <= frame.x + frame.width &&
        y >= frame.y &&
        y <= frame.y + frame.height
      );
    };

    it('lands just outside it, at its own level, where there is room', () => {
      const home = frameAt('A', 0, 0, 236, 140);
      const other = frameAt('B', 400, 0, 300, 200);
      const placed = movedTo(
        [...home.placed, ...other.placed],
        graphOf(...home.elements, ...other.elements),
        'A.kid',
        { x: 450, y: 60 },
      )!;
      const card = absolute(placed, 'A.kid');
      const b = placed.find(({ element }) => element.id === 'B')!;
      expect(
        placed.find(({ element }) => element.id === 'A.kid')!.element.parent,
      ).toBe('A');
      expect(inside(b, card)).toBe(false);
      // Its own module, fitted round it, stands clear of the other.
      const a = placed.find(({ element }) => element.id === 'A')!;
      expect(apart(a, b)).toBe(true);
    });

    it('refuses the other module while a card is dragged, never its own', () => {
      const home = frameAt('A', 0, 0, 236, 140);
      const other = frameAt('B', 400, 0, 300, 200);
      const frames = refusingFrames(
        [...home.placed, ...other.placed],
        graphOf(...home.elements, ...other.elements),
        'A.kid',
      );
      expect(frames).toEqual([{ x: 400, y: 0, width: 300, height: 200 }]);
      // A card lands in a frame when its centre is inside it.
      expect(landsIn(frames, { x: 450, y: 60, width: 150, height: 56 })).toBe(
        true,
      );
      expect(landsIn(frames, { x: 16, y: 60, width: 150, height: 56 })).toBe(
        false,
      );
    });

    it('lands beside it with no side free, the modules round it pushed aside', () => {
      const home = frameAt('A', 0, 0, 236, 140);
      const target = frameAt('B', 500, 0, 300, 200);
      const round = [
        frameAt('C', 500, -400, 300, 300),
        frameAt('D', 500, 300, 300, 300),
        frameAt('E', 850, 0, 300, 200),
        frameAt('F', 250, 0, 200, 200),
      ];
      const previous = [home, target, ...round].flatMap(({ placed }) => placed);
      const placed = movedTo(
        previous,
        graphOf(
          ...[home, target, ...round].flatMap(({ elements }) => elements),
        ),
        'A.kid',
        { x: 550, y: 60 },
      )!;
      const card = absolute(placed, 'A.kid');
      const b = placed.find(({ element }) => element.id === 'B')!;
      expect(inside(b, card)).toBe(false);
      const moved = round.filter(({ placed: [frame] }) => {
        const now = placed.find(
          ({ element }) => element.id === frame!.element.id,
        )!;
        return now.x !== frame!.x || now.y !== frame!.y;
      });
      expect(moved.length).toBeGreaterThan(0);
    });
  });

  it('shrinks a frame to what it holds once a card in it is moved back', () => {
    const box = element('Box');
    const kid = element('Kid', 'Box');
    const placed = movedTo(
      [at(box, 0, 0, 600, 400, true), at(kid, 300, 200)],
      graphOf(box, kid),
      'Kid',
      { x: 16, y: 60 },
    )!;
    const frame = new Map(placed.map((each) => [each.element.id, each])).get(
      'Box',
    )!;
    expect(frame).toMatchObject({ x: 0, y: 0, height: 60 + 56 + 40 });
    expect(frame.width).toBeLessThan(600);
  });

  it('raises what is left when a card at the top of a frame is taken off', () => {
    const box = element('Box');
    const [one, two] = [element('One', 'Box'), element('Two', 'Box')];
    const placed = placeLocally(
      [at(box, 100, 100, 400, 300, true), at(one, 16, 60), at(two, 16, 200)],
      graphOf(box, two),
      'One',
    )!;
    const byId = new Map(placed.map((each) => [each.element.id, each]));
    // Its corner where it was; what is left raised to the top of it, so it
    // shrinks from its bottom.
    expect(byId.get('Box')).toMatchObject({
      x: 100,
      y: 100,
      height: 60 + 56 + 40,
    });
    expect(byId.get('Two')).toMatchObject({ x: 16, y: 60 });
  });

  it('shrinks a frame to what is left in it when a card is taken off', () => {
    const box = element('Box');
    const [one, two] = [element('One', 'Box'), element('Two', 'Box')];
    const placed = placeLocally(
      [at(box, 0, 0, 400, 300, true), at(one, 16, 60), at(two, 16, 200)],
      graphOf(box, one),
      'Two',
    )!;
    const frame = new Map(placed.map((each) => [each.element.id, each])).get(
      'Box',
    )!;
    expect(frame).toMatchObject({ x: 0, y: 0, height: 60 + 56 + 40 });
  });

  it('grows the frame up and left when a card is dropped there', () => {
    const box = element('Box');
    const kid = element('Kid', 'Box');
    const placed = movedTo(
      [at(box, 100, 100, 200, 140, true), at(kid, 16, 60)],
      graphOf(box, kid),
      'Kid',
      { x: 20, y: 40 },
    )!;
    const byId = new Map(placed.map((each) => [each.element.id, each]));
    const frame = byId.get('Box')!;
    // The frame starts its padding before the card, which keeps its place.
    expect(frame).toMatchObject({ x: 20 - 16, y: 40 - 60 });
    expect(byId.get('Kid')).toMatchObject({ x: 16, y: 60 });
  });
});

describe('what goes when an element is taken off', () => {
  it('takes what is drawn inside a container with it, nested', () => {
    const nested = graphOf(exploration, {
      hidden: new Set(),
      relations: new Set(['contains']),
    });
    const gone = removalOf(nested, ['module|shop.orders']);
    expect(gone).toContain('module|shop.orders');
    expect(gone).toContain('building_block|shop.orders.Order');
  });

  it('takes only what was named when containment is not drawn', () => {
    const flat = graphOf(exploration, {
      hidden: new Set(),
      relations: new Set(['state']),
    });
    expect(removalOf(flat, ['module|shop.orders'])).toEqual([
      'module|shop.orders',
    ]);
  });
});

describe('pathTo', () => {
  it('names every frame the selection is drawn inside, out to the outermost', () => {
    const elements = new Map(
      [
        { id: 'module|a', container: null },
        { id: 'module|a.b', container: 'module|a' },
        { id: 'building_block|a.b.C', container: 'module|a.b' },
        { id: 'module|z', container: null },
      ].map((each) => [
        each.id,
        { ...each, kind: 'module', name: each.id, pattern: null } as const,
      ]),
    );
    expect(
      [...pathTo(new Set(['building_block|a.b.C']), elements)].sort(),
    ).toEqual(['module|a', 'module|a.b']);
    expect(pathTo(new Set(['module|z']), elements).size).toBe(0);
  });
});
