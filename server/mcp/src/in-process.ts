import { AttachCounter } from '#backend/boot/attach-counter';
import { installLifecycle } from '#backend/boot/lifecycle';
import { createServices } from '#backend/boot/services';
import { UiHost } from '#backend/boot/ui';
import { serveMcp } from './serve-mcp';
import { openWorkspace } from './workspace';

/**
 * One session in one process, MCP on stdio and the ui together, taking no
 * lock: what a bare `noesis` runs, and what the plugin launches. Boot is in
 * two halves: the MCP surface starts at once and answers the SDK's era probe
 * in milliseconds; the ui comes up only once a session is known to be
 * served, or when a person starts the process by hand.
 */
export async function serveInProcess(version: string): Promise<void> {
  const { config, noesis, session, sessionFiles } = await openWorkspace();
  const services = createServices(noesis);
  const ui = new UiHost({
    config,
    services,
    version,
    instance: crypto.randomUUID(),
    attachments: new AttachCounter({ graceMs: null, onIdle: () => {} }),
  });
  const lifecycle = installLifecycle({ dispose: release });

  const mcp = serveMcp({
    version,
    noesis,
    sessionFiles,
    services,
    onServing: () => ui.start(),
    onStdinEnd: () => void lifecycle.shutdown(),
  });

  // A terminal on stdin means nobody is speaking MCP — the bin started by
  // hand — and the page is the whole point of that run.
  if (process.stdin.isTTY) ui.start();

  async function release(): Promise<void> {
    await ui.stop();
    await mcp.close();
    await session.dispose();
  }
}
