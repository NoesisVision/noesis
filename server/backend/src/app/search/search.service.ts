import { z } from 'zod';

// Deliberately generic: the command palette, the only consumer, renders every
// entity as a titled row that may navigate somewhere.
export const searchResultSchema = z.object({
  type: z.string(),
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  href: z.string().optional(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

export type SearchProvider = (query: string) => Promise<SearchResult[]>;

export class SearchService {
  private readonly providers: SearchProvider[];

  // No provider registers yet; the endpoint ships anyway so the palette is
  // wired end to end.
  constructor(providers: SearchProvider[] = []) {
    this.providers = providers;
  }

  async search(query: string): Promise<SearchResult[]> {
    const trimmed = query.trim();
    if (trimmed === '' || this.providers.length === 0) return [];
    const batches = await Promise.all(this.providers.map((p) => p(trimmed)));
    return batches.flat();
  }
}
