import { rmSync } from 'node:fs';
import { resolve } from 'node:path';
import { serveStatic } from 'hono/bun';
import { createApp } from './app.js';
import { loadServerConfig } from './config/config.js';
import { DatabaseService } from './database/database.service.js';
import { DesignDocsRepository } from './design-docs/design-docs.repository.js';
import { DesignDocsService } from './design-docs/design-docs.service.js';
import { GreetingService } from './greeting/greeting.service.js';
import { InboxRepository } from './inbox/inbox.repository.js';
import { InboxService } from './inbox/inbox.service.js';
import { SchemaService } from './schema/schema.service.js';
import { SearchService } from './ui/search/search.service.js';

// The composition root: the ONE place that constructs dependencies, decides
// which slice each surface receives, and owns their lifecycle.
const config = loadServerConfig();
const db = new DatabaseService(config.dataDir);
db.init();
await ensureSchema();

// No search providers yet — no entity is searchable. Providers register here
// as their entities land (documents, graph nodes).
const app = createApp({
  greetingService: new GreetingService(),
  searchService: new SearchService([]),
  designDocsService: new DesignDocsService(new DesignDocsRepository(db)),
  inboxService: new InboxService(new InboxRepository(db)),
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

/**
 * The schema pass is the first query of the process, and so the first thing a
 * damaged on-disk database fails — LadybugDB reports a torn write-ahead log as
 * a bare `Runtime exception` that says nothing about what to do next.
 *
 * There is no repairing it in place: the process dies on that first query,
 * restarts, and dies again, which on a platform that restarts containers is a
 * loop with no way out. `NOESIS_RECOVER_WAL=1` is the way out — it deletes the
 * log and retries once, losing the transactions written since the last
 * checkpoint. Opt-in on purpose: that loss is an operator's decision, not
 * something a server should quietly decide for itself (decision 62).
 */
async function ensureSchema(): Promise<void> {
  try {
    await new SchemaService(db).ensureSchema();
    return;
  } catch (error) {
    const wal = db.walPath;
    if (!String(error).includes('Corrupted wal file') || wal === null)
      throw error;

    console.error(
      `[server] The database in ${config.dataDir} has a torn write-ahead log: ` +
        'a previous process was killed mid-write.',
    );
    if (process.env.NOESIS_RECOVER_WAL !== '1') {
      console.error(
        `[server] Set NOESIS_RECOVER_WAL=1 to delete ${wal} on the next boot ` +
          'and carry on, losing the transactions written since the last ' +
          'checkpoint. Take a copy of the data directory first if you want one.',
      );
      throw error;
    }

    console.warn(
      `[server] NOESIS_RECOVER_WAL=1 — deleting ${wal} and retrying.`,
    );
    // Best-effort, and it must not be awaited into the failure path: closing
    // tries to checkpoint the very log that is torn, so it throws the same
    // error the recovery is here to get past. The handle is unusable either
    // way; unlinking the file out from under it is the point.
    await db.close().catch(() => undefined);
    rmSync(wal, { force: true });
    db.init();
    await new SchemaService(db).ensureSchema();
    console.warn(
      '[server] Recovered. Unset NOESIS_RECOVER_WAL so the next torn log is ' +
        'reported rather than discarded.',
    );
  }
}

// Explicit shutdown (Nest's lifecycle hooks, made ours): stop accepting
// requests, then close the database deterministically so on-disk state is
// flushed (decisions 23/35).
let shuttingDown = false;
async function shutdown(): Promise<void> {
  // A second signal must not start a second teardown. Two `db.close()` calls
  // racing on one native handle is exactly what leaves a torn write-ahead log
  // for the next boot to die on (decision 62).
  if (shuttingDown) return;
  shuttingDown = true;
  try {
    await server.stop();
  } catch (error) {
    console.error(
      `[server] shutdown failed before the database closed: ${String(error)}`,
    );
  } finally {
    // Reached on every path: an unclosed database is a corrupt one next boot.
    await db.close();
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
