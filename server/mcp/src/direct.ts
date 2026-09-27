import { AttachCounter } from '#backend/boot/attach-counter';
import { installLifecycle } from '#backend/boot/lifecycle';
import { createServices } from '#backend/boot/services';
import { UiHost } from '#backend/boot/ui';
import { noesisApi } from '#mcp/api/noesis-api';
import { watchHost } from './host-watch';
import { serveMcp } from './serve-mcp';
import type { Workspace } from './workspace';

/**
 * `NOESIS_NO_DAEMON=1`: the session in one process, MCP and ui together,
 * taking no lock — for sandboxes that refuse a detached spawn, and for CI.
 * The tools still forward to the `/ui` routes, served in this process.
 * Chosen explicitly, never as a fallback beside a live backend: two writers on
 * the graph is what the backend exists to prevent.
 */
export function serveDirect(version: string, workspace: Workspace): void {
  const { config, noesis, session, sessionFiles } = workspace;
  const services = createServices(noesis);
  const ui = new UiHost({
    config,
    services,
    version,
    instance: crypto.randomUUID(),
    attachments: new AttachCounter({ graceMs: null, onIdle: () => {} }),
  });
  const api = noesisApi(async () => {
    await ui.listen();
    return { origin: `http://127.0.0.1:${ui.port}`, lost: () => {} };
  });
  const lifecycle = installLifecycle({ dispose: release });
  const watch = watchHost(config, lifecycle);

  const mcp = serveMcp({
    version,
    noesis,
    sessionFiles,
    api,
    onServing: () => ui.start(),
    onFirstMessage: () => watch.noticeInput(),
  });
  watch.start();

  async function release(): Promise<void> {
    watch.stop();
    await ui.stop();
    await mcp.close();
    await session.dispose();
  }
}
