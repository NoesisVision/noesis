// The Noesis service: one process per agent session, started by the agent
// host as a stdio MCP server. The same process serves the browser UI over HTTP
// on an ephemeral port (decision 68). Published to npm as @noesis-vision/noesis
// (self-contained dist/ built by `bun run build`: the server bundle plus the
// browser assets it imports through index.html); agent plugins launch it via
// bunx.
//
// stdout belongs to the MCP protocol — every log line goes to stderr. Our own
// code logs with console.error/warn; the redirect below catches anything a
// dependency prints with console.log, which would otherwise corrupt the
// stream.
console.log = (...args: unknown[]) => console.error(...args);

// Must stay the first import: it moves the working directory to the bundle
// before the HTML import below resolves its assets.
import './bundle-cwd.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import index from '../../frontend/index.html';
import { createApp } from './app.js';
import { openBrowser } from './browser.js';
import { launchCwd } from './bundle-cwd.js';
import { ChangesRepository } from './changes/changes.repository.js';
import { ChangesService } from './changes/changes.service.js';
import { loadServerConfig } from './config/config.js';
import { DatabaseService } from './database/database.service.js';
import { DesignDocsRepository } from './design-docs/design-docs.repository.js';
import { DesignDocsService } from './design-docs/design-docs.service.js';
import { NoesisDir } from './files/noesis-dir.js';
import { resolveRepositoryRoot } from './files/repository-root.js';
import { SessionDir } from './files/session-dir.js';
import { ImportService } from './imports/import.service.js';
import { GraphIndexer } from './index/indexer.js';
import { NoesisWatcher } from './index/watcher.js';
import { createMcpServer } from './mcp/mcp-server.js';
import { ensureLadybugBinary } from './native/ensure-ladybug.js';
import { ScannerService } from './scanner/scanner.service.js';
import { SchemaService } from './schema/schema.service.js';
import { createGraphSearch } from './search/graph-search.js';
import {
  ConversationsRepository,
  DocumentsRepository,
} from './sources/sources.repository.js';
import { SystemModelRepository } from './system-model/system-model.repository.js';
import { SearchService } from './ui/search/search.service.js';
import {
  DecisionsRepository,
  TopicsRepository,
} from './wiki/wiki.repository.js';

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
const conversationsRepository = new ConversationsRepository(changesRepository);
const documentsRepository = new DocumentsRepository(changesRepository);
const topicsRepository = new TopicsRepository(noesis);
const decisionsRepository = new DecisionsRepository(noesis);
const systemModelRepository = new SystemModelRepository(noesis);
const indexer = new GraphIndexer(db, {
  changes: changesRepository,
  designDocs: designDocsRepository,
  conversations: conversationsRepository,
  documents: documentsRepository,
  topics: topicsRepository,
  decisions: decisionsRepository,
  systemModels: systemModelRepository,
});
// Watching before the first build: a file that changes during the build then
// queues a second one, instead of slipping through the gap.
const watcher = new NoesisWatcher(noesis, () => indexer.rebuild());
watcher.start();
await indexer.rebuild();

const changesService = new ChangesService(changesRepository);
const designDocsService = new DesignDocsService(
  designDocsRepository,
  changesService,
);
const importService = new ImportService({
  changes: changesService,
  conversations: conversationsRepository,
  documents: documentsRepository,
  topics: topicsRepository,
  decisions: decisionsRepository,
});
// The scanner writes system-model files; the watcher indexes them like any
// other kind. It runs on demand (the scan-system-model tool), not at boot.
const scannerService = new ScannerService(noesis.root, systemModelRepository);
// One provider, over every node table the indexer fills.
const searchService = new SearchService([createGraphSearch(db)]);
const app = createApp({
  searchService,
  changesService,
  designDocsService,
});

// The browser app is the imported `index.html`: bun bundles its scripts and
// styles — on the fly when run from source, ahead of time into dist/ by
// `bun run build` — and serves them from the catch-all route, with the page
// itself answering every client-side path. The route surfaces are listed
// first; bun matches routes by specificity, so `/ui/*` beats `/*` and a
// surface 404 is never swallowed by the page.
const server = Bun.serve({
  port: config.port,
  hostname: '127.0.0.1',
  routes: {
    '/ui/*': app.fetch,
    '/internal/*': app.fetch,
    '/*': index,
  },
  fetch: app.fetch,
  // From source, bun's dev bundler rebuilds the page on the next request
  // after a change; the built bin is compiled with NODE_ENV=production and
  // serves the prebuilt assets. Hot module reload stays off: its client
  // runtime mishandles the circular import between router.js and
  // load-client.js inside @tanstack/router-core and the page dies at load
  // with "Cannot read properties of null (reading 'replaceRouteChunk')"
  // (bun 1.3.14 and 1.4.2 alike; the plain dev and production bundles are
  // fine). Refresh the browser after an edit.
  development: process.env.NODE_ENV !== 'production' && {
    hmr: false,
    console: true,
  },
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
  importService,
  searchService,
  scannerService,
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
    cwd: launchCwd,
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
