import { join } from 'node:path';
import type { Attachments } from '#backend/adapters/in/ui/internal.routes';
import type { UiDeps } from '#backend/adapters/in/ui/ui.routes';
import type { ServerConfig } from '#backend/platform/config/config';
import { pageBuilt, staticAssets } from '#backend/platform/http/static-assets';
import { serverLogger } from '#backend/platform/logging/server-logger';
import { createApp } from './app';
import { openBrowser } from './browser';
import { production } from './process';

const log = serverLogger('ui');

/** How long a stop waits for requests in flight before it closes them. */
const STOP_GRACE_MS = 5_000;

type UiServer = ReturnType<typeof Bun.serve>;

/** The server on its port: `port` is only unset for a unix socket, which this never binds. */
interface Bound extends Listening {
  server: UiServer;
}

/** Where the server listens, once it does. */
export interface Listening {
  /** The page's URL. */
  url: string;
  port: number;
}

export interface UiHostOptions {
  config: ServerConfig;
  services: UiDeps;
  version: string;
  instance: string;
  attachments: Attachments;
  /** True once shutdown has begun; every route then answers 503. */
  draining?: () => boolean;
}

/**
 * The page and its routes on a loopback port. A daemon awaits `listen()`,
 * since it is nothing without them; a session serving in-process calls
 * `start()` and serves its tools whether or not the page comes up.
 */
export class UiHost {
  private readonly options: UiHostOptions;
  private server: Promise<Bound> | undefined;
  private listening: UiServer | undefined;
  private stopped = false;

  constructor(options: UiHostOptions) {
    this.options = options;
  }

  /** Idempotent: the first call opens the server, later calls are no-ops. */
  start(): void {
    if (this.stopped) return;
    this.listen().catch((error: unknown) => {
      log.error('the ui did not start: {error}', { error: String(error) });
    });
  }

  /** Where the server listens; rejects when it cannot. */
  async listen(): Promise<Listening> {
    this.server ??= this.open();
    const { url, port } = await this.server;
    return { url, port };
  }

  /**
   * Waits for the requests in flight, then for nothing: whatever is still
   * open after the grace is closed. An open attach stream would otherwise
   * hold the stop forever.
   */
  async stop(): Promise<void> {
    this.stopped = true;
    const bound = await this.server?.catch(() => undefined);
    if (bound === undefined) return;
    const { server } = bound;
    const force = setTimeout(() => {
      log.warn('requests still open after {ms} ms — closing them', {
        ms: STOP_GRACE_MS,
      });
      void server.stop(true);
    }, STOP_GRACE_MS);
    await server.stop();
    clearTimeout(force);
  }

  private async open(): Promise<Bound> {
    const { config, services } = this.options;
    const app = createApp(services, {
      internal: {
        version: this.options.version,
        instance: this.options.instance,
        attachments: this.options.attachments,
        url: () => (this.listening ? urlOf(this.listening) : ''),
        keepOpen: (request) => this.listening?.timeout(request, 0),
      },
      draining: this.options.draining ?? (() => false),
    });

    const uiDirectory = this.uiDirectory();
    if (!(await pageBuilt(uiDirectory))) {
      log.warn('no built page in {path}; run the build or use `bun run dev`', {
        path: uiDirectory,
      });
    }

    const page = staticAssets(uiDirectory);
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
        '/*': page.fetch,
      },
    });
    if (server.port === undefined) throw new Error('the ui bound no port');
    this.listening = server;
    const url = urlOf(server);
    // The e2e specs and a person alike find the UI by this line.
    log.info('listening on {url}', { url });
    if (config.openBrowser) void openBrowser(url);
    return { server, url, port: server.port };
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

function urlOf(server: UiServer): string {
  return `http://localhost:${server.port}/`;
}
