import { join } from 'node:path';
import type { ServerConfig } from '#backend/platform/config/config';
import { StaticAssets } from '#backend/platform/http/static-assets';
import { serverLogger } from '#backend/platform/logging/logging';
import { createApp } from './app';
import { openBrowser } from './browser';
import { production } from './process';
import type { Services } from './services';

const log = serverLogger('ui');

type UiServer = ReturnType<typeof Bun.serve>;

export interface UiHostOptions {
  config: ServerConfig;
  services: Services;
}

/**
 * The ui half of the server: the page and its routes. Nothing waits on it —
 * the MCP tools run on the file repositories alone — so a session's first
 * request is answered while this comes up behind it, and a failure here
 * leaves the tools serving rather than killing the session.
 */
export class UiHost {
  private readonly options: UiHostOptions;
  private server: Promise<UiServer | null> | undefined;
  private stopped = false;

  constructor(options: UiHostOptions) {
    this.options = options;
  }

  /** Idempotent: the first call opens the server, later calls are no-ops. */
  start(): void {
    if (this.stopped) return;
    this.server ??= this.open().catch((error: unknown) => {
      log.error('the ui did not start: {error}', { error: String(error) });
      return null;
    });
  }

  /** Waits for a server still coming up, or nothing here knows what holds the port. */
  async stop(): Promise<void> {
    this.stopped = true;
    const server = this.server === undefined ? null : await this.server;
    await server?.stop();
  }

  private async open(): Promise<UiServer> {
    const { config, services } = this.options;
    const app = createApp(services);

    const uiDirectory = this.uiDirectory();
    const ui = new StaticAssets(uiDirectory);
    if (!(await ui.exists())) {
      log.warn('no built page in {path}; run the build or use `bun run dev`', {
        path: uiDirectory,
      });
    }

    // Bun matches routes by specificity, so `/ui/*` beats `/*` and a surface
    // 404 is never swallowed by the page.
    const server = Bun.serve({
      port: config.port,
      hostname: '127.0.0.1',
      routes: {
        '/ui/*': app.fetch,
        '/internal/*': app.fetch,
        // A built file, or the page itself: every client route renders the
        // SPA, which then reads the path it was opened at.
        '/*': (request: Request) => ui.respond(request),
      },
      fetch: app.fetch,
    });
    const url = `http://localhost:${server.port}/`;
    // The e2e specs and a person alike find the UI by this line.
    log.info('listening on {url}', { url });
    if (config.openBrowser) openBrowser(url);
    return server;
  }

  /**
   * The SPA is built by vite, not bundled into this file: that is what keeps
   * each mermaid diagram kind a chunk of its own, fetched when a document
   * needs it. In the bundle every module shares `dist/`, and the built page
   * sits beside it; from source it is the frontend's own output.
   */
  private uiDirectory(): string {
    return production
      ? join(import.meta.dir, 'ui')
      : join(import.meta.dir, '../../../frontend/dist');
  }
}
