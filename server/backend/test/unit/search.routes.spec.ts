import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { createSearchApp } from '#backend/adapters/in/ui/search/search.routes';
import { searchHandler, SearchResult } from '#backend/app/search/search';

const responseSchema = z.object({ results: z.array(SearchResult) });

describe('ui search routes', () => {
  it('answers with an empty result list while no provider is registered', async () => {
    const app = createSearchApp({ search: searchHandler() });

    const res = await app.request('/?q=anything');

    expect(res.status).toBe(200);
    expect(responseSchema.parse(await res.json())).toEqual({ results: [] });
  });

  it('answers with an empty result list for a missing or blank query', async () => {
    const app = createSearchApp({
      search: searchHandler([
        async () => [{ type: 'document', id: 'd1', title: 'Never returned' }],
      ]),
    });

    for (const path of ['/', '/?q=', '/?q=%20%20']) {
      const res = await app.request(path);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ results: [] });
    }
  });

  it('merges the results of every registered provider, trimmed query', async () => {
    const seen: string[] = [];
    const app = createSearchApp({
      search: searchHandler([
        async (q) => {
          seen.push(q);
          return [{ type: 'document', id: 'd1', title: 'Design doc' }];
        },
        async (q) => {
          seen.push(q);
          return [
            {
              type: 'node',
              id: 'n1',
              title: 'OrderService',
              subtitle: 'graph node',
              href: '/graph?node=n1',
            },
          ];
        },
      ]),
    });

    const res = await app.request('/?q=%20order%20');

    expect(seen).toEqual(['order', 'order']);
    expect(responseSchema.parse(await res.json()).results).toEqual([
      { type: 'document', id: 'd1', title: 'Design doc' },
      {
        type: 'node',
        id: 'n1',
        title: 'OrderService',
        subtitle: 'graph node',
        href: '/graph?node=n1',
      },
    ]);
  });
});
