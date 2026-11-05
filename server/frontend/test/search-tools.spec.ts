import { describe, expect, it } from 'bun:test';
import type { NavigateOptions } from '@tanstack/react-router';
import type { ChangeWithEntries } from '#backend/app/changes/change-entry.ts';
import type { SystemModel } from '#backend/app/system-model/system-model.ts';
import {
  type ModelContext,
  registerTools,
} from '../src/shared/web-mcp/web-mcp';
import { searchTools } from '../src/shell/search/search-tools';

const source = { path: 'X.java', line: null };
const systemModel = {
  id: '01a15509-0909-725f-8ab8-25ab23fc10d3',
  name: 'shop',
  scanned_at: '2026-10-19T10:00:00Z',
  modules: [
    { id: 'module|shop', name: 'shop', description: null, rules: [], source },
  ],
  buildingBlocks: [
    {
      id: 'building_block|shop.Basket',
      name: 'Basket',
      type: 'aggregate',
      description: null,
      implements: [],
      properties: [],
      rules: [],
      scenarios: [],
      source,
    },
  ],
  behaviors: [],
} as unknown as SystemModel;
const blockOf = (path: string, name: string, type: string) => ({
  ...systemModel.buildingBlocks[0]!,
  id: `building_block|${path}`,
  name,
  type,
});
systemModel.modules.push(
  ...([
    { ...systemModel.modules[0]!, id: 'module|shop.orders', name: 'orders' },
    {
      ...systemModel.modules[0]!,
      id: 'module|shop.invoices',
      name: 'invoices',
    },
  ] as unknown as SystemModel['modules']),
);
systemModel.buildingBlocks.push(
  ...([
    blockOf('shop.BasketTotal', 'BasketTotal', 'value_object'),
    blockOf('shop.orders.Line', 'Line', 'value_object'),
    blockOf('shop.invoices.Line', 'Line', 'value_object'),
  ] as unknown as SystemModel['buildingBlocks']),
);
const loyalty = {
  id: '2026-10-01-loyalty',
  name: 'Loyalty points expiry',
  key: '',
  type: 'feature',
  status: 'design',
  entries: [],
} as unknown as ChangeWithEntries;

/** The search tools as an agent calls them, and where they opened. */
function toolsOf() {
  const opened: NavigateOptions[] = [];
  const tools = new Map<string, (input: unknown) => Promise<string>>();
  const context: ModelContext = {
    registerTool: (tool) => void tools.set(tool.name, tool.execute),
  };
  registerTools(
    searchTools(
      () => ({
        changes: [loyalty],
        activeChange: null,
        projectName: 'shop',
        systemModel,
      }),
      async (link) => void opened.push(link),
    ),
    context,
  );
  const call = async (name: string, input: object) =>
    JSON.parse((await tools.get(name)?.(input)) ?? 'null');
  return { opened, call };
}

describe("the app's search offered to an agent", () => {
  it('takes the user where a click on the one result named would', async () => {
    const { call, opened } = toolsOf();
    const answer = await call('search_noesis', { query: 'basket' });
    expect(answer).toEqual({
      opened: {
        id: expect.stringMatching(/^element:/),
        name: 'Basket',
        context: 'Aggregate · shop',
      },
    });
    expect(opened).toEqual([
      { to: '/system-model', search: { node: expect.any(String) } },
    ]);
  });

  it('opens the one whose name is the query, over others that hold it', async () => {
    const { call, opened } = toolsOf();
    const answer = await call('search_noesis', { query: 'Basket' });
    expect(answer.opened.name).toBe('Basket');
    expect(opened).toHaveLength(1);
  });

  it('lists, and opens none, when several match', async () => {
    const { call, opened } = toolsOf();
    const answer = await call('search_noesis', { query: 'line' });
    expect(answer.opened).toBeNull();
    expect(answer.groups).toEqual([
      {
        group: 'System model',
        results: [
          expect.objectContaining({
            name: 'Line',
            context: 'Value Object · shop.invoices',
          }),
          expect.objectContaining({
            name: 'Line',
            context: 'Value Object · shop.orders',
          }),
        ],
      },
    ]);
    expect(opened).toEqual([]);
    const { results } = answer.groups[0];
    const chosen = await call('open_search_result', { id: results[1].id });
    expect(chosen.opened.context).toBe('Value Object · shop.orders');
    expect(opened).toHaveLength(1);
  });

  it('opens nothing on an empty query, listing what the dialog lists', async () => {
    const { call, opened } = toolsOf();
    const all = await call('search_noesis', { query: '' });
    expect(all.groups.map(({ group }: { group: string }) => group)).toEqual([
      'Workspace',
      'Changes',
    ]);
    expect(opened).toEqual([]);
  });

  it('refuses a result it does not know', async () => {
    const { call } = toolsOf();
    const refused = await call('open_search_result', { id: 'element:nope' });
    expect(refused.error).toContain('search_noesis');
  });
});
