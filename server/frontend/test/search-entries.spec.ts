import { describe, expect, it } from 'bun:test';
import type { ChangeWithEntries } from '#backend/app/changes/change-entry.ts';
import type { SystemModel } from '#backend/app/system-model/system-model.ts';
import {
  matchingGroups,
  searchGroups,
} from '../src/shell/search/search-entries';

const change = (
  id: string,
  name: string,
  entries: ChangeWithEntries['entries'] = [],
) =>
  ({
    id,
    name,
    key: '',
    type: 'feature',
    status: 'design',
    entries,
  }) as unknown as ChangeWithEntries;

const weather = change('2026-09-17-weather', 'Weather-based discount', [
  { kind: 'document', id: 'spec', name: 'Discount spec' },
  { kind: 'design-doc', id: 'doc', name: 'Weather-based discount' },
] as unknown as ChangeWithEntries['entries']);
const loyalty = change('2026-10-01-loyalty', 'Loyalty points expiry');

const source = { path: 'X.java', line: null };
const block = (id: string, name: string, type: string) => ({
  id,
  name,
  type,
  description: null,
  implements: [],
  properties: [],
  rules: [],
  scenarios: [],
  source,
});
const systemModel = {
  id: '01a15509-0909-725f-8ab8-25ab23fc10d3',
  name: 'shop',
  scanned_at: '2026-10-19T10:00:00Z',
  modules: [
    { id: 'module|shop', name: 'shop', description: null, rules: [], source },
  ],
  buildingBlocks: [
    block('building_block|shop.Basket', 'Basket', 'aggregate'),
    block('building_block|shop.Price', 'Price', 'value_object'),
  ],
  behaviours: [
    {
      id: 'behavior|shop.Basket.checkOut',
      buildingBlockId: 'building_block|shop.Basket',
      name: 'checkOut',
      type: 'Command',
      description: null,
      visibility: { kind: 'public' },
      input: [],
      output: [],
      rules: [],
      scenarios: [],
      source,
    },
  ],
} as unknown as SystemModel;

const groups = searchGroups({
  changes: [weather, loyalty],
  activeChange: weather,
  projectName: 'discounts-java',
  systemModel,
});

const labels = (query: string) =>
  matchingGroups(groups, query).map((group) => [
    group.label,
    group.entries.map((entry) => entry.label),
  ]);

describe('search', () => {
  it('lists the change you are in, the workspace, then the other changes', () => {
    expect(labels('')).toEqual([
      [
        'In Weather-based discount',
        ['Discount spec', 'Weather-based discount'],
      ],
      ['Workspace', ['System model']],
      ['Changes', ['Loyalty points expiry']],
    ]);
  });

  it("finds a design doc's views only once something is typed", () => {
    expect(labels('requirements')).toEqual([
      ['In Weather-based discount', ['Requirements']],
    ]);
  });

  it('matches by kind as well as by name, ignoring case', () => {
    expect(labels('DOCUMENT')).toEqual([
      ['In Weather-based discount', ['Discount spec']],
    ]);
  });

  it('leaves out the groups with nothing that matches', () => {
    expect(labels('nothing like this')).toEqual([]);
  });

  it('opens a design doc view at that view', () => {
    const [here] = matchingGroups(groups, 'model');
    expect(here?.entries[0]?.link).toEqual({
      to: '/changes/$changeId/design-docs/$docId',
      params: { changeId: '2026-09-17-weather', docId: 'doc' },
      search: { view: 'model' },
    });
  });

  it("finds the system model's elements by name or pattern, under their owner", () => {
    const [found] = matchingGroups(groups, 'basket');
    expect(found?.label).toBe('System model');
    expect(found?.entries.map((entry) => [entry.label, entry.context])).toEqual(
      [
        ['Basket', 'Aggregate · shop'],
        ['checkOut', 'Command · shop.Basket'],
      ],
    );
    expect(labels('value object')).toEqual([['System model', ['Price']]]);
  });

  it("opens the model tree at the element's row", () => {
    const [found] = matchingGroups(groups, 'price');
    expect(found?.entries[0]?.link).toEqual({
      to: '/system-model',
      search: { node: 'building_block|shop.Price' },
    });
  });

  it('lists a group only up to its limit, and counts the rest', () => {
    const [some] = matchingGroups(
      [
        {
          label: 'System model',
          entries:
            groups.find((g) => g.label === 'System model')?.entries ?? [],
          limit: 1,
        },
      ],
      'shop',
    );
    expect(some?.entries).toHaveLength(1);
    expect(some?.more).toBe(3);
  });
});
