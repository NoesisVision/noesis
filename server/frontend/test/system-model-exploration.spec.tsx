import { describe, expect, it } from 'bun:test';
import { ReactFlowProvider } from '@xyflow/react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { SystemModel } from '#backend/app/system-model/system-model.ts';
import {
  DesignDocumentContext,
  ElementSearch,
} from '../src/features/design-docs/element-reader';
import { ElementPanel } from '../src/features/design-docs/ui/architecture/element-panel';
import {
  chainOf,
  choiceWithin,
  elementSectionsOf,
  explorationOf,
  graphOf,
  hiddenBy,
  inPlacingOrder,
  howMuchDrawn,
  kindWordOf,
  neighboursOf,
  NO_PICKS,
  NO_SLOTS_HIDDEN,
  NOTHING_CHOSEN,
  picked,
  pickedIn,
  slotGroupsOf,
  PLACING_ORDER,
  isOwnSlotReach,
  isSlotReach,
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
  ExplorationSelectionContext,
  pathTo,
  type SelectionReading,
} from '../src/features/system-model/ui/exploration/exploration-reading';
import {
  cardSizeOf,
  FAR_NAME_SCALE,
  MODULE_NAME_SCALE,
  frameLeastWidthOf,
  HEIGHT,
  inGraphOrder,
  layoutExploration,
  setOutInSquare,
  nameWidthOf,
  PADDING,
  paddingOf,
  SIGNATURE_LINE,
  SPACING,
  widthOf,
} from '../src/features/system-model/ui/exploration/layout-exploration';
import {
  arrangeWithin,
  landsIn,
  movedAllTo,
  movedTo,
  placeLocally,
  refusingFrames,
} from '../src/features/system-model/ui/exploration/place-locally';
import { SlotBadges } from '../src/features/system-model/ui/exploration/slot-badges';
import { hasNodeMenu } from '../src/features/system-model/ui/exploration/use-reaches';
import { VisibilityPanel } from '../src/features/system-model/ui/exploration/visibility-panel';
import { MantineProvider } from '../src/shared/design-system/provider';
import { createStore } from '../src/shared/store';
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
/** The shop, its order also extending its line: a relation drawn as an edge. */
const extending = explorationOf({
  ...model,
  relations: [
    ...model.relations,
    {
      kind: 'extends',
      from: 'building_block|shop.orders.Order',
      to: 'building_block|shop.orders.Line',
    },
  ],
} as unknown as SystemModel);
const draw = (
  relations: RelationKind[],
  hidden: string[] = [],
  from = exploration,
) =>
  graphOf(from, {
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
    const graph = draw(['contains'], ['module']);
    expect(graph.elements.map(({ id, parent }) => [id, parent])).toEqual([
      ['building_block|shop.orders.Order', null],
      ['building_block|shop.orders.Line', null],
      ['behavior|shop.orders.Order.place', 'building_block|shop.orders.Order'],
    ]);
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
    expect(draw(['extends'], [], extending).relations).toHaveLength(1);
    expect(draw(['extends'], ['value_object'], extending).relations).toEqual(
      [],
    );
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
    // Were the order's place to work with the block it belongs to.
    const own = explorationOf({
      ...model,
      relations: [
        ...model.relations,
        {
          ...slot(
            'has_state',
            'behavior|shop.orders.Order.place',
            'order',
            'building_block|shop.orders.Order',
          ),
          kind: 'has_collaborator',
        },
      ],
    } as unknown as SystemModel);
    const id =
      'collaborator:behavior|shop.orders.Order.place->building_block|shop.orders.Order';
    const nested = graphOf(own, {
      hidden: new Set(),
      relations: new Set(['contains', 'collaborator']),
    });
    expect(nested.relations.map(({ id }) => id)).not.toContain(id);
    // Not nested, the two are cards apart, and the edge is drawn.
    const apart = graphOf(own, {
      hidden: new Set(),
      relations: new Set(['collaborator']),
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
  // What an element contains is always drawn inside it: not to switch,
  // either way round.
  expect(html).not.toContain('>Contains<');
  expect(html).not.toContain('>Is part of<');
  // Input and output, a behavior's signature, are one to switch.
  expect(html).not.toContain('>Input<');
  expect(html).not.toContain('>Output<');
  for (const label of [
    'State',
    'Input and output',
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
  const ORDER = 'building_block|shop.orders.Order';
  const LINE = 'building_block|shop.orders.Line';
  const PLACE = 'behavior|shop.orders.Order.place';
  const { elements } = layoutExploration(
    draw(['contains', 'extends'], [], extending),
  );
  const at = (id: string) => elements.find(({ element }) => element.id === id)!;

  it('puts a container before what it holds, sized around it', () => {
    const ids = elements.map(({ element }) => element.id);
    expect(ids.indexOf('module|shop')).toBeLessThan(
      ids.indexOf('module|shop.orders'),
    );
    expect(ids.indexOf(ORDER)).toBeLessThan(ids.indexOf(PLACE));
    expect(at(ORDER).holds).toBe(true);
    expect(at(PLACE).holds).toBe(false);
    expect(at(ORDER).width).toBeGreaterThan(at(PLACE).width);
    // Inside its padding, clear of the frame's name.
    expect(at(PLACE)).toMatchObject({ x: PADDING.left, y: PADDING.top });
    expect(at(ORDER).height).toBe(
      PADDING.top + at(PLACE).height + PADDING.bottom,
    );
  });

  it('sets a value object out after the rest of what its module holds', () => {
    const [order, line] = [at(ORDER), at(LINE)];
    // After it in its row, or in a row under it.
    expect(line.y > order.y || (line.y === order.y && line.x > order.x)).toBe(
      true,
    );
    // And neither on the other.
    expect(
      line.x >= order.x + order.width || line.y >= order.y + order.height,
    ).toBe(true);
  });

  describe('in the order of what each is, said in one place', () => {
    const one = (id: string, pattern: string | null, kind = 'building_block') =>
      ({ id, kind, name: id, pattern, container: null, parent: null }) as never;
    const scrambled = [
      one('Price', 'value_object'),
      one('OrderFactory', 'factory'),
      one('Order', 'aggregate'),
      one('PlaceOrder', 'application_service'),
      one('orders', null, 'module'),
      one('Orders', 'repository'),
      one('Pricing', 'domain_service'),
      one('Money', 'value_object'),
    ];

    it('names the order: modules, services, factories, the rest, value objects', () => {
      expect([...PLACING_ORDER]).toEqual([
        'module',
        'domain_service',
        'application_service',
        'factory',
        'rest',
        'value_object',
      ]);
    });

    it('sorts by it, those of one rank as they came', () => {
      expect(
        inPlacingOrder(scrambled).map(({ id }: { id: string }) => id),
      ).toEqual([
        'orders',
        'Pricing',
        'PlaceOrder',
        'OrderFactory',
        'Order',
        'Orders',
        'Price',
        'Money',
      ]);
    });

    it('places them so, row after row', () => {
      const placed = layoutExploration({
        elements: scrambled,
        relations: [],
        badges: new Map(),
        folded: new Set(),
        noOutput: new Set(),
        parentless: new Set(),
      }).elements;
      const read = placed
        .toSorted((a, b) => a.y - b.y || a.x - b.x)
        .map(({ element }) => element.id);
      expect(read).toEqual([
        'orders',
        'Pricing',
        'PlaceOrder',
        'OrderFactory',
        'Order',
        'Orders',
        'Price',
        'Money',
      ]);
    });
  });

  it('hands the cards over in the graph’s own order, however they were set out', () => {
    const graph = draw(['contains', 'extends'], [], extending);
    const ids = (placed: readonly { element: { id: string } }[]) =>
      placed.map(({ element }) => element.id);
    // Set out with the value object first, then put back in order.
    const scrambled = layoutExploration(graph).elements.toReversed();
    const ordered = inGraphOrder(graph, scrambled);
    expect(ids(ordered).toSorted()).toEqual(ids(scrambled).toSorted());
    // Each container before what it holds, siblings as the graph lists them.
    expect(ids(ordered).indexOf('module|shop')).toBeLessThan(
      ids(ordered).indexOf('module|shop.orders'),
    );
    expect(ids(ordered).indexOf(ORDER)).toBeLessThan(
      ids(ordered).indexOf(PLACE),
    );
    expect(ids(inGraphOrder(graph, ordered))).toEqual(ids(ordered));
    expect(ids(inGraphOrder(graph, layoutExploration(graph).elements))).toEqual(
      ids(ordered),
    );
  });

  describe('in a square', () => {
    const boxes = (count: number, width = 100, height = 100) =>
      Array.from({ length: count }, () => ({ width, height }));
    const rowsOf = (at: readonly { x: number; y: number }[]) =>
      new Set(at.map(({ y }) => y)).size;

    it('sets nine alike out three to a row', () => {
      const rows = setOutInSquare(boxes(9));
      expect(rowsOf(rows.at)).toBe(3);
      expect(rows.width).toBe(rows.height);
      // In their order, each row from the left.
      expect(rows.at.slice(0, 4)).toEqual([
        { x: 0, y: 0 },
        { x: 100 + SPACING, y: 0 },
        { x: 2 * (100 + SPACING), y: 0 },
        { x: 0, y: 100 + SPACING },
      ]);
    });

    it('gives wide cards more rows, tall ones fewer', () => {
      expect(rowsOf(setOutInSquare(boxes(6, 200, 56)).at)).toBe(3);
      expect(rowsOf(setOutInSquare(boxes(6, 56, 200)).at)).toBe(2);
    });

    it('counts what is round them: under a frame’s long name, across it', () => {
      // Four alike are two by two; in a frame 700 wide at least, all in a row.
      expect(rowsOf(setOutInSquare(boxes(4)).at)).toBe(2);
      expect(
        rowsOf(setOutInSquare(boxes(4), { across: 0, down: 0, least: 700 }).at),
      ).toBe(1);
    });

    it('lets a short box stand under a short one beside a tall one', () => {
      // A small module, a large one beside it, and another small one: under
      // the first, not in a row of its own below the large one.
      const rows = setOutInSquare([
        { width: 200, height: 180 },
        { width: 600, height: 540 },
        { width: 90, height: 120 },
      ]);
      expect(rows.at).toEqual([
        { x: 0, y: 0 },
        { x: 200 + SPACING, y: 0 },
        { x: 0, y: 180 + SPACING },
      ]);
      // As tall as the large one alone.
      expect(rows.height).toBe(540);
    });

    it('never sets a box before the one that came before it, as the page is read', () => {
      // Uneven widths and heights: read from the top, each row from the
      // left, the boxes are in the order they came in.
      const mixed = [
        { width: 180, height: 56 },
        { width: 192, height: 140 },
        { width: 246, height: 56 },
        { width: 274, height: 200 },
        { width: 180, height: 56 },
        { width: 182, height: 90 },
        { width: 180, height: 56 },
        { width: 184, height: 56 },
      ];
      for (const boxes of [mixed, mixed.toReversed()]) {
        const { at } = setOutInSquare(boxes);
        for (let each = 1; each < at.length; each++) {
          const [before, here] = [at[each - 1]!, at[each]!];
          expect(
            here.y > before.y || (here.y === before.y && here.x > before.x),
          ).toBe(true);
        }
        // And none on another, or nearer it than the room between two.
        for (let one = 0; one < at.length; one++)
          for (let other = one + 1; other < at.length; other++) {
            const [a, b] = [
              { ...at[one]!, ...boxes[one]! },
              { ...at[other]!, ...boxes[other]! },
            ];
            expect(
              a.x + a.width + SPACING <= b.x ||
                b.x + b.width + SPACING <= a.x ||
                a.y + a.height + SPACING <= b.y ||
                b.y + b.height + SPACING <= a.y,
            ).toBe(true);
          }
      }
    });

    describe('told where the boxes stood', () => {
      /** How many of the first boxes a setting out moves from one under another. */
      const fromOneColumn =
        (stood: number, height = 56) =>
        (at: readonly { x: number; y: number }[]) =>
          at
            .slice(0, stood)
            .filter(
              ({ x, y }, each) => x !== 0 || y !== each * (height + SPACING),
            ).length;

      it('keeps their rows when one more would make another shape a little squarer', () => {
        // Four wide cards are squarest two by two; three stood in a column.
        expect(rowsOf(setOutInSquare(boxes(4, 200, 56)).at)).toBe(2);
        const rows = setOutInSquare(
          boxes(4, 200, 56),
          undefined,
          fromOneColumn(3),
        );
        expect(rowsOf(rows.at)).toBe(4);
        expect(fromOneColumn(3)(rows.at)).toBe(0);
      });

      it('gives their rows up once keeping them is a quarter larger round', () => {
        // Eight in a column are 200 by 1120; two across, 496 by 512.
        const rows = setOutInSquare(
          boxes(8, 200, 56),
          undefined,
          fromOneColumn(7),
        );
        expect(rowsOf(rows.at)).toBe(4);
      });

      it('sets them out as squarely as ever where none stood', () => {
        const rows = setOutInSquare(boxes(4, 200, 56), undefined, () => 0);
        expect(rowsOf(rows.at)).toBe(2);
      });
    });

    it('sets one out where it is, and none nowhere', () => {
      expect(setOutInSquare(boxes(1)).at).toEqual([{ x: 0, y: 0 }]);
      expect(setOutInSquare([])).toMatchObject({ at: [], width: 0, height: 0 });
    });
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
    const graph = draw(['contains', 'extends'], [], extending);
    const { relations, elements } = relatedTo(
      graph,
      'building_block|shop.orders.Order',
    );
    expect([...relations]).toEqual([
      'extends:building_block|shop.orders.Order->building_block|shop.orders.Line',
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
    const graph = draw([]);
    const line = graph.elements.find(
      ({ id }) => id === 'building_block|shop.orders.Line',
    )!;
    const Node = ElementNode as unknown as (props: {
      id: string;
      data: unknown;
    }) => React.ReactNode;
    const render = (
      neighbours: ReturnType<typeof neighboursOf> = neighboursOf(exploration),
    ) =>
      renderToStaticMarkup(
        <MantineProvider>
          <ReactFlowProvider>
            <DesignDocumentContext.Provider value={designOf(model)}>
              <ExplorationReadingContext.Provider
                value={{
                  badges: graph.badges,
                  noOutput: graph.noOutput,
                  stepping: {
                    steppedBackFrom: new Map(),
                    hollowFrom: new Map(),
                  },
                  slots: exploration.slots,
                  onGoTo: () => {},
                  onInto: () => false,
                  onSelect: () => {},
                  onLetGo: () => {},
                  drawn: new Set([line.id]),
                  neighbours,
                  elements: new Map(
                    exploration.elements.map((each) => [each.id, each]),
                  ),
                  onShow: () => {},
                  onDraw: () => {},
                  onArrange: () => {},
                  slotGroups: new Map(),
                  slotsHidden: NO_SLOTS_HIDDEN,
                  onToggleSlots: () => {},
                }}
              >
                <ExplorationSelectionContext.Provider
                  value={createStore<SelectionReading>({
                    selected: new Set(['building_block|shop.orders.Order']),
                    related: new Set([line.id]),
                    path: new Set(),
                  })}
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
                    }}
                  />
                </ExplorationSelectionContext.Provider>
              </ExplorationReadingContext.Provider>
            </DesignDocumentContext.Provider>
          </ReactFlowProvider>
        </MantineProvider>,
      );
    const html = render();
    expect(html).toMatch(/<button[^>]*data-state="related"/);
    expect(html).toContain(
      'aria-label="Line, Building Block · Value Object, related to the selection"',
    );
    // What it is is its icon's to say on the card, and the tooltip's in a word.
    expect(html).toContain('data-element-kind="Value Object"');
    expect(html).not.toContain('>Value Object<');
    expect(html).toContain('aria-pressed="false"');
    // Its buttons are there whether or not it is in hand.
    expect(html).toContain('aria-label="More for Line"');
    // What it can bring is in its menu, not on the card.
    expect(html).not.toContain('aria-label="Show what Line is part of"');
    expect(html).toContain('aria-label="Remove Line from the view"');
    // With nothing to bring in, and no frame to tidy, its menu has nothing
    // to offer: no dots, only the way off.
    const bare = render(new Map());
    expect(bare).not.toContain('aria-label="More for Line"');
    expect(bare).toContain('aria-label="Remove Line from the view"');
  });
});

it('marks what steps back from further off, and gives each card what its name is sized by', () => {
  const graph = draw(['contains']);
  const Node = ElementNode as unknown as (props: {
    id: string;
    data: unknown;
  }) => React.ReactNode;
  const ORDERS = 'module|shop.orders';
  const PLACE = 'behavior|shop.orders.Order.place';
  const render = (
    id: string,
    holds: boolean,
    slotsHidden: typeof NO_SLOTS_HIDDEN = NO_SLOTS_HIDDEN,
  ) =>
    renderToStaticMarkup(
      <MantineProvider>
        <ReactFlowProvider>
          <DesignDocumentContext.Provider value={designOf(model)}>
            <ExplorationReadingContext.Provider
              value={{
                badges: graph.badges,
                noOutput: graph.noOutput,
                stepping: {
                  steppedBackFrom: new Map([[PLACE, 'blocks']]),
                  hollowFrom: new Map([[ORDERS, 'modules']]),
                },
                slots: exploration.slots,
                onGoTo: () => {},
                onInto: () => false,
                onSelect: () => {},
                onLetGo: () => {},
                drawn: new Set(graph.elements.map((each) => each.id)),
                neighbours: neighboursOf(exploration),
                elements: new Map(
                  exploration.elements.map((each) => [each.id, each]),
                ),
                onShow: () => {},
                onDraw: () => {},
                onArrange: () => {},
                slotGroups: new Map(),
                slotsHidden,
                onToggleSlots: () => {},
              }}
            >
              <Node
                id={id}
                data={{
                  placed: {
                    element: graph.elements.find((each) => each.id === id)!,
                    holds,
                    x: 0,
                    y: 0,
                    width: 400,
                    height: 300,
                  },
                }}
              />
            </ExplorationReadingContext.Provider>
          </DesignDocumentContext.Provider>
        </ReactFlowProvider>
      </MantineProvider>,
    );
  const holderOf = (html: string) =>
    /<div[^>]*data-part="(?:holder|container)"[^>]*>/.exec(html)?.[0];

  expect(holderOf(render(PLACE, false))).toContain(
    'data-stepped-back-from="blocks"',
  );
  // Drawn inside a frame: not moved from further off.
  expect(holderOf(render(PLACE, false))).toContain('data-nested="true"');
  const orders = holderOf(render(ORDERS, true));
  expect(orders).not.toContain('data-stepped-back-from');
  expect(orders).toContain('data-hollow-from="modules"');
  // Its name's width, in a frame 400 by 300.
  expect(orders).toContain(
    `--name-width:${nameWidthOf('orders')};--frame-width:400;--frame-height:300`,
  );
  // With slots hidden on it, a mark after its name says so, and shows them.
  expect(render(PLACE, false)).not.toContain('data-part="slots-hidden"');
  const hid = render(PLACE, false, {
    state: new Set(),
    signature: new Set([PLACE]),
  });
  expect(hid).toMatch(
    /data-part="slots-hidden"[^>]*data-tip="Show input and output"/,
  );
  expect(hid).toContain('input and output hidden"');
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

  describe('a behavior put in', () => {
    const elements = new Map(
      exploration.elements.map((each) => [each.id, each]),
    );
    const place = 'behavior|shop.orders.Order.place';
    const order = 'building_block|shop.orders.Order';

    it('brings the block it is on, drawn round it, and nothing further out', () => {
      const picks = pickedIn(NO_PICKS, [place], elements);
      expect(picks.added).toEqual(new Set([place, order]));
      const graph = graphOf(exploration, {
        hidden: new Set(['module', 'aggregate', 'value_object', 'behavior']),
        relations: new Set(['contains', 'invokes']),
        picks,
      });
      expect(
        new Map(graph.elements.map(({ id, parent }) => [id, parent])),
      ).toEqual(
        new Map([
          [order, null],
          [place, order],
        ]),
      );
    });

    it('brings its block back when the reader had taken it off', () => {
      const picks = pickedIn(picked(NO_PICKS, order, false), [place], elements);
      expect(picks.added.has(order)).toBe(true);
      expect(picks.removed.has(order)).toBe(false);
    });

    it('brings its block by name, a card of its own, though it came by a slot', () => {
      const picks = pickedIn(NO_PICKS, [place, order], elements, true);
      expect(picks.bySlot).toEqual(new Set([place]));
    });

    it('brings nothing with a block or a module', () => {
      const picks = pickedIn(NO_PICKS, [order, 'module|shop.orders'], elements);
      expect(picks.added).toEqual(new Set([order, 'module|shop.orders']));
    });
  });
});

describe('slots drawn on the cards that hold them', () => {
  const ORDER = 'building_block|shop.orders.Order';
  const LINE = 'building_block|shop.orders.Line';
  const PLACE = 'behavior|shop.orders.Order.place';
  const onCards = (
    relations: RelationKind[],
    {
      from = exploration,
      picks = NO_PICKS,
      slotsHidden = NO_SLOTS_HIDDEN,
    } = {},
  ) =>
    graphOf(from, {
      hidden: new Set(),
      relations: new Set(relations),
      picks,
      slotsHidden,
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

  it('hides a card’s state, or its input and output as one, on that card alone', () => {
    const all: RelationKind[] = ['contains', 'state', 'input', 'output'];
    const graph = onCards(all, {
      slotsHidden: { state: new Set([ORDER]), signature: new Set([PLACE]) },
    });
    expect(badges(graph, ORDER)).toEqual([]);
    expect(badges(graph, PLACE)).toEqual([]);
    expect(graph.noOutput.has(PLACE)).toBeFalse();
    // Its menu still offers each to show again, and nothing it has not got.
    const groups = slotGroupsOf(exploration, graph.elements, new Set(all));
    expect(groups.get(ORDER)).toEqual(['state']);
    expect(groups.get(PLACE)).toEqual(['signature']);
    // A group not asked for is not the card's to show.
    expect(
      slotGroupsOf(exploration, graph.elements, new Set(['contains'])).has(
        ORDER,
      ),
    ).toBeFalse();
    // Hidden on the card, a slot is no more drawn than one not asked for:
    // the type it alone kept off the diagram is a card again.
    expect(ids(graph)).toContain(LINE);
    expect(ids(onCards(all))).not.toContain(LINE);
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

  it('tells the behaviors that give nothing back, when their output is asked for', () => {
    // The order's place takes a line and gives nothing back.
    const asked = onCards(['contains', 'state', 'input', 'output']);
    expect([...asked.noOutput]).toEqual([PLACE]);
    // With outputs not drawn, none is said to be missing.
    expect(onCards(['contains', 'state', 'input']).noOutput.size).toBe(0);
    // One that gives something back is not among them.
    const giving = onCards(['contains', 'input', 'output'], {
      from: shopWith(slot('has_output', PLACE, 'placed', ORDER)),
    });
    expect(giving.noOutput.size).toBe(0);
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

  describe('drawn as the app draws them, every card put in by the reader', () => {
    /** The diagram with every kind hidden, as the app has it, and these picks. */
    const asTheAppDraws = (picks: ReturnType<typeof picked>) =>
      graphOf(exploration, {
        hidden: hiddenBy(NOTHING_CHOSEN, exploration),
        relations: new Set(['contains', 'state', 'input']),
        picks,
      });
    const byName = [ORDER, PLACE].reduce(
      (picks, id) => picked(picks, id, true),
      NO_PICKS,
    );

    it('keeps a type put in by name as a card of its own', () => {
      const graph = asTheAppDraws(picked(byName, LINE, true));
      expect(ids(graph)).toContain(LINE);
      expect(graph.folded.size).toBe(0);
    });

    it('folds a type brought in by following a slot from a card into its badges', () => {
      const graph = asTheAppDraws(picked(byName, LINE, true, true));
      expect(ids(graph)).not.toContain(LINE);
      expect([...graph.folded]).toEqual([LINE]);
      expect(badges(graph, PLACE)).toEqual(['input line: Line 1']);
    });

    it('brings a folded type out as a card once it is put in by name', () => {
      const slotted = picked(byName, LINE, true, true);
      const named = picked(slotted, LINE, true);
      expect([...(named.bySlot ?? [])]).toEqual([]);
      expect(ids(asTheAppDraws(named))).toContain(LINE);
    });

    it('forgets how a type came once it is taken off', () => {
      const gone = picked(picked(byName, LINE, true, true), LINE, false);
      expect([...(gone.bySlot ?? [])]).toEqual([]);
    });

    it('keeps how each type came across a later scan', () => {
      const kept = choiceWithin(
        { shown: new Set(), picks: picked(byName, LINE, true, true) },
        exploration,
      );
      expect([...(kept.picks.bySlot ?? [])]).toEqual([LINE]);
    });

    it('tells a slot followed from a card from any other way of reaching', () => {
      expect(
        [
          'hasInput',
          'inputOf',
          'hasState',
          'stateOf',
          'hasOutput',
          'outputOf',
        ].every((reach) => isSlotReach(reach as never)),
      ).toBeTrue();
      expect(
        ['invokes', 'worksWith', 'extends', 'contains', 'isPartOf'].some(
          (reach) => isSlotReach(reach as never),
        ),
      ).toBeFalse();
    });
  });

  describe('a card’s own menu', () => {
    const elements = new Map(
      exploration.elements.map((each) => [each.id, each]),
    );
    const reading = (...drawn: string[]) => ({
      drawn: new Set(drawn),
      neighbours: neighboursOf(exploration),
      elements,
      slotGroups: new Map(),
    });
    const ORDER = 'building_block|shop.orders.Order';
    const PLACE = 'behavior|shop.orders.Order.place';

    it('tells a card’s own slots from the same slots read back from their type', () => {
      expect(
        ['hasState', 'hasInput', 'hasOutput'].every((reach) =>
          isOwnSlotReach(reach as never),
        ),
      ).toBeTrue();
      expect(
        ['stateOf', 'inputOf', 'outputOf', 'invokes', 'contains'].some(
          (reach) => isOwnSlotReach(reach as never),
        ),
      ).toBeFalse();
    });

    it('does not offer the types of the card’s own slots: they are its badges', () => {
      // All the order and its behavior still reach is the line, by a slot.
      const drawn = reading('module|shop.orders', ORDER, PLACE);
      expect(hasNodeMenu(ORDER, false, drawn)).toBeFalse();
      expect(hasNodeMenu(PLACE, false, drawn)).toBeFalse();
    });

    it('offers a card with slots of its own to show or hide them', () => {
      const drawn = reading('module|shop.orders', ORDER, PLACE);
      expect(
        hasNodeMenu(ORDER, false, {
          ...drawn,
          slotGroups: new Map([[ORDER, ['state']]]),
        }),
      ).toBeTrue();
    });

    it('offers, from a type, the cards that hold it in a slot', () => {
      expect(
        hasNodeMenu(LINE, false, reading('module|shop.orders', LINE)),
      ).toBeTrue();
    });
  });

  it('relates a card to the types its badges name, when they have cards of their own', () => {
    const graph = onCards(['contains', 'state', 'input'], {
      picks: picked(NO_PICKS, LINE, true),
    });
    expect([...relatedTo(graph, LINE).elements]).toEqual(
      expect.arrayContaining([ORDER, PLACE]),
    );
    expect([...relatedTo(graph, ORDER).elements]).toContain(LINE);
    // A type with no card of its own is related to nothing on the diagram.
    const folded = onCards(['contains', 'state', 'input']);
    expect([...relatedTo(folded, ORDER).elements]).not.toContain(LINE);
  });

  it('leaves a card carrying badges room for them, and a frame room under its name', () => {
    const graph = onCards(['contains', 'state', 'input']);
    const element = (id: string) =>
      graph.elements.find((each) => each.id === id)!;
    const order = element(ORDER);
    const place = element(PLACE);
    // A card with no badges is as it was.
    const bare = draw(['contains']).elements.find(({ id }) => id === PLACE)!;
    expect(cardSizeOf(bare, { badges: new Map() })).toEqual({
      width: widthOf('place'),
      height: HEIGHT,
    });
    // A signature of one line: taller than its name and what it is alone.
    const sized = cardSizeOf(place, graph);
    expect(sized.height).toBeGreaterThan(HEIGHT);
    expect(sized.width).toBeGreaterThanOrEqual(widthOf('place'));
    // Order holds place, so it is a frame: its top grows for its badges.
    expect(paddingOf(order, graph).top).toBeGreaterThan(PADDING.top);
    expect(frameLeastWidthOf(order, graph)).toBeGreaterThan(0);
    expect(paddingOf(order, { badges: new Map() })).toEqual(PADDING);
  });

  it('leaves a card and a frame the width of their names as drawn from further off', () => {
    const none = { badges: new Map() };
    const place = draw(['contains']).elements.find(({ id }) => id === PLACE)!;
    const long = 'PreparationEventPublisher';
    const far = nameWidthOf(long) * FAR_NAME_SCALE;
    // Close up the name alone would leave it narrower.
    expect(far).toBeGreaterThan(widthOf(long));
    const block = { ...place, name: long, kind: 'building_block' as const };
    expect(cardSizeOf(block, none).width).toBeGreaterThan(far);
    expect(frameLeastWidthOf(block, none)).toBeGreaterThan(far);
    // A module's name is half as large again as a block's: its frame is
    // as wide as the name then takes from further off, and its top as tall.
    const moduleOf = (name: string) =>
      frameLeastWidthOf({ ...place, name, kind: 'module' as const }, none);
    for (const name of ['catalog', 'payments', long])
      expect(moduleOf(name)).toBeGreaterThan(
        (nameWidthOf(name) + 16) * FAR_NAME_SCALE * MODULE_NAME_SCALE,
      );
    expect(
      paddingOf({ ...place, kind: 'module' as const }, none).top,
    ).toBeGreaterThanOrEqual(6 + 26 * FAR_NAME_SCALE * MODULE_NAME_SCALE);
    expect(moduleOf('catalog')).toBeGreaterThan(
      frameLeastWidthOf(
        { ...place, name: 'catalog', kind: 'building_block' as const },
        none,
      ),
    );
    // A behavior in a frame has stepped back by then: its card is as wide
    // as its whole name close up, past the widest a card is for its name
    // alone; one standing on its own is as wide as from further off.
    const behavior = { ...place, name: long, kind: 'behavior' as const };
    expect(
      cardSizeOf({ ...behavior, parent: ORDER }, none).width,
    ).toBeGreaterThan(widthOf(long));
    expect(cardSizeOf({ ...behavior, parent: ORDER }, none).width).toBeLessThan(
      far,
    );
    // However long, it is never cut short.
    const longer = { ...behavior, parent: ORDER, name: `${long}${long}` };
    expect(cardSizeOf(longer, none).width).toBeGreaterThan(
      nameWidthOf(longer.name),
    );
    // A card with slots hidden on it has room for the way to show them.
    expect(
      cardSizeOf(longer, { ...none, slotsHiddenOn: new Set([PLACE]) }).width,
    ).toBe(cardSizeOf(longer, none).width + 24);
    expect(cardSizeOf({ ...behavior, parent: null }, none).width).toBe(
      cardSizeOf(block, none).width,
    );
    // Wide letters take more than narrow ones.
    expect(nameWidthOf('WWWW')).toBeGreaterThan(nameWidthOf('iiii'));
  });

  it('draws a card’s badges beside its button, as its signature', () => {
    const graph = onCards(['contains', 'state', 'input'], {
      picks: picked(NO_PICKS, LINE, true),
    });
    const Node = ElementNode as unknown as (props: {
      id: string;
      data: unknown;
    }) => React.ReactNode;
    const render = (id: string, holds: boolean) => {
      const element = graph.elements.find((each) => each.id === id)!;
      return renderToStaticMarkup(
        <MantineProvider>
          <ReactFlowProvider>
            <DesignDocumentContext.Provider value={designOf(model)}>
              <ExplorationReadingContext.Provider
                value={{
                  badges: graph.badges,
                  noOutput: graph.noOutput,
                  stepping: {
                    steppedBackFrom: new Map(),
                    hollowFrom: new Map(),
                  },
                  slots: exploration.slots,
                  onGoTo: () => {},
                  onInto: () => false,
                  onSelect: () => {},
                  onLetGo: () => {},
                  drawn: new Set(graph.elements.map((each) => each.id)),
                  neighbours: neighboursOf(exploration),
                  elements: new Map(
                    exploration.elements.map((each) => [each.id, each]),
                  ),
                  onShow: () => {},
                  onDraw: () => {},
                  onArrange: () => {},
                  slotGroups: new Map(),
                  slotsHidden: NO_SLOTS_HIDDEN,
                  onToggleSlots: () => {},
                }}
              >
                <ExplorationSelectionContext.Provider
                  value={createStore<SelectionReading>({
                    selected: new Set([LINE]),
                    related: new Set([ORDER, PLACE]),
                    path: new Set(),
                  })}
                >
                  <Node
                    id={id}
                    data={{
                      placed: {
                        element,
                        holds,
                        x: 0,
                        y: 0,
                        width: 220,
                        height: 90,
                      },
                    }}
                  />
                </ExplorationSelectionContext.Provider>
              </ExplorationReadingContext.Provider>
            </DesignDocumentContext.Provider>
          </ReactFlowProvider>
        </MantineProvider>,
      );
    };

    const place = render(PLACE, false);
    expect(place).toContain('data-badged="true"');
    // The badge is no part of the card's button, but a button of its own
    // that opens what its type relates to.
    const card = /<button[^>]*data-part="card"[^>]*>(.*?)<\/button>/s.exec(
      place,
    )?.[1];
    expect(card).toContain('place');
    expect(card).not.toContain('Line');
    // Written as the code declares it: `(line: Line)`, its brackets not
    // read out, the slot between them.
    expect(place).toMatch(
      /<span aria-hidden="true">\(<\/span><span[^>]*><button[^>]*data-relation="input"[^>]*data-related="true"[^>]*aria-label="line: Line, also on the diagram"[^>]*aria-haspopup="dialog"[^>]*aria-expanded="false"[^>]*>/,
    );
    expect(place).toMatch(
      /<span[^>]*>line<\/span><span[^>]*>: <\/span><span[^>]*><span[^>]*>Line<\/span>/,
    );
    expect(place).toMatch(
      /<\/button><\/span><span aria-hidden="true">\)<\/span>/,
    );
    // A type with a card of its own says so with ↗.
    expect(place).toMatch(/<span[^>]*>↗<\/span>/);
    expect(place).toContain('also on the diagram');
    // Its output not asked for, the signature ends at its bracket.
    expect(place).not.toContain('void');

    // Order holds place: a frame, its top as tall as its name and badges,
    // each field of its state a line of its own.
    const order = render(ORDER, true);
    // A frame has one way off the diagram, and it takes what it holds too.
    expect(order.match(/aria-label="Remove [^"]*"/g)).toEqual([
      'aria-label="Remove Order and what it holds from the view"',
    ]);
    expect(order).toContain('data-tip="Remove group"');
    expect(order).toMatch(
      />lines<\/span><span[^>]*>: <\/span><span[^>]*><span[^>]*>Line<\/span><span[^>]*>, many<\/span><span[^>]*data-cardinality="\*"/,
    );
    // A primitive leads nowhere: its badge is words, not a button.
    expect(order).toMatch(
      /<div><span><span[^>]*data-relation="state"[^>]*><span[^>]*>id<\/span><span[^>]*>: <\/span><span[^>]*><span[^>]*>uuid<\/span><\/span><\/span><\/span><\/div>/,
    );
    expect(order).toContain(
      `--frame-top:${
        paddingOf(
          graph.elements.find(({ id }) => id === ORDER)!,
          graph,
        ).top
      }px`,
    );
  });

  it('writes void where a behavior that gives nothing back would write its output', () => {
    const drawn = (noOutput: boolean) =>
      renderToStaticMarkup(
        <MantineProvider>
          <SlotBadges badges={[]} noOutput={noOutput} frame={false} />
        </MantineProvider>,
      );
    const html = drawn(true);
    // `() → void`: the arrow not read out, the word read as it is.
    expect(html).toMatch(
      /<span aria-hidden="true">\) → <\/span><span[^>]*>void<\/span>/,
    );
    // No slot has a tooltip, the word for none neither.
    expect(html).not.toContain('data-tip');
    // With no slot and nothing to say, a card has no signature.
    expect(drawn(false)).not.toContain('data-part="badges"');
  });

  it('gives each field of a card’s state a line, and grows no wider than the widest card', () => {
    const state = (name: string, typeName: string) => ({
      relation: 'state' as const,
      holder: ORDER,
      name,
      type: 'primitive|string' as never,
      typeName,
      cardinality: '1' as const,
      position: null,
      onDiagram: false,
    });
    const order = draw(['contains']).elements.find(({ id }) => id === ORDER)!;
    const sizeOf = (...badges: ReturnType<typeof state>[]) =>
      cardSizeOf(order, { badges: new Map([[ORDER, badges]]) });
    const one = sizeOf(state('body', 'string'));
    const three = sizeOf(
      state('body', 'string'),
      state('subject', 'string'),
      state('recipient', 'string'),
    );
    expect(three.height - one.height).toBe(2 * SIGNATURE_LINE);
    // A line too long for the widest card is cut short there, not wrapped.
    const long = sizeOf(state('a'.repeat(60), 'AVeryLongTypeNameIndeed'));
    expect(long.width).toBe(420);
    expect(long.height).toBe(one.height);
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

it('reads what is in hand without where it sits, which the canvas shows', () => {
  const ORDER = 'building_block|shop.orders.Order';
  const html = renderToStaticMarkup(
    <MantineProvider>
      <ElementPanel
        id={ORDER}
        document={designOf(model)}
        eyebrow="Building Block"
        title="Order"
        onSelectElement={() => {}}
      />
    </MantineProvider>,
  );
  expect(html).toMatch(/<h2[^>]*>Order<\/h2>/);
  expect(html).not.toContain('shop.orders.Order<');
  expect(html).not.toContain('>shop.orders<');
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

  it('adds to a drawn one from the plus in its corner', () => {
    const html = picker(3);
    expect(html).not.toContain('Start exploration');
    expect(html).toMatch(/<button[^>]*aria-label="Add to the exploration"/);
  });
});

describe('a card that stands without what holds it', () => {
  const ORDER = 'building_block|shop.orders.Order';
  const PLACE = 'behavior|shop.orders.Order.place';
  const drawnWith = (...added: string[]) =>
    graphOf(exploration, {
      hidden: new Set(['module', 'aggregate', 'value_object', 'behavior']),
      relations: new Set(['contains']),
      picks: { added: new Set(added), removed: new Set() },
    });

  it('is told apart: its parent is in the model, and not on the diagram', () => {
    // The order's module is not drawn; its behavior's block is.
    expect([...drawnWith(ORDER, PLACE).parentless]).toEqual([ORDER]);
    expect([...drawnWith(ORDER, 'module|shop.orders').parentless]).toEqual([
      'module|shop.orders',
    ]);
    // The outermost module has nothing round it to miss.
    expect(drawnWith('module|shop').parentless.size).toBe(0);
  });

  it('is left the room for the way to its parent, beside its menu and cross', () => {
    const graph = drawnWith(ORDER);
    const order = graph.elements.find(({ id }) => id === ORDER)!;
    const without = cardSizeOf(order, { badges: graph.badges });
    expect(cardSizeOf(order, graph).width).toBe(without.width + 24);
    expect(frameLeastWidthOf(order, graph)).toBe(
      frameLeastWidthOf(order, { badges: graph.badges }) + 24,
    );
  });
});

describe('how much of an element is drawn, with all inside it', () => {
  const ORDERS = 'module|shop.orders';
  const ORDER = 'building_block|shop.orders.Order';
  const LINE = 'building_block|shop.orders.Line';
  const PLACE = 'behavior|shop.orders.Order.place';
  const much = (...drawn: string[]) =>
    howMuchDrawn(exploration, new Set(drawn));

  it('is all of it, none of it, or only part', () => {
    expect(much(ORDER, PLACE).get(ORDER)).toBe(true);
    expect(much().get(ORDER)).toBe(false);
    // The block without its behavior, and the behavior without its block.
    expect(much(ORDER).get(ORDER)).toBe('mixed');
    expect(much(PLACE).get(ORDER)).toBe('mixed');
  });

  it('is all of an element with nothing inside it, once it is drawn', () => {
    expect(much(PLACE).get(PLACE)).toBe(true);
    expect(much(ORDER).get(PLACE)).toBe(false);
  });

  it('counts what is inside all the way down', () => {
    // A behavior alone marks every frame round it as partly drawn.
    expect(much(PLACE).get(ORDERS)).toBe('mixed');
    expect(much(PLACE).get('module|shop')).toBe('mixed');
    expect(much(ORDERS, ORDER, LINE, PLACE).get(ORDERS)).toBe(true);
    // Its own module is not inside it.
    expect(much(ORDERS, ORDER, LINE, PLACE).get('module|shop')).toBe('mixed');
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
    folded: new Set<string>(),
    noOutput: new Set<string>(),
    parentless: new Set<string>(),
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

  it('draws a card now drawn round others as a frame round them, where the card stood', () => {
    // Containment shown again: Box stood as a card, Kid under it, as far
    // in as it stood inside Box.
    const box = element('Box');
    const kid = element('Kid', 'Box');
    const next = element('Next');
    const placed = placeLocally(
      [at(box, 0, 0), at({ ...kid, parent: null }, 16, 400), at(next, 600, 0)],
      graphOf(box, kid, next),
      { x: 0, y: 0 },
    )!;
    const byId = new Map(placed.map((each) => [each.element.id, each]));
    const frame = byId.get('Box')!;
    expect(frame).toMatchObject({ holds: true, x: 0, y: 0 });
    // What it holds raised to the top of its room, and nothing moved.
    expect(byId.get('Kid')).toMatchObject({ x: 16, y: 60 });
    expect(frame.height).toBe(60 + 56 + 40);
    expect(byId.get('Next')).toMatchObject({ x: 600, y: 0 });
  });

  it('sizes every card anew for what it now carries, its corner where it stood', () => {
    const [a, b] = [element('A'), element('B')];
    const graph = graphOf(a, b);
    const placed = placeLocally(
      [at(a, 0, 0, 150, 200), at(b, 400, 0)],
      graph,
      { x: 0, y: 0 },
      { asSized: true },
    )!;
    expect(
      placed.map(({ x, y, width, height }) => [x, y, width, height]),
    ).toEqual([
      [0, 0, cardSizeOf(a, graph).width, HEIGHT],
      [400, 0, cardSizeOf(b, graph).width, HEIGHT],
    ]);
    // Unasked, they keep the sizes they had.
    expect(
      placeLocally([at(a, 0, 0, 150, 200)], graphOf(a), { x: 0, y: 0 })![0],
    ).toMatchObject({ width: 150, height: 200 });
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
        // Right of the repository: in its way once it moves.
        at(beyond, 1100, 72, 150, 56),
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
    expect(on('Beyond').x).toBeGreaterThan(1100);
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

  describe('several cards moved together', () => {
    it('lets each go where it was let go of, as they stood to each other', () => {
      const [a, b, c] = [element('A'), element('B'), element('C')];
      const placed = movedAllTo(
        [at(a, 0, 0), at(b, 200, 0), at(c, 0, 400)],
        graphOf(a, b, c),
        [
          { id: 'A', to: { x: 1000, y: 100 } },
          { id: 'B', to: { x: 1200, y: 100 } },
        ],
      )!;
      const byId = new Map(placed.map((each) => [each.element.id, each]));
      expect(byId.get('A')).toMatchObject({ x: 1000, y: 100 });
      expect(byId.get('B')).toMatchObject({ x: 1200, y: 100 });
      expect(byId.get('C')).toMatchObject({ x: 0, y: 400 });
    });

    it('moves what they land on off them, and none of them off each other', () => {
      const [a, b, c] = [element('A'), element('B'), element('C')];
      // A and B, side by side as close as cards stand, land over C.
      const placed = movedAllTo(
        [at(a, 0, 0), at(b, 182, 0), at(c, 600, 300)],
        graphOf(a, b, c),
        [
          { id: 'A', to: { x: 500, y: 290 } },
          { id: 'B', to: { x: 682, y: 290 } },
        ],
      )!;
      const byId = new Map(placed.map((each) => [each.element.id, each]));
      expect(byId.get('A')).toMatchObject({ x: 500, y: 290 });
      expect(byId.get('B')).toMatchObject({ x: 682, y: 290 });
      expect(apart(byId.get('C')!, byId.get('A')!)).toBe(true);
      expect(apart(byId.get('C')!, byId.get('B')!)).toBe(true);
    });

    it('grows the frame round cards moved in it, and takes what a frame holds with it', () => {
      const box = element('Box');
      const [one, two] = [element('One', 'Box'), element('Two', 'Box')];
      const other = element('Other');
      const kid = element('Kid', 'Other');
      const placed = movedAllTo(
        [
          at(box, 0, 0, 400, 200, true),
          at(one, 16, 60),
          at(two, 200, 60),
          at(other, 1000, 0, 200, 160, true),
          at(kid, 16, 60),
        ],
        graphOf(box, one, two, other, kid),
        [
          // Two cards down inside their frame, and another frame as far.
          { id: 'One', to: { x: 16, y: 260 } },
          { id: 'Two', to: { x: 200, y: 260 } },
          { id: 'Other', to: { x: 1000, y: 200 } },
        ],
      )!;
      const byId = new Map(placed.map((each) => [each.element.id, each]));
      expect(byId.get('One')).toMatchObject({ x: 16, y: 260 });
      expect(byId.get('Two')).toMatchObject({ x: 200, y: 260 });
      expect(byId.get('Box')!.height).toBeGreaterThanOrEqual(260 + 56);
      // The frame moved, what it holds where it was inside it.
      expect(byId.get('Other')).toMatchObject({ x: 1000, y: 200 });
      expect(byId.get('Kid')).toMatchObject({ x: 16, y: 60 });
    });
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
