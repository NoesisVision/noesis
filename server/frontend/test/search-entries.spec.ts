import { describe, expect, it } from 'bun:test';
import type { ChangeWithEntries } from '#backend/app/changes/change-entry.ts';
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

const groups = searchGroups({
  changes: [weather, loyalty],
  activeChange: weather,
  projectName: 'discounts-java',
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
});
