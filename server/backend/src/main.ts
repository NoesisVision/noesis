import { resolve } from 'node:path';
import { serveStatic } from 'hono/bun';
import { createApp } from './app.js';
import { ChangesRepository } from './changes/changes.repository.js';
import { ChangesService } from './changes/changes.service.js';
import { loadServerConfig } from './config/config.js';
import { DatabaseService } from './database/database.service.js';
import { DesignDocsRepository } from './design-docs/design-docs.repository.js';
import { DesignDocsService } from './design-docs/design-docs.service.js';
import { NoesisDir } from './files/noesis-dir.js';
import { resolveRepositoryRoot } from './files/repository-root.js';
import { GreetingService } from './greeting/greeting.service.js';
import { GraphIndexer } from './index/indexer.js';
import { NoesisWatcher } from './index/watcher.js';
import { SchemaService } from './schema/schema.service.js';
import { SearchService } from './ui/search/search.service.js';

// The composition root: the ONE place that constructs dependencies, decides
// which slice each surface receives, and owns their lifecycle.
const config = loadServerConfig();

// The knowledge graph files are the source of truth, under `.noesis/` at the
// root of the repository this process serves; the graph is an in-memory cache
// over them, built by the indexer at boot and kept current by the watcher
// (decision 68). Services write files only — never the graph.
const noesis = new NoesisDir(loadRepositoryRoot());
await noesis.ensure();
console.log(`[server] knowledge graph files in ${noesis.path}`);

const db = new DatabaseService();
db.init();
await new SchemaService(db).ensureSchema();

const changesRepository = new ChangesRepository(noesis);
const designDocsRepository = new DesignDocsRepository(changesRepository);
const indexer = new GraphIndexer(db, changesRepository, designDocsRepository);
// Watching before the first build: a file that changes during the build then
// queues a second one, instead of slipping through the gap.
const watcher = new NoesisWatcher(noesis, () => indexer.rebuild());
watcher.start();
await indexer.rebuild();

// No search providers yet — no entity is searchable. Providers register here
// as their entities land (documents, graph nodes).
const changesService = new ChangesService(changesRepository);
const app = createApp({
  greetingService: new GreetingService(),
  searchService: new SearchService([]),
  changesService,
  designDocsService: new DesignDocsService(
    designDocsRepository,
    changesService,
  ),
});

// Serving the built ui app (SPA at /, index.html fallback for client routes)
// is opt-in via UI_DIST_PATH — set in the production container, unset in dev
// (the ui app's own dev server serves the UI) and in tests. The route surfaces
// are excluded from the fallback so their 404s are not swallowed by the SPA.
const uiDistPath = process.env.UI_DIST_PATH
  ? resolve(process.env.UI_DIST_PATH)
  : undefined;
if (uiDistPath !== undefined) {
  // Registered after the routes in createApp, so surface endpoints win and
  // static files are only consulted for everything else.
  const surfaces = ['/ui', '/api', '/internal'];
  // `path` must be relative — hono's serveStatic strips a leading slash from
  // it (absolute paths are only honored in `root`).
  const spaIndex = serveStatic({ root: uiDistPath, path: 'index.html' });
  app.use('*', serveStatic({ root: uiDistPath }));
  app.get('*', (c, next) => {
    const path = c.req.path;
    if (surfaces.some((s) => path === s || path.startsWith(`${s}/`))) {
      return next(); // fall through to the surface's own 404
    }
    return spaIndex(c, next);
  });
}

const server = Bun.serve({
  port: Number(process.env.PORT ?? 3000),
  fetch: app.fetch,
});
console.log(`[server] listening on ${server.url}`);

function loadRepositoryRoot(): string {
  const result = resolveRepositoryRoot({
    root: config.root,
    cwd: process.cwd(),
  });
  if (!result.ok) {
    console.error(`[server] ${result.message}`);
    process.exit(1);
  }
  return result.root;
}

// Explicit shutdown (Nest's lifecycle hooks, made ours): stop watching and
// accepting requests, then close the database deterministically so its native
// handles are released (decisions 23/35).
let shuttingDown = false;
async function shutdown(): Promise<void> {
  // A second signal must not start a second teardown: two `db.close()` calls
  // racing on one native handle is undefined behaviour (decision 62's guard,
  // kept by 68).
  if (shuttingDown) return;
  shuttingDown = true;
  watcher.close();
  try {
    await server.stop();
  } catch (error) {
    console.error(
      `[server] shutdown failed before the database closed: ${String(error)}`,
    );
  } finally {
    await db.close();
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
