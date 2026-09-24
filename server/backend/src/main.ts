// These two stay first, in this order: the guard has to be in place before any
// other module is evaluated, and bundle-cwd has to read the working directory
// before anything can change it.
import './stdout-guard';
import './bundle-cwd';
import { join } from 'node:path';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { version } from '../package.json';
import { createGraphSearch } from './adapters/graph/graph-search';
import { IndexService } from './adapters/graph/index.service';
import { SchemaService } from './adapters/graph/schema.service';
import { createMcpServer } from './adapters/mcp/mcp-server';
import { ServingTransport } from './adapters/mcp/serving-transport';
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
import { StaticAssets } from './platform/http/static-assets';
import {
  configureLogging,
  disposeLogging,
  serverLogger,
} from './platform/logging/logging';
import { ensureLadybugBinary } from './platform/native/ensure-ladybug';

// Boot is in two halves. This one is the MCP surface and costs milliseconds,
// because on the modern era the SDK spawns a throwaway sibling process from
// the same command to probe the protocol, and that process must not pay for a
// session it will never serve.

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

const changesRepository = new NoesisChangesRepository(noesis);
const designDocsRepository = new NoesisDesignDocsRepository(noesis);
const documentsRepository = new NoesisDocumentsRepository(noesis);
const changesService = new ChangesService(
  changesRepository,
  designDocsRepository,
  documentsRepository,
);
const designDocsService = new DesignDocsService(
  designDocsRepository,
  changesService,
);
const documentsService = new DocumentsService(
  documentsRepository,
  changesService,
);

// `serveStdio` owns the transport and the era negotiation: the opening
// exchange picks the protocol revision and pins one server to it for the
// connection. The transport is ours only so that the first message that is
// not `server/discover` can start the other half.
const mcp = serveStdio(
  () =>
    createMcpServer({
      version,
      noesis,
      session,
      changesService,
      designDocsService,
      documentsService,
    }),
  {
    transport: new ServingTransport(() => startGraphAndUi()),
    onerror: (error) => {
      log.error('the MCP transport reported {error}', { error: String(error) });
    },
  },
);
// The handle reports no end of stdin, which is what ends the session.
process.stdin.once('end', () => {
  log.info('MCP stream closed — shutting down');
  void shutdown();
});
log.info('MCP server serving on stdio');

interface GraphAndUi {
  watcher: NoesisWatcher;
  db: DatabaseService;
  server: ReturnType<typeof Bun.serve>;
}

// Declared before the first `startGraphAndUi()` call, which a terminal on
// stdin makes during module evaluation.
let graphAndUi: Promise<GraphAndUi | null> | undefined;
let shuttingDown = false;

// A terminal on stdin means nobody is speaking MCP — `bun run dev`, or the bin
// started by hand — and the page is the whole point of that run.
if (process.stdin.isTTY) startGraphAndUi();

/**
 * The heavy half: the database, the graph index, the watcher and the page.
 * Nothing waits on it — both tools run on the file repositories alone — so a
 * session's first request is answered while this comes up behind it, and a
 * failure here leaves the tools serving rather than killing the session.
 */
function startGraphAndUi(): void {
  if (shuttingDown) return;
  graphAndUi ??= openGraphAndUi().catch((error) => {
    log.error('the graph and ui half did not start: {error}', {
      error: String(error),
    });
    return null;
  });
}

async function openGraphAndUi(): Promise<GraphAndUi> {
  ensureLadybugBinary();
  const db = new DatabaseService();
  await db.init();
  await new SchemaService(db).ensureSchema();

  const indexer = new IndexService(db, {
    changes: changesRepository,
    designDocs: designDocsRepository,
    documents: documentsRepository,
    systemModels: createSystemModelStore(noesis),
  });
  // Watching before the first build: a file that changes during the build then
  // queues a second one, instead of slipping through the gap.
  const watcher = new NoesisWatcher(noesis, () => indexer.rebuild());
  watcher.start();
  await indexer.rebuild();

  const app = createApp({
    searchService: new SearchService([createGraphSearch(db)]),
    changesService,
    designDocsService,
    documentsService,
  });

  const ui = new StaticAssets(uiDirectory());
  if (!(await ui.exists())) {
    log.warn('no built page in {path}; run the build or use `bun run dev`', {
      path: uiDirectory(),
    });
  }

  // Bun matches routes by specificity, so `/ui/*` beats `/*` and a surface 404
  // is never swallowed by the page.
  const server = Bun.serve({
    port: config.port,
    hostname: '127.0.0.1',
    routes: {
      '/ui/*': app.fetch,
      '/internal/*': app.fetch,
      // A built file, or the page itself: every client route renders the SPA,
      // which then reads the path it was opened at.
      '/*': (request: Request) => ui.respond(request),
    },
    fetch: app.fetch,
  });
  const url = `http://localhost:${server.port}/`;
  // The e2e specs and a person alike find the UI by this line.
  log.info('listening on {url}', { url });
  if (config.openBrowser) openBrowser(url);
  return { watcher, db, server };
}

/**
 * The SPA is built by vite, not bundled into this file: that is what keeps
 * each mermaid diagram kind a chunk of its own, fetched when a document needs
 * it. In a bundle the built page sits beside it; from source it is the
 * frontend's own output.
 */
function uiDirectory(): string {
  return production
    ? join(import.meta.dir, 'ui')
    : join(import.meta.dir, '../../frontend/dist');
}

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

// The database closes last, deterministically, to release its native handles.
async function shutdown(exitCode = 0): Promise<void> {
  // Two `db.close()` calls racing on one native handle is undefined behaviour.
  if (shuttingDown) return;
  shuttingDown = true;
  // The heavy half may still be coming up; let it finish, or nothing here
  // knows what is holding the database and the port.
  const half = graphAndUi === undefined ? null : await graphAndUi;
  half?.watcher.close();
  try {
    await mcp.close();
    await half?.server.stop();
    await session.dispose();
  } catch (error) {
    log.error('shutdown failed before the database closed: {error}', {
      error: String(error),
    });
  } finally {
    await half?.db.close();
  }
  await disposeLogging();
  process.exit(exitCode);
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP'] as const) {
  process.on(signal, () => void shutdown());
}

// Nothing in the process is trusted after either of these, so the session
// ends — but through `shutdown()`, so `.noesis/logs/` says why and the
// database still closes.
process.on('uncaughtException', (error) => crashed('exception', error));
process.on('unhandledRejection', (reason) => crashed('rejection', reason));

function crashed(kind: 'exception' | 'rejection', error: unknown): void {
  log.fatal('unhandled {kind}: {error}', {
    kind,
    error: String(error),
    stack: error instanceof Error ? error.stack : undefined,
  });
  void shutdown(1);
}
