import { beforeEach, describe, expect, it } from 'bun:test';
import type { SystemModel } from '#backend/app/system-model/system-model.ts';
import {
  explorationOf,
  graphOf,
  groupOf,
  NO_PICKS,
  neighboursOf,
  type RelationKind,
} from '../src/features/system-model/system-model-exploration';
import {
  type ExplorationActions,
  type ExplorationState,
  explorationTools,
} from '../src/features/system-model/ui/exploration/exploration-tools';
import {
  type ModelContext,
  registerTools,
} from '../src/shared/web-mcp/web-mcp';

const source = { path: 'X.java', line: null };
const block = (
  path: string,
  name: string,
  type: string,
  uses: string[] = [],
) => ({
  id: `building_block|${path}`,
  name,
  type,
  description: null,
  implements: [],
  properties: uses.map((target) => ({
    name: target,
    type: target,
    description: null,
    optional: false,
  })),
  rules: [],
  scenarios: [],
  source,
});
const behavior = (on: string, name: string, invokes: string[] = []) => ({
  id: `behavior|${on.slice(on.indexOf('|') + 1)}.${name}`,
  buildingBlockId: on,
  name,
  type: 'Command',
  description: null,
  visibility: { kind: 'public' },
  input: [],
  output: [],
  invokes,
  rules: [],
  scenarios: [],
  source,
});

const ORDER = 'building_block|shop.orders.Order';
const LINE = 'building_block|shop.orders.Line';
const STOCK = 'building_block|shop.stock.Stock';
const ORDERS = 'module|shop.orders';
const model = {
  id: '01a15509-0909-725f-8ab8-25ab23fc10d3',
  name: 'shop',
  scanned_at: '2026-10-19T10:00:00Z',
  modules: [
    { id: 'module|shop', name: 'shop', description: null, rules: [], source },
    { id: ORDERS, name: 'orders', description: null, rules: [], source },
    {
      id: 'module|shop.stock',
      name: 'stock',
      description: null,
      rules: [],
      source,
    },
  ],
  buildingBlocks: [
    block('shop.orders.Order', 'Order', 'aggregate', [LINE]),
    block('shop.orders.Line', 'Line', 'value_object'),
    block('shop.stock.Stock', 'Stock', 'aggregate'),
  ],
  behaviors: [
    behavior(ORDER, 'place', ['behavior|shop.stock.Stock.reserve']),
    behavior(STOCK, 'reserve'),
  ],
} as unknown as SystemModel;

const exploration = explorationOf(model);
const neighbours = neighboursOf(exploration);
const elements = new Map(exploration.elements.map((each) => [each.id, each]));

/** The diagram drawing these, with every relation. */
function stateOf(drawn: string[], selection: string[] = []): ExplorationState {
  const relations = new Set<RelationKind>(['contains', 'uses', 'invokes']);
  return {
    exploration,
    neighbours,
    elements,
    graph: graphOf(exploration, {
      hidden: new Set(exploration.elements.map(groupOf)),
      relations,
      picks: { ...NO_PICKS, added: new Set(drawn) },
    }),
    relations,
    direction: 'vertical',
    selection,
    veiled: new Set(),
    canUndo: false,
    canRedo: false,
  };
}

let state: ExplorationState;
let calls: [string, ...unknown[]][];
const actions: ExplorationActions = {
  show: async (ids, draw) =>
    void calls.push(draw === undefined ? ['show', ids] : ['show', ids, draw]),
  showBeside: async (ids, from, draw) =>
    void calls.push(
      draw === undefined
        ? ['showBeside', ids, from]
        : ['showBeside', ids, from, draw],
    ),
  hide: async (ids) => void calls.push(['hide', ids]),
  setRelations: async (relations) =>
    void calls.push(['setRelations', [...relations]]),
  select: async (ids) => void calls.push(['select', ids]),
  focus: async (ids) => void calls.push(['focus', ids]),
  arrange: async (direction) => void calls.push(['arrange', direction]),
  undo: async () => void calls.push(['undo']),
  redo: async () => void calls.push(['redo']),
  clear: async () => void calls.push(['clear']),
};

