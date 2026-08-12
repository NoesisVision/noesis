import { describe, expect, it } from 'bun:test';
import { z } from 'zod';
import { createSearchApp } from '../../src/ui/search/search.routes.js';
import {
  SearchService,
  searchResultSchema,
} from '../../src/ui/search/search.service.js';

const responseSchema = z.object({ results: z.array(searchResultSchema) });

describe('ui search routes', () => {
  it('answers with an empty result list while no provider is registered', async () => {
    const app = createSearchApp({ searchService: new SearchService() });

    const res = await app.request('/?q=anything');

    expect(res.status).toBe(200);
    expect(responseSchema.parse(await res.json())).toEqual({ results: [] });
  });

  it('answers with an empty result list for a missing or blank query', async () => {
    const app = createSearchApp({
      searchService: new SearchService([
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
      searchService: new SearchService([
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
