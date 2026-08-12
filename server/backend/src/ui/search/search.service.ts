import { z } from 'zod';

// The shell's command palette is the only consumer today, so the result shape
// stays deliberately generic: whatever an entity is, the palette renders it as
// a titled row that may navigate somewhere. Entities keep their own richer
// representations on their own endpoints.
export const searchResultSchema = z.object({
  type: z.string(),
  id: z.string(),
  title: z.string(),
  subtitle: z.string().optional(),
  href: z.string().optional(),
});

export type SearchResult = z.infer<typeof searchResultSchema>;

// One provider per searchable entity kind. Providers are registered by the
// composition root, so this module never learns about documents, graph nodes
// or projects — they learn about it.
export type SearchProvider = (query: string) => Promise<SearchResult[]>;

export class SearchService {
  private readonly providers: SearchProvider[];

  // Empty today: no entity is searchable yet. The endpoint still ships so the
  // palette's entities group is wired end to end and gains results the moment
  // the first provider registers here.
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