/** The tools as an agent calls them: through WebMCP, answering in JSON. */
async function toolsOf() {
  const registered = new Map<string, (input: unknown) => Promise<string>>();
  const context: ModelContext = {
    registerTool: (tool) => void registered.set(tool.name, tool.execute),
  };
  registerTools(
    explorationTools(() => state, actions),
    context,
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  return async (name: string, input: object = {}) => {
    const execute = registered.get(name);
    if (execute === undefined) throw new Error(`no tool ${name}`);
    return JSON.parse(await execute(input));
  };
}

beforeEach(() => {
  state = stateOf([]);
  calls = [];
});

describe('the exploration offered to an agent', () => {
  it('finds elements by name, best match first, saying which are drawn', async () => {
    state = stateOf([LINE]);
    const call = await toolsOf();
    const found = await call('find_diagram_element_ids', { query: 'or' });
    expect(found.elements.map(({ id }: { id: string }) => id)).toEqual([
      ORDER,
      ORDERS,
      LINE,
      'behavior|shop.orders.Order.place',
    ]);
    expect(found.elements[0]).toEqual({
      id: ORDER,
      name: 'Order',
      kind: 'Building block · Aggregate',
      path: 'shop.orders.Order',
      in: 'orders',
      drawn: false,
    });
    expect(found.elements[2].drawn).toBe(true);
    const aggregates = await call('find_diagram_element_ids', {
      query: '',
      type: 'aggregate',
    });
    expect(
      aggregates.elements.map(({ name }: { name: string }) => name),
    ).toEqual(['Order', 'Stock']);
  });

  it('describes an element by whom it is joined to, each way', async () => {
    const call = await toolsOf();
    const order = await call('describe_element', { id: ORDER });
    expect(order.name).toBe('Order');
    expect(order.isPartOf.elements.map(({ id }: { id: string }) => id)).toEqual(
      [ORDERS],
    );
    expect(order.uses.elements.map(({ id }: { id: string }) => id)).toEqual([
      LINE,
    ]);
    expect(order.contains.count).toBe(1);
    expect(order.usedBy).toBeUndefined();
  });

  it('refuses an id the model does not hold, saying how ids read', async () => {
    const call = await toolsOf();
    const refused = await call('describe_element', { id: 'Order' });
    expect(refused.error).toContain('no element Order');
    expect(refused.error).toContain('find_diagram_element_ids');
  });

  it('follows a chain without drawing it', async () => {
    const call = await toolsOf();
    const chain = await call('find_chain', { id: ORDER, reach: 'invokes' });
    expect(chain.elements.map(({ id }: { id: string }) => id)).toEqual([
      'behavior|shop.orders.Order.place',
      'behavior|shop.stock.Stock.reserve',
      STOCK,
    ]);
    expect(calls).toEqual([]);
  });

  it('shows elements, with all inside them when asked', async () => {
    const call = await toolsOf();
    await call('show_elements', { ids: [STOCK] });
    await call('show_elements', { ids: [ORDERS], withContents: true });
    expect(calls).toEqual([
      ['show', [STOCK]],
      ['show', [ORDERS, ORDER, 'behavior|shop.orders.Order.place', LINE]],
    ]);
  });

  it('shows a chain beside its drawn element, its relation drawn too', async () => {
    state = { ...stateOf([ORDER]), relations: new Set(['contains']) };
    const call = await toolsOf();
    const answer = await call('show_chain', { id: ORDER, reach: 'invokes' });
    // The relation goes with the chain, so one step takes both back.
    expect(calls).toEqual([
      [
        'showBeside',
        [
          'behavior|shop.orders.Order.place',
          'behavior|shop.stock.Stock.reserve',
          STOCK,
        ],
        ORDER,
        'invokes',
      ],
    ]);
    expect(answer.added).toBe(3);
  });

  it('hides, selects and focuses only what is drawn', async () => {
    state = stateOf([ORDER]);
    const call = await toolsOf();
    const refused = await call('hide_elements', { ids: [ORDER, LINE] });
    expect(refused.error).toContain(`Not on the diagram: ${LINE}`);
    await call('hide_elements', { ids: [ORDER] });
    await call('select_elements', { ids: [ORDER] });
    await call('select_elements', { ids: [] });
    await call('focus_elements', { ids: [ORDER] });
    expect(calls).toEqual([
      ['hide', [ORDER]],
      ['select', [ORDER]],
      ['select', []],
      ['focus', [ORDER]],
    ]);
  });

  it('reads the diagram whole: elements, edges and selection', async () => {
    state = stateOf([ORDER, LINE], [ORDER]);
    const call = await toolsOf();
    const diagram = await call('get_diagram');
    expect(diagram.elements.map(({ id }: { id: string }) => id)).toEqual([
      ORDER,
      LINE,
    ]);
    expect(diagram.edges).toEqual([
      { kind: 'uses', from: 'Order', to: 'Line', source: ORDER, target: LINE },
    ]);
    expect(diagram.selected).toEqual([ORDER]);
    expect(diagram.direction).toBe('vertical');
  });

  it('checks its input before it acts', async () => {
    const call = await toolsOf();
    const refused = await call('set_relations', { relations: ['owns'] });
    expect(refused.error).toBeString();
    await call('set_relations', { relations: ['uses'] });
    await call('arrange_diagram', { direction: 'horizontal' });
    expect(calls).toEqual([
      ['setRelations', ['uses']],
      ['arrange', 'horizontal'],
    ]);
  });

  it('goes back or forward only where there is a step to', async () => {
    const call = await toolsOf();
    expect((await call('undo')).error).toContain('no step');
    state = { ...state, canUndo: true };
    await call('undo');
    await call('clear_diagram');
    expect(calls).toEqual([['undo'], ['clear']]);
  });
});
