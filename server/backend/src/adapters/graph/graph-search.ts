import type {
  SearchProvider,
  SearchResult,
} from '#backend/app/search/search.service';
import type { DatabaseService } from '#backend/platform/database/database.service';

/** Results per kind. */
const LIMIT = 10;

// No ranking beyond kind order: the agent reads the hits and decides what they
// mean.
export function createGraphSearch(db: DatabaseService): SearchProvider {
  return async (query: string): Promise<SearchResult[]> => {
    const q = query.toLowerCase();
    const results: SearchResult[] = [];
    for (const kind of KINDS) {
      const rows = await db.query<Hit>(kind.cypher, { q, limit: LIMIT });
      for (const row of rows) {
        results.push({
          type: kind.type,
          id: row.id,
          title: row.title,
          subtitle: row.subtitle || undefined,
          href: kind.href(row),
        });
      }
    }
    return results;
  };
}

interface Hit {
  id: string;
  title: string;
  subtitle: string;
  change: string;
}

interface Kind {
  type: string;
  cypher: string;
  href: (hit: Hit) => string | undefined;
}

const KINDS: Kind[] = [
  {
    type: 'design-doc',
    cypher: `MATCH (n:DesignDoc)
      WHERE lower(n.name) CONTAINS $q
      RETURN n.id AS id, n.name AS title,
        CASE WHEN n.implemented THEN 'implemented' ELSE 'draft' END AS subtitle,
        n.change AS change
      ORDER BY n.name LIMIT $limit`,
    href: (hit) => `/changes/${hit.change}/design-docs/${hit.id}`,
  },
  {
    type: 'system-model',
    cypher: `MATCH (n:SystemModel)
      WHERE lower(n.name) CONTAINS $q
      RETURN n.id AS id, n.name AS title, n.scanned_at AS subtitle, '' AS change
      ORDER BY n.name LIMIT $limit`,
    href: () => undefined,
  },
  {
    type: 'document',
    cypher: `MATCH (n:Document)
      WHERE lower(n.title) CONTAINS $q
      RETURN n.id AS id, n.title AS title, n.date AS subtitle, n.change AS change
      ORDER BY n.date DESC LIMIT $limit`,
    href: () => undefined,
  },
];
