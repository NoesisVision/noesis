import { z } from 'zod';
import type { Handler } from '#backend/app/handler';

// Deliberately generic: the command palette, the only consumer, renders every
// entity as a titled row that may navigate somewhere.
export const searchResultSchema = z.object({
  type: z.string(),
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  href: z.string().optional(),
});

type SearchResult = z.infer<typeof searchResultSchema>;

export type SearchProvider = (query: string) => Promise<SearchResult[]>;

export type SearchHandler = Handler<string, SearchResult[]>;

/**
 * Every provider's results for the query, trimmed, in provider order; nothing
 * for a blank query. No provider registers yet; the endpoint ships anyway so
 * the palette is wired end to end.
 */
export function searchHandler(providers: SearchProvider[] = []): SearchHandler {
  return {
    async handle(query) {
      const trimmed = query.trim();
      if (trimmed === '' || providers.length === 0) return [];
      const batches = await Promise.all(providers.map((p) => p(trimmed)));
      return batches.flat();
    },
  };
}
