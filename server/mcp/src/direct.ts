import { AttachCounter } from '#backend/boot/attach-counter';
import { createServices } from '#backend/boot/services';
import { UiHost } from '#backend/boot/ui';
import { noesisApi } from '#mcp/backend/noesis-api';
import { serveSession } from './serve-session';
import type { Workspace } from './workspace';

/**
 * `NOESIS_NO_DAEMON=1`: the session in one process, MCP and ui together,
 * taking no lock — for sandboxes that refuse a detached spawn, and for CI.
 * The tools still forward to the `/ui` routes, served in this process.
 * Chosen explicitly, never as a fallback beside a live backend: two writers on
 * the graph is what the backend exists to prevent.
 */
export function serveDirect(version: string, workspace: Workspace): void {
  const { config, noesis } = workspace;
  const ui = new UiHost({
    config,
    services: createServices(noesis),
    version,
    instance: crypto.randomUUID(),
    attachments: new AttachCounter({ graceMs: null, onIdle: () => {} }),
  });
  serveSession({
    version,
    workspace,
    api: noesisApi(async () => {
      const { port } = await ui.listen();
      return { origin: `http://127.0.0.1:${port}`, lost: () => {} };
    }),
    onServing: () => ui.start(),
    dispose: () => ui.stop(),
  });
}
