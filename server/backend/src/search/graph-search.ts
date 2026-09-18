import type { DatabaseService } from '../infra/database/database.service.js';
import type {
  SearchProvider,
  SearchResult,
} from '../ui/search/search.service.js';

/** Results per kind; the palette and the tool both want a short list. */
const LIMIT = 10;

/**
 * The one search provider: a case-insensitive substring match over the
 * denormalised title and summary columns of every node table the indexer
 * fills. Deterministic data access, no ranking beyond kind order — the agent
 * reads the hits and decides what they mean (architecture, "Boundaries").
 */
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
    type: 'topic',
    cypher: `MATCH (n:Topic)
      WHERE lower(n.title) CONTAINS $q OR lower(n.short_summary) CONTAINS $q
      RETURN n.id AS id, n.title AS title, n.short_summary AS subtitle, '' AS change
      ORDER BY n.title LIMIT $limit`,
    href: () => undefined,
  },
  {
    type: 'decision',
    cypher: `MATCH (n:Decision)
      WHERE lower(n.title) CONTAINS $q
      RETURN n.id AS id, n.title AS title, n.status AS subtitle, '' AS change
      ORDER BY n.title LIMIT $limit`,
    href: () => undefined,
  },
  {
    type: 'design-doc',
    cypher: `MATCH (n:DesignDoc)
      WHERE lower(n.name) CONTAINS $q
      RETURN n.id AS id, n.name AS title, n.status AS subtitle, n.change AS change
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
    type: 'conversation',
    cypher: `MATCH (n:Conversation)
      WHERE lower(n.title) CONTAINS $q
      RETURN n.id AS id, n.title AS title, n.time AS subtitle, n.change AS change
      ORDER BY n.time DESC LIMIT $limit`,
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
