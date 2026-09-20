// stdout carries the MCP protocol: a dependency's console.log would corrupt it.
console.log = (...args: unknown[]) => console.error(...args);

// Must stay the first import: it moves the working directory to the bundle
// before the HTML import below resolves its assets.
import './bundle-cwd';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import index from '../../frontend/index.html';
import { version } from '../package.json';
import { createGraphSearch } from './adapters/graph/graph-search';
import { IndexService } from './adapters/graph/index.service';
import { SchemaService } from './adapters/graph/schema.service';
import { createMcpServer } from './adapters/mcp/mcp-server';
import { NoesisChangesRepository } from './adapters/store/changes.repository';
import { NoesisDesignDocsRepository } from './adapters/store/design-docs.repository';
import { NoesisDocumentsRepository } from './adapters/store/documents.repository';
import { createSystemModelStore } from './adapters/store/system-model.store';
import { createApp } from './app';
import { ChangesService } from './app/changes/changes.service';
import { DesignDocsService } from './app/design-docs/design-docs.service';
import { DocumentsService } from './app/information-sources/documents.service';
import { SearchService } from './app/search/search.service';
import { openBrowser } from './browser';
import { launchCwd } from './bundle-cwd';
import { loadServerConfig } from './platform/config/config';
import { DatabaseService } from './platform/database/database.service';
import { NoesisDir } from './platform/files/noesis-dir';
import { RepositoryRoot } from './platform/files/repository-root';
import { SessionDir } from './platform/files/session-dir';
import { NoesisWatcher } from './platform/files/watcher';
import {
  configureLogging,
  disposeLogging,
  serverLogger,
} from './platform/logging/logging';
import { ensureLadybugBinary } from './platform/native/ensure-ladybug';

const config = loadServerConfig();

const repositoryRoot = loadRepositoryRoot();
const noesis = new NoesisDir(repositoryRoot);
await noesis.ensureInitialized();
const production = process.env.NODE_ENV === 'production';
// Logging needs `.noesis/logs/`; failures before this point print and exit.
await configureLogging({
  logDir: noesis.logDir,
  production,
  level: config.logLevel,
});
const log = serverLogger();
log.info('knowledge graph files in {path}', { path: noesis.path });
const session = new SessionDir(noesis, repositoryRoot);
await session.open();
log.info('session scratch directory {path}', { path: session.path });

ensureLadybugBinary();
const db = new DatabaseService();
await db.init();
await new SchemaService(db).ensureSchema();

const changesRepository = new NoesisChangesRepository(noesis);
const systemModels = createSystemModelStore(noesis);
const indexer = new IndexService(db, {
  changes: changesRepository,
  systemModels,
});
// Watching before the first build: a file that changes during the build then
// queues a second one, instead of slipping through the gap.
const watcher = new NoesisWatcher(noesis, () => indexer.rebuild());
watcher.start();
await indexer.rebuild();

const changesService = new ChangesService(changesRepository);
const designDocsService = new DesignDocsService(
  new NoesisDesignDocsRepository(changesRepository),
  changesService,
);
const documentsService = new DocumentsService(
  new NoesisDocumentsRepository(changesRepository),
  changesService,
);
const searchService = new SearchService([createGraphSearch(db)]);
const app = createApp({
  searchService,
  changesService,
  designDocsService,
  documentsService,
});

// Bun matches routes by specificity, so `/ui/*` beats `/*` and a surface 404
// is never swallowed by the page.
const server = Bun.serve({
  port: config.port,
  hostname: '127.0.0.1',
  routes: {
    '/ui/*': app.fetch,
    '/internal/*': app.fetch,
    '/*': index,
  },
  fetch: app.fetch,
  // HMR stays off: its client runtime mishandles a circular import inside
  // @tanstack/router-core and the page dies with "Cannot read properties of
  // null (reading 'replaceRouteChunk')" (bun 1.3.14 and 1.4.2).
  development: !production && {
    hmr: false,
    console: true,
  },
});
const url = `http://localhost:${server.port}/`;
// The e2e specs and a person alike find the UI by this line.
log.info('listening on {url}', { url });
if (config.openBrowser) openBrowser(url);

// `serveStdio` owns the transport and the era negotiation: the opening
// exchange picks the protocol revision and pins one server to it for the
// connection.
const mcp = serveStdio(() =>
  createMcpServer({
    version,
    repositoryRoot,
    session,
    changesService,
    documentsService,
  }),
);
// The handle reports no end of stdin, which is what ends the session.
process.stdin.once('end', () => {
  log.info('MCP stream closed — shutting down');
  void shutdown();
});
log.info('MCP server serving on stdio');

function loadRepositoryRoot(): string {
  const result = new RepositoryRoot({
    root: config.root,
    cwd: launchCwd,
  }).resolve();
  if (!result.ok) {
    console.error(`[server] ${result.message}`);
    process.exit(1);
  }
  return result.root;
}

// The database closes last, deterministically, to release its native handles
// (decision D3).
let shuttingDown = false;
async function shutdown(): Promise<void> {
  // Two `db.close()` calls racing on one native handle is undefined behaviour.
  if (shuttingDown) return;
  shuttingDown = true;
  watcher.close();
  try {
    await mcp.close();
    await server.stop();
    await session.dispose();
  } catch (error) {
    log.error('shutdown failed before the database closed: {error}', {
      error: String(error),
    });
  } finally {
    await db.close();
  }
  await disposeLogging();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
