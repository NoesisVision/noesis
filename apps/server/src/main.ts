import { resolve } from 'node:path';
import { serveStatic } from 'hono/bun';
import { createApp } from './app.js';
import { loadServerConfig } from './config/config.js';
import { DatabaseService } from './database/database.service.js';
import { GreetingService } from './greeting/greeting.service.js';
import { SchemaService } from './schema/schema.service.js';

// The composition root: the ONE place that constructs dependencies, decides
// which slice each surface receives, and owns their lifecycle.
const config = loadServerConfig();
const db = new DatabaseService(config.dataDir);
db.init();
await new SchemaService(db).ensureSchema();

const app = createApp({ greetingService: new GreetingService() });

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

// Explicit shutdown (Nest's lifecycle hooks, made ours): lbug handles left to
// GC finalizers segfault after their Database closes (decision 23), so stop
// accepting requests, then close the connection deterministically.
async function shutdown(): Promise<void> {
  await server.stop();
  await db.close();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
