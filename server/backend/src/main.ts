// The Noesis service: one process per agent session, started by the agent
// host as a stdio MCP server. The same process serves the browser UI over HTTP
// on an ephemeral port (decision 68). Published to npm as @noesis-vision/noesis
// (self-contained dist/main.js bin, built by `bun run build`); agent plugins
// launch it via bunx.
//
// stdout belongs to the MCP protocol — every log line goes to stderr. Our own
// code logs with console.error/warn; the redirect below catches anything a
// dependency prints with console.log, which would otherwise corrupt the
// stream.
console.log = (...args: unknown[]) => console.error(...args);

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { serveStatic } from 'hono/bun';
import { createApp } from './app.js';
import { openBrowser } from './browser.js';
import { ChangesRepository } from './changes/changes.repository.js';
import { ChangesService } from './changes/changes.service.js';
import { loadServerConfig } from './config/config.js';
import { DatabaseService } from './database/database.service.js';
import { DesignDocsRepository } from './design-docs/design-docs.repository.js';
import { DesignDocsService } from './design-docs/design-docs.service.js';
import { NoesisDir } from './files/noesis-dir.js';
import { resolveRepositoryRoot } from './files/repository-root.js';
import { SessionDir } from './files/session-dir.js';
import { GraphIndexer } from './index/indexer.js';
import { NoesisWatcher } from './index/watcher.js';
import { createMcpServer } from './mcp/mcp-server.js';
import { ensureLadybugBinary } from './native/ensure-ladybug.js';
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
console.error(`[server] knowledge graph files in ${noesis.path}`);
// This process's scratch directory under `.noesis/tmp/`: working files pass
// between the agent and the tools through it, and it goes when the session
// does. Stale directories left by crashed sessions are swept while opening.
const session = new SessionDir(noesis);
await session.open();
console.error(`[server] session scratch directory ${session.path}`);

ensureLadybugBinary();
const db = new DatabaseService();
await db.init();
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
const designDocsService = new DesignDocsService(
  designDocsRepository,
  changesService,
);
const app = createApp({
  searchService: new SearchService([]),
  changesService,
  designDocsService,
});

// The built ui app ships inside the package (`ui/` beside `dist/`, copied
// there by `bun run build`); `UI_DIST_PATH` overrides it for development. The
// SPA is served at / with an index.html fallback for client routes; the route
// surfaces are excluded from the fallback so their 404s are not swallowed.
const uiDistPath = process.env.UI_DIST_PATH
  ? resolve(process.env.UI_DIST_PATH)
  : fileURLToPath(new URL('../ui/', import.meta.url));
if (existsSync(uiDistPath)) {
  // Registered after the routes in createApp, so surface endpoints win and
  // static files are only consulted for everything else.
  const surfaces = ['/ui', '/internal'];
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
} else {
  console.error(`[server] no ui build at ${uiDistPath} — serving routes only`);
}

const server = Bun.serve({
  port: config.port,
  hostname: '127.0.0.1',
  fetch: app.fetch,
});
const url = `http://localhost:${server.port}/`;
console.error(`[server] listening on ${url}`);
if (config.openBrowser) openBrowser(url);

// The agent's entry point: MCP over stdio, calling the same services
// in-process. When the host closes the stream the session is over, and so is
// this process — the UI lives exactly as long as the agent session.
const mcp = createMcpServer({
  repositoryRoot: noesis.root,
  session,
  changesService,
  designDocsService,
});
await mcp.connect(new StdioServerTransport());
// The SDK's transport reads stdin but does not report its end; the host
// closing the stream is what ends the session, so watch for it here.
process.stdin.once('end', () => {
  console.error('[server] MCP stream closed — shutting down');
  void shutdown();
});
console.error('[server] MCP server connected on stdio');

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
    await mcp.close();
    await server.stop();
    await session.dispose();
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
