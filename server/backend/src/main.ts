// stdout carries the MCP protocol: a dependency's console.log would corrupt it.
console.log = (...args: unknown[]) => console.error(...args);

// Must stay the first import: it moves the working directory to the bundle
// before the HTML import below resolves its assets.
import './bundle-cwd';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import index from '../../frontend/index.html';
import { createGraphSearch } from './adapters/graph/graph-search';
import { IndexService } from './adapters/graph/index.service';
import { SchemaService } from './adapters/graph/schema.service';
import { ImportService } from './adapters/mcp/import.service';
import { createMcpServer } from './adapters/mcp/mcp-server';
import { ScannerService } from './adapters/scanner/scanner.service';
import { NoesisChangesRepository } from './adapters/store/changes.repository';
import { NoesisDesignDocsRepository } from './adapters/store/design-docs.repository';
import { createSystemModelStore } from './adapters/store/system-model.store';
import {
  createDecisionsStore,
  createTopicsStore,
} from './adapters/store/wiki.store';
import { createApp } from './app';
import { ChangesService } from './app/changes/changes.service';
import { DesignDocsService } from './app/design-docs/design-docs.service';
import { SearchService } from './app/search/search.service';
import { openBrowser } from './browser';
import { launchCwd } from './bundle-cwd';
import { loadServerConfig } from './platform/config/config';
import { DatabaseService } from './platform/database/database.service';
import { NoesisDir } from './platform/files/noesis-dir';
import { resolveRepositoryRoot } from './platform/files/repository-root';
import { SessionDir } from './platform/files/session-dir';
import { NoesisWatcher } from './platform/files/watcher';
import {
  configureLogging,
  disposeLogging,
  serverLogger,
} from './platform/logging/logging';
import { ensureLadybugBinary } from './platform/native/ensure-ladybug';

const config = loadServerConfig();

const noesis = new NoesisDir(loadRepositoryRoot());
await noesis.ensure();
const production = process.env.NODE_ENV === 'production';
// Logging needs `.noesis/logs/`; failures before this point print and exit.
await configureLogging({
  logDir: noesis.logDir,
  production,
  level: config.logLevel,
});
const log = serverLogger();
log.info('knowledge graph files in {path}', { path: noesis.path });
const session = new SessionDir(noesis);
await session.open();
log.info('session scratch directory {path}', { path: session.path });

ensureLadybugBinary();
const db = new DatabaseService();
await db.init();
await new SchemaService(db).ensureSchema();

const changesRepository = new NoesisChangesRepository(noesis);
const topics = createTopicsStore(noesis);
const decisions = createDecisionsStore(noesis);
const systemModels = createSystemModelStore(noesis);
const indexer = new IndexService(db, {
  changes: changesRepository,
  topics,
  decisions,
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
const importService = new ImportService({
  changes: changesService,
  changesRepository,
  topics,
  decisions,
});
const scannerService = new ScannerService(noesis.root, systemModels);
const searchService = new SearchService([createGraphSearch(db)]);
const app = createApp({
  searchService,
  changesService,
  designDocsService,
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
// The SDK's stdio transport does not report stdin's end, which is what ends
// the session.
process.stdin.once('end', () => {
  log.info('MCP stream closed — shutting down');
  void shutdown();
});
log.info('MCP server connected on stdio');

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
